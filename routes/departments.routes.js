const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verifyToken, requireAdmin } = require('../middleware/auth');

// GET /api/departments - list all departments with employee and position counts
router.get('/departments', verifyToken, async (req, res) => {
    try {
        const departments = await query(`
            SELECT 
                d.id, d.name, d.description, d.created_at,
                COUNT(DISTINCT p.id) as positions_count,
                COUNT(DISTINCT e.id) as employees_count
            FROM departments d
            LEFT JOIN positions p ON p.department_id = d.id
            LEFT JOIN employees e ON e.department_id = d.id AND e.status = 'active'
            GROUP BY d.id, d.name, d.description, d.created_at
            ORDER BY d.name ASC
        `);
        res.json({ success: true, data: departments });
    } catch (error) {
        console.error('Error al obtener departamentos:', error);
        res.status(500).json({ success: false, message: 'Error al consultar departamentos.' });
    }
});

// POST /api/departments - create department
router.post('/departments', verifyToken, async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'El nombre del departamento es obligatorio.' });
        }

        const existing = await query('SELECT id FROM departments WHERE name = ?', [name.trim()]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'Ya existe un departamento con ese nombre.' });
        }

        const result = await query('INSERT INTO departments (name, description) VALUES (?, ?)', [name.trim(), description || '']);
        res.status(201).json({ success: true, message: 'Departamento creado con éxito.', id: result.insertId });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al crear departamento.' });
    }
});

// PUT /api/departments/:id
router.put('/departments/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'El nombre del departamento es obligatorio.' });
        }

        const existing = await query('SELECT id FROM departments WHERE name = ? AND id != ?', [name.trim(), id]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'Ya existe otro departamento con ese nombre.' });
        }

        await query('UPDATE departments SET name = ?, description = ? WHERE id = ?', [name.trim(), description || '', id]);
        res.json({ success: true, message: 'Departamento actualizado correctamente.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al actualizar departamento.' });
    }
});

// DELETE /api/departments/:id
router.delete('/departments/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const empCount = await query('SELECT COUNT(*) as count FROM employees WHERE department_id = ?', [id]);
        if (empCount[0]?.count > 0) {
            return res.status(400).json({
                success: false,
                message: `No se puede eliminar el departamento porque tiene ${empCount[0].count} empleado(s) asignado(s).`
            });
        }

        await query('DELETE FROM positions WHERE department_id = ?', [id]);
        await query('DELETE FROM departments WHERE id = ?', [id]);
        res.json({ success: true, message: 'Departamento eliminado correctamente.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al eliminar departamento.' });
    }
});

// -------------------------------------------------------------
// POSITIONS (PUESTOS)
// -------------------------------------------------------------

// GET /api/positions - list all positions with department info
router.get('/positions', verifyToken, async (req, res) => {
    try {
        const positions = await query(`
            SELECT 
                p.id, p.department_id, p.name, p.base_daily_salary, p.description, p.active, p.created_at,
                d.name as department_name,
                COUNT(e.id) as employees_count
            FROM positions p
            JOIN departments d ON d.id = p.department_id
            LEFT JOIN employees e ON e.position_id = p.id AND e.status = 'active'
            GROUP BY p.id, p.department_id, p.name, p.base_daily_salary, p.description, p.active, p.created_at, d.name
            ORDER BY d.name ASC, p.name ASC
        `);
        res.json({ success: true, data: positions });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al consultar puestos.' });
    }
});

// POST /api/positions - create position
router.post('/positions', verifyToken, async (req, res) => {
    try {
        const { department_id, name, base_daily_salary, description, active } = req.body;
        if (!department_id || !name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Departamento y nombre de puesto son obligatorios.' });
        }

        const salary = parseFloat(base_daily_salary) || 0;
        const result = await query(
            'INSERT INTO positions (department_id, name, base_daily_salary, description, active) VALUES (?, ?, ?, ?, ?)',
            [department_id, name.trim(), salary, description || '', active !== undefined ? active : 1]
        );

        res.status(201).json({ success: true, message: 'Puesto creado con éxito.', id: result.insertId });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al crear puesto.' });
    }
});

// PUT /api/positions/:id
router.put('/positions/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { department_id, name, base_daily_salary, description, active } = req.body;
        if (!department_id || !name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Departamento y nombre de puesto son obligatorios.' });
        }

        const salary = parseFloat(base_daily_salary) || 0;
        await query(
            'UPDATE positions SET department_id = ?, name = ?, base_daily_salary = ?, description = ?, active = ? WHERE id = ?',
            [department_id, name.trim(), salary, description || '', active !== undefined ? active : 1, id]
        );

        res.json({ success: true, message: 'Puesto actualizado correctamente.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al actualizar puesto.' });
    }
});

// DELETE /api/positions/:id
router.delete('/positions/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const empCount = await query('SELECT COUNT(*) as count FROM employees WHERE position_id = ?', [id]);
        if (empCount[0]?.count > 0) {
            return res.status(400).json({
                success: false,
                message: `No se puede eliminar el puesto porque tiene ${empCount[0].count} empleado(s) asignado(s). Puedes desactivarlo en su lugar.`
            });
        }

        await query('DELETE FROM positions WHERE id = ?', [id]);
        res.json({ success: true, message: 'Puesto eliminado correctamente.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al eliminar puesto.' });
    }
});

module.exports = router;
