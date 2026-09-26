const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verifyToken } = require('../middleware/auth');

// GET /api/attendance/stats - attendance summary metrics
router.get('/stats', verifyToken, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const monthStart = today.substring(0, 7) + '-01';

        const todayAttendance = await query(`
            SELECT 
                COUNT(CASE WHEN status = 'present' THEN 1 END) as present_today,
                COUNT(CASE WHEN status = 'late' THEN 1 END) as late_today,
                COUNT(CASE WHEN status LIKE '%absence%' THEN 1 END) as absent_today,
                COUNT(*) as total_logged_today
            FROM attendance WHERE date = ?
        `, [today]);

        const monthlyStats = await query(`
            SELECT 
                COALESCE(SUM(overtime_hours), 0) as total_overtime_hours,
                COALESCE(SUM(CASE WHEN is_holiday_worked = 1 THEN 1 ELSE 0 END), 0) as holidays_worked
            FROM attendance WHERE date >= ?
        `, [monthStart]);

        const activeEmployees = await query("SELECT COUNT(*) as count FROM employees WHERE status = 'active'");

        res.json({
            success: true,
            data: {
                today,
                present_today: todayAttendance[0]?.present_today || 0,
                late_today: todayAttendance[0]?.late_today || 0,
                absent_today: todayAttendance[0]?.absent_today || 0,
                total_active: activeEmployees[0]?.count || 0,
                monthly_overtime_hours: parseFloat(monthlyStats[0]?.total_overtime_hours || 0),
                monthly_holidays_worked: parseInt(monthlyStats[0]?.monthly_holidays_worked || 0)
            }
        });
    } catch (error) {
        console.error('Error al obtener estadísticas de asistencia:', error);
        res.status(500).json({ success: false, message: 'Error al consultar estadísticas de asistencia.' });
    }
});

// GET /api/attendance/daily-sheet?date=YYYY-MM-DD - get all active employees with attendance for a specific date
router.get('/daily-sheet', verifyToken, async (req, res) => {
    try {
        const date = req.query.date || new Date().toISOString().split('T')[0];

        const sheet = await query(`
            SELECT 
                e.id as employee_id, e.code, e.first_name, e.last_name, e.shift,
                d.name as department_name, p.name as position_name,
                a.id as attendance_id, a.date, a.check_in, a.check_out,
                CASE 
                    WHEN a.id IS NOT NULL THEN a.status
                    WHEN vr.id IS NOT NULL THEN 'vacation'
                    ELSE ''
                END as status,
                COALESCE(a.overtime_hours, 0) as overtime_hours,
                COALESCE(a.is_holiday_worked, 0) as is_holiday_worked,
                a.notes,
                CASE WHEN vr.id IS NOT NULL THEN 1 ELSE 0 END as is_on_vacation
            FROM employees e
            LEFT JOIN departments d ON d.id = e.department_id
            LEFT JOIN positions p ON p.id = e.position_id
            LEFT JOIN attendance a ON a.employee_id = e.id AND a.date = ?
            LEFT JOIN vacation_requests vr ON vr.employee_id = e.id AND vr.status = 'approved' AND ? BETWEEN vr.start_date AND vr.end_date
            WHERE e.status = 'active'
            ORDER BY d.name ASC, e.first_name ASC
        `, [date, date]);

        res.json({
            success: true,
            date,
            data: sheet
        });
    } catch (error) {
        console.error('Error al obtener pase de lista:', error);
        res.status(500).json({ success: false, message: 'Error al obtener la lista de asistencia diaria.' });
    }
});

