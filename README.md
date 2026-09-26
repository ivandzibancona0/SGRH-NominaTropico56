# 🌴 Sistema de Gestión de Recursos Humanos (SGRH) - Trópico 56 🌴

![Node.js](https://img.shields.io/badge/Node.js-v16+-339933?style=flat-square&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.21.2-000000?style=flat-square&logo=express&logoColor=white)
![Database](https://img.shields.io/badge/Database-MySQL-4479A1?style=flat-square&logo=mysql&logoColor=white)
![Frontend](https://img.shields.io/badge/Frontend-Vanilla%20JS%20%26%20CSS-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![Architecture](https://img.shields.io/badge/Architecture-SPA%20Mobile--First-0ea5e9?style=flat-square)
![License](https://img.shields.io/badge/License-ISC-green?style=flat-square)

Sistema integral para la administración del capital humano, control biométrico/PIN de asistencias, gestión de incidencias y mermas operativas, cálculo avanzado de nóminas (masivas e individuales) y centro de inteligencia de reportes con exportación nativa a Microsoft Excel.

Diseñado y optimizado a la medida de la dinámica operativa de **Trópico 56**, restaurantes, bares y empresas de hospitalidad.

---

## 📑 Tabla de Contenidos

- [Características Principales](#-características-principales)
- [Arquitectura Tecnológica](#-arquitectura-tecnológica)
- [Módulos del Sistema](#-módulos-del-sistema)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Requisitos Previos](#-requisitos-previos)
- [Instalación y Puesta en Marcha](#-instalación-y-puesta-en-marcha)
- [Variables de Entorno](#-variables-de-entorno)
- [Credenciales de Acceso por Defecto](#-credenciales-de-acceso-por-defecto)
- [Seguridad, Respaldos y Mantenimiento](#-seguridad-respaldos-y-mantenimiento)
- [Licencia](#-licencia)

---

## 🚀 Características Principales

- **Cero Frameworks Pesados en Frontend:** Aplicación de Página Única (**SPA**) ultrarrápida y liviana construida con **Vanilla JavaScript (ES6+)** y **Vanilla CSS**, con diseño adaptativo móvil/escritorio (Barra inferior móvil, Menú lateral desplegable y navegación fluida).
- **Base de Datos Relacional Exclusiva en MySQL:** Conexión robusta por pool a servidor **MySQL / MariaDB** mediante `mysql2/promise` con auto-inicialización de esquema DDL relacional y datos base al primer arranque.
- **Reloj Checador Rápido con Teclado Numérico:** Modal flotante global accesible en cualquier vista con teclado numérico virtual para registro de entrada y salida mediante PIN o código de empleado.
- **Pase de Lista Masivo y Diario:** Matriz de asistencias con visualización limpia de turnos sin marcar (`--:--`), cómputo automático de retardos, salidas anticipadas, horas extras y días festivos laborados al doble.
- **Pre-Nómina Interactiva en Vivo:** Hoja de cálculo integrada donde el administrador puede ajustar días laborados, horas extra, bonos, comisiones, amortización de mermas e ingresar retenciones (IMSS e ISR con recálculo dinámico).
- **Nóminas Masivas e Individuales:** Procesamiento de plantilla completa o generación de nóminas individuales para finiquitos, jornales eventuales o pagos extraordinarios.
- **Recibos de Nómina con Formato Oficial:** Generación e impresión de recibos desglosados listos para firma de conformidad del colaborador.
- **Cálculo de Vacaciones según LFT (Vacaciones Dignas):** Reglas integradas de la Ley Federal del Trabajo de México con cálculo automático de días devengados por antigüedad y control de prima vacacional (25%+).
- **Centro de Reportes y Exportación CSV:** Compatible al 100% con Microsoft Excel mediante codificación **UTF-8 con BOM (`\uFEFF`)**, evitando deformación de tildes y caracteres como la `ñ`.
- **Rendimiento con Infinity Scroll:** Tablas de alto desempeño con paginación reactiva basada en `IntersectionObserver`.
- **Lanzador de un Clic para Windows:** Archivo `SGRH - Trópico 56.bat` para iniciar el servidor y abrir el navegador de forma desatendida.

---

## 🛠️ Arquitectura Tecnológica

| Capa | Tecnología | Propósito |
| :--- | :--- | :--- |
| **Entorno de Ejecución** | Node.js (v16+) | Servidor web asíncrono y no bloqueante |
| **Framework Backend** | Express.js 4.21 | Rutas API REST y servicio de recursos estáticos |
| **Seguridad HTTP** | Helmet 8 & CORS | Cabeceras de protección y control de orígenes cruzados |
| **Autenticación** | JWT (`jsonwebtoken`) & `bcryptjs` | Tokens de sesión (24h) y hash seguro de contraseñas |
| **Mitigación de Ataques** | `express-rate-limit` & Sanitizer | Protección contra ataques de fuerza bruta e inyecciones |
| **Base de Datos** | `mysql2` | Motor relacional MySQL/MariaDB con pool de conexiones optimizado |
| **Gestión de Archivos** | `multer` | Procesamiento en memoria para restauración de respaldos (hasta 20MB) |
| **Frontend** | Vanilla JS (ES6+) / HTML5 / CSS3 | Interfaz SPA modular, sin empaquetadores ni dependencias externas |
| **Exportación de Datos** | Streams CSV con UTF-8 BOM | Compatibilidad perfecta con Microsoft Excel |

---

## 📦 Módulos del Sistema

### 1. 📊 Panel General (Dashboard)
- Indicadores clave de rendimiento (KPIs) en tiempo real: colaboradores activos, porcentaje de asistencia diaria, monto pendiente por cobrar en mermas y nómina del periodo.
- Accesos rápidos a operaciones frecuentes y resumen del día.

### 2. 🏢 Puestos y Departamentos
- Catálogo de departamentos operativos (Cocina, Barra, Salón, Administración, etc.).
- Catálogo de puestos con salario diario base sugerido y vinculación departamental.

### 3. 👥 Colaboradores (Plantilla de Empleados)
- Expediente digital completo: código único, nombres, RFC, CURP, NSS, fecha de ingreso, salario diario, turno y tipo de contrato.
- Filtrado dinámico por departamento y estatus (*Activo*, *Inactivo*, *Vacaciones*, *Permiso*).
- Gestión de bajas ágil: registro directo mediante botón rápido (`🗑️`) o formulario de edición, guardando la fecha exacta de inactividad.

### 4. 📅 Control de Asistencias y Reloj Checador
- **Reloj Checador Modal:** Teclado numérico táctil interactivo para registro de entrada y salida con PIN de colaborador.
- **Pase de Lista Diario:** Interfaz matricial para registrar asistencias masivas en una sola pantalla, con detección de retardos, salidas anticipadas y cálculo de horas extras.
- **Historial de Registros:** Visualización filtrable por fecha con Infinity Scroll y edición manual para administradores.

### 5. ☀️ Vacaciones (Ley Federal del Trabajo)
- Motor de cálculo de antigüedad automática basado en la tabla LFT (*Vacaciones Dignas*).
- Control del saldo disponible vs. días solicitados y tomados.
- Solicitud, aprobación/rechazo y cómputo de la prima vacacional (mínimo 25%).

### 6. ⚠️ Incidencias y Mermas
- Registro de cargos por rotura de loza, cristalería, pérdidas de equipo, faltantes de caja o daños.
- Esquema de financiamiento en cuotas o descuento íntegro en nómina.
- Control de saldos: montos totales, abonos cobrados y saldo pendiente.
- Estatus operativos: `Pendiente`, `En Nómina`, `Liquidado / Pagado` y `Cancelado / Condonado`.

### 7. 💵 Gestión y Cálculo de Nóminas
- Períodos flexibles: Semanal, Catorcenal, Quincenal, Diario/Jornada, Mensual o Personalizado.
- Modalidades: Nómina Masiva (toda la plantilla activa) o Nómina Individual (finiquito, jornada única).
- Pre-Nómina editable en vivo: desglose dinámico de percepciones (sueldo base, horas extra, festivos laborados al doble, bonos, comisiones, prima vacacional, aguinaldo) y deducciones (cuota de incidencias, retención IMSS, retención ISR y otras deducciones).
- Cierre y timbrado interno: amortización automática de incidencias asociadas.
- Emisión e impresión de **Recibos de Nómina** con firmas de conformidad y formato listo para imprimir.

### 8. 📑 Centro de Reportes y Exportación CSV
Generación de reportes tabulares con filtros de fechas, atajos rápidos (`[Este Mes]`, `[Mes Anterior]`, `[Últimos 30 Días]`, `[Año Actual]`, `[Todo]`) y exportación inmediata a Excel (UTF-8 BOM):
1. **Plantilla de Colaboradores:** Datos personales, fiscales (RFC, CURP, NSS), salarios, puestos y fecha de baja de inactivos.
2. **Asistencias y Retardos:** Detalle por día, horas de entrada/salida, horas extra, festivos dobles y justificaciones.
3. **Incidencias y Mermas:** Registro de cargos, responsables, cuotas pactadas y saldos pendientes.
4. **Nóminas y Dispersiones (Resumen):** Totales acumulados de percepciones, deducciones y neto dispersado por periodo.
5. **Desglose de Nómina por Trabajador (Detallado - 26 Columnas):** Matriz analítica con cada concepto devengado y deducido por colaborador.

### 9. 👤 Gestión de Usuarios y Roles
- Control de acceso basado en roles (**RBAC**):
  - **Administrador:** Control total, configuración global, gestión de usuarios, auditoría y respaldos.
  - **Estándar:** Operación cotidiana (asistencias, consulta de plantilla e incidencias).
- Cifrado unidireccional de credenciales con `bcryptjs`.
- Cambio de contraseña de autoservicio desde el perfil.

### 10. ⚙️ Configuración, Respaldos y Mantenimiento
- Parámetros operativos del restaurante (nombre, tolerancia de retardo, moneda).
- **Exportación de Respaldos:** Generación de copias completas en formato **JSON** o **SQL** con sentencias transaccionales.
- **Restauración de Respaldos:** Carga y restauración directa de archivos JSON o SQL desde el navegador.
- **Reinicio de Fábrica:** Limpieza y regeneración segura de la base de datos con verificación mediante token (`BORRAR_TODO_TROPICO_56`).

---

## 📂 Estructura del Proyecto

```text
├── config/
│   └── database.js              # Conexión por pool a MySQL, DDL e inicialización
├── database/
│   └── schema.sql               # Esquema DDL relacional de tablas y restricciones
├── middleware/
│   ├── auth.js                  # Verificación de JWT y middleware de rol administrador
│   └── security.js              # Rate limiters (login/API) y sanitización de payloads
├── routes/
│   ├── attendance.routes.js     # Checador, pase de lista, horas extras y bitácora
│   ├── auth.routes.js           # Login, perfil y cambio de contraseña
│   ├── departments.routes.js    # CRUD de departamentos y puestos
│   ├── employees.routes.js      # Expediente digital, altas, bajas y salarios
│   ├── incidents.routes.js      # Mermas, roturas, créditos y cuotas
│   ├── payroll.routes.js        # Cálculo de pre-nómina, guardado y recibos
│   ├── reports.routes.js        # KPIs de reportes, vista previa y exportación CSV con BOM
│   ├── system.routes.js         # Estado, ajustes, respaldos SQL/JSON y reseteo
│   ├── users.routes.js          # Administración de usuarios del sistema
│   └── vacations.routes.js      # Tabulador LFT, solicitudes y saldo de vacaciones
├── public/                      # Frontend estático (Single Page Application)
│   ├── assets/
│   │   ├── favicon.svg          # Favicon vectorial
│   │   └── logo-tropico.svg     # Logotipo oficial de Trópico 56
│   ├── css/
│   │   ├── components.css       # Estilos de botones, tablas, tarjetas, modales y badges
│   │   ├── layout.css           # Estructura del App Shell (topbar, sidebar, drawer móvil)
│   │   ├── main.css             # Reset, variables de color CSS y tipografía
│   │   └── modules.css          # Estilos específicos de nómina, checador y reportes
│   ├── js/
│   │   ├── api.js               # Cliente HTTP centralizado con inyección de JWT
│   │   ├── app.js               # Enrutador principal de la SPA y navegación de vistas
│   │   ├── auth.js              # Gestor de sesión en localStorage y decodificación de roles
│   │   ├── components/
│   │   │   ├── icons.js         # Diccionario de iconos SVG en línea
│   │   │   ├── infinityScroll.js# Controlador de scroll infinito con IntersectionObserver
│   │   │   ├── modal.js         # Componente de ventanas modales dinámicas
│   │   │   ├── punchClock.js    # Componente modal de reloj checador con teclado numérico
│   │   │   └── toast.js         # Notificaciones flotantes no bloqueantes
│   │   └── modules/
│   │       ├── attendance.js    # Vista de pase de lista y bitácora de asistencia
│   │       ├── dashboard.js     # Vista de KPIs generales y accesos rápidos
│   │       ├── departments.js   # Vista de gestión de puestos y departamentos
│   │       ├── employees.js     # Vista de directorio de empleados y expedientes
│   │       ├── incidents.js     # Vista de gestión de mermas e incidencias
│   │       ├── payroll.js       # Vista interactiva de pre-nómina, nóminas y recibos
│   │       ├── reports.js       # Vista de generación de reportes y descargas CSV
│   │       ├── settings.js      # Vista de ajustes generales, respaldos y reseteo
│   │       ├── users.js         # Vista de control de usuarios y privilegios
│   │       └── vacations.js     # Vista de solicitudes y saldos de vacaciones LFT
│   └── index.html               # Contenedor raíz de la SPA
├── .env.example                 # Plantilla de variables de configuración
├── .gitignore                   # Exclusiones de control de versiones Git
├── package.json                 # Metadatos del proyecto y dependencias
├── server.js                    # Punto de entrada y servidor Express
├── SGRH - Trópico 56.bat        # Lanzador directo de un clic para Windows
└── README.md                    # Documentación técnica del sistema
```

---

## 📋 Requisitos Previos

- **[Node.js](https://nodejs.org/)**: Versión 16.x o superior instalada.
- **[npm](https://www.npmjs.com/)**: Gestor de paquetes (incluido automáticamente con Node.js).
- **Servidor MySQL / MariaDB**: Instancia local o remota de MySQL (v5.7+ o v8.x) o MariaDB en ejecución.

---

## 💻 Instalación y Puesta en Marcha

### Opción A: Inicio Rápido en Windows (Recomendado)
Haz doble clic sobre el archivo ejecutable por lotes:
```text
SGRH - Trópico 56.bat
```
*El script abrirá automáticamente tu navegador web en `http://localhost:3000` y arrancará el servidor Node.js.*

---

### Opción B: Instalación Manual por Terminal

1. **Ubícate en el directorio del proyecto:**
   ```bash
   cd "SGRH - Trópico 56"
   ```

2. **Instalar las dependencias de Node.js:**
   ```bash
   npm install
   ```

3. **Configurar el entorno:**
   Copia el archivo `.env.example` creando tu propio archivo `.env`:
   ```bash
   # En Windows PowerShell:
   Copy-Item .env.example .env
   # En Windows CMD:
   copy .env.example .env
   ```

4. **Iniciar la aplicación:**
   ```bash
   # Modo Producción / Estándar:
   npm start

   # Modo Desarrollo (con reinicio automático al guardar cambios):
   npm run dev
   ```

5. **Acceder a la aplicación:**
   Abre cualquier navegador web e ingresa a:
   ```text
   http://localhost:3000
   ```

---

## ⚙️ Variables de Entorno

El archivo `.env` permite configurar la conectividad del servidor y la persistencia de datos:

| Variable | Tipo | Valor por Defecto | Descripción |
| :--- | :--- | :--- | :--- |
| `PORT` | Numérico | `3000` | Puerto en el que escuchará el servidor Express |
| `NODE_ENV` | Texto | `development` | Entorno de ejecución (`development` / `production`) |
| `DB_HOST` | Texto | `localhost` | Host o IP del servidor MySQL |
| `DB_PORT` | Numérico | `3306` | Puerto de conexión del servidor MySQL |
| `DB_USER` | Texto | `root` | Usuario de conexión a MySQL |
| `DB_PASSWORD` | Texto | *(vacío)* | Contraseña del usuario MySQL |
| `DB_NAME` | Texto | `tropico56_sgrh` | Nombre de la base de datos (se auto-crea al iniciar) |
| `JWT_SECRET` | Texto | `tropico56_sgrh_secret_...` | Clave secreta para la firma criptográfica de tokens |
| `JWT_EXPIRES_IN`| Texto | `24h` | Tiempo de vida de la sesión activa |

> [!NOTE]
> **Auto-Creación de Esquema:** El sistema crea automáticamente la base de datos `tropico56_sgrh` (o la definida en `DB_NAME`) junto con todas las tablas DDL, índices y datos iniciales requeridos en el primer arranque si aún no existen en el servidor MySQL.

---

## 🔑 Credenciales de Acceso por Defecto

El sistema inicializa automáticamente dos cuentas de usuario para pruebas y operación inmediata:

| Rol | Usuario | Contraseña | Alcance de Permisos |
| :--- | :--- | :--- | :--- |
| **Administrador** | `admin` | `admin123` | Acceso irrestricto a todos los módulos, nóminas, configuración, usuarios y respaldos |
| **Estándar** | `estandar` | `tropico123` | Acceso a pase de lista, checador, empleados, incidencias y vacaciones |

---

## 🔒 Seguridad, Respaldos y Mantenimiento

- **Protección de Cabeceras:** Implementación de `helmet` para neutralizar ataques comunes como *clickjacking* y *MIME-sniffing*.
- **Mitigación de Ataques de Fuerza Bruta:** El endpoint `/api/auth/login` restringe a máximo 20 intentos cada 15 minutos por dirección IP.
- **Sanitización de Peticiones:** Limpieza profunda de cadenas de texto en payloads JSON para prevenir ataques de scripting.
- **Consultas Preparadas y Parametrizadas:** Todas las interacciones con MySQL emplean sentencias parametrizadas y vinculadas, eliminando cualquier riesgo de inyección SQL.
- **Copias de Seguridad (Backups):** Accesibles desde el módulo de Configuración para usuarios con rol Administrador:
  - **Respaldo JSON:** Estructura completa de colecciones serializadas.
  - **Respaldo SQL:** Sentencias `INSERT` directas listas para importación externa.
- **Restauración Transaccional:** Módulo para cargar archivos `.json` o `.sql` directamente y reestablecer la base de datos íntegra.

---

## 📄 Licencia

Desarrollado exclusivamente para **Trópico 56 - Sistema de Gestión de Recursos Humanos**. Todos los derechos reservados.
