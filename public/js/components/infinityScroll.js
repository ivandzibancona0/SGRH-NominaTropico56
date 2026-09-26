// ==========================================================
// INFINITY SCROLL COMPONENT FOR HIGH PERFORMANCE TABLES
// Proactive IntersectionObserver + Scroll Dual-Trigger
// ==========================================================

class InfinityScrollTable {
    constructor({
        containerElement,
        tbodyElement,
        fetchDataFunction,
        renderRowFunction,
        emptyMessage = 'No se encontraron registros',
        limit = 12
    }) {
        this.container = containerElement;
        this.tbody = tbodyElement;
        this.fetchData = fetchDataFunction;
        this.renderRow = renderRowFunction;
        this.emptyMessage = emptyMessage;
        this.limit = limit;

        this.page = 1;
        this.isLoading = false;
        this.hasMore = true;
        this.totalLoaded = 0;
        this.observer = null;
        this.sentinel = null;
        this.scrollHandler = null;

        this.setupSentinel();
        this.setupObserver();
        this.setupScrollListener();
    }

    setupSentinel() {
        this.sentinel = document.createElement('div');
        this.sentinel.className = 'infinity-sentinel';
        this.sentinel.innerHTML = `
            <div class="spinner"></div>
            <span>Cargando más registros...</span>
        `;
        this.sentinel.style.display = 'none';

        if (this.container) {
            this.container.appendChild(this.sentinel);
        }
    }

    setupObserver() {
        if ('IntersectionObserver' in window) {
            this.observer = new IntersectionObserver((entries) => {
                const entry = entries[0];
                if (entry.isIntersecting && !this.isLoading && this.hasMore) {
                    this.loadNextPage();
                }
            }, {
                root: null,
                rootMargin: '250px',
                threshold: 0
            });

            this.observer.observe(this.sentinel);
        }
    }

    setupScrollListener() {
        this.scrollHandler = () => {
            if (this.isLoading || !this.hasMore) return;
            const scrollY = window.scrollY || window.pageYOffset;
            const windowHeight = window.innerHeight;
            const docHeight = document.documentElement.scrollHeight;

            if (scrollY + windowHeight >= docHeight - 250) {
                this.loadNextPage();
            }
        };

        window.addEventListener('scroll', this.scrollHandler, { passive: true });
    }

    async resetAndLoad() {
        this.page = 1;
        this.hasMore = true;
        this.totalLoaded = 0;
        if (this.tbody) this.tbody.innerHTML = '';
        await this.loadNextPage();
    }

    async loadNextPage() {
        if (this.isLoading || !this.hasMore) return;

        this.isLoading = true;
        this.sentinel.style.display = 'flex';

        try {
            const response = await this.fetchData(this.page, this.limit);
            const items = response.data || [];
            const pagination = response.pagination || {};

            if (this.page === 1 && items.length === 0) {
                const colSpan = this.tbody.closest('table')?.querySelectorAll('th').length || 6;
                this.tbody.innerHTML = `
                    <tr>
                        <td colspan="${colSpan}" class="table-empty-state">
                            ${window.Icons?.search || ''}
                            <p>${this.emptyMessage}</p>
                        </td>
                    </tr>
                `;
                this.hasMore = false;
            } else {
                items.forEach((item, index) => {
                    const rowHtml = this.renderRow(item, this.totalLoaded + index + 1);
                    if (typeof rowHtml === 'string') {
                        const tr = document.createElement('tr');
                        tr.innerHTML = rowHtml;
                        this.tbody.appendChild(tr);
                    } else if (rowHtml instanceof HTMLElement) {
                        this.tbody.appendChild(rowHtml);
                    }
                });

                this.totalLoaded += items.length;
                this.hasMore = pagination.hasMore !== undefined ? pagination.hasMore : (items.length === this.limit);
                if (this.hasMore) {
                    this.page += 1;
                }
            }
        } catch (error) {
            console.error('Error al cargar datos en Infinity Scroll:', error);
            this.hasMore = false;
            if (window.Toast) Toast.danger('Error al cargar datos adicionales.');
        } finally {
            this.isLoading = false;
            // Always hide spinner when request finishes so it doesn't hang in viewport
            this.sentinel.style.display = 'none';

            // Check if viewport is still not full and we have more records to load
            if (this.hasMore && document.documentElement.scrollHeight <= window.innerHeight + 100) {
                setTimeout(() => {
                    if (this.hasMore && !this.isLoading) {
                        this.loadNextPage();
                    }
                }, 100);
            }
        }
    }

    destroy() {
        if (this.observer && this.sentinel) {
            this.observer.unobserve(this.sentinel);
            this.observer.disconnect();
        }
        if (this.scrollHandler) {
            window.removeEventListener('scroll', this.scrollHandler);
        }
        if (this.sentinel) this.sentinel.remove();
    }
}

window.InfinityScrollTable = InfinityScrollTable;
