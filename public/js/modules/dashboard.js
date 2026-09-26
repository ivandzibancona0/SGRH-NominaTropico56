// Dashboard Module
const DashboardModule = {
    async render(container) {
        container.innerHTML = `
            <div class="view-header">
                <div class="view-header-title">
                    <h2>Panel General de Control</h2>
                    <p style="color: var(--color-muted); font-size: 0.9rem;">
                        Bienvenido al Sistema de Gestión de Recursos Humanos de <strong>Trópico 56</strong>.
                    </p>
                </div>
                <div class="view-actions">
                    <button class="btn btn-primary" id="dash-quick-punch" style="background: var(--color-dark); box-shadow: 0 4px 12px rgba(42,36,33,0.25);">
                        <span style="width: 16px; height: 16px; color: var(--color-gold);">${Icons.clock}</span>
                        <span>Reloj Checador</span>
                    </button>
                    <button class="btn btn-primary" id="dash-quick-payroll">
                        <span style="width: 16px; height: 16px;">${Icons.calculator}</span>
                        <span>Calcular Pre-Nómina</span>
                    </button>
                    <button class="btn btn-secondary" id="dash-quick-attendance">
                        <span style="width: 16px; height: 16px;">${Icons.attendance}</span>
                        <span>Pase de Lista</span>
                    </button>
                </div>
            </div>

            <!-- KPI Cards Grid -->
            <div class="kpi-grid" id="dash-kpis">
                <div class="kpi-card">
                    <div class="kpi-icon primary">${Icons.employees}</div>
                    <div class="kpi-content">
                        <h4>Empleados Activos</h4>
                        <div class="kpi-value" id="kpi-emp-active">--</div>
                        <div class="kpi-subtext" id="kpi-emp-total">Cargando plantilla...</div>
                    </div>
                </div>

                <div class="kpi-card">
                    <div class="kpi-icon success">${Icons.attendance}</div>
                    <div class="kpi-content">
                        <h4>Asistencias Hoy</h4>
                        <div class="kpi-value" id="kpi-att-today">--</div>
                        <div class="kpi-subtext" id="kpi-att-sub">Puntualidad del día</div>
                    </div>
                </div>

                <div class="kpi-card">
                    <div class="kpi-icon gold">${Icons.vacations}</div>
                    <div class="kpi-content">
                        <h4>En Vacaciones</h4>
                        <div class="kpi-value" id="kpi-vac-count">--</div>
                        <div class="kpi-subtext">Personal disfrutando descanso</div>
                    </div>
                </div>

                <div class="kpi-card">
                    <div class="kpi-icon accent">${Icons.dollar}</div>
                    <div class="kpi-content">
                        <h4>Nómina Est. Mensual</h4>
                        <div class="kpi-value" id="kpi-payroll-est">--</div>
                        <div class="kpi-subtext">Costo base salarial</div>
                    </div>
                </div>
            </div>

            <!-- Dashboard Content Sections -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem; margin-top: 1rem;">
                
                <!-- Card: Departamentos y Puestos -->
                <div class="card">
                    <div class="card-header">
                        <h3><span style="width: 20px; height: 20px;">${Icons.departments}</span> Departamentos Operativos</h3>
                        <button class="btn btn-secondary btn-sm" onclick="App.navigate('departments')">Ver Todos</button>
                    </div>
                    <div id="dash-depts-list" style="display: flex; flex-direction: column; gap: 0.75rem;">
                        <div class="spinner" style="margin: 2rem auto;"></div>
                    </div>
                </div>

                <!-- Card: Incidencias y Mermas Pendientes -->
                <div class="card">
                    <div class="card-header">
                        <h3><span style="width: 20px; height: 20px;">${Icons.incidents}</span> Incidencias por Cobrar</h3>
                        <button class="btn btn-secondary btn-sm" onclick="App.navigate('incidents')">Gestionar</button>
                    </div>
                    <div id="dash-incidents-list">
                        <div class="spinner" style="margin: 2rem auto;"></div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('dash-quick-punch').addEventListener('click', () => PunchClock.open());
        document.getElementById('dash-quick-payroll').addEventListener('click', () => {
            App.navigate('payroll');
            setTimeout(() => window.PayrollModule?.openPrePayrollModal(), 150);
        });
        document.getElementById('dash-quick-attendance').addEventListener('click', () => {
            App.navigate('attendance');
            setTimeout(() => window.AttendanceModule?.openDailySheetModal(), 150);
        });

        await this.loadStats();
    },

    async loadStats() {
        try {
            const [empStats, attStats, incStats, deptsRes] = await Promise.all([
                API.get('/employees/stats/summary'),
                API.get('/attendance/stats'),
                API.get('/incidents/stats'),
                API.get('/departments')
            ]);

            // Fill KPIs
            if (empStats.success) {
                const d = empStats.data;
                document.getElementById('kpi-emp-active').textContent = d.active_employees;
                document.getElementById('kpi-emp-total').textContent = `${d.total_employees} registrados (${d.total_departments} depts)`;
                document.getElementById('kpi-vac-count').textContent = d.on_vacation;
                document.getElementById('kpi-payroll-est').textContent = `$${d.estimated_monthly_payroll.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
            }

            if (attStats.success) {
                const a = attStats.data;
                document.getElementById('kpi-att-today').textContent = `${a.present_today} / ${a.total_active}`;
                document.getElementById('kpi-att-sub').textContent = `${a.late_today} retardos · ${a.absent_today} faltas hoy`;
            }

            // Fill Departments Summary
            const deptContainer = document.getElementById('dash-depts-list');
            if (deptsRes.success && deptsRes.data.length > 0) {
                deptContainer.innerHTML = deptsRes.data.map(dept => `
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.6rem 0.8rem; background: var(--color-bg); border-radius: var(--radius-md);">
                        <div>
                            <strong style="font-size: 0.9rem;">${dept.name}</strong>
                            <div style="font-size: 0.75rem; color: var(--color-muted);">${dept.positions_count} puestos configurados</div>
                        </div>
                        <span class="badge badge-primary">${dept.employees_count} colaboradores</span>
                    </div>
                `).join('');
            } else {
                deptContainer.innerHTML = `<p style="color: var(--color-muted); text-align: center; padding: 1rem;">No hay departamentos.</p>`;
            }

            // Fill Incidents Summary
            const incContainer = document.getElementById('dash-incidents-list');
            if (incStats.success) {
                const st = incStats.data;
                incContainer.innerHTML = `
                    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--color-danger-bg); border-radius: var(--radius-md);">
                            <div>
                                <span style="font-size: 0.75rem; color: var(--color-danger); font-weight: 700;">TOTAL SALDO PENDIENTE</span>
                                <div style="font-size: 1.25rem; font-weight: 800; color: var(--color-danger);">$${parseFloat(st.total_pending || 0).toFixed(2)}</div>
                            </div>
                            <span class="badge badge-danger">${st.active_incidents || 0} abiertas</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 0.82rem; color: var(--color-muted); padding: 0 0.5rem;">
                            <span>Monto total cobrado: <strong>$${parseFloat(st.total_collected || 0).toFixed(2)}</strong></span>
                            <span>Total histórico: <strong>$${parseFloat(st.total_charged || 0).toFixed(2)}</strong></span>
                        </div>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error al cargar dashboard:', error);
        }
    }
};

window.DashboardModule = DashboardModule;
