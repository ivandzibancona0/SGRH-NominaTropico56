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
                e.shift, e.entry_time, e.exit_time, e.rest_day, e.status, e.avatar, e.created_at,
                CASE WHEN e.face_descriptor IS NOT NULL AND e.face_descriptor != '' THEN 1 ELSE 0 END as has_face_enrolled,
                e.face_enrolled_at,
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

// GET /api/employees/face-descriptors - active employees with registered face vectors
router.get('/face-descriptors', verifyToken, async (req, res) => {
    try {
        const rows = await query(`
            SELECT 
                e.id, e.code, e.first_name, e.last_name, e.face_descriptor, e.face_enrolled_at,
                d.name as department_name, p.name as position_name
            FROM employees e
            LEFT JOIN departments d ON d.id = e.department_id
            LEFT JOIN positions p ON p.id = e.position_id
            WHERE e.status = 'active'
              AND e.face_descriptor IS NOT NULL
              AND e.face_descriptor != ''
            ORDER BY e.first_name ASC, e.last_name ASC
        `);

        const data = [];
        for (const row of rows) {
            try {
                const parsed = JSON.parse(row.face_descriptor);
                let descriptors = [];
                if (Array.isArray(parsed) && parsed.length > 0) {
                    if (typeof parsed[0] === 'number' && parsed.length === 128) {
                        descriptors = [parsed];
                    } else if (Array.isArray(parsed[0])) {
                        descriptors = parsed.filter(d => Array.isArray(d) && d.length === 128);
                    }
                }
                if (descriptors.length > 0) {
                    data.push({
                        id: row.id,
                        code: row.code,
                        first_name: row.first_name,
                        last_name: row.last_name,
                        department_name: row.department_name,
                        position_name: row.position_name,
                        face_enrolled_at: row.face_enrolled_at,
                        descriptors
                    });
                }
            } catch (parseErr) {
                console.warn(`Descriptor facial inválido para empleado ${row.id}:`, parseErr.message);
            }
        }

        res.json({
            success: true,
            count: data.length,
            data
        });
    } catch (error) {
        console.error('Error al consultar descriptores faciales:', error);
        res.status(500).json({ success: false, message: 'Error al obtener los descriptores biométricos.' });
    }
});

// PUT /api/employees/:id/face-descriptor - enroll or update facial descriptors (admin & standard)
router.put('/:id/face-descriptor', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { descriptors, consent } = req.body;

        if (!consent) {
            return res.status(400).json({
                success: false,
                message: 'Es obligatorio confirmar el consentimiento del colaborador para registrar datos biométricos.'
            });
        }

        const empCheck = await query('SELECT id, first_name, last_name, status FROM employees WHERE id = ?', [id]);
        if (empCheck.length === 0) {
            return res.status(404).json({ success: false, message: 'Colaborador no encontrado.' });
        }

        // Normalize single 128-vector or array of 1..5 128-vectors
        let normalized = [];
        if (Array.isArray(descriptors) && descriptors.length > 0) {
            if (typeof descriptors[0] === 'number') {
                normalized = [descriptors];
            } else if (Array.isArray(descriptors[0])) {
                normalized = descriptors;
            }
        }

        if (normalized.length === 0 || normalized.length > 5) {
            return res.status(400).json({
                success: false,
                message: 'Debe proporcionar entre 1 y 5 capturas faciales válidas.'
            });
        }

        for (const vec of normalized) {
            if (!Array.isArray(vec) || vec.length !== 128 || !vec.every(n => typeof n === 'number' && Number.isFinite(n))) {
                return res.status(400).json({
                    success: false,
                    message: 'Formato de descriptor facial inválido. Cada muestra debe contener exactamente 128 valores numéricos.'
                });
            }
        }

        const serialized = JSON.stringify(normalized);
        await query(
            'UPDATE employees SET face_descriptor = ?, face_enrolled_at = NOW() WHERE id = ?',
            [serialized, id]
        );

        res.json({
            success: true,
            message: `Registro facial guardado exitosamente para ${empCheck[0].first_name} ${empCheck[0].last_name} (${normalized.length} muestras).`,
            samples: normalized.length
        });
    } catch (error) {
        console.error('Error al guardar descriptor facial:', error);
        res.status(500).json({ success: false, message: 'Error al guardar el registro facial del colaborador.' });
    }
});

// DELETE /api/employees/:id/face-descriptor - remove biometric data (ARCO / re-enrollment)
router.delete('/:id/face-descriptor', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const empCheck = await query('SELECT id, first_name, last_name FROM employees WHERE id = ?', [id]);
        if (empCheck.length === 0) {
            return res.status(404).json({ success: false, message: 'Colaborador no encontrado.' });
        }

        await query('UPDATE employees SET face_descriptor = NULL, face_enrolled_at = NULL WHERE id = ?', [id]);

        res.json({
            success: true,
            message: `Datos biométricos eliminados correctamente para ${empCheck[0].first_name} ${empCheck[0].last_name}.`
        });
    } catch (error) {
        console.error('Error al eliminar descriptor facial:', error);
        res.status(500).json({ success: false, message: 'Error al eliminar los datos biométricos.' });
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
        const hasFaceEnrolled = Boolean(employee.face_descriptor && employee.face_descriptor.length > 0);
        delete employee.face_descriptor;

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
                has_face_enrolled: hasFaceEnrolled,
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
            contract_type, daily_salary, shift, entry_time, exit_time, rest_day, status
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
                contract_type, daily_salary, shift, entry_time, exit_time, rest_day, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            empCode, first_name.trim(), last_name.trim(), rfc.trim().toUpperCase(),
            curp ? curp.trim().toUpperCase() : null, nss ? nss.trim() : null,
            email ? email.trim().toLowerCase() : null, phone ? phone.trim() : null,
            address ? address.trim() : null, birth_date || null, hire_date,
            department_id, position_id, contract_type || 'Indeterminado',
            salary, shift || 'Matutino',
            entry_time || '09:00:00', exit_time || '17:00:00', rest_day || 'Domingo',
            status || 'active'
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
            contract_type, daily_salary, shift, entry_time, exit_time, rest_day, status
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
                shift = ?, entry_time = ?, exit_time = ?, rest_day = ?, status = ?
            WHERE id = ?
        `, [
            code, first_name.trim(), last_name.trim(), rfc.trim().toUpperCase(),
            curp ? curp.trim().toUpperCase() : null, nss ? nss.trim() : null,
            email ? email.trim().toLowerCase() : null, phone ? phone.trim() : null,
            address ? address.trim() : null, birth_date || null, hire_date,
            department_id, position_id, contract_type || 'Indeterminado',
            salary, shift || 'Matutino',
            entry_time || '09:00:00', exit_time || '17:00:00', rest_day || 'Domingo',
            status || 'active', id
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
        // Soft delete / mark inactive and clear biometric data
        await query("UPDATE employees SET status = 'inactive', face_descriptor = NULL, face_enrolled_at = NULL WHERE id = ?", [id]);
        res.json({ success: true, message: 'Empleado dado de baja exitosamente.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al dar de baja al empleado.' });
    }
});

module.exports = router;
