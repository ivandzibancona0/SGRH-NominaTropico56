// ==========================================================
// SISTEMA DE GESTIÓN DE RECURSOS HUMANOS - TRÓPICO 56
// Reloj Checador Digital en Tiempo Real (Modal Kiosco Dual: Facial + Manual)
// ==========================================================

const PunchClock = {
    isOpen: false,
    timerInterval: null,
    employeesList: [],

    // Estado del modo biométrico facial
    activeMode: 'manual', // 'facial' | 'manual'
    faceSettings: null,
    faceMatcher: null,
    faceEmployeeMap: new Map(),
    faceEnrolledCount: 0,
    faceScanTimer: null,
    faceResumeTimer: null,
    faceScanActive: false,
    faceScanPaused: false,
    faceIsDetecting: false,
    faceSessionId: 0,

    // Estado de máquina en 2 fases (Identificación -> Liveness rápido)
    _scanPhase: 'identify', // 'identify' | 'liveness'
    _pendingEmployee: null,
    _streakLabel: null,
    _streakCount: 0,
    _livenessState: {
        startedAt: 0,
        missedFrames: 0,
        lastCenter: null,
        lastWidth: 0,
        earSamples: [],
        baselineEar: 0,
        closedFrames: 0,
        sawClosed: false,
        yawSamples: [],
        pitchSamples: [],
        baselineYaw: null,
        baselinePitch: null,
        headMoveFrames: 0
    },

    async open() {
        this.isOpen = true;
        this.faceSessionId++;
        const currentSession = this.faceSessionId;

        // Cargar empleados activos y parámetros biométricos en paralelo
        try {
            const [empRes, settings] = await Promise.all([
                API.get('/employees', { limit: 200 }),
                window.FaceService ? FaceService.getSettings() : Promise.resolve({ enabled: false, manualFallback: true })
            ]);
            this.employeesList = (empRes.data || []).filter(e => e.status === 'active');
            this.faceSettings = settings;
        } catch (e) {
            this.employeesList = [];
            this.faceSettings = { enabled: false, manualFallback: true };
        }

        if (!this.isOpen || currentSession !== this.faceSessionId) return;

        const faceEnabled = Boolean(window.FaceService && this.faceSettings?.enabled);
        const manualAllowed = this.faceSettings?.manualFallback !== false || !faceEnabled;
        this.activeMode = faceEnabled ? 'facial' : 'manual';

        const now = new Date();
        const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const dateFormatted = now.toLocaleDateString('es-MX', dateOptions);
        const capitalizedDate = dateFormatted.charAt(0).toUpperCase() + dateFormatted.slice(1);

        const content = `
            <div style="display: flex; flex-direction: column; gap: 1.15rem;">
                <!-- Digital Clock Display Card -->
                <div style="background: linear-gradient(135deg, var(--color-dark), #1A1614); border-radius: var(--radius-lg); padding: 1.25rem 1.5rem; text-align: center; color: #FFF; box-shadow: var(--shadow-md); position: relative; overflow: hidden;">
                    <div style="position: absolute; top: -20px; right: -20px; width: 100px; height: 100px; background: rgba(217, 91, 40, 0.15); border-radius: 50%; pointer-events: none;"></div>
                    
                    <div style="font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.15em; color: var(--color-gold); font-weight: 700; margin-bottom: 0.25rem;">
                        Trópico 56 · Reloj Checador
                    </div>
                    
                    <!-- Live Time Display -->
                    <div id="punch-live-clock" style="font-family: monospace; font-size: 2.5rem; font-weight: 800; letter-spacing: 0.05em; color: #FFFFFF; line-height: 1.1; margin: 0.35rem 0;">
                        00:00:00
                    </div>
                    
                    <div style="font-size: 0.85rem; color: #D1C7BD; font-weight: 500;">
                        ${capitalizedDate}
                    </div>
                </div>

                ${faceEnabled && manualAllowed ? `
                    <!-- Dual Mode Switcher Tabs -->
                    <div class="punch-mode-tabs" role="tablist">
                        <button type="button" class="punch-mode-tab active" id="tab-punch-facial" role="tab" aria-selected="true">
                            <span style="width: 17px; height: 17px; display: inline-flex;">${Icons.faceId}</span>
                            <span>Reconocimiento Facial</span>
                        </button>
                        <button type="button" class="punch-mode-tab" id="tab-punch-manual" role="tab" aria-selected="false">
                            <span style="width: 17px; height: 17px; display: inline-flex;">${Icons.search}</span>
                            <span>Registro Manual</span>
                        </button>
                    </div>
                ` : ''}

                <!-- PANEL 1: RECONOCIMIENTO FACIAL -->
                ${faceEnabled ? `
                    <div id="punch-panel-facial" style="display: ${this.activeMode === 'facial' ? 'flex' : 'none'}; flex-direction: column; gap: 0.75rem;">
                        <div class="face-camera-stage">
                            <video id="punch-face-video" autoplay muted playsinline></video>
                            <canvas id="punch-face-canvas"></canvas>
                            <div class="face-guide-oval" id="punch-face-oval"></div>
                            <div class="face-status-pill" id="punch-face-status">Inicializando reconocimiento facial...</div>
                            <div class="face-overlay-card" id="punch-face-overlay" style="display: none;"></div>
                        </div>

                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; flex-wrap: wrap; font-size: 0.78rem; color: var(--color-muted); padding: 0 0.15rem;">
                            <span id="punch-face-meta">Cargando catálogo biométrico...</span>
                            <div style="display: flex; gap: 0.4rem;">
                                ${this.faceSettings?.livenessRequired ? `
                                    <span class="badge badge-info" style="font-size: 0.7rem; padding: 0.2rem 0.5rem;">Antifraude: Parpadeo / Movimiento</span>
                                ` : ''}
                                <button type="button" class="btn btn-secondary btn-sm" id="btn-punch-face-reload" style="padding: 0.22rem 0.55rem; font-size: 0.74rem;" title="Recargar cámara y descriptores">
                                    Recargar cámara
                                </button>
                            </div>
                        </div>
                    </div>
                ` : ''}

                <!-- PANEL 2: REGISTRO MANUAL (RESPALDO) -->
                ${manualAllowed ? `
                    <div id="punch-panel-manual" style="display: ${this.activeMode === 'manual' ? 'flex' : 'none'}; flex-direction: column; gap: 1rem;">
                        <!-- Employee Search Filter -->
                        <div class="form-group" style="margin-bottom: 0;">
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
                ` : ''}
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

        // Wire dual mode tabs if both are present
        const tabFacial = document.getElementById('tab-punch-facial');
        const tabManual = document.getElementById('tab-punch-manual');
        if (tabFacial && tabManual) {
            tabFacial.addEventListener('click', () => this.switchMode('facial'));
            tabManual.addEventListener('click', () => this.switchMode('manual'));
        }

        const reloadFaceBtn = document.getElementById('btn-punch-face-reload');
        if (reloadFaceBtn) {
            reloadFaceBtn.addEventListener('click', () => this.startFaceMode());
        }

        // Wire manual search & selector if present
        const searchInput = document.getElementById('punch-emp-search');
        const selectEl = document.getElementById('punch-emp-select');
        if (searchInput && selectEl) {
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

                if (filtered.some(emp => String(emp.id) === String(currentSelected))) {
                    selectEl.value = currentSelected;
                } else if (filtered.length === 1 && term.length >= 2) {
                    selectEl.value = filtered[0].id;
                    this.loadEmployeePunchStatus(filtered[0].id);
                } else {
                    selectEl.value = '';
                    const statusEl = document.getElementById('punch-status-container');
                    if (statusEl) statusEl.style.display = 'none';
                }
            });

            selectEl.addEventListener('change', (e) => {
                const empId = e.target.value;
                if (empId) {
                    this.loadEmployeePunchStatus(empId);
                } else {
                    const statusEl = document.getElementById('punch-status-container');
                    if (statusEl) statusEl.style.display = 'none';
                }
            });
        }

        // Iniciar cámara si el modo activo es facial
        if (this.activeMode === 'facial') {
            await this.startFaceMode();
        }
    },

    async switchMode(mode) {
        if (this.activeMode === mode) return;
        this.activeMode = mode;

        const tabFacial = document.getElementById('tab-punch-facial');
        const tabManual = document.getElementById('tab-punch-manual');
        const panelFacial = document.getElementById('punch-panel-facial');
        const panelManual = document.getElementById('punch-panel-manual');

        if (tabFacial && tabManual) {
            tabFacial.classList.toggle('active', mode === 'facial');
            tabManual.classList.toggle('active', mode === 'manual');
            tabFacial.setAttribute('aria-selected', mode === 'facial' ? 'true' : 'false');
            tabManual.setAttribute('aria-selected', mode === 'manual' ? 'true' : 'false');
        }

        if (panelFacial) panelFacial.style.display = mode === 'facial' ? 'flex' : 'none';
        if (panelManual) panelManual.style.display = mode === 'manual' ? 'flex' : 'none';

        if (mode === 'facial') {
            await this.startFaceMode();
        } else {
            this.stopFaceMode();
        }
    },

    resetRecognitionTracking() {
        this._scanPhase = 'identify';
        this._pendingEmployee = null;
        this._streakLabel = null;
        this._streakCount = 0;
        this._livenessState = {
            startedAt: 0,
            missedFrames: 0,
            lastCenter: null,
            lastWidth: 0,
            earSamples: [],
            baselineEar: 0,
            closedFrames: 0,
            sawClosed: false,
            yawSamples: [],
            pitchSamples: [],
            baselineYaw: null,
            baselinePitch: null,
            headMoveFrames: 0
        };
    },

    drawFaceBox(ctx, box, label, strokeColor) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 3;
        ctx.strokeRect(box.x, box.y, box.width, box.height);

        ctx.save();
        ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
        const textWidth = ctx.measureText(label).width;
        const padX = 8;
        const labelH = 24;
        const labelY = Math.max(labelH + 4, box.y);
        ctx.fillStyle = strokeColor;
        ctx.fillRect(box.x, labelY - labelH, textWidth + padX * 2, labelH);

        // Invertir horizontalmente solo el texto para compensar transform: scaleX(-1) del canvas
        ctx.scale(-1, 1);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(label, -(box.x + textWidth + padX), labelY - 7);
        ctx.restore();
    },

    setFaceStatus(text, variant = '') {
        const pill = document.getElementById('punch-face-status');
        if (!pill) return;
        pill.textContent = text;
        pill.className = `face-status-pill ${variant}`.trim();
    },

    showFaceOverlay(htmlContent) {
        const overlay = document.getElementById('punch-face-overlay');
        if (!overlay) return;
        overlay.innerHTML = htmlContent;
        overlay.style.display = 'flex';
    },

    hideFaceOverlay() {
        const overlay = document.getElementById('punch-face-overlay');
        if (!overlay) return;
        overlay.style.display = 'none';
        overlay.innerHTML = '';
    },

    async startFaceMode() {
        this.stopFaceMode();
        this.faceSessionId++;
        const sessionId = this.faceSessionId;

        const videoEl = document.getElementById('punch-face-video');
        const metaEl = document.getElementById('punch-face-meta');
        if (!videoEl) return;

        this.hideFaceOverlay();
        this.resetRecognitionTracking();
        this.faceScanPaused = false;

        try {
            this.setFaceStatus('Cargando modelos biométricos locales...');
            const detectorModel = this.faceSettings?.detectorModel || 'ssd';
            const threshold = this.faceSettings?.threshold || 0.50;

            const [, descRes] = await Promise.all([
                FaceService.loadModels(detectorModel, Boolean(this.faceSettings?.livenessRequired)),
                API.get('/employees/face-descriptors')
            ]);

            if (!this.isOpen || this.activeMode !== 'facial' || sessionId !== this.faceSessionId) return;

            const built = FaceService.buildMatcher(descRes.data || [], threshold);
            this.faceMatcher = built.matcher;
            this.faceEmployeeMap = built.employeeMap;
            this.faceEnrolledCount = built.count;

            if (metaEl) {
                metaEl.textContent = `${this.faceEnrolledCount} colaborador${this.faceEnrolledCount === 1 ? '' : 'es'} con biometría activa`;
            }

            if (!this.faceMatcher || this.faceEnrolledCount === 0) {
                this.setFaceStatus('No hay rostros registrados aún.', 'warning');
                this.showFaceOverlay(`
                    <div style="width: 44px; height: 44px; color: var(--color-gold);">${Icons.faceId}</div>
                    <strong style="font-size: 1rem;">Sin colaboradores enrolados</strong>
                    <p style="font-size: 0.84rem; color: #D1C7BD; max-width: 320px; margin: 0;">
                        Registra primero el rostro de tus colaboradores desde el módulo <strong>Personal</strong>, o utiliza la pestaña <strong>Registro Manual</strong>.
                    </p>
                `);
                return;
            }

            this.setFaceStatus('Activando cámara web...');
            await FaceService.startCamera(videoEl);

            if (!this.isOpen || this.activeMode !== 'facial' || sessionId !== this.faceSessionId) {
                FaceService.stopCamera();
                return;
            }

            this.faceScanActive = true;
            this.setFaceStatus('Coloca tu rostro frente a la cámara para checar');
            this.scheduleNextFaceScan(sessionId, 200);
        } catch (err) {
            if (sessionId !== this.faceSessionId) return;
            this.setFaceStatus(err.message || 'Error al iniciar reconocimiento facial.', 'danger');
            this.showFaceOverlay(`
                <div style="width: 42px; height: 42px; color: #EF4444;">${Icons.camera}</div>
                <strong style="font-size: 0.98rem;">Cámara no disponible</strong>
                <p style="font-size: 0.82rem; color: #D1C7BD; max-width: 320px; margin: 0;">
                    ${err.message || 'Verifica los permisos de la cámara o utiliza el Registro Manual.'}
                </p>
            `);
        }
    },

    stopFaceMode() {
        this.faceScanActive = false;
        this.faceScanPaused = false;
        this.faceIsDetecting = false;
        if (this.faceScanTimer) {
            clearTimeout(this.faceScanTimer);
            this.faceScanTimer = null;
        }
        if (this.faceResumeTimer) {
            clearTimeout(this.faceResumeTimer);
            this.faceResumeTimer = null;
        }
        this.resetRecognitionTracking();
        if (window.FaceService) {
            FaceService.stopCamera();
        }
        const canvasEl = document.getElementById('punch-face-canvas');
        if (canvasEl) {
            const ctx = canvasEl.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
        }
    },

    scheduleNextFaceScan(sessionId, delayMs = 280) {
        if (this.faceScanTimer) clearTimeout(this.faceScanTimer);
        if (!this.faceScanActive || !this.isOpen || this.activeMode !== 'facial' || sessionId !== this.faceSessionId) {
            return;
        }
        this.faceScanTimer = setTimeout(() => this.runFaceScanTick(sessionId), delayMs);
    },

    async runFaceScanTick(sessionId) {
        if (!this.faceScanActive || !this.isOpen || this.activeMode !== 'facial' || sessionId !== this.faceSessionId) {
            return;
        }
        if (this.faceScanPaused || this.faceIsDetecting) {
            this.scheduleNextFaceScan(sessionId, 300);
            return;
        }

        const videoEl = document.getElementById('punch-face-video');
        const canvasEl = document.getElementById('punch-face-canvas');
        const ovalEl = document.getElementById('punch-face-oval');
        if (!videoEl || !canvasEl || videoEl.readyState < 2 || !this.faceMatcher) {
            this.scheduleNextFaceScan(sessionId, 300);
            return;
        }

        this.faceIsDetecting = true;
        try {
            // Sincronizar tamaño del canvas con el video real
            if (canvasEl.width !== videoEl.videoWidth || canvasEl.height !== videoEl.videoHeight) {
                canvasEl.width = videoEl.videoWidth;
                canvasEl.height = videoEl.videoHeight;
            }
            const ctx = canvasEl.getContext('2d');

            // ==========================================================
            // FASE 2: PRUEBA DE VIDA RÁPIDA (~15-25 FPS, sin descriptor)
            // ==========================================================
            if (this._scanPhase === 'liveness' && this._pendingEmployee) {
                const emp = this._pendingEmployee;
                const ls = this._livenessState;

                // Timeout de seguridad (6 segundos) para bloquear fotos estáticas
                if (Date.now() - ls.startedAt > 6000) {
                    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
                    ovalEl?.classList.remove('detected');
                    this.resetRecognitionTracking();
                    this.setFaceStatus('No se detectó prueba de vida. Intenta nuevamente.', 'warning');
                    return;
                }

                const fastDet = await FaceService.detectSingleLandmarksFast(videoEl);
                if (!this.faceScanActive || sessionId !== this.faceSessionId || this.faceScanPaused) {
                    return;
                }

                ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

                if (!fastDet) {
                    ls.missedFrames++;
                    if (ls.missedFrames > 10) {
                        ovalEl?.classList.remove('detected');
                        this.resetRecognitionTracking();
                        this.setFaceStatus('Rostro perdido. Colócate nuevamente frente a la cámara.');
                    }
                    return;
                }

                const box = fastDet.detection.box;
                const cx = box.x + box.width / 2;
                const cy = box.y + box.height / 2;

                // Verificar continuidad espacial para evitar intercambio de persona
                if (ls.lastCenter) {
                    const jumpDist = Math.hypot(cx - ls.lastCenter.x, cy - ls.lastCenter.y);
                    const maxAllowedJump = Math.max(ls.lastWidth || box.width, box.width) * 0.55;
                    if (jumpDist > maxAllowedJump) {
                        ovalEl?.classList.remove('detected');
                        this.resetRecognitionTracking();
                        this.setFaceStatus('Cambio brusco detectado. Identificando nuevamente...');
                        return;
                    }
                }

                ls.missedFrames = 0;
                ls.lastCenter = { x: cx, y: cy };
                ls.lastWidth = box.width;

                ovalEl?.classList.add('detected');
                const boxLabel = `${emp.first_name} · Confirmando...`;
                this.drawFaceBox(ctx, box, boxLabel, '#F59E0B');

                const ear = FaceService.computeEyeAspectRatio(fastDet.landmarks);
                const pose = FaceService.computeHeadPoseRatio(fastDet.landmarks);

                // Calibrar referencia con promedio móvil de los primeros 3 frames
                if (ls.earSamples.length < 3) {
                    if (ear !== null) ls.earSamples.push(ear);
                    if (pose) {
                        ls.yawSamples.push(pose.yaw);
                        ls.pitchSamples.push(pose.pitch);
                    }
                    if (ls.earSamples.length >= 3) {
                        ls.baselineEar = ls.earSamples.reduce((a, b) => a + b, 0) / ls.earSamples.length;
                        if (ls.yawSamples.length > 0) {
                            ls.baselineYaw = ls.yawSamples.reduce((a, b) => a + b, 0) / ls.yawSamples.length;
                            ls.baselinePitch = ls.pitchSamples.reduce((a, b) => a + b, 0) / ls.pitchSamples.length;
                        }
                    }
                    this.setFaceStatus(`Hola ${emp.first_name} — parpadea o mueve levemente la cabeza`, 'success');
                    return;
                }

                // 1) Señal A: Parpadeo natural calibrado
                let blinkConfirmed = false;
                if (ear !== null && ls.baselineEar > 0) {
                    const closeThreshold = Math.max(0.18, Math.min(0.25, ls.baselineEar * 0.89));
                    const reopenThreshold = Math.min(0.26, ls.baselineEar * 0.94);

                    if (ear <= closeThreshold) {
                        ls.sawClosed = true;
                        ls.closedFrames++;
                    }
                    if ((ls.sawClosed && ear >= reopenThreshold) || ls.closedFrames >= 2) {
                        blinkConfirmed = true;
                    }
                }

                // 2) Señal B: Ligero giro horizontal o asentimiento de cabeza en 3D
                let headMoveConfirmed = false;
                if (pose && ls.baselineYaw !== null && ls.baselinePitch !== null) {
                    const yawDelta = Math.abs(pose.yaw - ls.baselineYaw);
                    const pitchDelta = Math.abs(pose.pitch - ls.baselinePitch);
                    if (yawDelta >= 0.14 || pitchDelta >= 0.09) {
                        ls.headMoveFrames++;
                    } else {
                        ls.headMoveFrames = Math.max(0, ls.headMoveFrames - 1);
                    }
                    if (ls.headMoveFrames >= 2) {
                        headMoveConfirmed = true;
                    }
                }

                if (blinkConfirmed || headMoveConfirmed) {
                    this.drawFaceBox(ctx, box, `${emp.first_name} ✓`, '#4CAF50');
                    await this.handleFacialMatch(emp, sessionId);
                    return;
                }

                this.setFaceStatus(`Hola ${emp.first_name} — parpadea o mueve levemente la cabeza`, 'success');
                return;
            }

            // ==========================================================
            // FASE 1: IDENTIFICACIÓN (Detector configurado + FaceMatcher)
            // ==========================================================
            const detectorModel = this.faceSettings?.detectorModel || 'ssd';
            const detections = await FaceService.detectAllFaces(videoEl, detectorModel);

            if (!this.faceScanActive || sessionId !== this.faceSessionId || this.faceScanPaused) {
                return;
            }

            ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

            if (!detections || detections.length === 0) {
                ovalEl?.classList.remove('detected');
                this._livenessState.missedFrames++;
                if (this._livenessState.missedFrames >= 5) {
                    this.resetRecognitionTracking();
                    this.setFaceStatus('Coloca tu rostro frente a la cámara para checar');
                }
                return;
            }

            this._livenessState.missedFrames = 0;

            // Evaluar el rostro más grande/cercano presente en cámara
            const primary = detections.reduce((best, curr) => {
                const bestArea = best.detection.box.width * best.detection.box.height;
                const currArea = curr.detection.box.width * curr.detection.box.height;
                return currArea > bestArea ? curr : best;
            }, detections[0]);

            const bestMatch = this.faceMatcher.findBestMatch(primary.descriptor);
            const isMatched = bestMatch.label !== 'unknown';
            const matchedEmp = isMatched ? this.faceEmployeeMap.get(bestMatch.label) : null;
            const box = primary.detection.box;

            const strokeColor = isMatched ? '#4CAF50' : '#EF4444';
            const boxLabel = matchedEmp
                ? `${matchedEmp.first_name} ${matchedEmp.last_name.split(' ')[0]}`
                : 'No reconocido';
            this.drawFaceBox(ctx, box, boxLabel, strokeColor);

            if (!matchedEmp) {
                ovalEl?.classList.remove('detected');
                this.resetRecognitionTracking();
                this.setFaceStatus('Rostro no reconocido. Acércate o mejora la iluminación.', 'warning');
                return;
            }

            ovalEl?.classList.add('detected');

            // Estabilidad multi-frame (requerir 3 detecciones consecutivas del mismo colaborador)
            if (this._streakLabel === bestMatch.label) {
                this._streakCount++;
            } else {
                this.resetRecognitionTracking();
                this._streakLabel = bestMatch.label;
                this._streakCount = 1;
            }

            if (this._streakCount < 3) {
                this.setFaceStatus(`Identificando a ${matchedEmp.first_name}... (${this._streakCount}/3)`);
                return;
            }

            // Si la prueba de vida está activada, transicionar a Fase 2 rápida
            if (this.faceSettings?.livenessRequired) {
                const initEar = FaceService.computeEyeAspectRatio(primary.landmarks);
                const initPose = FaceService.computeHeadPoseRatio(primary.landmarks);

                this._scanPhase = 'liveness';
                this._pendingEmployee = matchedEmp;
                this._livenessState = {
                    startedAt: Date.now(),
                    missedFrames: 0,
                    lastCenter: { x: box.x + box.width / 2, y: box.y + box.height / 2 },
                    lastWidth: box.width,
                    earSamples: initEar !== null ? [initEar] : [],
                    baselineEar: 0,
                    closedFrames: 0,
                    sawClosed: false,
                    yawSamples: initPose ? [initPose.yaw] : [],
                    pitchSamples: initPose ? [initPose.pitch] : [],
                    baselineYaw: null,
                    baselinePitch: null,
                    headMoveFrames: 0
                };
                this.setFaceStatus(`Hola ${matchedEmp.first_name} — parpadea o mueve levemente la cabeza`, 'success');
                return;
            }

            // Sin prueba de vida: disparar registro directo
            await this.handleFacialMatch(matchedEmp, sessionId);
        } catch (err) {
            console.error('Error en ciclo de escaneo facial:', err);
        } finally {
            this.faceIsDetecting = false;
            if (this.faceScanActive && !this.faceScanPaused && sessionId === this.faceSessionId) {
                const nextDelay = this._scanPhase === 'liveness' ? 40 : 260;
                this.scheduleNextFaceScan(sessionId, nextDelay);
            }
        }
    },

    async handleFacialMatch(emp, sessionId) {
        this.faceScanPaused = true;
        this.resetRecognitionTracking();
        this.setFaceStatus(`Registrando checada de ${emp.first_name}...`, 'success');

        try {
            const res = await API.post('/attendance/punch', {
                employee_id: emp.id,
                type: 'auto',
                method: 'facial'
            });

            if (!this.isOpen || sessionId !== this.faceSessionId) return;

            if (res.type === 'already_completed') {
                FaceService.playFeedbackTone('warning');
                const rec = res.today_record || {};
                this.showFaceOverlay(`
                    <span class="badge badge-info" style="font-size: 0.8rem; padding: 0.35rem 0.8rem;">JORNADA COMPLETADA</span>
                    <h3 style="margin: 0.25rem 0 0; font-size: 1.25rem; color: #FFF;">${emp.first_name} ${emp.last_name}</h3>
                    <div style="font-size: 0.85rem; color: #D1C7BD;">
                        Entrada: <strong>${rec.check_in ? rec.check_in.substring(0, 5) : '--:--'}</strong> · Salida: <strong>${rec.check_out ? rec.check_out.substring(0, 5) : '--:--'}</strong>
                    </div>
                    <small style="color: #A89F96; margin-top: 0.35rem;">Reanudando escáner en unos segundos...</small>
                `);
            } else {
                const isCheckIn = res.type === 'check_in';
                const accentColor = isCheckIn ? '#4CAF50' : '#F59E0B';
                const badgeLabel = isCheckIn ? 'ENTRADA REGISTRADA' : 'SALIDA REGISTRADA';

                FaceService.playFeedbackTone('success');
                Toast.success(res.message);

                let extraNote = '';
                if (res.is_late) {
                    extraNote = `<span class="badge badge-warning" style="margin-top: 0.2rem;">Retardo detectado</span>`;
                } else if (res.is_early) {
                    extraNote = `<span class="badge badge-danger" style="margin-top: 0.2rem;">Salida anticipada</span>`;
                } else if (res.overtime_hours > 0) {
                    extraNote = `<span class="badge badge-gold" style="margin-top: 0.2rem;">+${res.overtime_hours} hr${res.overtime_hours > 1 ? 's' : ''} extra (Pendiente)</span>`;
                }

                this.showFaceOverlay(`
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: ${accentColor}; color: #FFF; display: flex; align-items: center; justify-content: center;">
                        <span style="width: 26px; height: 26px; display: inline-flex;">${Icons.check}</span>
                    </div>
                    <div style="font-size: 0.78rem; letter-spacing: 0.12em; font-weight: 800; color: ${accentColor};">${badgeLabel}</div>
                    <h3 style="margin: 0; font-size: 1.3rem; color: #FFF;">${emp.first_name} ${emp.last_name}</h3>
                    <div style="font-family: monospace; font-size: 1.55rem; font-weight: 800; color: var(--color-gold);">${res.time} HRS</div>
                    ${extraNote}
                    <small style="color: #A89F96; margin-top: 0.25rem;">Siguiente colaborador en 4 segundos...</small>
                `);

                // Refrescar tabla de asistencias si está abierta detrás del modal
                if (window.AttendanceModule?.infinityTable) {
                    window.AttendanceModule.loadStats();
                    window.AttendanceModule.infinityTable.resetAndLoad();
                }
            }
        } catch (err) {
            if (!this.isOpen || sessionId !== this.faceSessionId) return;

            const isCooldown = err.status === 429 || err.data?.code === 'COOLDOWN';
            FaceService.playFeedbackTone('warning');

            this.showFaceOverlay(`
                <span class="badge ${isCooldown ? 'badge-warning' : 'badge-danger'}" style="font-size: 0.78rem; padding: 0.35rem 0.75rem;">
                    ${isCooldown ? 'ESPERA REQUERIDA (COOLDOWN)' : 'REGISTRO BLOQUEADO'}
                </span>
                <h3 style="margin: 0.25rem 0 0; font-size: 1.15rem; color: #FFF;">${emp.first_name} ${emp.last_name}</h3>
                <p style="font-size: 0.85rem; color: #E5DDD5; max-width: 320px; margin: 0.25rem 0;">
                    ${err.message || 'No se pudo procesar la checada.'}
                </p>
                <small style="color: #A89F96;">Reanudando escáner en 4 segundos...</small>
            `);
        }

        // Pausa / debounce de 4.5 segundos antes de reanudar el escaneo continuo
        if (this.faceResumeTimer) clearTimeout(this.faceResumeTimer);
        this.faceResumeTimer = setTimeout(() => {
            if (!this.isOpen || this.activeMode !== 'facial' || sessionId !== this.faceSessionId) return;
            this.hideFaceOverlay();
            this.faceScanPaused = false;
            this.setFaceStatus('Coloca tu rostro frente a la cámara para checar');
            this.scheduleNextFaceScan(sessionId, 250);
        }, 4500);
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
            el.innerHTML = `${h}:${m}:${s} <span style="font-size: 1.1rem; color: var(--color-gold); font-weight: 600;">${ampm}</span>`;
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
            const res = await API.post('/attendance/punch', { employee_id: employeeId, type, method: 'manual' });
            if (res.success) {
                Toast.success(res.message);
                await this.loadEmployeePunchStatus(employeeId);

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
        this.faceSessionId++;
        this.stopFaceMode();
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
