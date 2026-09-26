const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verifyToken, requireAdmin } = require('../middleware/auth');

// GET /api/incidents/stats - incident summary
router.get('/stats', verifyToken, async (req, res) => {
    try {
        const stats = await query(`
            SELECT 
                COUNT(*) as total_incidents,
                COALESCE(SUM(total_amount), 0) as total_charged,
                COALESCE(SUM(pending_amount), 0) as total_pending,
                COALESCE(SUM(total_amount - pending_amount), 0) as total_collected,
                COUNT(CASE WHEN status IN ('pending', 'in_payroll') THEN 1 END) as active_incidents
            FROM incidents
        `);

        res.json({ success: true, data: stats[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al consultar métricas de incidencias.' });
    }
});

// GET /api/incidents - list with Infinity Scroll
router.get('/', verifyToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const offset = (page - 1) * limit;
        const employee_id = req.query.employee_id ? parseInt(req.query.employee_id) : null;
        const status = req.query.status || null;
        const type = req.query.type || null;

        let countSql = 'SELECT COUNT(*) as total FROM incidents i JOIN employees e ON e.id = i.employee_id WHERE 1=1';
        let dataSql = `
            SELECT 
                i.id, i.employee_id, i.date, i.type, i.description, i.total_amount,
                i.installments, i.installment_amount, i.pending_amount, i.status, i.created_at,
                e.code, e.first_name, e.last_name,
                d.name as department_name, p.name as position_name
            FROM incidents i
            JOIN employees e ON e.id = i.employee_id
            LEFT JOIN departments d ON d.id = e.department_id
            LEFT JOIN positions p ON p.id = e.position_id
            WHERE 1=1
        `;

        const params = [];
        const countParams = [];

        if (employee_id) {
            countSql += ' AND i.employee_id = ?';
            dataSql += ' AND i.employee_id = ?';
            params.push(employee_id);
            countParams.push(employee_id);
        }

        if (status) {
            countSql += ' AND i.status = ?';
            dataSql += ' AND i.status = ?';
            params.push(status);
            countParams.push(status);
        }

        if (type) {
            countSql += ' AND i.type = ?';
            dataSql += ' AND i.type = ?';
            params.push(type);
            countParams.push(type);
        }

        dataSql += ' ORDER BY i.date DESC, i.id DESC LIMIT ? OFFSET ?';
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
        console.error('Error al listar incidencias:', error);
        res.status(500).json({ success: false, message: 'Error al consultar incidencias laborales.' });
    }
});

// POST /api/incidents - create incident
router.post('/', verifyToken, async (req, res) => {
    try {
        const { employee_id, date, type, description, total_amount, installments } = req.body;

        if (!employee_id || !date || !type || !description || !total_amount) {
            return res.status(400).json({
                success: false,
                message: 'Empleado, fecha, tipo de incidencia, descripción y monto son obligatorios.'
            });
        }

        const total = parseFloat(total_amount);
        const numInstallments = parseInt(installments) || 1;
        const installmentAmount = (total / numInstallments);

        const result = await query(`
            INSERT INTO incidents (
                employee_id, date, type, description, total_amount,
                installments, installment_amount, pending_amount, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
        `, [
            employee_id, date, type, description.trim(), total,
            numInstallments, installmentAmount, total
        ]);

        res.status(201).json({
            success: true,
            message: 'Incidencia laboral registrada exitosamente.',
            id: result.insertId
        });
    } catch (error) {
        console.error('Error al registrar incidencia:', error);
        res.status(500).json({ success: false, message: 'Error al registrar incidencia laboral.' });
    }
});

// GET /api/incidents/:id - get single incident details
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const list = await query(`
            SELECT i.*, e.first_name, e.last_name, e.code, d.name as department_name, p.name as position_name
            FROM incidents i
            JOIN employees e ON e.id = i.employee_id
            LEFT JOIN departments d ON d.id = e.department_id
            LEFT JOIN positions p ON p.id = e.position_id
            WHERE i.id = ?
        `, [id]);

        if (list.length === 0) {
            return res.status(404).json({ success: false, message: 'Incidencia no encontrada.' });
        }
        res.json({ success: true, data: list[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al consultar incidencia.' });
    }
});

// PUT /api/incidents/:id - edit incident details and status
router.put('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { date, type, description, total_amount, installments, pending_amount, status } = req.body;

        const total = total_amount !== undefined ? parseFloat(total_amount) : null;
        const pending = pending_amount !== undefined ? parseFloat(pending_amount) : null;
        const inst = installments !== undefined ? parseInt(installments) : null;
        const instAmt = total && inst ? (total / inst) : null;

        await query(`
            UPDATE incidents SET
                date = COALESCE(?, date),
                type = COALESCE(?, type),
                description = COALESCE(?, description),
                total_amount = COALESCE(?, total_amount),
                installments = COALESCE(?, installments),
                installment_amount = COALESCE(?, installment_amount),
                pending_amount = COALESCE(?, pending_amount),
                status = COALESCE(?, status)
            WHERE id = ?
        `, [date, type, description, total, inst, instAmt, pending, status, id]);

        res.json({ success: true, message: 'Incidencia actualizada exitosamente.' });
    } catch (error) {
        console.error('Error al actualizar incidencia:', error);
        res.status(500).json({ success: false, message: 'Error al actualizar incidencia.' });
    }
});

// PUT /api/incidents/:id/status - update incident status
router.put('/:id/status', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, pending_amount } = req.body;

        if (!['pending', 'in_payroll', 'paid', 'cancelled'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Estatus no válido.' });
        }

        let updateSql = 'UPDATE incidents SET status = ?';
        const params = [status];

        if (pending_amount !== undefined) {
            updateSql += ', pending_amount = ?';
            params.push(parseFloat(pending_amount));
        }

        updateSql += ' WHERE id = ?';
        params.push(id);

        await query(updateSql, params);
        res.json({ success: true, message: 'Estatus de incidencia actualizado.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al actualizar estatus de la incidencia.' });
    }
});

// DELETE /api/incidents/:id
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await query('DELETE FROM incidents WHERE id = ?', [id]);
        res.json({ success: true, message: 'Incidencia eliminada exitosamente.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al eliminar incidencia.' });
    }
});

module.exports = router;
