const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verifyToken, requireAdmin } = require('../middleware/auth');

// GET /api/employees/stats/summary - dashboard stats
router.get('/stats/summary', verifyToken, async (req, res) => {
    try {
        const totalResult = await query("SELECT COUNT(*) as total FROM employees");
        const activeResult = await query("SELECT COUNT(*) as active FROM employees WHERE status = 'active'");
        const vacationResult = await query("SELECT COUNT(*) as vacation FROM employees WHERE status = 'vacation'");
        const monthlyPayrollEst = await query("SELECT SUM(daily_salary * 30) as estimated_monthly FROM employees WHERE status = 'active'");
        const deptsResult = await query("SELECT COUNT(*) as total_depts FROM departments");
        const posResult = await query("SELECT COUNT(*) as total_positions FROM positions WHERE active = 1");

        res.json({
            success: true,
            data: {
                total_employees: totalResult[0]?.total || 0,
                active_employees: activeResult[0]?.active || 0,
                on_vacation: vacationResult[0]?.vacation || 0,
                estimated_monthly_payroll: parseFloat(monthlyPayrollEst[0]?.estimated_monthly || 0),
                total_departments: deptsResult[0]?.total_depts || 0,
                total_positions: posResult[0]?.total_positions || 0
            }
        });
    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        res.status(500).json({ success: false, message: 'Error al consultar resumen de empleados.' });
    }
});

