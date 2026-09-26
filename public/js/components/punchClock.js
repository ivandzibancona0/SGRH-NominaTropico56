// ==========================================================
// SISTEMA DE GESTIÓN DE RECURSOS HUMANOS - TRÓPICO 56
// Reloj Checador Digital en Tiempo Real (Modal Kiosco)
// ==========================================================

const PunchClock = {
    timerInterval: null,
    employeesList: [],

    async open() {
        // Load active employees
        try {
            const empRes = await API.get('/employees', { limit: 100 });
            this.employeesList = (empRes.data || []).filter(e => e.status === 'active');
        } catch (e) {
            this.employeesList = [];
        }

        const now = new Date();
        const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const dateFormatted = now.toLocaleDateString('es-MX', dateOptions);
        const capitalizedDate = dateFormatted.charAt(0).toUpperCase() + dateFormatted.slice(1);

        const content = `
            <div style="display: flex; flex-direction: column; gap: 1.25rem;">
                <!-- Digital Clock Display Card -->
                <div style="background: linear-gradient(135deg, var(--color-dark), #1A1614); border-radius: var(--radius-lg); padding: 1.5rem; text-align: center; color: #FFF; box-shadow: var(--shadow-md); position: relative; overflow: hidden;">
                    <div style="position: absolute; top: -20px; right: -20px; width: 100px; height: 100px; background: rgba(217, 91, 40, 0.15); border-radius: 50%; pointer-events: none;"></div>
                    
                    <div style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.15em; color: var(--color-gold); font-weight: 700; margin-bottom: 0.35rem;">
                        Trópico 56 · Reloj Checador
                    </div>
                    
                    <!-- Live Time Display -->
                    <div id="punch-live-clock" style="font-family: monospace; font-size: 2.8rem; font-weight: 800; letter-spacing: 0.05em; color: #FFFFFF; line-height: 1.1; margin: 0.5rem 0;">
                        00:00:00
                    </div>
                    
                    <div style="font-size: 0.88rem; color: #D1C7BD; font-weight: 500;">
                        ${capitalizedDate}
                    </div>
                </div>

                <!-- Employee Selector Section -->
                <div class="form-group" style="margin-bottom: 0;">
                    <label style="font-weight: 700; font-size: 0.9rem;">Selecciona o Busca tu Nombre / Código <span class="required">*</span></label>
                    <select id="punch-emp-select" class="form-control" style="font-size: 0.95rem; padding: 0.65rem 0.85rem;">
                        <option value="">-- Elige tu Nombre o Código de Colaborador --</option>
                        ${this.employeesList.map(e => `
                            <option value="${e.id}">${e.first_name} ${e.last_name} (${e.code} · ${e.position_name})</option>
                        `).join('')}
                    </select>
                </div>

                <!-- Live Status & Punch Action Area (Dynamic) -->
                <div id="punch-status-container" style="display: none; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 1.25rem; text-align: center;">
                    <!-- Injected dynamically on employee selection -->
                </div>
            </div>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="PunchClock.close()">Cerrar Reloj</button>
        `;

        Modal.open({
            title: 'Reloj Checador Digital en Tiempo Real',
            content,
            size: 'md',
            footer
        });

        // Start real-time clock ticking
        this.startLiveTimer();

        // Handle employee selection
        const selectEl = document.getElementById('punch-emp-select');
        selectEl.addEventListener('change', (e) => {
            const empId = e.target.value;
            if (empId) {
                this.loadEmployeePunchStatus(empId);
            } else {
                document.getElementById('punch-status-container').style.display = 'none';
            }
        });
    },

    startLiveTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);

        const updateClock = () => {
            const el = document.getElementById('punch-live-clock');
            if (!el) {
                clearInterval(this.timerInterval);
                return;
            }
            const now = new Date();
            const h = String(now.getHours()).padStart(2, '0');
            const m = String(now.getMinutes()).padStart(2, '0');
            const s = String(now.getSeconds()).padStart(2, '0');
            const ampm = now.getHours() >= 12 ? 'PM' : 'AM';
            el.innerHTML = `${h}:${m}:${s} <span style="font-size: 1.2rem; color: var(--color-gold); font-weight: 600;">${ampm}</span>`;
        };

        updateClock();
        this.timerInterval = setInterval(updateClock, 1000);
    },

    async loadEmployeePunchStatus(employeeId) {
        const container = document.getElementById('punch-status-container');
        if (!container) return;

        container.style.display = 'block';
        container.innerHTML = '<div class="spinner" style="margin: 1.5rem auto;"></div>';

        try {
            const res = await API.post('/attendance/punch', { employee_id: employeeId, type: 'status' });
            if (!res.success) throw new Error(res.message);

            const emp = res.employee;
            const rec = res.today_record;
            const now = new Date();
            const currentHourMin = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

            let actionHtml = '';

            if (!rec || !rec.check_in) {
                // Not checked in yet -> Check In Button
                actionHtml = `
                    <div style="margin-bottom: 1rem;">
                        <span class="badge badge-info" style="font-size: 0.8rem; padding: 0.35rem 0.75rem;">
                            Sin registro de entrada hoy
                        </span>
                    </div>
                    <button class="btn btn-primary" id="btn-do-checkin" style="width: 100%; padding: 0.9rem 1.5rem; font-size: 1.05rem; justify-content: center; background: var(--color-success); border-color: var(--color-success); box-shadow: 0 4px 15px rgba(46, 125, 50, 0.3);">
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        <span>REGISTRAR ENTRADA (${currentHourMin} HRS)</span>
                    </button>
                `;
            } else if (rec.check_in && !rec.check_out) {
                // Checked in -> Check Out Button
                actionHtml = `
                    <div style="display: flex; justify-content: center; gap: 0.75rem; margin-bottom: 1rem; flex-wrap: wrap;">
                        <span class="badge badge-success" style="font-size: 0.82rem; padding: 0.35rem 0.75rem;">
                            ✓ Entrada: ${rec.check_in.substring(0, 5)} hrs
                        </span>
                        <span class="badge badge-warning" style="font-size: 0.82rem; padding: 0.35rem 0.75rem;">
                            En turno laboral
                        </span>
                    </div>
                    <button class="btn btn-primary" id="btn-do-checkout" style="width: 100%; padding: 0.9rem 1.5rem; font-size: 1.05rem; justify-content: center; background: var(--color-primary); box-shadow: 0 4px 15px var(--color-primary-glow);">
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                        <span>REGISTRAR SALIDA (${currentHourMin} HRS)</span>
                    </button>
                `;
            } else {
                // Already checked in and checked out -> Completed
                actionHtml = `
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
                        <div style="font-size: 1rem; font-weight: 700; color: var(--color-success);">
                            ✓ Jornada completada para hoy
                        </div>
                        <div style="display: flex; gap: 0.5rem; font-size: 0.85rem; color: var(--color-dark); font-family: monospace;">
                            <span>Entrada: <strong>${rec.check_in.substring(0, 5)} hrs</strong></span> · 
                            <span>Salida: <strong>${rec.check_out.substring(0, 5)} hrs</strong></span>
                        </div>
                        ${parseFloat(rec.overtime_hours) > 0 ? `
                            <span class="badge badge-gold" style="margin-top: 0.25rem;">+${rec.overtime_hours} hrs extra acumuladas</span>
                        ` : ''}
                    </div>
                    <button class="btn btn-secondary btn-sm" id="btn-do-checkout" style="margin: 0 auto;">
                        Actualizar Hora de Salida
                    </button>
                `;
            }

            container.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem; text-align: left; background: var(--color-card); padding: 0.75rem 1rem; border-radius: var(--radius-md); border: 1px solid var(--color-border-light);">
                    <div class="user-avatar-initial" style="width: 44px; height: 44px; font-size: 1.1rem; flex-shrink: 0;">
                        ${emp.first_name[0]}${emp.last_name[0]}
                    </div>
                    <div style="min-width: 0;">
                        <strong style="font-size: 1rem; color: var(--color-dark); display: block;">${emp.first_name} ${emp.last_name}</strong>
                        <div style="font-size: 0.8rem; color: var(--color-muted);">${emp.code} · ${emp.position_name} (${emp.department_name})</div>
                    </div>
                </div>

                ${actionHtml}
            `;

            // Bind checkin / checkout button actions
            const btnIn = document.getElementById('btn-do-checkin');
            if (btnIn) {
                btnIn.addEventListener('click', async () => {
                    await this.submitPunch(employeeId, 'check_in');
                });
            }

            const btnOut = document.getElementById('btn-do-checkout');
            if (btnOut) {
                btnOut.addEventListener('click', async () => {
                    await this.submitPunch(employeeId, 'check_out');
                });
            }

        } catch (err) {
            container.innerHTML = `<div style="color: var(--color-danger); font-size: 0.88rem;">${err.message || 'Error al consultar estado.'}</div>`;
        }
    },

    async submitPunch(employeeId, type) {
        try {
            Toast.info('Registrando checada en tiempo real...');
            const res = await API.post('/attendance/punch', { employee_id: employeeId, type });
            if (res.success) {
                Toast.success(res.message);
                await this.loadEmployeePunchStatus(employeeId);
                
                // Refresh attendance table if user is currently on attendance view
                if (window.AttendanceModule?.infinityTable) {
                    window.AttendanceModule.loadStats();
                    window.AttendanceModule.infinityTable.resetAndLoad();
                }
            }
        } catch (err) {
            Toast.danger(err.message || 'Error al procesar checada.');
        }
    },

    close() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        Modal.close();
    }
};

window.PunchClock = PunchClock;
