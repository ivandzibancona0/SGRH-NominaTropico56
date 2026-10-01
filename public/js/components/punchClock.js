// ==========================================================
// SISTEMA DE GESTIÓN DE RECURSOS HUMANOS - TRÓPICO 56
// Reloj Checador Digital en Tiempo Real (Modal Kiosco)
// ==========================================================

const PunchClock = {
    isOpen: false,
    timerInterval: null,
    employeesList: [],

    async open() {
        this.isOpen = true;

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

                <!-- Employee Search Filter -->
                <div class="form-group" style="margin-bottom: 0.65rem;">
                    <label style="font-weight: 700; font-size: 0.82rem; color: var(--color-muted); text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 0.35rem;">
                        Buscar Colaborador
                    </label>
                    <div style="position: relative;">
                        <input 
                            type="text" 
                            id="punch-emp-search" 
                            class="form-control" 
                            placeholder="Buscar por nombre, apellido o código (ej. Lucía, Pérez, EMP-006)..." 
                            style="padding-left: 2.5rem; font-size: 0.92rem;"
                            autocomplete="off"
                        >
                        <span style="position: absolute; left: 0.85rem; top: 50%; transform: translateY(-50%); width: 18px; height: 18px; color: var(--color-muted); pointer-events: none; display: flex; align-items: center;">
                            ${Icons.search}
                        </span>
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
            <button class="btn btn-secondary" onclick="PunchClock.requestClose()">Cerrar Reloj</button>
        `;

        Modal.open({
            title: 'Reloj Checador Digital en Tiempo Real',
            content,
            size: 'md',
            footer
        });

        // Intercept close 'X' button on modal header to enforce security credentials
        const modalCloseBtn = document.getElementById('btn-modal-close');
        if (modalCloseBtn) {
            const newCloseBtn = modalCloseBtn.cloneNode(true);
            modalCloseBtn.parentNode.replaceChild(newCloseBtn, modalCloseBtn);
            newCloseBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.requestClose();
            });
        }

        // Start real-time clock ticking
        this.startLiveTimer();

        // Search input dynamic filter
        const searchInput = document.getElementById('punch-emp-search');
        const selectEl = document.getElementById('punch-emp-select');

        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase().trim();
            const currentSelected = selectEl.value;

            const filtered = this.employeesList.filter(emp => {
                const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
                const code = (emp.code || '').toLowerCase();
                return fullName.includes(term) || code.includes(term);
            });

            selectEl.innerHTML = `
                <option value="">-- ${filtered.length > 0 ? 'Elige tu Nombre o Código de Colaborador' : 'No se encontraron colaboradores'} --</option>
                ${filtered.map(emp => `
                    <option value="${emp.id}">${emp.first_name} ${emp.last_name} (${emp.code} · ${emp.position_name})</option>
                `).join('')}
            `;

            // If previously selected employee is still in results, keep it selected
            if (filtered.some(emp => String(emp.id) === String(currentSelected))) {
                selectEl.value = currentSelected;
            } else if (filtered.length === 1 && term.length >= 2) {
                // If single match found while typing, select and load automatically
                selectEl.value = filtered[0].id;
                this.loadEmployeePunchStatus(filtered[0].id);
            } else {
                selectEl.value = '';
                document.getElementById('punch-status-container').style.display = 'none';
            }
        });

        // Handle employee selection
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
            const schedEntry = emp.entry_time ? emp.entry_time.substring(0, 5) : '09:00';
            const schedExit = emp.exit_time ? emp.exit_time.substring(0, 5) : '17:00';
            const schedRest = emp.rest_day || 'Domingo';

            let actionHtml = '';

            if (!rec || !rec.check_in) {
                // Not checked in yet -> Check In Button
                actionHtml = `
                    <div style="margin-bottom: 1rem; display: flex; flex-direction: column; align-items: center; gap: 0.35rem;">
                        <span class="badge badge-info" style="font-size: 0.8rem; padding: 0.35rem 0.75rem;">
                            Sin registro de entrada hoy
                        </span>
                        <small style="color: var(--color-muted); font-size: 0.78rem;">Horario esperado: Entrada ${schedEntry} hrs</small>
                    </div>
                    <button class="btn btn-primary" id="btn-do-checkin" style="width: 100%; padding: 0.9rem 1.5rem; font-size: 1.05rem; justify-content: center; background: var(--color-success); border-color: var(--color-success); box-shadow: 0 4px 15px rgba(46, 125, 50, 0.3);">
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        <span>REGISTRAR ENTRADA (${currentHourMin} HRS)</span>
                    </button>
                `;
            } else if (rec.check_in && !rec.check_out) {
                // Checked in -> Check Out Button
                const isLate = rec.status === 'late';
                actionHtml = `
                    <div style="display: flex; justify-content: center; gap: 0.5rem; margin-bottom: 0.75rem; flex-wrap: wrap;">
                        <span class="badge badge-success" style="font-size: 0.82rem; padding: 0.35rem 0.75rem;">
                            ✓ Entrada: ${rec.check_in.substring(0, 5)} hrs
                        </span>
                        ${isLate ? `
                            <span class="badge badge-warning" style="font-size: 0.82rem; padding: 0.35rem 0.75rem; background: #fff3cd; color: #856404; border: 1px solid #ffeeba;">
                                ⚠️ Retardo (Expediente: ${schedEntry})
                            </span>
                        ` : `
                            <span class="badge badge-info" style="font-size: 0.82rem; padding: 0.35rem 0.75rem;">
                                En turno laboral
                            </span>
                        `}
                    </div>
                    <div style="text-align: center; margin-bottom: 0.75rem;">
                        <small style="color: var(--color-muted); font-size: 0.78rem;">Horario oficial de salida: <strong>${schedExit} hrs</strong></small>
                    </div>
                    <button class="btn btn-primary" id="btn-do-checkout" style="width: 100%; padding: 0.9rem 1.5rem; font-size: 1.05rem; justify-content: center; background: var(--color-primary); box-shadow: 0 4px 15px var(--color-primary-glow);">
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                        <span>REGISTRAR SALIDA (${currentHourMin} HRS)</span>
                    </button>
                `;
            } else {
                // Already checked in and checked out -> Completed
                const isEarly = rec.status === 'early_departure';
                const isLate = rec.status === 'late';
                const otHours = parseFloat(rec.overtime_hours) || 0;
                const otStatus = rec.overtime_status || 'approved';

                actionHtml = `
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                        <div style="font-size: 1rem; font-weight: 700; color: var(--color-success);">
                            ✓ Jornada completada para hoy
                        </div>
                        <div style="display: flex; gap: 0.5rem; font-size: 0.85rem; color: var(--color-dark); font-family: monospace;">
                            <span>Entrada: <strong>${rec.check_in.substring(0, 5)} hrs</strong></span> · 
                            <span>Salida: <strong>${rec.check_out.substring(0, 5)} hrs</strong></span>
                        </div>
                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: center;">
                            ${isLate ? `<span class="badge badge-warning">Retardo</span>` : ''}
                            ${isEarly ? `<span class="badge badge-danger" style="background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;">Salida anticipada (Horario: ${schedExit})</span>` : ''}
                            ${otHours > 0 ? `
                                <span class="badge badge-gold" style="margin-top: 0.25rem;">
                                    +${otHours} hr${otHours > 1 ? 's' : ''} extra completas ${otStatus === 'pending' ? '(Pendiente de Autorización)' : otStatus === 'compensated' ? '(Compensado)' : ''}
                                </span>
                            ` : ''}
                        </div>
                    </div>
                `;
            }

            container.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem; text-align: left; background: var(--color-card); padding: 0.75rem 1rem; border-radius: var(--radius-md); border: 1px solid var(--color-border-light);">
                    <div class="user-avatar-initial" style="width: 44px; height: 44px; font-size: 1.1rem; flex-shrink: 0;">
                        ${emp.first_name[0]}${emp.last_name[0]}
                    </div>
                    <div style="min-width: 0; flex: 1;">
                        <strong style="font-size: 1rem; color: var(--color-dark); display: block;">${emp.first_name} ${emp.last_name}</strong>
                        <div style="font-size: 0.8rem; color: var(--color-muted);">${emp.code} · ${emp.position_name} (${emp.department_name})</div>
                        <div style="font-size: 0.75rem; color: var(--color-primary); font-weight: 500; margin-top: 0.2rem;">
                            Horario: ${schedEntry} - ${schedExit} hrs · Descanso: ${schedRest}
                        </div>
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

    // Intercept closing request and open stacked security modal
    requestClose() {
        this.openSecurityModal();
    },

    // Stacked modal to verify user credentials before closing
    openSecurityModal() {
        if (document.getElementById('punch-security-modal-overlay')) return;

        const currentUser = Auth.currentUser || {};
        const overlay = document.createElement('div');
        overlay.id = 'punch-security-modal-overlay';
        overlay.className = 'modal-overlay active';
        overlay.style.cssText = 'z-index: 1200; background: rgba(0, 0, 0, 0.7); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px);';

        overlay.innerHTML = `
            <div class="modal-container" style="max-width: 440px; width: 90%; box-shadow: 0 20px 45px rgba(0,0,0,0.45); margin: auto;" role="dialog" aria-modal="true">
                <div class="modal-header">
                    <h3 style="font-size: 1.05rem; display: flex; align-items: center; gap: 0.5rem;">
                        <span style="color: var(--color-primary); width: 20px; height: 20px; display: inline-flex;">${Icons.lock || ''}</span>
                        <span>Confirmación de Seguridad</span>
                    </h3>
                    <button class="modal-close-btn" id="btn-punch-security-cancel-x" aria-label="Cancelar">
                        ${Icons.x}
                    </button>
                </div>
                <div class="modal-body" style="padding: 1.25rem 1.5rem;">
                    <p style="font-size: 0.88rem; color: var(--color-muted); margin-bottom: 1.15rem; line-height: 1.45;">
                        Para cerrar el reloj checador, por favor ingresa las credenciales de tu perfil de usuario activo.
                    </p>

                    <div id="punch-security-error" style="display: none; background: var(--color-danger-bg, #FEE2E2); color: var(--color-danger, #DC2626); padding: 0.75rem 1rem; border-radius: var(--radius-md); font-size: 0.85rem; margin-bottom: 1.15rem; border: 1px solid rgba(220, 38, 38, 0.25); line-height: 1.4;">
                        No se ha podido cerrar el reloj checador por credenciales incorrectas.
                    </div>

                    <form id="punch-security-form" onsubmit="return false;">
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label style="font-size: 0.85rem; font-weight: 600;">Usuario <span class="required">*</span></label>
                            <input 
                                type="text" 
                                id="punch-sec-username" 
                                class="form-control" 
                                value="${currentUser.username || ''}" 
                                placeholder="Ingresa tu usuario" 
                                required
                                autocomplete="username"
                            >
                        </div>
                        <div class="form-group" style="margin-bottom: 0.5rem;">
                            <label style="font-size: 0.85rem; font-weight: 600;">Contraseña <span class="required">*</span></label>
                            <input 
                                type="password" 
                                id="punch-sec-password" 
                                class="form-control" 
                                placeholder="Ingresa tu contraseña" 
                                required
                                autocomplete="current-password"
                            >
                        </div>
                    </form>
                </div>
                <div class="modal-footer" style="padding: 1rem 1.5rem; display: flex; justify-content: flex-end; gap: 0.75rem;">
                    <button class="btn btn-secondary" id="btn-punch-security-cancel">Cancelar</button>
                    <button class="btn btn-primary" id="btn-punch-security-submit">Verificar y Cerrar</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const closeSecurityModal = () => {
            const el = document.getElementById('punch-security-modal-overlay');
            if (el) el.remove();
        };

        document.getElementById('btn-punch-security-cancel').addEventListener('click', closeSecurityModal);
        document.getElementById('btn-punch-security-cancel-x').addEventListener('click', closeSecurityModal);

        // Verification logic
        const submitVerification = async () => {
            const usernameInput = document.getElementById('punch-sec-username');
            const passwordInput = document.getElementById('punch-sec-password');
            const errorBox = document.getElementById('punch-security-error');
            const submitBtn = document.getElementById('btn-punch-security-submit');

            const username = usernameInput.value.trim();
            const password = passwordInput.value;

            if (!username || !password) {
                errorBox.style.display = 'block';
                errorBox.textContent = 'No se ha podido cerrar el reloj checador por credenciales incorrectas.';
                Toast.danger('No se ha podido cerrar el reloj checador por credenciales incorrectas.');
                return;
            }

            try {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Verificando...';

                const res = await API.post('/auth/verify-credentials', { username, password });

                if (res.success) {
                    Toast.success('Reloj checador cerrado exitosamente.');
                    closeSecurityModal();
                    this.forceClose();
                } else {
                    throw new Error(res.message || 'No se ha podido cerrar el reloj checador por credenciales incorrectas.');
                }
            } catch (err) {
                errorBox.style.display = 'block';
                errorBox.textContent = 'No se ha podido cerrar el reloj checador por credenciales incorrectas.';
                Toast.danger('No se ha podido cerrar el reloj checador por credenciales incorrectas.');
                passwordInput.value = '';
                passwordInput.focus();
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Verificar y Cerrar';
            }
        };

        document.getElementById('btn-punch-security-submit').addEventListener('click', submitVerification);
        document.getElementById('punch-sec-password').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                submitVerification();
            }
        });

        setTimeout(() => {
            const pwd = document.getElementById('punch-sec-password');
            if (pwd) pwd.focus();
        }, 100);
    },

    forceClose() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        this.isOpen = false;
        Modal.close();
    },

    close() {
        this.requestClose();
    }
};

window.PunchClock = PunchClock;
