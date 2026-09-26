const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verifyToken, requireAdmin } = require('../middleware/auth');

// GET /api/payroll - list generated payrolls with Infinity Scroll
router.get('/', verifyToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const countRes = await query('SELECT COUNT(*) as total FROM payrolls');
        const total = countRes[0]?.total || 0;

        const payrolls = await query(`
            SELECT 
                p.*,
                u.full_name as created_by_name,
                COUNT(pd.id) as employees_count
            FROM payrolls p
            LEFT JOIN users u ON u.id = p.created_by
            LEFT JOIN payroll_details pd ON pd.payroll_id = p.id
            GROUP BY p.id, u.full_name
            ORDER BY p.start_date DESC, p.id DESC
            LIMIT ? OFFSET ?
        `, [limit, offset]);

        res.json({
            success: true,
            data: payrolls,
            pagination: {
                page,
                limit,
                total,
                hasMore: offset + payrolls.length < total
            }
        });
    } catch (error) {
        console.error('Error al consultar nóminas:', error);
        res.status(500).json({ success: false, message: 'Error al consultar historial de nóminas.' });
    }
});

// GET /api/payroll/:id - get payroll details
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const payrollRes = await query('SELECT * FROM payrolls WHERE id = ?', [id]);
        if (payrollRes.length === 0) {
            return res.status(404).json({ success: false, message: 'Nómina no encontrada.' });
        }

        const details = await query(`
            SELECT 
                pd.*,
                e.code as employee_code,
                e.first_name, e.last_name, e.rfc, e.nss, e.curp,
                d.name as department_name,
                p.name as position_name
            FROM payroll_details pd
            JOIN employees e ON e.id = pd.employee_id
            LEFT JOIN departments d ON d.id = e.department_id
            LEFT JOIN positions p ON p.id = e.position_id
            WHERE pd.payroll_id = ?
            ORDER BY d.name ASC, e.first_name ASC
        `, [id]);

        res.json({
            success: true,
            payroll: payrollRes[0],
            details
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al consultar detalle de nómina.' });
    }
});

