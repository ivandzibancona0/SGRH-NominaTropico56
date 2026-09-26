// System Settings & Database Maintenance Module
const SettingsModule = {
    async render(container) {
        if (!Auth.isAdmin()) {
            container.innerHTML = `
                <div class="card" style="text-align: center; padding: 3rem 1.5rem;">
                    <div style="width: 48px; height: 48px; margin: 0 auto 1rem; color: var(--color-danger);">${Icons.alert || Icons.x}</div>
                    <h3>Acceso Restringido</h3>
                    <p style="color: var(--color-muted); max-width: 400px; margin: 0.5rem auto 1.5rem;">
                        El módulo de configuración y mantenimiento de base de datos requiere privilegios de <strong>Administrador</strong>.
                    </p>
                    <button class="btn btn-secondary" onclick="App.navigate('dashboard')">Volver al Panel</button>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="view-header" style="margin-bottom: 1.5rem;">
                <h2>Configuración y Mantenimiento</h2>
                <p style="color: var(--color-muted); font-size: 0.9rem;">
                    Respaldos de base de datos, restauración de archivos, reinicio del sistema y parámetros generales de Trópico 56.
                </p>
            </div>

            <!-- Database Backup and Restore Section -->
            <div class="card" style="margin-bottom: 1.5rem;">
                <div class="card-header">
                    <h3><span style="width: 20px; height: 20px;">${Icons.settings}</span> Respaldos y Restauración de Base de Datos</h3>
                    <span class="badge badge-success" id="db-status-badge">Conectada</span>
                </div>

                <div class="backup-zone">
                    <!-- Export Box -->
                    <div class="backup-card">
                        <div>
                            <h4 style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                <span style="width: 20px; height: 20px; color: var(--color-primary);">${Icons.download}</span>
                                Generar Respaldo de Base de Datos
                            </h4>
                            <p style="font-size: 0.85rem; color: var(--color-muted);">
                                Descarga una copia completa de seguridad con todas las tablas: empleados, asistencias, incidencias, nóminas y configuraciones.
                            </p>
                        </div>

                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                            <button class="btn btn-primary btn-sm" id="btn-download-backup-json">
                                <span style="width: 16px; height: 16px;">${Icons.download}</span>
                                <span>Descargar Respaldo (JSON)</span>
                            </button>
                            <button class="btn btn-secondary btn-sm" id="btn-download-backup-sql">
                                <span style="width: 16px; height: 16px;">${Icons.download}</span>
                                <span>Descargar Respaldo (SQL)</span>
                            </button>
                        </div>
                    </div>

                    <!-- Restore Box -->
                    <div class="backup-card">
                        <div>
                            <h4 style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                <span style="width: 20px; height: 20px; color: var(--color-accent);">${Icons.upload}</span>
                                Restaurar Base de Datos Existente
                            </h4>
                            <p style="font-size: 0.85rem; color: var(--color-muted);">
                                Carga un archivo de respaldo previo (<code>.json</code> o <code>.sql</code>) para restaurar el estado completo de la información.
                            </p>
                        </div>

                        <div>
                            <input type="file" id="restore-file-input" accept=".json,.sql" style="display: none;">
                            <button class="btn btn-accent btn-sm" id="btn-trigger-restore">
                                <span style="width: 16px; height: 16px;">${Icons.upload}</span>
                                <span>Seleccionar y Cargar Archivo</span>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Danger Zone: Wipe / Reset DB -->
                <div class="danger-zone">
                    <h4>
                        <span style="width: 20px; height: 20px;">${Icons.incidents}</span>
                        Zona de Riesgo: Borrar Base de Datos Actual y Crear una Nueva
                    </h4>
                    <p style="font-size: 0.85rem; color: #7F1D1D; margin-bottom: 1rem;">
                        Esta acción eliminará todas las tablas, empleados, asistencias, incidencias y nóminas registradas, y creará una base de datos nueva con la estructura y semillas oficiales limpias.
                    </p>
                    <button class="btn btn-danger btn-sm" id="btn-open-reset-modal">
                        <span style="width: 16px; height: 16px;">${Icons.trash}</span>
                        <span>Borrar y Crear Base de Datos Nueva</span>
                    </button>
                </div>
            </div>

            <!-- General System Settings Card -->
            <div class="card">
                <div class="card-header">
                    <h3><span style="width: 20px; height: 20px;">${Icons.edit}</span> Parámetros del Restaurante</h3>
                </div>

                <form id="system-settings-form">
                    <div class="form-row form-row-2">
                        <div class="form-group">
                            <label>Nombre del Restaurante / Razón Social</label>
                            <input type="text" id="set-rest-name" class="form-control" value="Trópico 56">
                        </div>
                        <div class="form-group">
                            <label>RFC del Restaurante</label>
                            <input type="text" id="set-rest-rfc" class="form-control" value="TRO220815XYZ">
                        </div>
                    </div>

                    <div class="form-row form-row-4">
                        <div class="form-group">
                            <label>Frecuencia de Pago Habitual</label>
                            <select id="set-default-period" class="form-control">
                                <option value="quincenal" selected>Quincenal (15 días)</option>
                                <option value="semanal">Semanal (7 días)</option>
                                <option value="catorcenal">Catorcenal (14 días)</option>
                                <option value="diario">Diario / Jornada (1 día)</option>
                                <option value="mensual">Mensual (30 días)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>% Prima Vacacional Defecto</label>
                            <input type="number" step="0.5" id="set-vac-pct" class="form-control" value="25.00">
                        </div>
                        <div class="form-group">
                            <label>Días Aguinaldo LFT Defecto</label>
                            <input type="number" step="1" id="set-xmas-days" class="form-control" value="15">
                        </div>
                        <div class="form-group">
                            <label>Moneda del Sistema</label>
                            <input type="text" id="set-currency" class="form-control" value="MXN" readonly>
                        </div>
                    </div>

                    <div style="display: flex; justify-content: flex-end; margin-top: 1rem;">
                        <button type="button" class="btn btn-primary" id="btn-save-settings">Guardar Parámetros</button>
                    </div>
                </form>
            </div>
        `;

        this.setupHandlers();
        await this.loadStatusAndSettings();
    },

    setupHandlers() {
        // Download JSON backup
        document.getElementById('btn-download-backup-json').addEventListener('click', () => {
            this.downloadBackup('json');
        });

        // Download SQL backup
        document.getElementById('btn-download-backup-sql').addEventListener('click', () => {
            this.downloadBackup('sql');
        });

        // Restore trigger
        const fileInput = document.getElementById('restore-file-input');
        document.getElementById('btn-trigger-restore').addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (!confirm(`¿Confirmas que deseas restaurar la base de datos desde "${file.name}"? Los datos actuales serán reemplazados.`)) {
                fileInput.value = '';
                return;
            }

            const formData = new FormData();
            formData.append('backup_file', file);

            try {
                Toast.info('Restaurando base de datos, por favor espera...');
                const res = await API.post('/system/restore', formData);
                Toast.success(res.message || 'Base de datos restaurada correctamente.');
                fileInput.value = '';
                await this.loadStatusAndSettings();
            } catch (err) {
                Toast.danger(err.message || 'Error al restaurar base de datos.');
            }
        });

        // Open Wipe/Reset DB Modal
        document.getElementById('btn-open-reset-modal').addEventListener('click', () => this.openResetModal());

        // Save settings
        document.getElementById('btn-save-settings').addEventListener('click', async () => {
            const settings = {
                restaurant_name: document.getElementById('set-rest-name').value.trim(),
                restaurant_rfc: document.getElementById('set-rest-rfc').value.trim(),
                default_payment_period: document.getElementById('set-default-period').value,
                vacation_bonus_pct: document.getElementById('set-vac-pct').value,
                christmas_bonus_days: document.getElementById('set-xmas-days').value
            };

            try {
                await API.put('/system/settings', { settings });
                Toast.success('Configuración guardada correctamente.');
            } catch (err) {
                Toast.danger(err.message || 'Error al guardar configuración.');
            }
        });
    },

    async loadStatusAndSettings() {
        try {
            const [statusRes, setRes] = await Promise.all([
                API.get('/system/status'),
                API.get('/system/settings')
            ]);

            if (statusRes.success) {
                const s = statusRes.status;
                const badge = document.getElementById('db-status-badge');
                if (badge) {
                    badge.textContent = `Driver: ${s.driver.toUpperCase()} (${s.database_name})`;
                }
            }

            if (setRes.success && setRes.settings) {
                const st = setRes.settings;
                if (st.restaurant_name) document.getElementById('set-rest-name').value = st.restaurant_name;
                if (st.restaurant_rfc) document.getElementById('set-rest-rfc').value = st.restaurant_rfc;
                if (st.default_payment_period) document.getElementById('set-default-period').value = st.default_payment_period;
                if (st.vacation_bonus_pct) document.getElementById('set-vac-pct').value = st.vacation_bonus_pct;
                if (st.christmas_bonus_days) document.getElementById('set-xmas-days').value = st.christmas_bonus_days;
            }
        } catch (e) {
            console.error('Error al cargar status:', e);
        }
    },

    openResetModal() {
        const content = `
            <div style="display: flex; flex-direction: column; gap: 1rem;">
                <div style="background: #FEF2F2; border: 1px solid #F87171; padding: 1rem; border-radius: var(--radius-md); color: #991B1B; font-size: 0.88rem;">
                    <strong>ADVERTENCIA CRÍTICA:</strong><br>
                    Se borrarán permanentemente todos los registros actuales de empleados, asistencias, incidencias y nóminas.
                </div>

                <p style="font-size: 0.88rem;">
                    Para confirmar esta acción destructiva, por favor escribe exactamente: <br>
                    <code style="font-size: 0.95rem; font-weight: 700; color: var(--color-danger); user-select: all;">BORRAR_TODO_TROPICO_56</code>
                </p>

                <div class="form-group">
                    <label>Escribe la confirmación de seguridad:</label>
                    <input type="text" id="reset-confirm-input" class="form-control" placeholder="BORRAR_TODO_TROPICO_56">
                </div>
            </div>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
            <button class="btn btn-danger" id="btn-exec-reset">Confirmar y Borrar Todo</button>
        `;

        Modal.open({
            title: 'Confirmación: Reiniciar Base de Datos',
            content,
            footer
        });

        document.getElementById('btn-exec-reset').addEventListener('click', async () => {
            const confirmation = document.getElementById('reset-confirm-input').value.trim();

            if (confirmation !== 'BORRAR_TODO_TROPICO_56') {
                Toast.warning('El texto de confirmación no coincide.');
                return;
            }

            try {
                Toast.info('Reinicializando base de datos...');
                const res = await API.post('/system/reset', { confirmation });
                Toast.success(res.message || 'Base de datos reiniciada con éxito.');
                Modal.close();
                App.navigate('dashboard');
            } catch (err) {
                Toast.danger(err.message || 'Error al reiniciar la base de datos.');
            }
        });
    },

    async downloadBackup(format = 'json') {
        try {
            Toast.info(`Preparando respaldo ${format.toUpperCase()}...`);
            const token = API.getToken();
            const response = await fetch(`/api/system/backup?format=${format}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errJson = await response.json().catch(() => ({}));
                throw new Error(errJson.message || `Error del servidor (${response.status})`);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `backup_tropico56_${new Date().toISOString().split('T')[0]}.${format}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();

            Toast.success(`¡Respaldo ${format.toUpperCase()} descargado exitosamente!`);
        } catch (e) {
            Toast.danger(e.message || 'Error al descargar respaldo.');
        }
    }
};

window.SettingsModule = SettingsModule;
