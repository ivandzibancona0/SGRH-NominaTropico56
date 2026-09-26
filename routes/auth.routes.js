const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { verifyToken, generateToken } = require('../middleware/auth');
const { authLimiter } = require('../middleware/security');

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Por favor ingresa usuario y contraseña.'
            });
        }

        const users = await query(
            'SELECT * FROM users WHERE username = ? OR email = ? LIMIT 1',
            [username, username]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Credenciales inválidas. Verifica tu usuario y contraseña.'
            });
        }

        const user = users[0];

        if (!user.active) {
            return res.status(403).json({
                success: false,
                message: 'Tu cuenta ha sido desactivada. Consulta con el Administrador.'
            });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Credenciales inválidas. Verifica tu usuario y contraseña.'
            });
        }

        const token = generateToken({
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            email: user.email,
            role: user.role
        });

        res.json({
            success: true,
            message: `¡Bienvenido a Trópico 56, ${user.full_name}!`,
            token,
            user: {
                id: user.id,
                username: user.username,
                full_name: user.full_name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno en el servidor de autenticación.'
        });
    }
});

// GET /api/auth/profile
router.get('/profile', verifyToken, async (req, res) => {
    try {
        const users = await query('SELECT id, username, full_name, email, role, active, created_at FROM users WHERE id = ?', [req.user.id]);
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
        }
        res.json({ success: true, user: users[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al consultar perfil.' });
    }
});

// POST /api/auth/change-password
router.post('/change-password', verifyToken, async (req, res) => {
    try {
        const { current_password, new_password } = req.body;
        if (!current_password || !new_password) {
            return res.status(400).json({ success: false, message: 'Debe ingresar la contraseña actual y la nueva.' });
        }

        if (new_password.length < 6) {
            return res.status(400).json({ success: false, message: 'La nueva contraseña debe tener al menos 6 caracteres.' });
        }

        const users = await query('SELECT * FROM users WHERE id = ?', [req.user.id]);
        const user = users[0];

        const isMatch = await bcrypt.compare(current_password, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'La contraseña actual no es correcta.' });
        }

        const salt = await bcrypt.genSalt(10);
        const newHash = await bcrypt.hash(new_password, salt);

        await query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, req.user.id]);

        res.json({ success: true, message: 'Contraseña actualizada correctamente.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al cambiar contraseña.' });
    }
});

module.exports = router;