// POST /api/payroll/calculate-preview - PRE-NÓMINA MASIVA CALCULATION
router.post('/calculate-preview', verifyToken, async (req, res) => {
    try {
        const {
            period_type = 'quincenal',
            start_date,
            end_date,
            period_name,
            include_christmas_bonus = false,
            employee_id = null
        } = req.body;

        let standardDays = 15;
        if (period_type === 'semanal') standardDays = 7;
        else if (period_type === 'catorcenal') standardDays = 14;
        else if (period_type === 'diario') standardDays = 1;
        else if (period_type === 'quincenal') standardDays = 15;
        else if (period_type === 'mensual') standardDays = 30;
        else {
            const startD = new Date(start_date);
            const endD = new Date(end_date);
            const diffTime = Math.abs(endD - startD);
            standardDays = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1);
        }

        let empSql = `
            SELECT 
                e.id, e.code, e.first_name, e.last_name, e.rfc, e.curp, e.nss,
                e.hire_date, e.daily_salary, e.shift,
                d.name as department_name,
                p.name as position_name
            FROM employees e
            LEFT JOIN departments d ON d.id = e.department_id
            LEFT JOIN positions p ON p.id = e.position_id
            WHERE e.status = 'active'
        `;
        const empParams = [];
        if (employee_id) {
            empSql += ' AND e.id = ?';
            empParams.push(employee_id);
        }
        empSql += ' ORDER BY d.name ASC, e.first_name ASC';

        const activeEmployees = await query(empSql, empParams);

        const previewItems = [];
        let grandTotalPerceptions = 0;
        let grandTotalDeductions = 0;
        let grandTotalNet = 0;

        for (const emp of activeEmployees) {
            const dailySalary = parseFloat(emp.daily_salary) || 0;
            const hourlyRate = dailySalary / 8;

            // 1. Attendance & Overtime in period
            const attRecords = await query(`
                SELECT 
                    status,
                    COALESCE(overtime_hours, 0) as overtime_hours,
                    COALESCE(is_holiday_worked, 0) as is_holiday_worked
                FROM attendance
                WHERE employee_id = ? AND date BETWEEN ? AND ?
            `, [emp.id, start_date, end_date]);

            let loggedDaysWorked = 0;
            let absences = 0;
            let totalOvertimeHours = 0;
            let totalHolidaysWorked = 0;

            if (attRecords.length > 0) {
                attRecords.forEach(att => {
                    if (att.status === 'present' || att.status === 'late' || att.status === 'early_departure' || att.status === 'vacation' || att.status === 'leave') {
                        loggedDaysWorked += 1;
                    } else if (att.status.includes('absence')) {
                        absences += 1;
                    }
                    totalOvertimeHours += parseFloat(att.overtime_hours) || 0;
                    if (att.is_holiday_worked) totalHolidaysWorked += 1;
                });
            } else {
                // If no daily attendance records logged, default to standard period days
                loggedDaysWorked = standardDays;
            }

            const daysWorked = Math.min(standardDays, Math.max(0, standardDays - absences));
            const baseSalaryPay = daysWorked * dailySalary;
            const overtimePay = totalOvertimeHours * (hourlyRate * 2); // Doble según LFT
            const holidayPay = totalHolidaysWorked * (dailySalary * 2); // Doble adicional según LFT

            // 2. Vacation Days & Vacation Bonus (Prima Vacacional) in period
            const vacationReqs = await query(`
                SELECT days_requested, vacation_pay_percentage 
                FROM vacation_requests 
                WHERE employee_id = ? AND status = 'approved' 
                AND ((start_date BETWEEN ? AND ?) OR (end_date BETWEEN ? AND ?))
            `, [emp.id, start_date, end_date, start_date, end_date]);

            let vacationDays = 0;
            let vacationBonus = 0;
            let vacationPay = 0;

            if (vacationReqs.length > 0) {
                vacationReqs.forEach(v => {
                    vacationDays += parseInt(v.days_requested) || 0;
                    const pct = (parseFloat(v.vacation_pay_percentage) || 25.00) / 100;
                    vacationPay += (parseInt(v.days_requested) * dailySalary);
                    vacationBonus += (parseInt(v.days_requested) * dailySalary * pct);
                });
            }

            // 3. Aguinaldo (Christmas Bonus) - full or proportional
            let christmasBonus = 0;
            if (include_christmas_bonus) {
                const hire = new Date(emp.hire_date);
                const currentYear = new Date(end_date).getFullYear();
                const yearStart = new Date(currentYear, 0, 1);
                const effectiveStart = hire > yearStart ? hire : yearStart;
                const endOfYear = new Date(currentYear, 11, 31);
                const daysWorkedInYear = Math.max(1, Math.min(365, Math.floor((endOfYear - effectiveStart) / (1000 * 60 * 60 * 24))));
                christmasBonus = (dailySalary * 15 * daysWorkedInYear) / 365;
            }

            // 4. Incidents deductions to collect
            const pendingIncidents = await query(`
                SELECT id, installment_amount, pending_amount 
                FROM incidents 
                WHERE employee_id = ? AND status IN ('pending', 'in_payroll')
            `, [emp.id]);

            let incidentDeductions = 0;
            const incidentIds = [];
            pendingIncidents.forEach(inc => {
                const deduction = Math.min(parseFloat(inc.installment_amount), parseFloat(inc.pending_amount));
                incidentDeductions += deduction;
                incidentIds.push({ id: inc.id, amount: deduction });
            });

            // 5. Default taxes and social security (0.00 by default for manual entry)
            const imssDeduction = 0;
            const isrDeduction = 0;
            const bonus = 0;
            const commissions = 0;
            const otherDeductions = 0;

            const totalPerceptions = baseSalaryPay + overtimePay + holidayPay + vacationBonus + christmasBonus + bonus + commissions;
            const totalDeductions = incidentDeductions + imssDeduction + isrDeduction + otherDeductions;
            const netPay = Math.max(0, totalPerceptions - totalDeductions);

            grandTotalPerceptions += totalPerceptions;
            grandTotalDeductions += totalDeductions;
            grandTotalNet += netPay;

            previewItems.push({
                employee_id: emp.id,
                employee_code: emp.code,
                employee_name: `${emp.first_name} ${emp.last_name}`,
                rfc: emp.rfc,
                department_name: emp.department_name,
                position_name: emp.position_name,
                daily_salary: dailySalary,
                days_worked: daysWorked,
                base_salary: parseFloat(baseSalaryPay.toFixed(2)),
                overtime_hours: totalOvertimeHours,
                overtime_pay: parseFloat(overtimePay.toFixed(2)),
                holidays_worked: totalHolidaysWorked,
                holiday_pay: parseFloat(holidayPay.toFixed(2)),
                bonus: parseFloat(bonus.toFixed(2)),
                commissions: parseFloat(commissions.toFixed(2)),
                vacation_days: vacationDays,
                vacation_pay: parseFloat(vacationPay.toFixed(2)),
                vacation_bonus: parseFloat(vacationBonus.toFixed(2)),
                christmas_bonus: parseFloat(christmasBonus.toFixed(2)),
                incident_deductions: parseFloat(incidentDeductions.toFixed(2)),
                incident_ids: incidentIds,
                tax_deductions: 0,
                social_security_deductions: 0,
                other_deductions: parseFloat(otherDeductions.toFixed(2)),
                total_perceptions: parseFloat(totalPerceptions.toFixed(2)),
                total_deductions: parseFloat(totalDeductions.toFixed(2)),
                net_pay: parseFloat(netPay.toFixed(2)),
                notes: ''
            });
        }

        res.json({
            success: true,
            summary: {
                period_name: period_name || `Nómina ${period_type.toUpperCase()} (${start_date} al ${end_date})`,
                period_type,
                start_date,
                end_date,
                employees_count: previewItems.length,
                total_perceptions: parseFloat(grandTotalPerceptions.toFixed(2)),
                total_deductions: parseFloat(grandTotalDeductions.toFixed(2)),
                net_total: parseFloat(grandTotalNet.toFixed(2))
            },
            items: previewItems
        });
    } catch (error) {
        console.error('Error al calcular pre-nómina:', error);
        res.status(500).json({ success: false, message: 'Error al procesar el cálculo de pre-nómina.' });
    }
});

