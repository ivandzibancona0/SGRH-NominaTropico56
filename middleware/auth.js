const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'tropico56_sgrh_secret_key_2026_super_secure';

function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'] || req.headers['x-access-token'];
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    } else if (authHeader) {
        token = authHeader;
    } else if (req.query && req.query.token) {
        token = req.query.token;
    }

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Acceso no autorizado. Token no proporcionado.'
        });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Sesión expirada o token inválido. Por favor inicia sesión nuevamente.'
        });
    }
}

function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Acceso denegado. Se requieren privilegios de Administrador para realizar esta acción.'
        });
    }
    next();
}

function generateToken(payload) {
    const expiresIn = process.env.JWT_EXPIRES_IN || '24h';
    return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

module.exports = {
    verifyToken,
    requireAdmin,
    generateToken
};
