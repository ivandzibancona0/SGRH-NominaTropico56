const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verifyToken, requireAdmin } = require('../middleware/auth');

// Helper to compute vacation days earned based on seniority and LFT rules
async function getEarnedDaysForYears(years, lftRules) {
    if (years < 1) return 0;
    const rule = lftRules.find(r => years >= r.years_min && years <= r.years_max);
    if (rule) return rule.vacation_days;
    // Fallback: 32 days for > 35 years
    return 32;
}

// GET /api/vacations/lft-rules - get LFT vacation tabulation
router.get('/lft-rules', verifyToken, async (req, res) => {
    try {
        const rules = await query('SELECT * FROM lft_vacation_rules ORDER BY years_min ASC');
        res.json({ success: true, data: rules });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al consultar tabulador LFT.' });
    }
});

// PUT /api/vacations/lft-rules - update LFT vacation rules (for the popup/modal tabulator)
router.put('/lft-rules', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { rules } = req.body;
        if (!Array.isArray(rules) || rules.length === 0) {
            return res.status(400).json({ success: false, message: 'La lista de reglas del tabulador es obligatoria.' });
        }

        // Delete current and re-insert
        await query('DELETE FROM lft_vacation_rules');
        for (const r of rules) {
            await query(
                'INSERT INTO lft_vacation_rules (years_min, years_max, vacation_days) VALUES (?, ?, ?)',
                [parseInt(r.years_min), parseInt(r.years_max), parseInt(r.vacation_days)]
            );
        }

        res.json({ success: true, message: 'Tabulador de vacaciones LFT actualizado exitosamente.' });
    } catch (error) {
        console.error('Error al actualizar tabulador LFT:', error);
        res.status(500).json({ success: false, message: 'Error al actualizar el tabulador de vacaciones.' });
    }
});

// GET /api/vacations/employees-balance - list all employees with seniority, days earned, days taken and days pending
router.get('/employees-balance', verifyToken, async (req, res) => {
    try {
        const lftRules = await query('SELECT * FROM lft_vacation_rules ORDER BY years_min ASC');
        const employees = await query(`
            SELECT 
                e.id, e.code, e.first_name, e.last_name, e.hire_date, e.daily_salary, e.status, e.rest_day,
                d.name as department_name, p.name as position_name
            FROM employees e
            LEFT JOIN departments d ON d.id = e.department_id
            LEFT JOIN positions p ON p.id = e.position_id
            WHERE e.status = 'active'
            ORDER BY e.hire_date ASC
        `);

        const requests = await query(`
            SELECT employee_id, SUM(days_requested) as taken_days
            FROM vacation_requests
            WHERE status = 'approved'
            GROUP BY employee_id
        `);

        const takenMap = {};
        requests.forEach(r => {
            takenMap[r.employee_id] = r.taken_days;
        });

        const today = new Date();

        const data = employees.map(emp => {
            const hire = new Date(emp.hire_date);
            const diffTime = Math.abs(today - hire);
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            const seniorityYears = Math.floor(diffDays / 365.25);
            const seniorityMonths = Math.floor((diffDays % 365.25) / 30.4375);

            let earnedDays = 0;
            if (seniorityYears >= 1) {
                const rule = lftRules.find(r => seniorityYears >= r.years_min && seniorityYears <= r.years_max);
                earnedDays = rule ? rule.vacation_days : 32;
            }

            const takenDays = takenMap[emp.id] || 0;
            const remainingDays = Math.max(0, earnedDays - takenDays);
            const isEligible = seniorityYears >= 1;

            return {
                id: emp.id,
                code: emp.code,
                name: `${emp.first_name} ${emp.last_name}`,
                department_name: emp.department_name,
                position_name: emp.position_name,
                hire_date: emp.hire_date,
                daily_salary: emp.daily_salary,
                seniority_years: seniorityYears,
                seniority_months: seniorityMonths,
                seniority_label: `${seniorityYears} año(s) ${seniorityMonths} mes(es)`,
                is_eligible: isEligible,
                earned_days: earnedDays,
                taken_days: takenDays,
                remaining_days: remainingDays,
                rest_day: emp.rest_day || null,
                estimated_vacation_bonus: (remainingDays * emp.daily_salary * 0.25).toFixed(2)
            };
        });

        res.json({ success: true, data });
    } catch (error) {
        console.error('Error al calcular balance de vacaciones:', error);
        res.status(500).json({ success: false, message: 'Error al consultar balance de vacaciones.' });
    }
});