// POST /api/payroll/save - SAVE & CLOSE PAYROLL (from Pre-Nómina Modal)
router.post('/save', verifyToken, async (req, res) => {
    try {
        const {
            period_type,
            period_name,
            start_date,
            end_date,
            status = 'closed',
            items
        } = req.body;

        if (!start_date || !end_date || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Datos de la nómina y lista de empleados son obligatorios.' });
        }

        let totalPerceptions = 0;
        let totalDeductions = 0;
        let netTotal = 0;

        items.forEach(it => {
            totalPerceptions += parseFloat(it.total_perceptions) || 0;
            totalDeductions += parseFloat(it.total_deductions) || 0;
            netTotal += parseFloat(it.net_pay) || 0;
        });

        // 1. Create main payroll record
        const pResult = await query(`
            INSERT INTO payrolls (
                period_type, period_name, start_date, end_date,
                status, total_perceptions, total_deductions, net_total,
                created_by, closed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            period_type || 'quincenal',
            period_name || `Nómina ${start_date} a ${end_date}`,
            start_date,
            end_date,
            status,
            totalPerceptions,
            totalDeductions,
            netTotal,
            req.user.id,
            status === 'closed' ? new Date().toISOString().replace('T', ' ').substring(0, 19) : null
        ]);

        const payrollId = pResult.insertId;

        // 2. Insert detail rows and apply incident deductions
        for (const item of items) {
            await query(`
                INSERT INTO payroll_details (
                    payroll_id, employee_id, days_worked, base_salary,
                    overtime_hours, overtime_pay, holidays_worked, holiday_pay,
                    bonus, commissions, vacation_days, vacation_pay, vacation_bonus,
                    christmas_bonus, incident_deductions, tax_deductions,
                    social_security_deductions, other_deductions, total_perceptions,
                    total_deductions, net_pay, status, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                payrollId,
                item.employee_id,
                item.days_worked || 15,
                item.base_salary || 0,
                item.overtime_hours || 0,
                item.overtime_pay || 0,
                item.holidays_worked || 0,
                item.holiday_pay || 0,
                item.bonus || 0,
                item.commissions || 0,
                item.vacation_days || 0,
                item.vacation_pay || 0,
                item.vacation_bonus || 0,
                item.christmas_bonus || 0,
                item.incident_deductions || 0,
                item.tax_deductions || 0,
                item.social_security_deductions || 0,
                item.other_deductions || 0,
                item.total_perceptions || 0,
                item.total_deductions || 0,
                item.net_pay || 0,
                'approved',
                item.notes || ''
            ]);

            // Deduct applied incidents if closed
            if (status === 'closed' && Array.isArray(item.incident_ids)) {
                for (const inc of item.incident_ids) {
                    const incData = await query('SELECT pending_amount FROM incidents WHERE id = ?', [inc.id]);
                    if (incData.length > 0) {
                        const newPending = Math.max(0, (parseFloat(incData[0].pending_amount) - parseFloat(inc.amount)));
                        const newStatus = newPending <= 0 ? 'paid' : 'in_payroll';
                        await query('UPDATE incidents SET pending_amount = ?, status = ? WHERE id = ?', [newPending, newStatus, inc.id]);
                    }
                }
            }
        }

        res.status(201).json({
            success: true,
            message: 'Nómina procesada y guardada exitosamente.',
            payroll_id: payrollId
        });
    } catch (error) {
        console.error('Error al guardar nómina:', error);
        res.status(500).json({ success: false, message: 'Error al guardar el cálculo de nómina.' });
    }
});

// GET /api/payroll/receipt/:detailId - Printable Payment Receipt
router.get('/receipt/:detailId', verifyToken, async (req, res) => {
    try {
        const { detailId } = req.params;
        const details = await query(`
            SELECT 
                pd.*,
                p.period_name, p.period_type, p.start_date as period_start, p.end_date as period_end,
                e.code as employee_code, e.first_name, e.last_name, e.rfc, e.curp, e.nss,
                e.hire_date, e.daily_salary, e.shift,
                d.name as department_name, pos.name as position_name
            FROM payroll_details pd
            JOIN payrolls p ON p.id = pd.payroll_id
            JOIN employees e ON e.id = pd.employee_id
            LEFT JOIN departments d ON d.id = e.department_id
            LEFT JOIN positions pos ON pos.id = e.position_id
            WHERE pd.id = ?
        `, [detailId]);

        if (details.length === 0) {
            return res.status(404).json({ success: false, message: 'Recibo de nómina no encontrado.' });
        }

        res.json({
            success: true,
            receipt: details[0]
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al generar recibo de nómina.' });
    }
});

module.exports = router;
