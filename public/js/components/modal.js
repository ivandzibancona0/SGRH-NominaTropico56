// Dynamic Modal Manager
const Modal = {
    overlay: null,
    currentModalId: null,

    init() {
        if (!this.overlay) {
            this.overlay = document.createElement('div');
            this.overlay.className = 'modal-overlay';
            this.overlay.id = 'global-modal-overlay';
            this.overlay.addEventListener('click', (e) => {
                if (e.target === this.overlay) {
                    this.close();
                }
            });
            document.body.appendChild(this.overlay);

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isOpen()) {
                    this.close();
                }
            });
        }
    },

    isOpen() {
        return this.overlay && this.overlay.classList.contains('active');
    },

    open({ title, content, size = '', footer = '', onClose = null }) {
        this.init();
        this.onCloseCallback = onClose;

        let sizeClass = '';
        if (size === 'lg') sizeClass = 'modal-lg';
        if (size === 'xl') sizeClass = 'modal-xl';

        this.overlay.innerHTML = `
            <div class="modal-container ${sizeClass}" role="dialog" aria-modal="true">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close-btn" id="btn-modal-close" aria-label="Cerrar">
                        ${Icons.x}
                    </button>
                </div>
                <div class="modal-body" id="modal-body-content">
                    ${typeof content === 'string' ? content : ''}
                </div>
                ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
            </div>
        `;

        if (typeof content !== 'string' && content instanceof HTMLElement) {
            const body = this.overlay.querySelector('#modal-body-content');
            body.appendChild(content);
        }

        document.getElementById('btn-modal-close').addEventListener('click', () => this.close());

        requestAnimationFrame(() => {
            this.overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    },

    close() {
        if (!this.overlay) return;
        this.overlay.classList.remove('active');
        document.body.style.overflow = '';
        if (typeof this.onCloseCallback === 'function') {
            this.onCloseCallback();
            this.onCloseCallback = null;
        }
    }
};

window.Modal = Modal;