// GET /api/vacations/requests - list vacation requests with Infinity Scroll
router.get('/requests', verifyToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const offset = (page - 1) * limit;
        const employee_id = req.query.employee_id ? parseInt(req.query.employee_id) : null;
        const status = req.query.status || null;

        let countSql = 'SELECT COUNT(*) as total FROM vacation_requests vr JOIN employees e ON e.id = vr.employee_id WHERE 1=1';
        let dataSql = `
            SELECT 
                vr.id, vr.employee_id, vr.start_date, vr.end_date, vr.days_requested,
                vr.vacation_pay_percentage, vr.status, vr.notes, vr.created_at,
                e.code, e.first_name, e.last_name, e.daily_salary, e.hire_date,
                d.name as department_name, p.name as position_name
            FROM vacation_requests vr
            JOIN employees e ON e.id = vr.employee_id
            LEFT JOIN departments d ON d.id = e.department_id
            LEFT JOIN positions p ON p.id = e.position_id
            WHERE 1=1
        `;

        const params = [];
        const countParams = [];

        if (employee_id) {
            countSql += ' AND vr.employee_id = ?';
            dataSql += ' AND vr.employee_id = ?';
            params.push(employee_id);
            countParams.push(employee_id);
        }

        if (status) {
            countSql += ' AND vr.status = ?';
            dataSql += ' AND vr.status = ?';
            params.push(status);
            countParams.push(status);
        }

        dataSql += ' ORDER BY vr.start_date DESC, vr.id DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const totalRes = await query(countSql, countParams);
        const total = totalRes[0]?.total || 0;
        const list = await query(dataSql, params);

        res.json({
            success: true,
            data: list,
            pagination: {
                page,
                limit,
                total,
                hasMore: offset + list.length < total
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al consultar solicitudes de vacaciones.' });
    }
});

// GET /api/vacations/requests/:id - single vacation request details
router.get('/requests/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await query(`
            SELECT 
                vr.*,
                e.code, e.first_name, e.last_name, e.daily_salary, e.hire_date, e.rest_day,
                d.name as department_name, p.name as position_name
            FROM vacation_requests vr
            JOIN employees e ON e.id = vr.employee_id
            LEFT JOIN departments d ON d.id = e.department_id
            LEFT JOIN positions p ON p.id = e.position_id
            WHERE vr.id = ?
        `, [id]);

        if (result.length === 0) {
            return res.status(404).json({ success: false, message: 'Solicitud de vacaciones no encontrada.' });
        }

        res.json({ success: true, data: result[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al consultar solicitud de vacaciones.' });
    }
});

// Helper to calculate vacation days dynamically between start and end date,
// subtracting exclusively the employee's registered rest day in their file.
function calculateVacationDays(startDateStr, endDateStr, restDayName) {
    if (!startDateStr || !endDateStr) return 0;
    const [sY, sM, sD] = startDateStr.split('-').map(Number);
    const [eY, eM, eD] = endDateStr.split('-').map(Number);
    const start = new Date(sY, sM - 1, sD, 12, 0, 0);
    const end = new Date(eY, eM - 1, eD, 12, 0, 0);
    if (end < start) return 0;

    const dayMap = {
        'domingo': 0,
        'lunes': 1,
        'martes': 2,
        'miércoles': 3,
        'miercoles': 3,
        'jueves': 4,
        'viernes': 5,
        'sábado': 6,
        'sabado': 6
    };

    const cleanRest = (restDayName || '').toLowerCase().trim();
    const restDayIdx = dayMap[cleanRest] !== undefined ? dayMap[cleanRest] : null;

    let count = 0;
    let curr = new Date(start);
    while (curr <= end) {
        const dow = curr.getDay();
        if (restDayIdx === null || dow !== restDayIdx) {
            count++;
        }
        curr.setDate(curr.getDate() + 1);
    }
    return count;
}

// POST /api/vacations/requests - create vacation request
router.post('/requests', verifyToken, async (req, res) => {
    try {
        const { employee_id, start_date, end_date, days_requested, vacation_pay_percentage, notes } = req.body;

        if (!employee_id || !start_date || !end_date) {
            return res.status(400).json({ success: false, message: 'Empleado, fechas y días solicitados son obligatorios.' });
        }

        // Validación: fecha de término no puede ser inferior a fecha de inicio
        if (end_date < start_date) {
            return res.status(400).json({
                success: false,
                message: 'La fecha de fin del periodo vacacional no puede ser inferior a la fecha de inicio.'
            });
        }

        // Validación: no permitir registrar periodos en fechas pasadas
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        if (start_date < todayStr) {
            return res.status(400).json({
                success: false,
                message: 'No se pueden registrar periodos vacacionales en fechas pasadas.'
            });
        }

        // Validate employee and check remaining days
        const emp = await query('SELECT hire_date, rest_day FROM employees WHERE id = ?', [employee_id]);
        if (emp.length === 0) {
            return res.status(404).json({ success: false, message: 'Empleado no encontrado.' });
        }

        // Auto-calcular días hábiles usando el día de descanso asignado en el expediente del empleado
        const calculatedDays = calculateVacationDays(start_date, end_date, emp[0].rest_day);
        const days = calculatedDays > 0 ? calculatedDays : parseInt(days_requested);
        if (!days || days <= 0) {
            return res.status(400).json({ success: false, message: 'Los días solicitados deben ser mayores a cero.' });
        }

        const lftRules = await query('SELECT * FROM lft_vacation_rules ORDER BY years_min ASC');
        const hire = new Date(emp[0].hire_date);
        const diffDays = Math.floor((today - hire) / (1000 * 60 * 60 * 24));
        const seniorityYears = Math.floor(diffDays / 365.25);

        if (seniorityYears < 1) {
            return res.status(400).json({
                success: false,
                message: 'El empleado aún no cumple el primer año de antigüedad para tener derecho a vacaciones por LFT.'
            });
        }

        const rule = lftRules.find(r => seniorityYears >= r.years_min && seniorityYears <= r.years_max);
        const earnedDays = rule ? rule.vacation_days : 32;

        const takenRes = await query("SELECT SUM(days_requested) as taken FROM vacation_requests WHERE employee_id = ? AND status = 'approved'", [employee_id]);
        const taken = takenRes[0]?.taken || 0;
        const available = earnedDays - taken;

        if (days > available) {
            return res.status(400).json({
                success: false,
                message: `El empleado sólo tiene ${available} día(s) de vacaciones pendiente(s) disponibles.`
            });
        }

        const pct = parseFloat(vacation_pay_percentage) || 25.00;

        const result = await query(`
            INSERT INTO vacation_requests (
                employee_id, start_date, end_date, days_requested,
                vacation_pay_percentage, status, notes
            ) VALUES (?, ?, ?, ?, ?, 'approved', ?)
        `, [employee_id, start_date, end_date, days, pct, notes || '']);

        res.status(201).json({
            success: true,
            message: 'Periodo vacacional registrado y aprobado exitosamente.',
            id: result.insertId
        });
    } catch (error) {
        console.error('Error al registrar periodo vacacional:', error);
        res.status(500).json({ success: false, message: 'Error al registrar solicitud de vacaciones.' });
    }
});

// PUT /api/vacations/requests/:id - edit/correct vacation request (Admin only)
router.put('/requests/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { start_date, end_date, days_requested, vacation_pay_percentage, status, notes } = req.body;

        const currentReq = await query('SELECT * FROM vacation_requests WHERE id = ?', [id]);
        if (currentReq.length === 0) {
            return res.status(404).json({ success: false, message: 'Solicitud de vacaciones no encontrada.' });
        }
        const reqItem = currentReq[0];

        if (end_date < start_date) {
            return res.status(400).json({ success: false, message: 'La fecha de fin del periodo vacacional no puede ser inferior a la fecha de inicio.' });
        }

        // Check employee rest_day and calculate days
        const emp = await query('SELECT hire_date, rest_day FROM employees WHERE id = ?', [reqItem.employee_id]);
        const calculatedDays = calculateVacationDays(start_date, end_date, emp[0]?.rest_day);
        const days = calculatedDays > 0 ? calculatedDays : parseInt(days_requested);
        if (!days || days <= 0) {
            return res.status(400).json({ success: false, message: 'Los días solicitados deben ser mayores a cero.' });
        }
        const lftRules = await query('SELECT * FROM lft_vacation_rules ORDER BY years_min ASC');
        const hire = new Date(emp[0].hire_date);
        const today = new Date();
        const diffDays = Math.floor((today - hire) / (1000 * 60 * 60 * 24));
        const seniorityYears = Math.floor(diffDays / 365.25);
        const rule = lftRules.find(r => seniorityYears >= r.years_min && seniorityYears <= r.years_max);
        const earnedDays = rule ? rule.vacation_days : 32;

        const takenRes = await query("SELECT SUM(days_requested) as taken FROM vacation_requests WHERE employee_id = ? AND status = 'approved' AND id != ?", [reqItem.employee_id, id]);
        const taken = takenRes[0]?.taken || 0;
        const available = earnedDays - taken;

        const finalStatus = status || reqItem.status;
        if (finalStatus === 'approved' && days > available) {
            return res.status(400).json({
                success: false,
                message: `El empleado sólo tiene ${available} día(s) de vacaciones disponibles.`
            });
        }

        const pct = parseFloat(vacation_pay_percentage) || 25.00;
        await query(`
            UPDATE vacation_requests SET
                start_date = ?, end_date = ?, days_requested = ?,
                vacation_pay_percentage = ?, status = ?, notes = ?
            WHERE id = ?
        `, [start_date, end_date, days, pct, finalStatus, notes !== undefined ? notes : reqItem.notes, id]);

        res.json({ success: true, message: 'Periodo vacacional corregido y actualizado exitosamente.' });
    } catch (error) {
        console.error('Error al corregir periodo vacacional:', error);
        res.status(500).json({ success: false, message: 'Error al corregir la solicitud de vacaciones.' });
    }
});

// PUT /api/vacations/requests/:id/status - approve/reject request
router.put('/requests/:id/status', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!['approved', 'pending', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Estatus inválido.' });
        }

        await query('UPDATE vacation_requests SET status = ? WHERE id = ?', [status, id]);
        res.json({ success: true, message: `Solicitud de vacaciones ${status === 'approved' ? 'aprobada' : status === 'rejected' ? 'rechazada' : 'puesta en revisión'}.` });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al cambiar estatus de solicitud.' });
    }
});

module.exports = router;