// POST /api/attendance/bulk - save or update daily sheet for multiple employees
router.post('/bulk', verifyToken, async (req, res) => {
    try {
        const { date, records } = req.body;
        if (!date || !Array.isArray(records) || records.length === 0) {
            return res.status(400).json({ success: false, message: 'Fecha y registros de asistencia son obligatorios.' });
        }

        for (const rec of records) {
            const { employee_id, check_in, check_out, status, overtime_hours, is_holiday_worked, notes } = rec;
            const existing = await query('SELECT id FROM attendance WHERE employee_id = ? AND date = ?', [employee_id, date]);

            const ot = parseFloat(overtime_hours) || 0;
            const holiday = is_holiday_worked ? 1 : 0;

            if (existing.length > 0) {
                await query(`
                    UPDATE attendance SET
                        check_in = ?, check_out = ?, status = ?,
                        overtime_hours = ?, is_holiday_worked = ?, notes = ?
                    WHERE id = ?
                `, [check_in || null, check_out || null, status || 'present', ot, holiday, notes || '', existing[0].id]);
            } else {
                await query(`
                    INSERT INTO attendance (
                        employee_id, date, check_in, check_out, status,
                        overtime_hours, is_holiday_worked, notes
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [employee_id, date, check_in || null, check_out || null, status || 'present', ot, holiday, notes || '']);
            }
        }

        res.json({ success: true, message: 'Asistencias del día registradas exitosamente.' });
    } catch (error) {
        console.error('Error al guardar asistencias masivas:', error);
        res.status(500).json({ success: false, message: 'Error al registrar asistencias masivas.' });
    }
});

// GET /api/attendance - list attendance history with Infinity Scroll
router.get('/', verifyToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 15;
        const offset = (page - 1) * limit;
        const employee_id = req.query.employee_id ? parseInt(req.query.employee_id) : null;
        const date = req.query.date || null;
        const start_date = req.query.start_date || null;
        const end_date = req.query.end_date || null;
        const status = req.query.status || null;

        let countSql = `
            SELECT COUNT(*) as total
            FROM attendance a
            JOIN employees e ON e.id = a.employee_id
            WHERE 1=1
        `;

        let dataSql = `
            SELECT a.*, e.first_name, e.last_name, e.code, e.shift,
                   d.name as department_name, p.name as position_name
            FROM attendance a
            JOIN employees e ON e.id = a.employee_id
            LEFT JOIN departments d ON d.id = e.department_id
            LEFT JOIN positions p ON p.id = e.position_id
            WHERE 1=1
        `;

        const params = [];
        const countParams = [];

        if (employee_id) {
            countSql += ' AND a.employee_id = ?';
            dataSql += ' AND a.employee_id = ?';
            params.push(employee_id);
            countParams.push(employee_id);
        }

        if (date) {
            countSql += ' AND a.date = ?';
            dataSql += ' AND a.date = ?';
            params.push(date);
            countParams.push(date);
        } else {
            if (start_date) {
                countSql += ' AND a.date >= ?';
                dataSql += ' AND a.date >= ?';
                params.push(start_date);
                countParams.push(start_date);
            }

            if (end_date) {
                countSql += ' AND a.date <= ?';
                dataSql += ' AND a.date <= ?';
                params.push(end_date);
                countParams.push(end_date);
            }
        }

        if (status) {
            countSql += ' AND a.status = ?';
            dataSql += ' AND a.status = ?';
            params.push(status);
            countParams.push(status);
        }

        dataSql += ' ORDER BY a.date DESC, a.id DESC LIMIT ? OFFSET ?';
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
        console.error('Error al consultar historial de asistencia:', error);
        res.status(500).json({ success: false, message: 'Error al consultar historial de asistencias.' });
    }
});

// POST /api/attendance/punch - Real-time punch clock check-in / check-out
router.post('/punch', verifyToken, async (req, res) => {
    try {
        const { employee_id, type } = req.body; // type: 'check_in' | 'check_out' | 'status'
        if (!employee_id) {
            return res.status(400).json({ success: false, message: 'ID de colaborador es obligatorio.' });
        }

        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const timeStr = `${hours}:${minutes}:${seconds}`;
        const displayTime = `${hours}:${minutes}`;

        const empRes = await query(`
            SELECT e.id, e.first_name, e.last_name, e.code, e.shift,
                   d.name as department_name, p.name as position_name
            FROM employees e
            LEFT JOIN departments d ON d.id = e.department_id
            LEFT JOIN positions p ON p.id = e.position_id
            WHERE e.id = ?
        `, [employee_id]);

        if (empRes.length === 0) {
            return res.status(404).json({ success: false, message: 'Colaborador no encontrado.' });
        }
        const emp = empRes[0];

        const existing = await query('SELECT * FROM attendance WHERE employee_id = ? AND date = ?', [employee_id, dateStr]);
        const record = existing[0] || null;

        if (type === 'check_in') {
            let status = 'present';
            // Smart tardiness detection based on shift
            if (emp.shift === 'Matutino' && (now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() > 15))) {
                status = 'late';
            }

            if (record) {
                await query('UPDATE attendance SET check_in = ?, status = ? WHERE id = ?', [timeStr, status, record.id]);
            } else {
                await query('INSERT INTO attendance (employee_id, date, check_in, status) VALUES (?, ?, ?, ?)', [employee_id, dateStr, timeStr, status]);
            }

            return res.json({
                success: true,
                type: 'check_in',
                time: displayTime,
                status,
                message: `¡Entrada registrada a las ${displayTime} hrs para ${emp.first_name} ${emp.last_name}!`
            });
        } else if (type === 'check_out') {
            let ot = 0;
            if (record && record.check_in) {
                const [inH, inM] = record.check_in.split(':').map(Number);
                const [outH, outM] = [now.getHours(), now.getMinutes()];
                const diffHours = ((outH * 60 + outM) - (inH * 60 + inM)) / 60;
                if (diffHours > 8.5) {
                    ot = Math.round((diffHours - 8) * 2) / 2; // calculate nearest 0.5 hr extra
                }
            }

            if (record) {
                await query('UPDATE attendance SET check_out = ?, overtime_hours = COALESCE(NULLIF(?, 0), overtime_hours) WHERE id = ?', [timeStr, ot, record.id]);
            } else {
                await query('INSERT INTO attendance (employee_id, date, check_out, status) VALUES (?, ?, ?, ?)', [employee_id, dateStr, timeStr, 'present']);
            }

            return res.json({
                success: true,
                type: 'check_out',
                time: displayTime,
                overtime_hours: ot,
                message: `¡Salida registrada a las ${displayTime} hrs para ${emp.first_name} ${emp.last_name}!${ot > 0 ? ` (${ot} hrs extra detectadas)` : ''}`
            });
        } else {
            // Status lookup
            return res.json({
                success: true,
                employee: emp,
                today_record: record,
                server_time: displayTime,
                server_date: dateStr
            });
        }
    } catch (error) {
        console.error('Error al procesar checada:', error);
        res.status(500).json({ success: false, message: 'Error al procesar registro en el reloj checador.' });
    }
});

// POST /api/attendance - Save or update individual attendance record
router.post('/', verifyToken, async (req, res) => {
    try {
        const { employee_id, date, check_in, check_out, status, overtime_hours, is_holiday_worked, notes } = req.body;
        if (!employee_id || !date) {
            return res.status(400).json({ success: false, message: 'Empleado y fecha son obligatorios.' });
        }

        const existing = await query('SELECT id FROM attendance WHERE employee_id = ? AND date = ?', [employee_id, date]);
        const ot = parseFloat(overtime_hours) || 0;
        const holiday = is_holiday_worked ? 1 : 0;

        if (existing.length > 0) {
            await query(`
                UPDATE attendance SET
                    check_in = ?, check_out = ?, status = ?,
                    overtime_hours = ?, is_holiday_worked = ?, notes = ?
                WHERE id = ?
            `, [check_in || null, check_out || null, status || 'present', ot, holiday, notes || '', existing[0].id]);
            res.json({ success: true, message: 'Registro de asistencia actualizado correctamente.' });
        } else {
            await query(`
                INSERT INTO attendance (
                    employee_id, date, check_in, check_out, status,
                    overtime_hours, is_holiday_worked, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [employee_id, date, check_in || null, check_out || null, status || 'present', ot, holiday, notes || '']);
            res.status(201).json({ success: true, message: 'Registro de asistencia guardado exitosamente.' });
        }
    } catch (error) {
        console.error('Error al guardar asistencia individual:', error);
        res.status(500).json({ success: false, message: 'Error al guardar asistencia individual.' });
    }
});

// PUT /api/attendance/:id - Update specific attendance record by ID
router.put('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { check_in, check_out, status, overtime_hours, is_holiday_worked, notes } = req.body;

        const ot = parseFloat(overtime_hours) || 0;
        const holiday = is_holiday_worked ? 1 : 0;

        await query(`
            UPDATE attendance SET
                check_in = ?, check_out = ?, status = ?,
                overtime_hours = ?, is_holiday_worked = ?, notes = ?
            WHERE id = ?
        `, [check_in || null, check_out || null, status || 'present', ot, holiday, notes || '', id]);

        res.json({ success: true, message: 'Registro de asistencia actualizado con éxito.' });
    } catch (error) {
        console.error('Error al actualizar registro de asistencia:', error);
        res.status(500).json({ success: false, message: 'Error al actualizar registro de asistencia.' });
    }
});

module.exports = router;
