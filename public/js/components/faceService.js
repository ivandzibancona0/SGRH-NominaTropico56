// ==========================================================
// SISTEMA DE GESTIÓN DE RECURSOS HUMANOS - TRÓPICO 56
// Servicio Compartido de Reconocimiento Facial (100% Local/Offline)
// Los archivos de pesos preentrenados residen en: /public/models (servidos en /models)
// La librería local reside en: /public/vendor/face-api.js (servida en /vendor/face-api.js)
// ==========================================================

const FaceService = {
    MODEL_URL: '/models',
    VENDOR_SCRIPT_URL: '/vendor/face-api.js',

    _scriptPromise: null,
    _loadedModels: {
        ssd: false,
        tiny: false,
        landmarks: false,
        recognition: false
    },
    _activeStream: null,
    _activeVideoEl: null,

    // Cargar la librería @vladmandic/face-api desde almacenamiento local (sin CDN)
    ensureLibraryLoaded() {
        if (window.faceapi) {
            return Promise.resolve(window.faceapi);
        }
        if (this._scriptPromise) {
            return this._scriptPromise;
        }
        this._scriptPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = this.VENDOR_SCRIPT_URL;
            script.async = true;
            script.onload = () => {
                if (window.faceapi) {
                    resolve(window.faceapi);
                } else {
                    this._scriptPromise = null;
                    reject(new Error('La librería local de reconocimiento facial no se inicializó correctamente.'));
                }
            };
            script.onerror = () => {
                this._scriptPromise = null;
                reject(new Error('No se pudo cargar /vendor/face-api.js. Verifica que el archivo exista en public/vendor/.'));
            };
            document.head.appendChild(script);
        });
        return this._scriptPromise;
    },

    // Cargar modelos preentrenados desde /models una sola vez (caché en memoria)
    async loadModels(detectorType = 'ssd', preloadTinyForLiveness = false) {
        const faceapi = await this.ensureLibraryLoaded();
        const tasks = [];

        if (detectorType === 'tiny' || preloadTinyForLiveness) {
            if (!this._loadedModels.tiny) {
                tasks.push(
                    faceapi.nets.tinyFaceDetector.loadFromUri(this.MODEL_URL).then(() => {
                        this._loadedModels.tiny = true;
                    })
                );
            }
        }
        if (detectorType !== 'tiny') {
            if (!this._loadedModels.ssd) {
                tasks.push(
                    faceapi.nets.ssdMobilenetv1.loadFromUri(this.MODEL_URL).then(() => {
                        this._loadedModels.ssd = true;
                    })
                );
            }
        }

        if (!this._loadedModels.landmarks) {
            tasks.push(
                faceapi.nets.faceLandmark68Net.loadFromUri(this.MODEL_URL).then(() => {
                    this._loadedModels.landmarks = true;
                })
            );
        }

        if (!this._loadedModels.recognition) {
            tasks.push(
                faceapi.nets.faceRecognitionNet.loadFromUri(this.MODEL_URL).then(() => {
                    this._loadedModels.recognition = true;
                })
            );
        }

        if (tasks.length > 0) {
            await Promise.all(tasks);
        }
        return faceapi;
    },

    // Consultar parámetros biométricos desde system_settings con valores por defecto seguros
    async getSettings() {
        const defaults = {
            enabled: true,
            threshold: 0.50,
            cooldownMinutes: 5,
            livenessRequired: true,
            detectorModel: 'ssd',
            manualFallback: true
        };

        try {
            const res = await API.get('/system/settings');
            if (res.success && res.settings) {
                const s = res.settings;
                const threshold = parseFloat(s.face_match_threshold);
                const cooldown = parseFloat(s.face_cooldown_minutes);
                return {
                    enabled: s.face_recognition_enabled !== '0',
                    threshold: Number.isFinite(threshold) && threshold >= 0.35 && threshold <= 0.65 ? threshold : defaults.threshold,
                    cooldownMinutes: Number.isFinite(cooldown) && cooldown >= 0 ? cooldown : defaults.cooldownMinutes,
                    livenessRequired: s.face_liveness_required !== '0',
                    detectorModel: s.face_detector_model === 'tiny' ? 'tiny' : 'ssd',
                    manualFallback: s.punch_manual_fallback !== '0'
                };
            }
        } catch (err) {
            console.warn('No se pudieron leer parámetros faciales, usando valores predeterminados:', err.message);
        }
        return defaults;
    },

    // Iniciar cámara web en resolución optimizada (640x480) con manejo claro de errores
    async startCamera(videoEl) {
        this.stopCamera();

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error(
                'El navegador no permite acceder a la cámara en este contexto. Asegúrate de abrir la aplicación desde http://localhost:3000 o HTTPS.'
            );
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                },
                audio: false
            });

            this._activeStream = stream;
            this._activeVideoEl = videoEl;
            videoEl.srcObject = stream;
            videoEl.muted = true;
            videoEl.playsInline = true;

            await new Promise((resolve, reject) => {
                const onLoaded = () => {
                    videoEl.removeEventListener('loadedmetadata', onLoaded);
                    videoEl.removeEventListener('error', onError);
                    videoEl.play().then(resolve).catch(resolve);
                };
                const onError = (e) => {
                    videoEl.removeEventListener('loadedmetadata', onLoaded);
                    videoEl.removeEventListener('error', onError);
                    reject(new Error('Error al reproducir el flujo de video de la cámara.'));
                };
                videoEl.addEventListener('loadedmetadata', onLoaded);
                videoEl.addEventListener('error', onError);
            });

            return stream;
        } catch (err) {
            let friendly = 'No se pudo acceder a la cámara web.';
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                friendly = 'Permiso de cámara denegado. Permite el acceso a la cámara en el navegador y vuelve a intentar.';
            } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                friendly = 'No se detectó ninguna cámara web conectada a este equipo.';
            } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
                friendly = 'La cámara está siendo utilizada por otra aplicación. Ciérrala e intenta nuevamente.';
            } else if (err.message) {
                friendly = err.message;
            }
            throw new Error(friendly);
        }
    },

    // Apagar siempre todos los tracks de la cámara para liberar el hardware
    stopCamera() {
        if (this._activeStream) {
            this._activeStream.getTracks().forEach(track => {
                try { track.stop(); } catch (e) {}
            });
            this._activeStream = null;
        }
        if (this._activeVideoEl) {
            try {
                this._activeVideoEl.pause();
                this._activeVideoEl.srcObject = null;
            } catch (e) {}
            this._activeVideoEl = null;
        }
    },

    getDetectorOptions(detectorType = 'ssd') {
        const faceapi = window.faceapi;
        if (detectorType === 'tiny') {
            return new faceapi.TinyFaceDetectorOptions({
                inputSize: 320,
                scoreThreshold: 0.5
            });
        }
        return new faceapi.SsdMobilenetv1Options({
            minConfidence: 0.55
        });
    },

    // Detectar rostros en vivo (landmarks + descriptor 128D) - Fase 1 Identificación
    async detectAllFaces(videoEl, detectorType = 'ssd') {
        if (!window.faceapi || !videoEl || videoEl.readyState < 2) return [];
        const options = this.getDetectorOptions(detectorType);
        return await window.faceapi
            .detectAllFaces(videoEl, options)
            .withFaceLandmarks()
            .withFaceDescriptors();
    },

    // Detección rápida solo con TinyFaceDetector + Landmarks (SIN descriptor 128D) - Fase 2 Liveness (~15-25 FPS)
    async detectSingleLandmarksFast(videoEl) {
        if (!window.faceapi || !videoEl || videoEl.readyState < 2) return null;
        const options = new window.faceapi.TinyFaceDetectorOptions({
            inputSize: 224,
            scoreThreshold: 0.45
        });
        return await window.faceapi
            .detectSingleFace(videoEl, options)
            .withFaceLandmarks();
    },

    // Detectar un único rostro con validación estricta de calidad para enrolamiento
    async captureEnrollmentSample(videoEl, detectorType = 'ssd') {
        const detections = await this.detectAllFaces(videoEl, detectorType);

        if (!detections || detections.length === 0) {
            return {
                ok: false,
                reason: 'No se detectó ningún rostro. Colócate frente a la cámara con buena iluminación.'
            };
        }

        if (detections.length > 1) {
            return {
                ok: false,
                reason: 'Se detectaron varios rostros en pantalla. Asegúrate de que solo esté el colaborador frente a la cámara.'
            };
        }

        const det = detections[0];
        const score = det.detection.score || 0;
        const box = det.detection.box;
        const minScore = detectorType === 'tiny' ? 0.65 : 0.78;

        if (score < minScore) {
            return {
                ok: false,
                reason: 'La imagen del rostro es poco nítida. Mejora la iluminación o acércate un poco.'
            };
        }

        if (box.width < 85 || box.height < 85) {
            return {
                ok: false,
                reason: 'El rostro está demasiado lejos de la cámara. Acércate un poco más.'
            };
        }

        return {
            ok: true,
            score,
            box,
            landmarks: det.landmarks,
            descriptor: Array.from(det.descriptor)
        };
    },

    // Calcular Eye Aspect Ratio (EAR) promedio de ambos ojos para prueba de vida por parpadeo
    computeEyeAspectRatio(landmarks) {
        if (!landmarks) return null;
        const leftEye = landmarks.getLeftEye();
        const rightEye = landmarks.getRightEye();
        if (!leftEye || leftEye.length < 6 || !rightEye || rightEye.length < 6) return null;

        const dist = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);
        const ear = (eye) => {
            const v1 = dist(eye[1], eye[5]);
            const v2 = dist(eye[2], eye[4]);
            const h = dist(eye[0], eye[3]);
            return h > 0 ? (v1 + v2) / (2.0 * h) : 0;
        };

        return (ear(leftEye) + ear(rightEye)) / 2.0;
    },

    // Calcular proporciones geométricas 3D de giro horizontal (yaw) y asentimiento vertical (pitch)
    computeHeadPoseRatio(landmarks) {
        if (!landmarks) return null;
        const leftEye = landmarks.getLeftEye();
        const rightEye = landmarks.getRightEye();
        const nose = landmarks.getNose();
        const mouth = landmarks.getMouth();
        if (!leftEye?.length || !rightEye?.length || !nose || nose.length < 4 || !mouth?.length) {
            return null;
        }

        const avgPt = (pts) => {
            let sx = 0, sy = 0;
            for (const p of pts) { sx += p.x; sy += p.y; }
            return { x: sx / pts.length, y: sy / pts.length };
        };

        const lEye = avgPt(leftEye);
        const rEye = avgPt(rightEye);
        const mouthC = avgPt(mouth);
        const noseTip = nose[3]; // Punta de la nariz en el modelo de 68 landmarks

        const eyeMidX = (lEye.x + rEye.x) / 2;
        const eyeMidY = (lEye.y + rEye.y) / 2;
        const eyeDist = Math.hypot(rEye.x - lEye.x, rEye.y - lEye.y);
        const eyeToMouth = Math.hypot(mouthC.x - eyeMidX, mouthC.y - eyeMidY);

        if (eyeDist < 10 || eyeToMouth < 10) return null;

        return {
            yaw: (noseTip.x - eyeMidX) / eyeDist,
            pitch: (noseTip.y - eyeMidY) / eyeToMouth
        };
    },

    // Construir FaceMatcher a partir de los descriptores retornados por la API
    buildMatcher(records, threshold = 0.50) {
        const faceapi = window.faceapi;
        const employeeMap = new Map();
        const labeledDescriptors = [];

        for (const emp of (records || [])) {
            if (!Array.isArray(emp.descriptors) || emp.descriptors.length === 0) continue;
            const floatVectors = emp.descriptors
                .filter(vec => Array.isArray(vec) && vec.length === 128)
                .map(vec => new Float32Array(vec));

            if (floatVectors.length > 0) {
                const label = String(emp.id);
                employeeMap.set(label, emp);
                labeledDescriptors.push(new faceapi.LabeledFaceDescriptors(label, floatVectors));
            }
        }

        const matcher = labeledDescriptors.length > 0
            ? new faceapi.FaceMatcher(labeledDescriptors, threshold)
            : null;

        return { matcher, employeeMap, count: labeledDescriptors.length };
    },

    // Pitido discreto de retroalimentación mediante Web Audio API (sin archivos de audio externos)
    playFeedbackTone(kind = 'success') {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            if (kind === 'success') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(740, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(1046, ctx.currentTime + 0.14);
                gain.gain.setValueAtTime(0.08, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.24);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.25);
            } else if (kind === 'warning') {
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(420, ctx.currentTime);
                gain.gain.setValueAtTime(0.07, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.23);
            }

            setTimeout(() => {
                try { ctx.close(); } catch (e) {}
            }, 350);
        } catch (e) {
            // Audio opcional no bloqueante
        }
    }
};

window.FaceService = FaceService;
