const rateLimit = require('express-rate-limit');

// Rate limiter for authentication attempts
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // max 20 attempts per 15 minutes
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Demasiados intentos de acceso desde esta dirección IP. Por seguridad, intente más tarde.'
    }
});

// General API Rate Limiter
const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 min
    max: 200,
    standardHeaders: true,
    legacyHeaders: false
});

// Request body sanitization helper
function sanitizeInputs(req, res, next) {
    if (req.body && typeof req.body === 'object') {
        for (const key in req.body) {
            if (typeof req.body[key] === 'string') {
                // Trim and prevent raw script injection
                req.body[key] = req.body[key].trim();
            }
        }
    }
    next();
}

module.exports = {
    authLimiter,
    apiLimiter,
    sanitizeInputs
};