// GET /api/employees - list with Infinity Scroll pagination & filters
router.get('/', verifyToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const offset = (page - 1) * limit;
        const search = req.query.search ? `%${req.query.search.trim()}%` : null;
        const department_id = req.query.department_id ? parseInt(req.query.department_id) : null;
        const status = req.query.status || null;

        let countSql = 'SELECT COUNT(*) as total FROM employees e LEFT JOIN positions p ON p.id = e.position_id WHERE 1=1';
        let dataSql = `
            SELECT 
                e.id, e.code, e.first_name, e.last_name, e.rfc, e.curp, e.nss,
                e.email, e.phone, e.address, e.birth_date, e.hire_date,
                e.department_id, e.position_id, e.contract_type, e.daily_salary,
                e.shift, e.status, e.avatar, e.created_at,
                d.name as department_name,
                p.name as position_name
            FROM employees e
            LEFT JOIN departments d ON d.id = e.department_id
            LEFT JOIN positions p ON p.id = e.position_id
            WHERE 1=1
        `;

        const params = [];
        const countParams = [];

        if (search) {
            const condition = ` AND (
                e.first_name LIKE ? OR 
                e.last_name LIKE ? OR 
                e.code LIKE ? OR 
                e.rfc LIKE ? OR 
                e.email LIKE ? OR 
                p.name LIKE ?
            )`;
            countSql += condition;
            dataSql += condition;
            for (let i = 0; i < 6; i++) {
                params.push(search);
                countParams.push(search);
            }
        }

        if (department_id) {
            countSql += ' AND e.department_id = ?';
            dataSql += ' AND e.department_id = ?';
            params.push(department_id);
            countParams.push(department_id);
        }

        if (status) {
            countSql += ' AND e.status = ?';
            dataSql += ' AND e.status = ?';
            params.push(status);
            countParams.push(status);
        }

        dataSql += ' ORDER BY e.id DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const totalRes = await query(countSql, countParams);
        const total = totalRes[0]?.total || 0;
        const employees = await query(dataSql, params);

        const hasMore = offset + employees.length < total;

        res.json({
            success: true,
            data: employees,
            pagination: {
                page,
                limit,
                total,
                hasMore,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error al listar empleados:', error);
        res.status(500).json({ success: false, message: 'Error al consultar catálogo de empleados.' });
    }
});

// GET /api/employees/:id - single employee details
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await query(`
            SELECT 
                e.*,
                d.name as department_name,
                p.name as position_name
            FROM employees e
            LEFT JOIN departments d ON d.id = e.department_id
            LEFT JOIN positions p ON p.id = e.position_id
            WHERE e.id = ?
        `, [id]);

        if (result.length === 0) {
            return res.status(404).json({ success: false, message: 'Empleado no encontrado.' });
        }

        const employee = result[0];

        // Fetch recent incidents and vacation requests for this employee
        const incidents = await query('SELECT * FROM incidents WHERE employee_id = ? ORDER BY date DESC LIMIT 5', [id]);
        const vacations = await query('SELECT * FROM vacation_requests WHERE employee_id = ? ORDER BY start_date DESC LIMIT 5', [id]);
        const attendanceSummary = await query(`
            SELECT 
                COUNT(CASE WHEN status = 'present' THEN 1 END) as present_days,
                COUNT(CASE WHEN status = 'late' THEN 1 END) as late_days,
                COUNT(CASE WHEN status LIKE '%absence%' THEN 1 END) as absences,
                COALESCE(SUM(overtime_hours), 0) as total_overtime
            FROM attendance 
            WHERE employee_id = ?
        `, [id]);

        res.json({
            success: true,
            data: {
                ...employee,
                incidents,
                vacations,
                attendance_summary: attendanceSummary[0] || {}
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al consultar empleado.' });
    }
});

// POST /api/employees - create employee
router.post('/', verifyToken, async (req, res) => {
    try {
        const {
            code, first_name, last_name, rfc, curp, nss, email, phone,
            address, birth_date, hire_date, department_id, position_id,
            contract_type, daily_salary, shift, status
        } = req.body;

        if (!first_name || !last_name || !rfc || !hire_date || !department_id || !position_id) {
            return res.status(400).json({
                success: false,
                message: 'Nombre, apellidos, RFC, fecha de ingreso, departamento y puesto son campos obligatorios.'
            });
        }

        // Generate automatic code if not provided
        let empCode = code;
        if (!empCode || !empCode.trim()) {
            const countRes = await query('SELECT COUNT(*) as count FROM employees');
            const nextNum = (countRes[0]?.count || 0) + 1;
            empCode = `EMP-${String(nextNum).padStart(3, '0')}`;
        }

        // Check if code or RFC exists
        const checkCode = await query('SELECT id FROM employees WHERE code = ?', [empCode]);
        if (checkCode.length > 0) {
            return res.status(400).json({ success: false, message: `El código de empleado ${empCode} ya está en uso.` });
        }

        const salary = parseFloat(daily_salary) || 0;

        const result = await query(`
            INSERT INTO employees (
                code, first_name, last_name, rfc, curp, nss, email, phone,
                address, birth_date, hire_date, department_id, position_id,
                contract_type, daily_salary, shift, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            empCode, first_name.trim(), last_name.trim(), rfc.trim().toUpperCase(),
            curp ? curp.trim().toUpperCase() : null, nss ? nss.trim() : null,
            email ? email.trim().toLowerCase() : null, phone ? phone.trim() : null,
            address ? address.trim() : null, birth_date || null, hire_date,
            department_id, position_id, contract_type || 'Indeterminado',
            salary, shift || 'Matutino', status || 'active'
        ]);

        res.status(201).json({
            success: true,
            message: 'Empleado registrado exitosamente.',
            id: result.insertId,
            code: empCode
        });
    } catch (error) {
        console.error('Error al registrar empleado:', error);
        res.status(500).json({ success: false, message: 'Error al registrar el empleado.' });
    }
});

// PUT /api/employees/:id - update employee
router.put('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            code, first_name, last_name, rfc, curp, nss, email, phone,
            address, birth_date, hire_date, department_id, position_id,
            contract_type, daily_salary, shift, status
        } = req.body;

        if (!first_name || !last_name || !rfc || !hire_date || !department_id || !position_id) {
            return res.status(400).json({
                success: false,
                message: 'Nombre, apellidos, RFC, fecha de ingreso, departamento y puesto son campos obligatorios.'
            });
        }

        // Check if code is taken by another
        if (code) {
            const checkCode = await query('SELECT id FROM employees WHERE code = ? AND id != ?', [code, id]);
            if (checkCode.length > 0) {
                return res.status(400).json({ success: false, message: `El código ${code} ya está asignado a otro empleado.` });
            }
        }

        const salary = parseFloat(daily_salary) || 0;

        await query(`
            UPDATE employees SET
                code = ?, first_name = ?, last_name = ?, rfc = ?, curp = ?, nss = ?,
                email = ?, phone = ?, address = ?, birth_date = ?, hire_date = ?,
                department_id = ?, position_id = ?, contract_type = ?, daily_salary = ?,
                shift = ?, status = ?
            WHERE id = ?
        `, [
            code, first_name.trim(), last_name.trim(), rfc.trim().toUpperCase(),
            curp ? curp.trim().toUpperCase() : null, nss ? nss.trim() : null,
            email ? email.trim().toLowerCase() : null, phone ? phone.trim() : null,
            address ? address.trim() : null, birth_date || null, hire_date,
            department_id, position_id, contract_type || 'Indeterminado',
            salary, shift || 'Matutino', status || 'active', id
        ]);

        res.json({ success: true, message: 'Empleado actualizado correctamente.' });
    } catch (error) {
        console.error('Error al actualizar empleado:', error);
        res.status(500).json({ success: false, message: 'Error al actualizar información del empleado.' });
    }
});

// DELETE /api/employees/:id - deactivate or delete employee
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        // Soft delete / mark inactive
        await query("UPDATE employees SET status = 'inactive' WHERE id = ?", [id]);
        res.json({ success: true, message: 'Empleado dado de baja exitosamente.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al dar de baja al empleado.' });
    }
});

module.exports = router;
