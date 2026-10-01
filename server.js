const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const { initDatabase } = require('./config/database');
const { sanitizeInputs, apiLimiter } = require('./middleware/security');

// Import routes
const authRoutes = require('./routes/auth.routes');
const departmentRoutes = require('./routes/departments.routes');
const employeeRoutes = require('./routes/employees.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const vacationRoutes = require('./routes/vacations.routes');
const incidentRoutes = require('./routes/incidents.routes');
const payrollRoutes = require('./routes/payroll.routes');
const reportsRoutes = require('./routes/reports.routes');
const userRoutes = require('./routes/users.routes');
const systemRoutes = require('./routes/system.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Security & Middlewares
app.use(helmet({
    contentSecurityPolicy: false // Allow loading CDN fonts & SVGs smoothly
}));
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(sanitizeInputs);

// General rate limiter for API endpoints
app.use('/api', apiLimiter);

// Serve Static Frontend files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api', departmentRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/vacations', vacationRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/system', systemRoutes);

// Fallback for SPA routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('❌ Error no controlado en servidor:', err);
    res.status(500).json({
        success: false,
        message: 'Ocurrió un error inesperado en el servidor.',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start Server and Database
async function startServer() {
    try {
        await initDatabase();
        app.listen(PORT, () => {
            console.log(`==========================================================`);
            console.log(`🌴 SISTEMA DE GESTIÓN DE RECURSOS HUMANOS - TRÓPICO 56 🌴`);
            console.log(`🚀 Servidor ejecutándose en: http://localhost:${PORT}`);
            console.log(`👤 Usuario Admin inicial: admin / admin123`);
            console.log(`👤 Usuario Estándar: estandar / tropico123`);
            console.log(`==========================================================`);
        });
    } catch (error) {
        console.error('❌ Error crítico al iniciar servidor:', error);
        process.exit(1);
    }
}

process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('⚠️ Uncaught Exception thrown:', err);
});

startServer();
