// Toast notifications system
const Toast = {
    container: null,

    init() {
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }
    },

    show(message, type = 'info', duration = 3500) {
        this.init();
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        let iconSvg = Icons.check;
        if (type === 'danger') iconSvg = Icons.alert || Icons.x;
        if (type === 'warning') iconSvg = Icons.incidents;

        toast.innerHTML = `
            <div style="width: 20px; height: 20px; flex-shrink: 0;">${iconSvg}</div>
            <div style="flex: 1;">${message}</div>
        `;

        this.container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    success(msg, dur) { this.show(msg, 'success', dur); },
    danger(msg, dur) { this.show(msg, 'danger', dur); },
    warning(msg, dur) { this.show(msg, 'warning', dur); },
    info(msg, dur) { this.show(msg, 'info', dur); }
};

window.Toast = Toast;
