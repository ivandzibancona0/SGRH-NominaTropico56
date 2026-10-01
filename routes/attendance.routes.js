const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verifyToken } = require('../middleware/auth');

// Helper to check if a date falls within a closed payroll period
async function getClosedPayrollForDate(dateStr) {
    if (!dateStr) return null;
    const closed = await query(
        "SELECT id, period_name, start_date, end_date FROM payrolls WHERE status = 'closed' AND ? BETWEEN start_date AND end_date LIMIT 1",
        [dateStr]
    );
    return closed.length > 0 ? closed[0] : null;
}

// GET /api/attendance/check-lock?date=YYYY-MM-DD - lightweight check for UI forms
router.get('/check-lock', verifyToken, async (req, res) => {
    try {
        const { date } = req.query;
        const closedPayroll = await getClosedPayrollForDate(date);
        res.json({
            success: true,
            is_locked: !!closedPayroll,
            closed_payroll: closedPayroll
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al verificar bloqueo de fecha.' });
    }
});

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
        const closedPayroll = await getClosedPayrollForDate(date);

        const sheet = await query(`
            SELECT 
                e.id as employee_id, e.code, e.first_name, e.last_name, e.shift,
                e.entry_time, e.exit_time, e.rest_day,
                d.name as department_name, p.name as position_name,
                a.id as attendance_id, a.date, a.check_in, a.check_out,
                CASE 
                    WHEN a.id IS NOT NULL THEN a.status
                    WHEN vr.id IS NOT NULL THEN 'vacation'
                    ELSE ''
                END as status,
                COALESCE(a.overtime_hours, 0) as overtime_hours,
                COALESCE(a.overtime_status, 'approved') as overtime_status,
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
            is_locked: !!closedPayroll,
            closed_payroll: closedPayroll,
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

        const closedPayroll = await getClosedPayrollForDate(date);
        if (closedPayroll) {
            return res.status(403).json({
                success: false,
                message: `No se puede modificar ni registrar el pase de lista: La fecha ${date} pertenece al periodo de nómina cerrado "${closedPayroll.period_name}".`
            });
        }

        for (const rec of records) {
            const { employee_id, check_in, check_out, status, overtime_hours, overtime_status, is_holiday_worked, notes } = rec;
            const existing = await query('SELECT id FROM attendance WHERE employee_id = ? AND date = ?', [employee_id, date]);

            const ot = parseFloat(overtime_hours) || 0;
            const validOtStatus = ['pending', 'approved', 'compensated', 'rejected'].includes(overtime_status) ? overtime_status : 'approved';
            const holiday = is_holiday_worked ? 1 : 0;

            if (existing.length > 0) {
                await query(`
                    UPDATE attendance SET
                        check_in = ?, check_out = ?, status = ?,
                        overtime_hours = ?, overtime_status = ?, is_holiday_worked = ?, notes = ?
                    WHERE id = ?
                `, [check_in || null, check_out || null, status || 'present', ot, validOtStatus, holiday, notes || '', existing[0].id]);
            } else {
                await query(`
                    INSERT INTO attendance (
                        employee_id, date, check_in, check_out, status,
                        overtime_hours, overtime_status, is_holiday_worked, notes
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [employee_id, date, check_in || null, check_out || null, status || 'present', ot, validOtStatus, holiday, notes || '']);
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
                   d.name as department_name, p.name as position_name,
                   (SELECT cp.period_name FROM payrolls cp WHERE cp.status = 'closed' AND a.date BETWEEN cp.start_date AND cp.end_date LIMIT 1) as closed_payroll_name
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

// Helper to convert 'HH:MM:SS' or 'HH:MM' string to seconds from midnight
function timeToSeconds(timeVal) {
    if (!timeVal) return null;
    const parts = timeVal.toString().split(':');
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    const s = parseInt(parts[2], 10) || 0;
    return h * 3600 + m * 60 + s;
}

// POST /api/attendance/punch - Real-time punch clock check-in / check-out
router.post('/punch', verifyToken, async (req, res) => {
    try {
        const { employee_id, type } = req.body; // type: 'check_in' | 'check_out' | 'status'
        if (!employee_id) {
            return res.status(400).json({ success: false, message: 'ID de colaborador es obligatorio.' });
        }

        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];

        // Bloquear checada si hoy pertenece a un periodo cerrado
        if (type === 'check_in' || type === 'check_out') {
            const closedPayroll = await getClosedPayrollForDate(dateStr);
            if (closedPayroll) {
                return res.status(403).json({
                    success: false,
                    message: `El reloj checador no puede registrar checadas: La fecha actual (${dateStr}) pertenece al periodo cerrado "${closedPayroll.period_name}".`
                });
            }
        }
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const timeStr = `${hours}:${minutes}:${seconds}`;
        const displayTime = `${hours}:${minutes}`;

        const empRes = await query(`
            SELECT e.id, e.first_name, e.last_name, e.code, e.shift,
                   e.entry_time, e.exit_time, e.rest_day,
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

        const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
        const entrySec = timeToSeconds(emp.entry_time || '09:00:00');
        const exitSec = timeToSeconds(emp.exit_time || '17:00:00');

        if (type === 'check_in') {
            // Si la hora de entrada es mayor a la hora del expediente -> Retardo
            const isLate = nowSec > entrySec;
            const status = isLate ? 'late' : 'present';

            if (record) {
                await query('UPDATE attendance SET check_in = ?, status = ? WHERE id = ?', [timeStr, status, record.id]);
            } else {
                await query('INSERT INTO attendance (employee_id, date, check_in, status) VALUES (?, ?, ?, ?)', [employee_id, dateStr, timeStr, status]);
            }

            const scheduleDisplay = emp.entry_time ? emp.entry_time.substring(0, 5) : '09:00';
            const msg = isLate 
                ? `¡Entrada registrada a las ${displayTime} hrs para ${emp.first_name} ${emp.last_name}! (Retardo detectado: Horario expediente ${scheduleDisplay})`
                : `¡Entrada a tiempo registrada a las ${displayTime} hrs para ${emp.first_name} ${emp.last_name}!`;

            return res.json({
                success: true,
                type: 'check_in',
                time: displayTime,
                status,
                is_late: isLate,
                message: msg
            });
        } else if (type === 'check_out') {
            // Si la salida es menor a la hora del expediente -> Salida anticipada
            const isEarly = nowSec < exitSec;
            let status;
            let ot = 0;
            let otStatus = 'approved';

            if (isEarly) {
                status = 'early_departure';
                ot = 0;
                otStatus = 'approved';
            } else {
                // Horas completas realizadas después de la hora de salida
                const diffSeconds = nowSec - exitSec;
                const diffMinutes = Math.floor(diffSeconds / 60);
                ot = Math.floor(diffMinutes / 60);

                if (ot > 0) {
                    otStatus = 'pending'; // Pendiente de autorización
                } else {
                    otStatus = 'approved';
                }

                // Preservar retardo de la mañana si existía
                if (record && record.status === 'late') {
                    status = 'late';
                } else {
                    status = 'present';
                }
            }

            if (record) {
                await query(`
                    UPDATE attendance SET 
                        check_out = ?, 
                        status = ?, 
                        overtime_hours = ?, 
                        overtime_status = ? 
                    WHERE id = ?
                `, [timeStr, status, ot, otStatus, record.id]);
            } else {
                await query(`
                    INSERT INTO attendance (employee_id, date, check_out, status, overtime_hours, overtime_status)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [employee_id, dateStr, timeStr, status, ot, otStatus]);
            }

            const scheduleExitDisplay = emp.exit_time ? emp.exit_time.substring(0, 5) : '17:00';
            let msg;
            if (isEarly) {
                msg = `¡Salida registrada a las ${displayTime} hrs para ${emp.first_name} ${emp.last_name}! (Salida anticipada: Horario oficial de salida ${scheduleExitDisplay})`;
            } else if (ot > 0) {
                msg = `¡Salida registrada a las ${displayTime} hrs para ${emp.first_name} ${emp.last_name}! (+${ot} hr${ot > 1 ? 's' : ''} extra completas registradas - Pendiente de Autorización)`;
            } else {
                msg = `¡Salida registrada a las ${displayTime} hrs para ${emp.first_name} ${emp.last_name}!`;
            }

            return res.json({
                success: true,
                type: 'check_out',
                time: displayTime,
                status,
                is_early: isEarly,
                overtime_hours: ot,
                overtime_status: otStatus,
                message: msg
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
        const { employee_id, date, check_in, check_out, status, overtime_hours, overtime_status, is_holiday_worked, notes } = req.body;
        if (!employee_id || !date) {
            return res.status(400).json({ success: false, message: 'Empleado y fecha son obligatorios.' });
        }

        const closedPayroll = await getClosedPayrollForDate(date);
        if (closedPayroll) {
            return res.status(403).json({
                success: false,
                message: `No se puede modificar ni registrar la asistencia: La fecha ${date} pertenece al periodo cerrado "${closedPayroll.period_name}".`
            });
        }

        const existing = await query('SELECT id FROM attendance WHERE employee_id = ? AND date = ?', [employee_id, date]);
        const ot = parseFloat(overtime_hours) || 0;
        const validOtStatus = ['pending', 'approved', 'compensated', 'rejected'].includes(overtime_status) ? overtime_status : 'approved';
        const holiday = is_holiday_worked ? 1 : 0;

        if (existing.length > 0) {
            await query(`
                UPDATE attendance SET
                    check_in = ?, check_out = ?, status = ?,
                    overtime_hours = ?, overtime_status = ?, is_holiday_worked = ?, notes = ?
                WHERE id = ?
            `, [check_in || null, check_out || null, status || 'present', ot, validOtStatus, holiday, notes || '', existing[0].id]);
            res.json({ success: true, message: 'Registro de asistencia actualizado correctamente.' });
        } else {
            await query(`
                INSERT INTO attendance (
                    employee_id, date, check_in, check_out, status,
                    overtime_hours, overtime_status, is_holiday_worked, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [employee_id, date, check_in || null, check_out || null, status || 'present', ot, validOtStatus, holiday, notes || '']);
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
        const { check_in, check_out, status, overtime_hours, overtime_status, is_holiday_worked, notes } = req.body;

        const currentRec = await query('SELECT date FROM attendance WHERE id = ?', [id]);
        if (currentRec.length === 0) {
            return res.status(404).json({ success: false, message: 'Registro de asistencia no encontrado.' });
        }

        const closedPayroll = await getClosedPayrollForDate(currentRec[0].date);
        if (closedPayroll) {
            return res.status(403).json({
                success: false,
                message: `No se puede modificar la asistencia: El registro corresponde a la fecha ${currentRec[0].date}, la cual pertenece al periodo cerrado "${closedPayroll.period_name}".`
            });
        }

        const ot = parseFloat(overtime_hours) || 0;
        const validOtStatus = ['pending', 'approved', 'compensated', 'rejected'].includes(overtime_status) ? overtime_status : 'approved';
        const holiday = is_holiday_worked ? 1 : 0;

        await query(`
            UPDATE attendance SET
                check_in = ?, check_out = ?, status = ?,
                overtime_hours = ?, overtime_status = ?, is_holiday_worked = ?, notes = ?
            WHERE id = ?
        `, [check_in || null, check_out || null, status || 'present', ot, validOtStatus, holiday, notes || '', id]);

        res.json({ success: true, message: 'Registro de asistencia actualizado con éxito.' });
    } catch (error) {
        console.error('Error al actualizar registro de asistencia:', error);
        res.status(500).json({ success: false, message: 'Error al actualizar registro de asistencia.' });
    }
});

// POST /api/attendance/:id/overtime-action - Admin approves, compensates or rejects overtime
router.post('/:id/overtime-action', verifyToken, async (req, res) => {
    try {
        if (req.user?.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Solo el usuario administrador puede autorizar o compensar horas extra.' });
        }

        const { id } = req.params;
        const { action, notes } = req.body; // action: 'approve' | 'compensate' | 'reject'

        const rec = await query('SELECT * FROM attendance WHERE id = ?', [id]);
        if (rec.length === 0) {
            return res.status(404).json({ success: false, message: 'Registro de asistencia no encontrado.' });
        }

        const item = rec[0];
        const closedPayroll = await getClosedPayrollForDate(item.date);
        if (closedPayroll) {
            return res.status(403).json({
                success: false,
                message: `No se pueden modificar ni compensar horas extra: El registro pertenece a la nómina cerrada "${closedPayroll.period_name}".`
            });
        }
        let newStatus = item.status;
        let newOtStatus = 'approved';
        let updatedNotes = item.notes ? `${item.notes}\n` : '';

        if (action === 'approve') {
            newOtStatus = 'approved';
            updatedNotes += `[${new Date().toLocaleDateString('es-MX')}] Horas extra aprobadas para pago en nómina por administrador.`;
        } else if (action === 'reject') {
            newOtStatus = 'rejected';
            updatedNotes += `[${new Date().toLocaleDateString('es-MX')}] Horas extra rechazadas/no autorizadas por administrador.`;
        } else if (action === 'compensate') {
            newOtStatus = 'compensated';
            if (item.status === 'late' || item.status === 'early_departure') {
                newStatus = 'present';
            }
            updatedNotes += `[${new Date().toLocaleDateString('es-MX')}] Horas extra aplicadas como compensación de retardo/permiso (Estatus actualizado a Presente).`;
        } else {
            return res.status(400).json({ success: false, message: 'Acción no válida. Opciones: approve, compensate, reject.' });
        }

        if (notes) {
            updatedNotes += ` Nota adicional: ${notes}`;
        }

        await query(`
            UPDATE attendance SET
                status = ?,
                overtime_status = ?,
                notes = ?
            WHERE id = ?
        `, [newStatus, newOtStatus, updatedNotes.trim(), id]);

        res.json({
            success: true,
            message: action === 'compensate' 
                ? 'Horas extra aplicadas como compensación y estatus actualizado a Presente.'
                : `Horas extra ${action === 'approve' ? 'aprobadas' : 'rechazadas'} exitosamente.`,
            status: newStatus,
            overtime_status: newOtStatus
        });
    } catch (error) {
        console.error('Error al gestionar horas extra:', error);
        res.status(500).json({ success: false, message: 'Error al gestionar horas extra.' });
    }
});

module.exports = router;
