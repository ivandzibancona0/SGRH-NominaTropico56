// Employees Module with Infinity Scroll
const EmployeesModule = {
    infinityTable: null,
    departments: [],
    positions: [],

    async render(container) {
        container.innerHTML = `
            <div class="view-header">
                <div class="view-header-title">
                    <h2>Plantilla de Empleados</h2>
                    <p style="color: var(--color-muted); font-size: 0.9rem;">Expediente de colaboradores, información contractual y salarios de Trópico 56.</p>
                </div>
                <div class="view-actions">
                    <button class="btn btn-primary" id="btn-add-employee">
                        <span style="width: 18px; height: 18px;">${Icons.plus}</span>
                        <span>Registrar Empleado</span>
                    </button>
                </div>
            </div>

            <!-- Filter and Search Bar -->
            <div class="filter-bar">
                <div class="search-input-wrapper">
                    ${Icons.search}
                    <input type="text" id="emp-search-input" class="form-control" placeholder="Buscar por nombre, código, RFC o puesto...">
                </div>

                <div class="filter-actions">
                    <select id="emp-dept-filter" class="form-control" style="width: 190px;">
                        <option value="">Todos los Deptos.</option>
                    </select>

                    <select id="emp-status-filter" class="form-control" style="width: 150px;">
                        <option value="">Todos los Estados</option>
                        <option value="active">Activos</option>
                        <option value="inactive">Bajas</option>
                        <option value="vacation">En Vacaciones</option>
                    </select>
                </div>
            </div>

            <!-- Table Container with Infinity Scroll -->
            <div class="table-container" id="employees-table-container">
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Código / Empleado</th>
                                <th>RFC / CURP</th>
                                <th>Departamento & Puesto</th>
                                <th>Fecha Ingreso</th>
                                <th>Salario Diario</th>
                                <th>Estatus</th>
                                <th style="text-align: right;">Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="employees-tbody"></tbody>
                    </table>
                </div>
            </div>
        `;

        document.getElementById('btn-add-employee').addEventListener('click', () => this.openEmployeeModal());

        // Load depts and positions for filters
        await this.loadCatalogs();

        // Setup filter listeners
        const searchInput = document.getElementById('emp-search-input');
        const deptFilter = document.getElementById('emp-dept-filter');
        const statusFilter = document.getElementById('emp-status-filter');

        let debounceTimer = null;
        searchInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => this.infinityTable.resetAndLoad(), 300);
        });

        deptFilter.addEventListener('change', () => this.infinityTable.resetAndLoad());
        statusFilter.addEventListener('change', () => this.infinityTable.resetAndLoad());

        // Initialize Infinity Scroll
        this.initInfinityScroll();
    },

    async loadCatalogs() {
        try {
            const [dRes, pRes] = await Promise.all([
                API.get('/departments'),
                API.get('/positions')
            ]);
            this.departments = dRes.data || [];
            this.positions = pRes.data || [];

            const deptSelect = document.getElementById('emp-dept-filter');
            if (deptSelect) {
                this.departments.forEach(d => {
                    const opt = document.createElement('option');
                    opt.value = d.id;
                    opt.textContent = d.name;
                    deptSelect.appendChild(opt);
                });
            }
        } catch (e) {
            console.error('Error al cargar catálogos:', e);
        }
    },

    initInfinityScroll() {
        const container = document.getElementById('employees-table-container');
        const tbody = document.getElementById('employees-tbody');

        this.infinityTable = new InfinityScrollTable({
            containerElement: container,
            tbodyElement: tbody,
            emptyMessage: 'No se encontraron colaboradores con los filtros seleccionados.',
            fetchDataFunction: async (page, limit) => {
                const search = document.getElementById('emp-search-input')?.value || '';
                const department_id = document.getElementById('emp-dept-filter')?.value || '';
                const status = document.getElementById('emp-status-filter')?.value || '';

                return await API.get('/employees', {
                    page,
                    limit,
                    search,
                    department_id,
                    status
                });
            },
            renderRowFunction: (emp) => {
                let badgeClass = 'badge-success';
                let statusLabel = 'Activo';
                if (emp.status === 'inactive') { badgeClass = 'badge-danger'; statusLabel = 'Baja'; }
                if (emp.status === 'vacation') { badgeClass = 'badge-warning'; statusLabel = 'Vacaciones'; }

                return `
                    <td>
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <div class="user-avatar-initial" style="background: var(--color-primary); font-size: 0.8rem; width: 32px; height: 32px;">
                                ${emp.first_name[0]}${emp.last_name[0]}
                            </div>
                            <div>
                                <strong style="color: var(--color-dark);">${emp.first_name} ${emp.last_name}</strong>
                                <div style="font-size: 0.75rem; color: var(--color-muted); font-family: monospace; display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
                                    <span>${emp.code}</span>
                                    ${emp.has_face_enrolled ? `<span class="badge-face-enrolled" title="Reconocimiento facial registrado"><span style="width: 11px; height: 11px; display: inline-flex;">${Icons.faceId}</span> Facial</span>` : ''}
                                </div>
                            </div>
                        </div>
                    </td>
                    <td>
                        <div style="font-size: 0.82rem; font-weight: 600;">${emp.rfc}</div>
                        <div style="font-size: 0.75rem; color: var(--color-muted);">${emp.curp || 'Sin CURP'}</div>
                    </td>
                    <td>
                        <div style="font-weight: 600;">${emp.position_name || 'Sin Puesto'}</div>
                        <div style="font-size: 0.75rem; color: var(--color-muted);">${emp.department_name || 'Sin Depto'}</div>
                    </td>
                    <td>
                        <span style="font-size: 0.82rem;">${emp.hire_date}</span>
                    </td>
                    <td>
                        <strong style="color: var(--color-dark);">$${parseFloat(emp.daily_salary || 0).toFixed(2)}</strong>
                        <span style="font-size: 0.72rem; color: var(--color-muted);">/día</span>
                    </td>
                    <td>
                        <span class="badge ${badgeClass}">
                            <span class="badge-dot"></span>
                            ${statusLabel}
                        </span>
                    </td>
                    <td style="text-align: right; white-space: nowrap;">
                        <button class="btn btn-secondary btn-sm btn-icon-only" onclick="EmployeesModule.openFaceEnrollModal(${emp.id})" title="${emp.has_face_enrolled ? 'Actualizar / Gestionar Rostro' : 'Registrar Rostro Facial'}" style="${emp.has_face_enrolled ? 'color: var(--color-success); border-color: rgba(46,125,50,0.35);' : ''}">
                            <span style="width: 15px; height: 15px;">${Icons.faceId}</span>
                        </button>
                        <button class="btn btn-secondary btn-sm btn-icon-only" onclick="EmployeesModule.viewEmployeeDetails(${emp.id})" title="Ver Expediente">
                            <span style="width: 15px; height: 15px;">${Icons.eye}</span>
                        </button>
                        <button class="btn btn-secondary btn-sm btn-icon-only" onclick="EmployeesModule.openEmployeeModal(${emp.id})" title="Editar">
                            <span style="width: 15px; height: 15px;">${Icons.edit}</span>
                        </button>
                        <button class="btn btn-outline-danger btn-sm btn-icon-only" onclick="EmployeesModule.deactivateEmployee(${emp.id})" title="Dar de Baja">
                            <span style="width: 15px; height: 15px;">${Icons.trash}</span>
                        </button>
                    </td>
                `;
            }
        });

        this.infinityTable.loadNextPage();
    },

    async viewEmployeeDetails(id) {
        try {
            const res = await API.get(`/employees/${id}`);
            const emp = res.data;

            const content = `
                <div style="display: flex; flex-direction: column; gap: 1.25rem;">
                    <div style="display: flex; align-items: center; gap: 1rem; background: var(--color-bg); padding: 1.25rem; border-radius: var(--radius-lg);">
                        <div class="user-avatar-initial" style="width: 56px; height: 56px; font-size: 1.4rem;">
                            ${emp.first_name[0]}${emp.last_name[0]}
                        </div>
                        <div>
                            <h3 style="margin-bottom: 0.2rem;">${emp.first_name} ${emp.last_name}</h3>
                            <div style="font-size: 0.85rem; color: var(--color-muted);">
                                <strong>${emp.position_name}</strong> · ${emp.department_name} · Código: <code>${emp.code}</code>
                            </div>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; font-size: 0.85rem;">
                        <div><strong>RFC:</strong> ${emp.rfc}</div>
                        <div><strong>CURP:</strong> ${emp.curp || 'N/A'}</div>
                        <div><strong>NSS:</strong> ${emp.nss || 'N/A'}</div>
                        <div><strong>Fecha Ingreso:</strong> ${emp.hire_date}</div>
                        <div><strong>Salario Diario:</strong> $${parseFloat(emp.daily_salary).toFixed(2)} MXN</div>
                        <div><strong>Turno:</strong> ${emp.shift}</div>
                        <div><strong>Horario Asignado:</strong> ${emp.entry_time ? emp.entry_time.slice(0, 5) : '09:00'} a ${emp.exit_time ? emp.exit_time.slice(0, 5) : '17:00'}</div>
                        <div><strong>Día de Descanso:</strong> ${emp.rest_day || 'Domingo'}</div>
                        <div><strong>Teléfono:</strong> ${emp.phone || 'N/A'}</div>
                        <div><strong>Correo:</strong> ${emp.email || 'N/A'}</div>
                        <div style="grid-column: 1 / -1;">
                            <strong>Reconocimiento Facial:</strong>
                            ${emp.has_face_enrolled
                                ? `<span class="badge badge-success" style="margin-left: 0.35rem;">Registrado</span> <small style="color: var(--color-muted); margin-left: 0.35rem;">${emp.face_enrolled_at ? `(${emp.face_enrolled_at})` : ''}</small>`
                                : `<span class="badge badge-secondary" style="margin-left: 0.35rem;">Sin registro facial</span>`}
                        </div>
                        <div style="grid-column: 1 / -1;"><strong>Dirección:</strong> ${emp.address || 'N/A'}</div>
                    </div>

                    <!-- Resumen de Asistencia del Empleado -->
                    <div style="background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 1rem;">
                        <h4 style="font-size: 0.85rem; margin-bottom: 0.5rem; text-transform: uppercase; color: var(--color-muted);">Resumen de Desempeño y Asistencia</h4>
                        <div style="display: flex; justify-content: space-around; text-align: center;">
                            <div>
                                <div style="font-size: 1.2rem; font-weight: 700; color: var(--color-success);">${emp.attendance_summary?.present_days || 0}</div>
                                <span style="font-size: 0.72rem; color: var(--color-muted);">Asistencias</span>
                            </div>
                            <div>
                                <div style="font-size: 1.2rem; font-weight: 700; color: var(--color-warning);">${emp.attendance_summary?.late_days || 0}</div>
                                <span style="font-size: 0.72rem; color: var(--color-muted);">Retardos</span>
                            </div>
                            <div>
                                <div style="font-size: 1.2rem; font-weight: 700; color: var(--color-primary);">${emp.attendance_summary?.total_overtime || 0} hrs</div>
                                <span style="font-size: 0.72rem; color: var(--color-muted);">Horas Extra</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            Modal.open({
                title: `Expediente: ${emp.first_name} ${emp.last_name}`,
                content,
                size: 'lg',
                footer: `
                    <button class="btn btn-secondary" onclick="EmployeesModule.openFaceEnrollModal(${emp.id})">
                        <span style="width: 16px; height: 16px; display: inline-flex;">${Icons.faceId}</span>
                        <span>${emp.has_face_enrolled ? 'Actualizar Rostro' : 'Registrar Rostro'}</span>
                    </button>
                    <button class="btn btn-secondary" onclick="Modal.close()">Cerrar</button>
                `
            });
        } catch (e) {
            Toast.danger('Error al obtener expediente del empleado.');
        }
    },

    async openEmployeeModal(id = null) {
        let emp = null;
        if (id) {
            const res = await API.get(`/employees/${id}`);
            emp = res.data;
        }

        const title = emp ? `Editar Empleado: ${emp.first_name}` : 'Registrar Nuevo Empleado';

        const deptOptions = this.departments.map(d => `
            <option value="${d.id}" ${emp && emp.department_id === d.id ? 'selected' : ''}>${d.name}</option>
        `).join('');

        const content = `
            <form id="emp-form">
                <div class="form-row form-row-3">
                    <div class="form-group">
                        <label>Código Empleado</label>
                        <input type="text" id="m-emp-code" class="form-control" placeholder="Auto-generado si vacío" value="${emp ? emp.code : ''}">
                    </div>
                    <div class="form-group">
                        <label>Nombre(s) <span class="required">*</span></label>
                        <input type="text" id="m-emp-fname" class="form-control" placeholder="Ej. Mateo" value="${emp ? emp.first_name : ''}" required>
                    </div>
                    <div class="form-group">
                        <label>Apellidos <span class="required">*</span></label>
                        <input type="text" id="m-emp-lname" class="form-control" placeholder="Ej. Hernández Solís" value="${emp ? emp.last_name : ''}" required>
                    </div>
                </div>

                <div class="form-row form-row-3">
                    <div class="form-group">
                        <label>RFC <span class="required">*</span></label>
                        <input type="text" id="m-emp-rfc" class="form-control" placeholder="13 caracteres" maxlength="13" value="${emp ? emp.rfc : ''}" required>
                    </div>
                    <div class="form-group">
                        <label>CURP</label>
                        <input type="text" id="m-emp-curp" class="form-control" placeholder="18 caracteres" maxlength="18" value="${emp ? (emp.curp || '') : ''}">
                    </div>
                    <div class="form-group">
                        <label>NSS (Seguro Social)</label>
                        <input type="text" id="m-emp-nss" class="form-control" placeholder="11 dígitos" maxlength="11" value="${emp ? (emp.nss || '') : ''}">
                    </div>
                </div>

                <div class="form-row form-row-3">
                    <div class="form-group">
                        <label>Departamento <span class="required">*</span></label>
                        <select id="m-emp-dept" class="form-control" required>
                            <option value="">Selecciona Departamento</option>
                            ${deptOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Puesto Asignado <span class="required">*</span></label>
                        <select id="m-emp-pos" class="form-control" required disabled>
                            <option value="">Primero selecciona un Departamento...</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Salario Diario (MXN) <span class="required">*</span></label>
                        <input type="number" step="0.01" id="m-emp-salary" class="form-control" placeholder="0.00" value="${emp ? emp.daily_salary : ''}" required>
                    </div>
                </div>

                <div class="form-row form-row-3">
                    <div class="form-group">
                        <label>Fecha de Ingreso <span class="required">*</span></label>
                        <input type="date" id="m-emp-hire" class="form-control" value="${emp ? emp.hire_date : new Date().toISOString().split('T')[0]}" required>
                    </div>
                    <div class="form-group">
                        <label>Turno Habitual</label>
                        <select id="m-emp-shift" class="form-control">
                            <option value="Matutino" ${emp && emp.shift === 'Matutino' ? 'selected' : ''}>Matutino</option>
                            <option value="Vespertino" ${emp && emp.shift === 'Vespertino' ? 'selected' : ''}>Vespertino</option>
                            <option value="Mixto" ${emp && emp.shift === 'Mixto' ? 'selected' : ''}>Mixto / Especial</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Estatus</label>
                        <select id="m-emp-status" class="form-control">
                            <option value="active" ${emp && emp.status === 'active' ? 'selected' : ''}>Activo</option>
                            <option value="vacation" ${emp && emp.status === 'vacation' ? 'selected' : ''}>En Vacaciones</option>
                            <option value="inactive" ${emp && emp.status === 'inactive' ? 'selected' : ''}>Baja</option>
                        </select>
                    </div>
                </div>

                <div class="form-row form-row-3">
                    <div class="form-group">
                        <label>Horario de Entrada <span class="required">*</span></label>
                        <input type="time" id="m-emp-entry-time" class="form-control" value="${emp && emp.entry_time ? emp.entry_time.slice(0, 5) : '09:00'}" required>
                    </div>
                    <div class="form-group">
                        <label>Horario de Salida <span class="required">*</span></label>
                        <input type="time" id="m-emp-exit-time" class="form-control" value="${emp && emp.exit_time ? emp.exit_time.slice(0, 5) : '17:00'}" required>
                    </div>
                    <div class="form-group">
                        <label>Día de Descanso <span class="required">*</span></label>
                        <select id="m-emp-rest-day" class="form-control" required>
                            <option value="Lunes" ${emp && emp.rest_day === 'Lunes' ? 'selected' : ''}>Lunes</option>
                            <option value="Martes" ${emp && emp.rest_day === 'Martes' ? 'selected' : ''}>Martes</option>
                            <option value="Miércoles" ${emp && emp.rest_day === 'Miércoles' ? 'selected' : ''}>Miércoles</option>
                            <option value="Jueves" ${emp && emp.rest_day === 'Jueves' ? 'selected' : ''}>Jueves</option>
                            <option value="Viernes" ${emp && emp.rest_day === 'Viernes' ? 'selected' : ''}>Viernes</option>
                            <option value="Sábado" ${emp && emp.rest_day === 'Sábado' ? 'selected' : ''}>Sábado</option>
                            <option value="Domingo" ${(!emp || !emp.rest_day || emp.rest_day === 'Domingo') ? 'selected' : ''}>Domingo</option>
                            <option value="Rotativo" ${emp && emp.rest_day === 'Rotativo' ? 'selected' : ''}>Rotativo / Variable</option>
                        </select>
                    </div>
                </div>

                <div class="form-row form-row-2">
                    <div class="form-group">
                        <label>Teléfono de Contacto</label>
                        <input type="text" id="m-emp-phone" class="form-control" placeholder="Ej. 55 1234 5678" value="${emp ? (emp.phone || '') : ''}">
                    </div>
                    <div class="form-group">
                        <label>Correo Electrónico</label>
                        <input type="email" id="m-emp-email" class="form-control" placeholder="colaborador@tropico56.com" value="${emp ? (emp.email || '') : ''}">
                    </div>
                </div>

                <div class="form-group">
                    <label>Dirección Particular</label>
                    <input type="text" id="m-emp-addr" class="form-control" placeholder="Calle, número, colonia, código postal" value="${emp ? (emp.address || '') : ''}">
                </div>
            </form>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
            <button class="btn btn-primary" id="btn-save-employee">${emp ? 'Actualizar Expediente' : 'Registrar Colaborador'}</button>
        `;

        Modal.open({ title, content, size: 'xl', footer });

        const deptSelect = document.getElementById('m-emp-dept');
        const posSelect = document.getElementById('m-emp-pos');
        const salaryInput = document.getElementById('m-emp-salary');

        // Helper function to update position dropdown according to chosen department
        const updatePositionDropdown = (selectedDeptId, preselectedPosId = null) => {
            if (!selectedDeptId) {
                posSelect.innerHTML = '<option value="">Primero selecciona un Departamento...</option>';
                posSelect.disabled = true;
                return;
            }

            const filteredPositions = this.positions.filter(p => String(p.department_id) === String(selectedDeptId));

            if (filteredPositions.length === 0) {
                posSelect.innerHTML = '<option value="">No hay puestos creados en este departamento</option>';
                posSelect.disabled = true;
                return;
            }

            posSelect.disabled = false;
            posSelect.innerHTML = `
                <option value="">Selecciona Puesto (${filteredPositions.length} disponibles)</option>
                ${filteredPositions.map(p => `
                    <option value="${p.id}" data-salary="${p.base_daily_salary}" ${preselectedPosId && String(preselectedPosId) === String(p.id) ? 'selected' : ''}>
                        ${p.name} ($${parseFloat(p.base_daily_salary).toFixed(2)}/día)
                    </option>
                `).join('')}
            `;
        };

        // If editing an employee with an existing department, initialize filtered positions
        if (emp && emp.department_id) {
            updatePositionDropdown(emp.department_id, emp.position_id);
        }

        // When Department changes, filter positions and enable dropdown
        deptSelect.addEventListener('change', (e) => {
            const deptId = e.target.value;
            updatePositionDropdown(deptId, null);
            salaryInput.value = '';
        });

        // Auto-fill salary when position is selected
        posSelect.addEventListener('change', (e) => {
            const selectedOpt = e.target.selectedOptions[0];
            const baseSalary = selectedOpt?.getAttribute('data-salary');
            if (baseSalary) {
                salaryInput.value = parseFloat(baseSalary).toFixed(2);
            }
        });

        document.getElementById('btn-save-employee').addEventListener('click', async () => {
            const payload = {
                code: document.getElementById('m-emp-code').value.trim(),
                first_name: document.getElementById('m-emp-fname').value.trim(),
                last_name: document.getElementById('m-emp-lname').value.trim(),
                rfc: document.getElementById('m-emp-rfc').value.trim(),
                curp: document.getElementById('m-emp-curp').value.trim(),
                nss: document.getElementById('m-emp-nss').value.trim(),
                department_id: document.getElementById('m-emp-dept').value,
                position_id: document.getElementById('m-emp-pos').value,
                daily_salary: document.getElementById('m-emp-salary').value,
                hire_date: document.getElementById('m-emp-hire').value,
                shift: document.getElementById('m-emp-shift').value,
                entry_time: document.getElementById('m-emp-entry-time').value || '09:00',
                exit_time: document.getElementById('m-emp-exit-time').value || '17:00',
                rest_day: document.getElementById('m-emp-rest-day').value || 'Domingo',
                status: document.getElementById('m-emp-status').value,
                phone: document.getElementById('m-emp-phone').value.trim(),
                email: document.getElementById('m-emp-email').value.trim(),
                address: document.getElementById('m-emp-addr').value.trim()
            };

            if (!payload.first_name || !payload.last_name || !payload.rfc || !payload.department_id || !payload.position_id || !payload.daily_salary || !payload.hire_date || !payload.entry_time || !payload.exit_time || !payload.rest_day) {
                Toast.warning('Por favor completa todos los campos marcados como obligatorios (*)');
                return;
            }

            try {
                if (emp) {
                    await API.put(`/employees/${emp.id}`, payload);
                    Toast.success('Empleado actualizado correctamente.');
                } else {
                    await API.post('/employees', payload);
                    Toast.success('Empleado registrado exitosamente.');
                }
                Modal.close();
                this.infinityTable.resetAndLoad();
            } catch (err) {
                Toast.danger(err.message || 'Error al procesar registro de empleado.');
            }
        });
    },

    async deactivateEmployee(id) {
        if (!confirm('¿Deseas dar de baja a este colaborador?')) return;
        try {
            await API.delete(`/employees/${id}`);
            Toast.success('Colaborador marcado como baja.');
            this.infinityTable.resetAndLoad();
        } catch (e) {
            Toast.danger(e.message || 'No se pudo actualizar el estatus.');
        }
    },

    async openFaceEnrollModal(empId) {
        try {
            const [empRes, faceSettings] = await Promise.all([
                API.get(`/employees/${empId}`),
                FaceService.getSettings()
            ]);
            const emp = empRes.data;
            if (!emp) {
                Toast.danger('Colaborador no encontrado.');
                return;
            }

            const stepsInfo = [
                { num: 1, title: '1. De frente', hint: 'Mira directamente a la cámara con expresión neutral.' },
                { num: 2, title: '2. Giro izq.', hint: 'Gira ligeramente tu rostro hacia la izquierda.' },
                { num: 3, title: '3. Giro der.', hint: 'Gira ligeramente tu rostro hacia la derecha.' }
            ];

            let capturedDescriptors = [];
            let isCameraReady = false;
            let isCapturing = false;
            let isModalActive = true;

            const content = `
                <div style="display: flex; flex-direction: column; gap: 1rem;">
                    <!-- Employee Header -->
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; background: var(--color-bg); padding: 0.85rem 1rem; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <div class="user-avatar-initial" style="width: 40px; height: 40px; font-size: 0.95rem;">
                                ${emp.first_name[0]}${emp.last_name[0]}
                            </div>
                            <div>
                                <strong style="color: var(--color-dark); display: block;">${emp.first_name} ${emp.last_name}</strong>
                                <span style="font-size: 0.78rem; color: var(--color-muted);">${emp.code} · ${emp.position_name || ''} (${emp.department_name || ''})</span>
                            </div>
                        </div>
                        <div>
                            ${emp.has_face_enrolled
                                ? `<span class="badge badge-success">Rostro Registrado</span>`
                                : `<span class="badge badge-secondary">Sin Registro Facial</span>`}
                        </div>
                    </div>

                    <!-- 3-Step Guidance -->
                    <div class="face-enroll-steps" id="face-enroll-steps">
                        ${stepsInfo.map((s, idx) => `
                            <div class="face-enroll-step ${idx === 0 ? 'active' : ''}" id="face-step-${idx}">
                                <div>${s.title}</div>
                                <div style="font-size: 0.7rem; opacity: 0.85;" id="face-step-state-${idx}">${idx === 0 ? 'Siguiente' : 'Pendiente'}</div>
                            </div>
                        `).join('')}
                    </div>

                    <!-- Camera Stage -->
                    <div class="face-camera-stage">
                        <video id="enroll-face-video" autoplay muted playsinline></video>
                        <canvas id="enroll-face-canvas"></canvas>
                        <div class="face-guide-oval" id="enroll-guide-oval"></div>
                        <div class="face-status-pill" id="enroll-status-pill">Cargando modelos biométricos locales...</div>
                    </div>

                    <!-- Step Hint & Capture Controls -->
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap;">
                        <small id="enroll-step-hint" style="color: var(--color-muted); font-size: 0.82rem; flex: 1;">
                            ${stepsInfo[0].hint}
                        </small>
                        <div style="display: flex; gap: 0.5rem;">
                            <button type="button" class="btn btn-secondary btn-sm" id="btn-enroll-reset" disabled>
                                Reiniciar
                            </button>
                            <button type="button" class="btn btn-primary btn-sm" id="btn-enroll-capture" disabled>
                                <span style="width: 16px; height: 16px; display: inline-flex;">${Icons.camera}</span>
                                <span id="btn-enroll-capture-label">Capturar Muestra (1/3)</span>
                            </button>
                        </div>
                    </div>

                    <!-- LFPDPPP Consent -->
                    <div style="background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 0.75rem 0.9rem;">
                        <label style="display: flex; align-items: flex-start; gap: 0.55rem; font-size: 0.8rem; color: var(--color-dark); cursor: pointer; margin: 0;">
                            <input type="checkbox" id="enroll-consent-chk" style="margin-top: 2px; width: 16px; height: 16px; accent-color: var(--color-primary); flex-shrink: 0;">
                            <span>
                                Confirmo que <strong>${emp.first_name} ${emp.last_name}</strong> otorgó su consentimiento para almacenar únicamente su vector matemático facial (sin guardar fotografías) con el fin exclusivo de control de asistencia.
                            </span>
                        </label>
                    </div>
                </div>
            `;

            const footer = `
                ${emp.has_face_enrolled ? `
                    <button type="button" class="btn btn-outline-danger" id="btn-enroll-delete" style="margin-right: auto;">
                        Eliminar Biometría
                    </button>
                ` : ''}
                <button type="button" class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
                <button type="button" class="btn btn-primary" id="btn-enroll-save" disabled>
                    <span style="width: 16px; height: 16px; display: inline-flex;">${Icons.shieldCheck}</span>
                    <span>Guardar Registro Facial</span>
                </button>
            `;

            Modal.open({
                title: 'Enrolamiento Biométrico Facial',
                content,
                size: 'md',
                footer,
                onClose: () => {
                    isModalActive = false;
                    FaceService.stopCamera();
                }
            });

            const videoEl = document.getElementById('enroll-face-video');
            const canvasEl = document.getElementById('enroll-face-canvas');
            const ovalEl = document.getElementById('enroll-guide-oval');
            const pillEl = document.getElementById('enroll-status-pill');
            const hintEl = document.getElementById('enroll-step-hint');
            const captureBtn = document.getElementById('btn-enroll-capture');
            const captureLabel = document.getElementById('btn-enroll-capture-label');
            const resetBtn = document.getElementById('btn-enroll-reset');
            const saveBtn = document.getElementById('btn-enroll-save');
            const consentChk = document.getElementById('enroll-consent-chk');
            const deleteBtn = document.getElementById('btn-enroll-delete');

            const setStatus = (text, variant = '') => {
                if (!pillEl) return;
                pillEl.textContent = text;
                pillEl.className = `face-status-pill ${variant}`.trim();
            };

            const updateControls = () => {
                const count = capturedDescriptors.length;
                stepsInfo.forEach((s, idx) => {
                    const stepEl = document.getElementById(`face-step-${idx}`);
                    const stateEl = document.getElementById(`face-step-state-${idx}`);
                    if (!stepEl || !stateEl) return;
                    stepEl.classList.remove('active', 'done');
                    if (idx < count) {
                        stepEl.classList.add('done');
                        stateEl.textContent = 'Capturada ✓';
                    } else if (idx === count) {
                        stepEl.classList.add('active');
                        stateEl.textContent = 'Siguiente';
                    } else {
                        stateEl.textContent = 'Pendiente';
                    }
                });

                if (count < 3) {
                    hintEl.textContent = stepsInfo[count].hint;
                    captureLabel.textContent = `Capturar Muestra (${count + 1}/3)`;
                    captureBtn.disabled = !isCameraReady || isCapturing;
                } else {
                    hintEl.textContent = '¡3 muestras capturadas! Marca el consentimiento y presiona "Guardar Registro Facial".';
                    captureLabel.textContent = 'Muestras Completas (3/3)';
                    captureBtn.disabled = true;
                }

                resetBtn.disabled = count === 0;
                saveBtn.disabled = count === 0 || !consentChk.checked;
            };

            consentChk.addEventListener('change', updateControls);

            resetBtn.addEventListener('click', () => {
                capturedDescriptors = [];
                ovalEl?.classList.remove('detected');
                if (canvasEl) {
                    const ctx = canvasEl.getContext('2d');
                    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
                }
                setStatus('Muestras reiniciadas. Listo para capturar (1/3).');
                updateControls();
            });

            captureBtn.addEventListener('click', async () => {
                if (!isCameraReady || isCapturing || capturedDescriptors.length >= 3) return;
                isCapturing = true;
                updateControls();
                setStatus('Analizando rostro, mantén la posición...');

                try {
                    const sample = await FaceService.captureEnrollmentSample(videoEl, faceSettings.detectorModel);
                    if (!isModalActive) return;

                    if (!sample.ok) {
                        ovalEl?.classList.remove('detected');
                        setStatus(sample.reason, 'warning');
                        FaceService.playFeedbackTone('warning');
                    } else {
                        capturedDescriptors.push(sample.descriptor);
                        ovalEl?.classList.add('detected');
                        FaceService.playFeedbackTone('success');

                        // Dibujar marco de confirmación breve sobre canvas
                        if (canvasEl && videoEl.videoWidth > 0) {
                            canvasEl.width = videoEl.videoWidth;
                            canvasEl.height = videoEl.videoHeight;
                            const ctx = canvasEl.getContext('2d');
                            ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
                            ctx.strokeStyle = '#4CAF50';
                            ctx.lineWidth = 3;
                            const { x, y, width, height } = sample.box;
                            ctx.strokeRect(x, y, width, height);
                            setTimeout(() => {
                                if (canvasEl) ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
                            }, 900);
                        }

                        if (capturedDescriptors.length < 3) {
                            setStatus(`Muestra ${capturedDescriptors.length}/3 capturada ✓`, 'success');
                        } else {
                            setStatus('¡3/3 muestras listas! Guarda el registro.', 'success');
                        }
                    }
                } catch (err) {
                    setStatus(err.message || 'Error al analizar la imagen del rostro.', 'danger');
                } finally {
                    isCapturing = false;
                    updateControls();
                }
            });

            saveBtn.addEventListener('click', async () => {
                if (capturedDescriptors.length === 0) {
                    Toast.warning('Captura al menos una muestra facial antes de guardar.');
                    return;
                }
                if (!consentChk.checked) {
                    Toast.warning('Debes confirmar el consentimiento del colaborador.');
                    return;
                }

                try {
                    saveBtn.disabled = true;
                    const res = await API.put(`/employees/${emp.id}/face-descriptor`, {
                        descriptors: capturedDescriptors,
                        consent: true
                    });
                    Toast.success(res.message || 'Registro facial guardado exitosamente.');
                    Modal.close();
                    if (this.infinityTable) {
                        this.infinityTable.resetAndLoad();
                    }
                } catch (err) {
                    Toast.danger(err.message || 'Error al guardar el registro facial.');
                    updateControls();
                }
            });

            if (deleteBtn) {
                deleteBtn.addEventListener('click', async () => {
                    if (!confirm(`¿Deseas eliminar los datos biométricos faciales de ${emp.first_name} ${emp.last_name}?`)) return;
                    try {
                        deleteBtn.disabled = true;
                        const res = await API.delete(`/employees/${emp.id}/face-descriptor`);
                        Toast.success(res.message || 'Datos biométricos eliminados.');
                        Modal.close();
                        if (this.infinityTable) {
                            this.infinityTable.resetAndLoad();
                        }
                    } catch (err) {
                        Toast.danger(err.message || 'No se pudieron eliminar los datos biométricos.');
                        deleteBtn.disabled = false;
                    }
                });
            }

            // Cargar modelos locales e iniciar cámara
            try {
                setStatus('Cargando modelos biométricos locales...');
                await FaceService.loadModels(faceSettings.detectorModel);
                if (!isModalActive) return;

                setStatus('Iniciando cámara web...');
                await FaceService.startCamera(videoEl);
                if (!isModalActive) {
                    FaceService.stopCamera();
                    return;
                }

                isCameraReady = true;
                setStatus('Cámara lista. Coloca el rostro dentro del óvalo y captura (1/3).', 'success');
                updateControls();
            } catch (initErr) {
                setStatus(initErr.message || 'No se pudo inicializar el reconocimiento facial.', 'danger');
                Toast.danger(initErr.message || 'No se pudo inicializar la cámara.');
            }
        } catch (err) {
            Toast.danger(err.message || 'Error al abrir el módulo de enrolamiento facial.');
        }
    }
};

window.EmployeesModule = EmployeesModule;
