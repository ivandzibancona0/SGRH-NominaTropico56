// Payroll & Mass Editable Pre-Payroll Module
const PayrollModule = {
    infinityTable: null,
    currentPreviewData: null,

    async render(container) {
        container.innerHTML = `
            <div class="view-header">
                <div class="view-header-title">
                    <h2>Gestión y Cálculo de Nóminas</h2>
                    <p style="color: var(--color-muted); font-size: 0.9rem;">
                        Generación periódica, cálculo masivo con edición individual (Pre-Nómina) y emisión de recibos.
                    </p>
                </div>
                <div class="view-actions">
                    <button class="btn btn-primary" id="btn-open-prenomina">
                        <span style="width: 18px; height: 18px;">${Icons.calculator}</span>
                        <span>Calcular Pre-Nómina</span>
                    </button>
                </div>
            </div>

            <!-- Payroll History Table with Infinity Scroll -->
            <div class="card">
                <div class="card-header">
                    <h3><span style="width: 20px; height: 20px;">${Icons.payroll}</span> Historial de Periodos de Nómina Procesados</h3>
                </div>

                <div class="table-container" id="payroll-history-container" style="border: none; box-shadow: none;">
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Periodo / Nombre</th>
                                    <th>Rango de Fechas</th>
                                    <th>Tipo</th>
                                    <th>Colaboradores</th>
                                    <th>Total Percepciones</th>
                                    <th>Total Deducciones</th>
                                    <th>Neto Pagado</th>
                                    <th>Estatus</th>
                                    <th style="text-align: right;">Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="payroll-tbody"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('btn-open-prenomina').addEventListener('click', () => this.openPrePayrollModal());
        this.initInfinityScroll();
    },

    initInfinityScroll() {
        const container = document.getElementById('payroll-history-container');
        const tbody = document.getElementById('payroll-tbody');

        this.infinityTable = new InfinityScrollTable({
            containerElement: container,
            tbodyElement: tbody,
            emptyMessage: 'No hay nóminas procesadas aún. Haz clic en "Calcular Pre-Nómina" para comenzar.',
            fetchDataFunction: async (page, limit) => {
                return await API.get('/payroll', { page, limit });
            },
            renderRowFunction: (p) => {
                const isClosed = p.status === 'closed';
                return `
                    <td>
                        <strong>${p.period_name}</strong>
                        <div style="font-size: 0.75rem; color: var(--color-muted);">Creado por: ${p.created_by_name || 'Admin'}</div>
                    </td>
                    <td>
                        <span style="font-family: monospace; font-size: 0.85rem;">${p.start_date} al ${p.end_date}</span>
                    </td>
                    <td>
                        <span class="badge badge-info">${p.period_type}</span>
                    </td>
                    <td><strong>${p.employees_count || 0} emp.</strong></td>
                    <td><strong style="color: var(--color-success);">$${parseFloat(p.total_perceptions).toFixed(2)}</strong></td>
                    <td><strong style="color: var(--color-danger);">$${parseFloat(p.total_deductions).toFixed(2)}</strong></td>
                    <td><strong style="color: var(--color-primary); font-size: 1rem;">$${parseFloat(p.net_total).toFixed(2)}</strong></td>
                    <td>
                        <span class="badge ${isClosed ? 'badge-success' : 'badge-warning'}">
                            <span class="badge-dot"></span>
                            ${isClosed ? 'Cerrada' : 'Borrador'}
                        </span>
                    </td>
                    <td style="text-align: right; white-space: nowrap;">
                        <button class="btn btn-secondary btn-sm" onclick="PayrollModule.viewPayrollDetails(${p.id})">
                            <span style="width: 15px; height: 15px;">${Icons.eye}</span>
                            <span>Ver Recibos</span>
                        </button>
                    </td>
                `;
            }
        });

        this.infinityTable.loadNextPage();
    },

    // -------------------------------------------------------------
    // VENTANA EMERGENTE PRE-NÓMINA (CÁLCULO MASIVO EDITABLE)
    // -------------------------------------------------------------
    async openPrePayrollModal() {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = today.getDate();

        // Check default configured period from system settings if available
        let defaultPeriod = 'quincenal';
        try {
            const setRes = await API.get('/system/settings');
            if (setRes.success && setRes.settings?.default_payment_period) {
                defaultPeriod = setRes.settings.default_payment_period;
            }
        } catch (e) {}

        const formatDate = (d) => d.toISOString().split('T')[0];

        // Helper to compute date range according to period type
        const getDatesForType = (type) => {
            const now = new Date();
            if (type === 'diario') {
                const cur = formatDate(now);
                return { start: cur, end: cur, name: `Nómina Diaria (${cur})` };
            } else if (type === 'semanal') {
                const dayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday...
                const distanceToMonday = (dayOfWeek + 6) % 7;
                const monday = new Date(now);
                monday.setDate(now.getDate() - distanceToMonday);
                const sunday = new Date(monday);
                sunday.setDate(monday.getDate() + 6);
                return {
                    start: formatDate(monday),
                    end: formatDate(sunday),
                    name: `Semana ${Math.ceil(now.getDate() / 7)} - ${month}/${year}`
                };
            } else if (type === 'catorcenal') {
                const startCatorcena = new Date(now);
                startCatorcena.setDate(now.getDate() - 13);
                return {
                    start: formatDate(startCatorcena),
                    end: formatDate(now),
                    name: `Catorcena (${formatDate(startCatorcena)} al ${formatDate(now)})`
                };
            } else if (type === 'mensual') {
                const firstDay = `${year}-${month}-01`;
                const lastD = new Date(year, now.getMonth() + 1, 0).getDate();
                return {
                    start: firstDay,
                    end: `${year}-${month}-${lastD}`,
                    name: `Mes Completo - ${month}/${year}`
                };
            } else if (type === 'personalizado') {
                return {
                    start: formatDate(now),
                    end: formatDate(now),
                    name: `Periodo Personalizado (${month}/${year})`
                };
            } else {
                // Quincenal (default)
                if (day <= 15) {
                    return {
                        start: `${year}-${month}-01`,
                        end: `${year}-${month}-15`,
                        name: `Quincena 1 - ${month}/${year}`
                    };
                } else {
                    const lastD = new Date(year, now.getMonth() + 1, 0).getDate();
                    return {
                        start: `${year}-${month}-16`,
                        end: `${year}-${month}-${lastD}`,
                        name: `Quincena 2 - ${month}/${year}`
                    };
                }
            }
        };

        const initialDates = getDatesForType(defaultPeriod);

        // Get employees list for optional single employee calculation
        let employees = [];
        try {
            const empRes = await API.get('/employees', { limit: 100 });
            employees = (empRes.data || []).filter(e => e.status === 'active');
        } catch (e) {}

        const setupContent = `
            <div style="display: flex; flex-direction: column; gap: 1.25rem;">
                <div style="background: var(--color-bg); padding: 1rem; border-radius: var(--radius-md); font-size: 0.88rem;">
                    Configura la frecuencia, fechas y alcance del cálculo. Puedes procesar a <strong>todos los colaboradores</strong> o calcular la nómina de un <strong>colaborador individual</strong> (para pagos especiales, jornadas aisladas o finiquitos).
                </div>

                <div class="form-group">
                    <label>Alcance del Cálculo / Modalidad <span class="required">*</span></label>
                    <select id="pre-scope" class="form-control" style="font-weight: 600;">
                        <option value="all">Todos los Colaboradores Activos (Nómina Masiva)</option>
                        <option value="single">Colaborador Individual (Nómina Individual / Finiquito / Pago Especial)</option>
                    </select>
                </div>

                <div class="form-group" id="pre-emp-wrapper" style="display: none; background: var(--color-card); border: 1px dashed var(--color-primary); padding: 0.85rem; border-radius: var(--radius-md);">
                    <label style="font-weight: 600; color: var(--color-primary);">Seleccionar Colaborador <span class="required">*</span></label>
                    <select id="pre-emp-id" class="form-control">
                        <option value="">-- Elige al Colaborador --</option>
                        ${employees.map(e => `<option value="${e.id}" data-name="${e.first_name} ${e.last_name}">${e.first_name} ${e.last_name} (${e.code} · ${e.position_name})</option>`).join('')}
                    </select>
                </div>

                <div class="form-row form-row-2">
                    <div class="form-group">
                        <label>Frecuencia / Tipo de Periodo</label>
                        <select id="pre-type" class="form-control">
                            <option value="quincenal" ${defaultPeriod === 'quincenal' ? 'selected' : ''}>Quincenal (15 días)</option>
                            <option value="semanal" ${defaultPeriod === 'semanal' ? 'selected' : ''}>Semanal (7 días)</option>
                            <option value="catorcenal" ${defaultPeriod === 'catorcenal' ? 'selected' : ''}>Catorcenal (14 días)</option>
                            <option value="diario" ${defaultPeriod === 'diario' ? 'selected' : ''}>Diario / Jornada (1 día)</option>
                            <option value="mensual" ${defaultPeriod === 'mensual' ? 'selected' : ''}>Mensual (30 días)</option>
                            <option value="personalizado" ${defaultPeriod === 'personalizado' ? 'selected' : ''}>Personalizado (Rango libre)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Nombre Identificador del Periodo</label>
                        <input type="text" id="pre-name" class="form-control" value="${initialDates.name}">
                    </div>
                </div>

                <div class="form-row form-row-2">
                    <div class="form-group">
                        <label>Fecha de Inicio del Periodo <span class="required">*</span></label>
                        <input type="date" id="pre-start" class="form-control" value="${initialDates.start}" required>
                    </div>
                    <div class="form-group">
                        <label>Fecha de Fin del Periodo <span class="required">*</span></label>
                        <input type="date" id="pre-end" class="form-control" value="${initialDates.end}" required>
                    </div>
                </div>

                <div style="background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 0.85rem 1rem; display: flex; align-items: center; gap: 0.75rem;">
                    <input type="checkbox" id="pre-aguinaldo" style="width: 20px; height: 20px; accent-color: var(--color-primary);">
                    <div>
                        <label for="pre-aguinaldo" style="margin-bottom: 0; font-weight: 600; cursor: pointer;">
                            ¿Incluir Pago de Aguinaldo / Parte Proporcional del Año?
                        </label>
                        <div style="font-size: 0.75rem; color: var(--color-muted);">Calcula 15 días de salario o la parte proporcional a los días laborados según la LFT.</div>
                    </div>
                </div>
            </div>
        `;

        const setupFooter = `
            <button class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
            <button class="btn btn-primary" id="btn-run-prenomina">
                <span style="width: 16px; height: 16px;">${Icons.calculator}</span>
                <span>Generar Pre-Nómina</span>
            </button>
        `;

        Modal.open({
            title: 'Generador de Pre-Nómina Masiva o Individual',
            content: setupContent,
            footer: setupFooter
        });

        // Dynamic change of scope (All vs Single)
        document.getElementById('pre-scope').addEventListener('change', (e) => {
            const isSingle = e.target.value === 'single';
            const wrapper = document.getElementById('pre-emp-wrapper');
            wrapper.style.display = isSingle ? 'block' : 'none';

            if (!isSingle) {
                const dates = getDatesForType(document.getElementById('pre-type').value);
                document.getElementById('pre-name').value = dates.name;
            } else {
                const empSelect = document.getElementById('pre-emp-id');
                const opt = empSelect.options[empSelect.selectedIndex];
                if (opt && opt.value) {
                    document.getElementById('pre-name').value = `Nómina Individual - ${opt.getAttribute('data-name')}`;
                }
            }
        });

        document.getElementById('pre-emp-id').addEventListener('change', (e) => {
            const opt = e.target.options[e.target.selectedIndex];
            if (opt && opt.value) {
                document.getElementById('pre-name').value = `Nómina Individual - ${opt.getAttribute('data-name')}`;
            }
        });

        // Dynamic change of period type updates dates and name automatically
        document.getElementById('pre-type').addEventListener('change', (e) => {
            const dates = getDatesForType(e.target.value);
            document.getElementById('pre-start').value = dates.start;
            document.getElementById('pre-end').value = dates.end;
            if (document.getElementById('pre-scope').value !== 'single') {
                document.getElementById('pre-name').value = dates.name;
            }
        });

        document.getElementById('btn-run-prenomina').addEventListener('click', async () => {
            const scope = document.getElementById('pre-scope').value;
            const employee_id = scope === 'single' ? parseInt(document.getElementById('pre-emp-id').value) : null;
            const period_type = document.getElementById('pre-type').value;
            const period_name = document.getElementById('pre-name').value.trim();
            const start_date = document.getElementById('pre-start').value;
            const end_date = document.getElementById('pre-end').value;
            const include_christmas_bonus = document.getElementById('pre-aguinaldo').checked;

            if (scope === 'single' && !employee_id) {
                Toast.warning('Debes seleccionar al colaborador para la nómina individual.');
                return;
            }

            if (!start_date || !end_date) {
                Toast.warning('Debes ingresar fecha de inicio y fin.');
                return;
            }

            try {
                Toast.info(scope === 'single' ? 'Calculando pre-nómina individual...' : 'Calculando percepciones y deducciones masivas...');
                const res = await API.post('/payroll/calculate-preview', {
                    period_type,
                    period_name,
                    start_date,
                    end_date,
                    include_christmas_bonus,
                    employee_id
                });

                if (res.success) {
                    PayrollModule.currentPreviewData = res;
                    PayrollModule.renderPrePayrollEditor(res);
                }
            } catch (err) {
                Toast.danger(err.message || 'Error al calcular pre-nómina.');
            }
        });
    },

    // -------------------------------------------------------------
    // EDITOR INLINE MASIVO DE LA PRE-NÓMINA
    // -------------------------------------------------------------
    renderPrePayrollEditor(data) {
        const s = data.summary;
        const items = data.items;

        const content = `
            <div style="display: flex; flex-direction: column; gap: 1rem;">
                <!-- Pre-payroll Banner with Grand Totals -->
                <div class="prenomina-banner">
                    <div>
                        <h4 style="font-size: 1.05rem; margin-bottom: 0.2rem;">${s.period_name}</h4>
                        <div style="font-size: 0.8rem; color: var(--color-muted);">
                            Periodo: <strong>${s.start_date} al ${s.end_date}</strong> · <strong>${s.employees_count}</strong> colaboradores incluidos
                        </div>
                    </div>
                    <div class="prenomina-totals">
                        <div class="prenomina-stat">
                            <span>Percepciones</span>
                            <strong style="color: var(--color-success);" id="grand-perceptions">$${s.total_perceptions.toFixed(2)}</strong>
                        </div>
                        <div class="prenomina-stat">
                            <span>Deducciones</span>
                            <strong style="color: var(--color-danger);" id="grand-deductions">$${s.total_deductions.toFixed(2)}</strong>
                        </div>
                        <div class="prenomina-stat net">
                            <span>Neto a Pagar</span>
                            <strong id="grand-net">$${s.net_total.toFixed(2)}</strong>
                        </div>
                    </div>
                </div>

                <div style="font-size: 0.8rem; color: var(--color-muted);">
                    <em>* Puedes editar individualmente cualquier casilla en tiempo real (días trabajados, bonos, comisiones, prima vacacional, deducciones). Los totales se actualizarán al instante.</em>
                </div>

                <!-- Pre-payroll Table with Inline Inputs -->
                <div class="prenomina-table-wrapper">
                    <table class="prenomina-table">
                        <thead>
                            <tr>
                                <th>Colaborador</th>
                                <th>Sal. Diario</th>
                                <th class="perceptions-header">Días Lab.</th>
                                <th class="perceptions-header">Sueldo Base</th>
                                <th class="perceptions-header">Hrs Extra ($)</th>
                                <th class="perceptions-header">Festivos ($)</th>
                                <th class="perceptions-header">Bonos</th>
                                <th class="perceptions-header">Comisiones</th>
                                <th class="perceptions-header">Prima Vac.</th>
                                <th class="perceptions-header">Aguinaldo</th>
                                <th class="deductions-header">Incidencias</th>
                                <th class="deductions-header">IMSS ($)</th>
                                <th class="deductions-header">ISR ($)</th>
                                <th class="deductions-header">Otras Deduc.</th>
                                <th>Total Percep.</th>
                                <th>Total Deduc.</th>
                                <th>Neto a Pagar</th>
                            </tr>
                        </thead>
                        <tbody id="prenomina-tbody">
                            ${items.map((emp, idx) => `
                                <tr data-idx="${idx}">
                                    <td style="text-align: left; white-space: nowrap; font-weight: 600;">
                                        ${emp.employee_name}
                                        <div style="font-size: 0.72rem; color: var(--color-muted);">${emp.position_name}</div>
                                    </td>
                                    <td>$${emp.daily_salary.toFixed(2)}</td>
                                    
                                    <!-- Editable Inputs -->
                                    <td><input type="number" step="0.5" class="input-inline-num edit-days" value="${emp.days_worked}"></td>
                                    <td><span class="row-base-pay">$${emp.base_salary.toFixed(2)}</span></td>
                                    <td><input type="number" step="10" class="input-inline-num edit-ot" value="${emp.overtime_pay}"></td>
                                    <td><input type="number" step="10" class="input-inline-num edit-holiday" value="${emp.holiday_pay}"></td>
                                    <td><input type="number" step="50" class="input-inline-num edit-bonus" value="${emp.bonus}"></td>
                                    <td><input type="number" step="50" class="input-inline-num edit-commissions" value="${emp.commissions}"></td>
                                    <td><input type="number" step="10" class="input-inline-num edit-vac-bonus" value="${emp.vacation_bonus}"></td>
                                    <td><input type="number" step="50" class="input-inline-num edit-xmas" value="${emp.christmas_bonus}"></td>
                                    <td><input type="number" step="10" class="input-inline-num edit-incident" value="${emp.incident_deductions}"></td>
                                    <td><input type="number" step="10" class="input-inline-num edit-imss" value="${emp.social_security_deductions}"></td>
                                    <td><input type="number" step="10" class="input-inline-num edit-isr" value="${emp.tax_deductions}"></td>
                                    <td><input type="number" step="10" class="input-inline-num edit-other-deduc" value="${emp.other_deductions}"></td>

                                    <!-- Row Calculated Results -->
                                    <td><strong class="row-perceptions" style="color: var(--color-success);">$${emp.total_perceptions.toFixed(2)}</strong></td>
                                    <td><strong class="row-deductions" style="color: var(--color-danger);">$${emp.total_deductions.toFixed(2)}</strong></td>
                                    <td><strong class="row-net" style="color: var(--color-primary); font-size: 0.95rem;">$${emp.net_pay.toFixed(2)}</strong></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
            <button class="btn btn-primary" id="btn-save-close-payroll">
                <span style="width: 16px; height: 16px;">${Icons.check}</span>
                <span>Guardar y Cerrar Nómina</span>
            </button>
        `;

        Modal.open({
            title: 'Pre-Nómina Masiva con Edición Individual',
            content,
            size: 'xl',
            footer
        });

        // Setup real-time inline recalculation on input change
        const tbody = document.getElementById('prenomina-tbody');
        tbody.addEventListener('input', (e) => {
            if (e.target.classList.contains('input-inline-num')) {
                const tr = e.target.closest('tr');
                const idx = parseInt(tr.getAttribute('data-idx'));
                PayrollModule.recalculateRow(tr, idx);
                PayrollModule.recalculateGrandTotals();
            }
        });

        document.getElementById('btn-save-close-payroll').addEventListener('click', async () => {
            try {
                Toast.info('Guardando y cerrando nómina...');
                const savePayload = {
                    period_type: s.period_type,
                    period_name: s.period_name,
                    start_date: s.start_date,
                    end_date: s.end_date,
                    status: 'closed',
                    items: PayrollModule.currentPreviewData.items
                };

                const res = await API.post('/payroll/save', savePayload);
                if (res.success) {
                    Toast.success('¡Nómina guardada y cerrada exitosamente!');
                    Modal.close();
                    PayrollModule.infinityTable.resetAndLoad();
                }
            } catch (err) {
                Toast.danger(err.message || 'Error al guardar la nómina.');
            }
        });
    },

    recalculateRow(tr, idx) {
        const item = this.currentPreviewData.items[idx];
        const days = parseFloat(tr.querySelector('.edit-days').value) || 0;
        const dailySalary = item.daily_salary;
        const basePay = days * dailySalary;
        tr.querySelector('.row-base-pay').textContent = `$${basePay.toFixed(2)}`;

        const ot = parseFloat(tr.querySelector('.edit-ot').value) || 0;
        const holiday = parseFloat(tr.querySelector('.edit-holiday').value) || 0;
        const bonus = parseFloat(tr.querySelector('.edit-bonus').value) || 0;
        const commissions = parseFloat(tr.querySelector('.edit-commissions').value) || 0;
        const vacBonus = parseFloat(tr.querySelector('.edit-vac-bonus').value) || 0;
        const xmas = parseFloat(tr.querySelector('.edit-xmas').value) || 0;

        const incident = parseFloat(tr.querySelector('.edit-incident').value) || 0;
        const imss = parseFloat(tr.querySelector('.edit-imss').value) || 0;
        const isr = parseFloat(tr.querySelector('.edit-isr').value) || 0;
        const otherDeduc = parseFloat(tr.querySelector('.edit-other-deduc').value) || 0;

        const totalPercep = basePay + ot + holiday + bonus + commissions + vacBonus + xmas;
        const totalDeduc = incident + imss + isr + otherDeduc;
        const net = Math.max(0, totalPercep - totalDeduc);

        tr.querySelector('.row-perceptions').textContent = `$${totalPercep.toFixed(2)}`;
        tr.querySelector('.row-deductions').textContent = `$${totalDeduc.toFixed(2)}`;
        tr.querySelector('.row-net').textContent = `$${net.toFixed(2)}`;

        // Update item object
        item.days_worked = days;
        item.base_salary = parseFloat(basePay.toFixed(2));
        item.overtime_pay = ot;
        item.holiday_pay = holiday;
        item.bonus = bonus;
        item.commissions = commissions;
        item.vacation_bonus = vacBonus;
        item.christmas_bonus = xmas;
        item.incident_deductions = incident;
        item.social_security_deductions = imss;
        item.tax_deductions = isr;
        item.other_deductions = otherDeduc;
        item.total_perceptions = parseFloat(totalPercep.toFixed(2));
        item.total_deductions = parseFloat(totalDeduc.toFixed(2));
        item.net_pay = parseFloat(net.toFixed(2));
    },

    recalculateGrandTotals() {
        let totalPercep = 0;
        let totalDeduc = 0;
        let totalNet = 0;

        this.currentPreviewData.items.forEach(item => {
            totalPercep += item.total_perceptions;
            totalDeduc += item.total_deductions;
            totalNet += item.net_pay;
        });

        document.getElementById('grand-perceptions').textContent = `$${totalPercep.toFixed(2)}`;
        document.getElementById('grand-deductions').textContent = `$${totalDeduc.toFixed(2)}`;
        document.getElementById('grand-net').textContent = `$${totalNet.toFixed(2)}`;
    },

    // -------------------------------------------------------------
    // DETALLE DE NÓMINA Y VISTA DE RECIBO DIGITAL IMPRIMIBLE
    // -------------------------------------------------------------
    async viewPayrollDetails(payrollId) {
        try {
            const res = await API.get(`/payroll/${payrollId}`);
            const { payroll, details } = res;

            const content = `
                <div style="display: flex; flex-direction: column; gap: 1.25rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; background: var(--color-bg); padding: 1rem; border-radius: var(--radius-md);">
                        <div>
                            <h4>${payroll.period_name}</h4>
                            <div style="font-size: 0.85rem; color: var(--color-muted);">Periodo del ${payroll.start_date} al ${payroll.end_date}</div>
                        </div>
                        <div style="display: flex; gap: 1.5rem; text-align: right;">
                            <div>
                                <span style="font-size: 0.72rem; color: var(--color-muted);">TOTAL PERCEPCIONES</span>
                                <div style="font-weight: 700; color: var(--color-success);">$${parseFloat(payroll.total_perceptions).toFixed(2)}</div>
                            </div>
                            <div>
                                <span style="font-size: 0.72rem; color: var(--color-muted);">TOTAL DEDUCCIONES</span>
                                <div style="font-weight: 700; color: var(--color-danger);">$${parseFloat(payroll.total_deductions).toFixed(2)}</div>
                            </div>
                            <div>
                                <span style="font-size: 0.72rem; color: var(--color-primary); font-weight: 700;">GRAN TOTAL NETO</span>
                                <div style="font-size: 1.2rem; font-weight: 800; color: var(--color-primary);">$${parseFloat(payroll.net_total).toFixed(2)}</div>
                            </div>
                        </div>
                    </div>

                    <div style="max-height: 480px; overflow-y: auto; border: 1px solid var(--color-border); border-radius: var(--radius-md);">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Colaborador</th>
                                    <th>Días Lab.</th>
                                    <th>Sueldo Base</th>
                                    <th>Hrs Extra</th>
                                    <th>Festivos</th>
                                    <th>Prima Vac.</th>
                                    <th>Aguinaldo</th>
                                    <th>Deducciones</th>
                                    <th>Neto a Pagar</th>
                                    <th style="text-align: right;">Recibo</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${details.map(d => `
                                    <tr>
                                        <td>
                                            <strong>${d.first_name} ${d.last_name}</strong>
                                            <div style="font-size: 0.75rem; color: var(--color-muted);">${d.position_name}</div>
                                        </td>
                                        <td>${d.days_worked}</td>
                                        <td>$${parseFloat(d.base_salary).toFixed(2)}</td>
                                        <td>$${parseFloat(d.overtime_pay).toFixed(2)}</td>
                                        <td>$${parseFloat(d.holiday_pay).toFixed(2)}</td>
                                        <td>$${parseFloat(d.vacation_bonus).toFixed(2)}</td>
                                        <td>$${parseFloat(d.christmas_bonus).toFixed(2)}</td>
                                        <td><span style="color: var(--color-danger);">-$${parseFloat(d.total_deductions).toFixed(2)}</span></td>
                                        <td><strong style="color: var(--color-primary); font-size: 0.95rem;">$${parseFloat(d.net_pay).toFixed(2)}</strong></td>
                                        <td style="text-align: right;">
                                            <button class="btn btn-secondary btn-sm" onclick="PayrollModule.openReceiptModal(${d.id})">
                                                <span style="width: 14px; height: 14px;">${Icons.print}</span>
                                                <span>Imprimir</span>
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;

            Modal.open({
                title: `Detalle de Nómina: ${payroll.period_name}`,
                content,
                size: 'xl',
                footer: `<button class="btn btn-secondary" onclick="Modal.close()">Cerrar</button>`
            });
        } catch (e) {
            Toast.danger('Error al consultar detalle de nómina.');
        }
    },

    // -------------------------------------------------------------
    // MODAL DE RECIBO INDIVIDUAL DE PAGO (IMPRIMIBLE)
    // -------------------------------------------------------------
    async openReceiptModal(detailId) {
        try {
            const res = await API.get(`/payroll/receipt/${detailId}`);
            const r = res.receipt;

            const content = `
                <div class="receipt-container" id="printable-receipt">
                    <div class="receipt-header">
                        <div class="receipt-logo-block">
                            <img src="/assets/logo-tropico.svg" alt="Trópico 56">
                            <div>
                                <h3 style="margin: 0; color: var(--color-dark);">TRÓPICO 56</h3>
                                <div style="font-size: 0.75rem; color: var(--color-muted);">RESTAURANTE & MIXOLOGÍA</div>
                                <div style="font-size: 0.75rem; color: var(--color-muted);">RFC: TRO220815XYZ</div>
                            </div>
                        </div>
                        <div class="receipt-title">
                            <h2>RECIBO DE PAGO</h2>
                            <div style="font-size: 0.8rem; color: var(--color-muted); font-family: monospace;">Folio: T56-REC-${String(r.id).padStart(5, '0')}</div>
                        </div>
                    </div>

                    <div class="receipt-grid">
                        <div>
                            <div><strong>Empleado:</strong> ${r.first_name} ${r.last_name}</div>
                            <div><strong>Código / RFC:</strong> ${r.employee_code} · ${r.rfc}</div>
                            <div><strong>NSS / CURP:</strong> ${r.nss || 'N/A'} · ${r.curp || 'N/A'}</div>
                        </div>
                        <div>
                            <div><strong>Puesto:</strong> ${r.position_name}</div>
                            <div><strong>Departamento:</strong> ${r.department_name}</div>
                            <div><strong>Periodo:</strong> ${r.period_name} (${r.period_start} al ${r.period_end})</div>
                        </div>
                    </div>

                    <div class="receipt-breakdown">
                        <div class="breakdown-box">
                            <h4 style="color: var(--color-success);">PERCEPCIONES</h4>
                            <div class="breakdown-row"><span>Sueldo Base (${r.days_worked} días):</span> <strong>$${parseFloat(r.base_salary).toFixed(2)}</strong></div>
                            ${parseFloat(r.overtime_pay) > 0 ? `<div class="breakdown-row"><span>Horas Extra (${r.overtime_hours} hrs):</span> <strong>$${parseFloat(r.overtime_pay).toFixed(2)}</strong></div>` : ''}
                            ${parseFloat(r.holiday_pay) > 0 ? `<div class="breakdown-row"><span>Días Festivos Laborados:</span> <strong>$${parseFloat(r.holiday_pay).toFixed(2)}</strong></div>` : ''}
                            ${parseFloat(r.bonus) > 0 ? `<div class="breakdown-row"><span>Bonos de Puntualidad / Desempeño:</span> <strong>$${parseFloat(r.bonus).toFixed(2)}</strong></div>` : ''}
                            ${parseFloat(r.commissions) > 0 ? `<div class="breakdown-row"><span>Comisiones / Propinas:</span> <strong>$${parseFloat(r.commissions).toFixed(2)}</strong></div>` : ''}
                            ${parseFloat(r.vacation_bonus) > 0 ? `<div class="breakdown-row"><span>Prima Vacacional:</span> <strong>$${parseFloat(r.vacation_bonus).toFixed(2)}</strong></div>` : ''}
                            ${parseFloat(r.christmas_bonus) > 0 ? `<div class="breakdown-row"><span>Aguinaldo / Proporcional:</span> <strong>$${parseFloat(r.christmas_bonus).toFixed(2)}</strong></div>` : ''}
                            <div class="breakdown-row" style="border-top: 1px solid var(--color-border); margin-top: 0.5rem; font-weight: 700;">
                                <span>TOTAL PERCEPCIONES:</span> <strong>$${parseFloat(r.total_perceptions).toFixed(2)}</strong>
                            </div>
                        </div>

                        <div class="breakdown-box">
                            <h4 style="color: var(--color-danger);">DEDUCCIONES</h4>
                            ${parseFloat(r.incident_deductions) > 0 ? `<div class="breakdown-row"><span>Descuento por Incidencias / Mermas:</span> <strong>$${parseFloat(r.incident_deductions).toFixed(2)}</strong></div>` : ''}
                            ${parseFloat(r.social_security_deductions) > 0 ? `<div class="breakdown-row"><span>IMSS (Cuota Obrera):</span> <strong>$${parseFloat(r.social_security_deductions).toFixed(2)}</strong></div>` : ''}
                            ${parseFloat(r.tax_deductions) > 0 ? `<div class="breakdown-row"><span>Retención ISR:</span> <strong>$${parseFloat(r.tax_deductions).toFixed(2)}</strong></div>` : ''}
                            ${parseFloat(r.other_deductions) > 0 ? `<div class="breakdown-row"><span>Otras Deducciones:</span> <strong>$${parseFloat(r.other_deductions).toFixed(2)}</strong></div>` : ''}
                            <div class="breakdown-row" style="border-top: 1px solid var(--color-border); margin-top: 0.5rem; font-weight: 700;">
                                <span>TOTAL DEDUCCIONES:</span> <strong>$${parseFloat(r.total_deductions).toFixed(2)}</strong>
                            </div>
                        </div>
                    </div>

                    <div class="receipt-net-total">
                        <span>NETO A RECIBIR:</span>
                        <span style="font-size: 1.35rem; color: var(--color-primary); font-weight: 800;">$${parseFloat(r.net_pay).toFixed(2)} MXN</span>
                    </div>

                    <div class="receipt-signatures">
                        <div class="signature-line">Firma del Empleado</div>
                        <div class="signature-line">Autorizado por Empresa</div>
                    </div>
                </div>
            `;

            const footer = `
                <button class="btn btn-secondary" onclick="Modal.close()">Cerrar</button>
                <button class="btn btn-primary" onclick="window.print()">
                    <span style="width: 16px; height: 16px;">${Icons.print}</span>
                    <span>Imprimir Recibo</span>
                </button>
            `;

            Modal.open({
                title: 'Recibo Oficial de Pago de Nómina',
                content,
                size: 'lg',
                footer
            });
        } catch (e) {
            Toast.danger('Error al abrir recibo de nómina.');
        }
    }
};

window.PayrollModule = PayrollModule;
