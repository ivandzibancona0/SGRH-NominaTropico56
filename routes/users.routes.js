const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { verifyToken, requireAdmin } = require('../middleware/auth');

// GET /api/users - list users (admin only)
router.get('/', verifyToken, requireAdmin, async (req, res) => {
    try {
        const users = await query(`
            SELECT id, username, full_name, email, role, active, created_at, updated_at
            FROM users
            ORDER BY id ASC
        `);
        res.json({ success: true, data: users });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al consultar usuarios.' });
    }
});

// POST /api/users - create new user (admin only)
router.post('/', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { username, password, full_name, email, role = 'standard', active = 1 } = req.body;

        if (!username || !password || !full_name || !email) {
            return res.status(400).json({
                success: false,
                message: 'Usuario, contraseña, nombre completo y correo electrónico son obligatorios.'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'La contraseña debe tener al menos 6 caracteres.'
            });
        }

        const validRole = ['admin', 'standard'].includes(role) ? role : 'standard';

        // Check if username or email exists
        const existing = await query('SELECT id FROM users WHERE username = ? OR email = ?', [username.trim(), email.trim()]);
        if (existing.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'El nombre de usuario o correo ya se encuentra registrado.'
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        const result = await query(`
            INSERT INTO users (username, password_hash, full_name, email, role, active)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [username.trim(), hash, full_name.trim(), email.trim(), validRole, active ? 1 : 0]);

        res.status(201).json({
            success: true,
            message: `Usuario ${username} (${validRole === 'admin' ? 'Administrador' : 'Estándar'}) creado con éxito.`,
            id: result.insertId
        });
    } catch (error) {
        console.error('Error al crear usuario:', error);
        res.status(500).json({ success: false, message: 'Error al crear usuario.' });
    }
});

// PUT /api/users/:id - update user
router.put('/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { full_name, email, role, active, password } = req.body;

        if (!full_name || !email) {
            return res.status(400).json({ success: false, message: 'Nombre completo y correo son obligatorios.' });
        }

        // Prevent admin from deactivating themselves
        if (parseInt(id) === req.user.id && active === 0) {
            return res.status(400).json({ success: false, message: 'No puedes desactivar tu propia cuenta activa.' });
        }

        const validRole = ['admin', 'standard'].includes(role) ? role : 'standard';

        if (password && password.trim().length >= 6) {
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(password.trim(), salt);
            await query(`
                UPDATE users SET
                    full_name = ?, email = ?, role = ?, active = ?, password_hash = ?
                WHERE id = ?
            `, [full_name.trim(), email.trim(), validRole, active !== undefined ? (active ? 1 : 0) : 1, hash, id]);
        } else {
            await query(`
                UPDATE users SET
                    full_name = ?, email = ?, role = ?, active = ?
                WHERE id = ?
            `, [full_name.trim(), email.trim(), validRole, active !== undefined ? (active ? 1 : 0) : 1, id]);
        }

        res.json({ success: true, message: 'Usuario actualizado correctamente.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al actualizar usuario.' });
    }
});

// DELETE /api/users/:id - delete user
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        if (parseInt(id) === req.user.id) {
            return res.status(400).json({ success: false, message: 'No puedes eliminar tu propio usuario.' });
        }

        await query('DELETE FROM users WHERE id = ?', [id]);
        res.json({ success: true, message: 'Usuario eliminado exitosamente.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al eliminar usuario.' });
    }
});

module.exports = router;
