/**
 * ============================================================================
 * ระบบบำบัดน้ำเสีย โรงพยาบาล ๕๐ พรรษา มหาวชิราลงกรณ (SPA)
 * INFLUENT.JS - บันทึกและจัดการปริมาณน้ำเสียเข้าระบบ (80% Wastewater)
 * ค้นหา & ปฏิบัติการข้อมูล, กรอง, นำเข้า, ส่งออก, พิมพ์ Excel/CSV, สร้างข้อมูลจำลอง
 * ============================================================================
 */

class InfluentModule {
    constructor() {
        this.items = [];
        this.filteredItems = [];
        this.editingId = null;
        this.uploadedAttachments = [];
        this.sortField = 'recorded_at';
        this.sortDir = 'desc';
        this.currentPage = 1;
        this.pageSize = 10;
        this.sortOrder = 'date_desc';
        this.filters = {
            search: '',
            category: 'all',
            building: 'all',
            startDate: '',
            endDate: '',
            year: 'all',
            month: 'all'
        };
    }

    async init() {
        this.bindEvents();
        await this.loadData();
    }

    bindEvents() {
        // Table Sorting
        const thSortDate = document.getElementById('th-sort-date');
        if (thSortDate) {
            thSortDate.addEventListener('click', () => {
                this.sortDir = this.sortDir === 'desc' ? 'asc' : 'desc';
                this.sortField = 'recorded_at';
                this.sortOrder = this.sortDir === 'desc' ? 'date_desc' : 'date_asc';
                const sortSelect = document.getElementById('filter-inf-sort-order');
                if (sortSelect) sortSelect.value = this.sortOrder;
                this.applyFilters();
            });
        }

        // Sort Order Dropdown
        const sortOrderEl = document.getElementById('filter-inf-sort-order');
        if (sortOrderEl) {
            sortOrderEl.addEventListener('change', (e) => {
                this.sortOrder = e.target.value;
                if (this.sortOrder === 'date_desc') {
                    this.sortField = 'recorded_at';
                    this.sortDir = 'desc';
                } else if (this.sortOrder === 'date_asc') {
                    this.sortField = 'recorded_at';
                    this.sortDir = 'asc';
                }
                this.currentPage = 1;
                this.applyFilters();
            });
        }

        // Page Size Dropdown
        const pageSizeEl = document.getElementById('filter-inf-page-size');
        if (pageSizeEl) {
            pageSizeEl.addEventListener('change', (e) => {
                this.pageSize = e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10);
                this.currentPage = 1;
                this.applyFilters();
            });
        }

        // Add Single Meter Modal Trigger
        const btnAdd = document.getElementById('btn-add-influent');
        if (btnAdd) btnAdd.addEventListener('click', () => this.openAddModal());

        // Add Auto-Gen Trigger
        const btnAddAuto = document.getElementById('btn-add-influent-auto');
        if (btnAddAuto) {
            btnAddAuto.addEventListener('click', () => {
                if (window.AutoGeneratorModule && typeof window.AutoGeneratorModule.openGeneratorModal === 'function') {
                    window.AutoGeneratorModule.openGeneratorModal('influent');
                } else if (window.App && typeof window.App.openModal === 'function') {
                    window.App.openModal('modal-auto-generator');
                }
            });
        }

        // Quick Action Toolbar Buttons
        const btnRefresh = document.getElementById('btn-inf-refresh');
        if (btnRefresh) btnRefresh.addEventListener('click', async () => {
            await this.loadData();
            Swal.fire({
                icon: 'success',
                title: 'รีเฟรชสำเร็จ',
                text: 'อัปเดตข้อมูลปริมาณน้ำเสียล่าสุดแล้ว',
                timer: 1000,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });
        });

        const btnPreview = document.getElementById('btn-inf-preview');
        if (btnPreview) btnPreview.addEventListener('click', () => this.previewData());

        const btnExcel = document.getElementById('btn-inf-excel');
        if (btnExcel) btnExcel.addEventListener('click', () => this.exportExcel());

        const btnPdf = document.getElementById('btn-inf-pdf');
        if (btnPdf) btnPdf.addEventListener('click', () => this.exportPDF());

        const btnCsv = document.getElementById('btn-inf-csv');
        if (btnCsv) btnCsv.addEventListener('click', () => this.exportCSV());

        const btnAutoGen = document.getElementById('btn-inf-auto-gen');
        if (btnAutoGen) {
            btnAutoGen.addEventListener('click', () => {
                if (window.AutoGeneratorModule && typeof window.AutoGeneratorModule.openGeneratorModal === 'function') {
                    window.AutoGeneratorModule.openGeneratorModal('influent');
                } else if (window.App && typeof window.App.openModal === 'function') {
                    window.App.openModal('modal-auto-generator');
                }
            });
        }

        const btnDummy = document.getElementById('btn-inf-dummy');
        if (btnDummy) btnDummy.addEventListener('click', async () => {
            if (window.ExportImportModule) {
                await window.ExportImportModule.seedSampleData();
                await this.loadData();
            }
        });

        const btnClear = document.getElementById('btn-inf-clear-all');
        if (btnClear) btnClear.addEventListener('click', () => this.clearAllData());

        // Filter Inputs
        const filterSearch = document.getElementById('filter-inf-search');
        if (filterSearch) {
            filterSearch.addEventListener('input', (e) => {
                this.filters.search = e.target.value.trim();
                this.currentPage = 1;
                this.applyFilters();
            });
        }

        const filterBuilding = document.getElementById('filter-inf-building');
        if (filterBuilding) {
            filterBuilding.addEventListener('change', (e) => {
                this.filters.building = e.target.value;
                this.currentPage = 1;
                this.applyFilters();
            });
        }

        const filterCategory = document.getElementById('filter-inf-category');
        if (filterCategory) {
            filterCategory.addEventListener('change', (e) => {
                this.filters.category = e.target.value;
                this.currentPage = 1;
                this.applyFilters();
            });
        }

        const filterStartDate = document.getElementById('filter-inf-start-date');
        if (filterStartDate) {
            filterStartDate.addEventListener('change', (e) => {
                this.filters.startDate = e.target.value;
                this.currentPage = 1;
                this.applyFilters();
            });
        }

        const filterEndDate = document.getElementById('filter-inf-end-date');
        if (filterEndDate) {
            filterEndDate.addEventListener('change', (e) => {
                this.filters.endDate = e.target.value;
                this.currentPage = 1;
                this.applyFilters();
            });
        }

        const filterYear = document.getElementById('filter-inf-year');
        if (filterYear) {
            filterYear.addEventListener('change', (e) => {
                this.filters.year = e.target.value;
                this.currentPage = 1;
                this.applyFilters();
            });
        }

        const filterMonth = document.getElementById('filter-inf-month');
        if (filterMonth) {
            filterMonth.addEventListener('change', (e) => {
                this.filters.month = e.target.value;
                this.currentPage = 1;
                this.applyFilters();
            });
        }

        // Quick Action Filter Pills
        const pillAll = document.getElementById('pill-inf-all');
        if (pillAll) pillAll.addEventListener('click', () => {
            this.resetFilters();
            this.setActivePill('pill-inf-all');
            this.applyFilters();
        });

        const pillThisYear = document.getElementById('pill-inf-this-year');
        if (pillThisYear) pillThisYear.addEventListener('click', () => {
            this.resetFilters();
            this.filters.year = '2569';
            const el = document.getElementById('filter-inf-year');
            if (el) el.value = '2569';
            this.setActivePill('pill-inf-this-year');
            this.applyFilters();
        });

        const pillThisMonth = document.getElementById('pill-inf-this-month');
        if (pillThisMonth) pillThisMonth.addEventListener('click', () => {
            this.resetFilters();
            this.filters.month = '8';
            this.filters.year = '2569';
            const elM = document.getElementById('filter-inf-month');
            if (elM) elM.value = '8';
            const elY = document.getElementById('filter-inf-year');
            if (elY) elY.value = '2569';
            this.setActivePill('pill-inf-this-month');
            this.applyFilters();
        });

        const pillToday = document.getElementById('pill-inf-today');
        if (pillToday) pillToday.addEventListener('click', () => {
            this.resetFilters();
            const todayStr = new Date().toISOString().split('T')[0];
            this.filters.startDate = todayStr;
            this.filters.endDate = todayStr;
            const elStart = document.getElementById('filter-inf-start-date');
            if (elStart) elStart.value = todayStr;
            const elEnd = document.getElementById('filter-inf-end-date');
            if (elEnd) elEnd.value = todayStr;
            this.setActivePill('pill-inf-today');
            this.applyFilters();
        });

        // Form Submit
        const form = document.getElementById('form-influent');
        if (form) {
            form.addEventListener('submit', (e) => this.handleFormSubmit(e));
        }

        // Live calculation in add/edit modal
        const startInput = document.getElementById('inf-form-meter-start') || document.getElementById('inf-meter-start');
        const endInput = document.getElementById('inf-form-meter-today') || document.getElementById('inf-meter-end');
        if (startInput && endInput) {
            const updateCalc = () => {
                const s = parseFloat(startInput.value) || 0;
                const en = parseFloat(endInput.value) || 0;
                const used = Math.max(0, en - s);
                const waste = used * 0.80;

                const usedEl = document.getElementById('inf-form-total-used') || document.getElementById('inf-calc-water-used');
                const wasteEl = document.getElementById('inf-form-wastewater') || document.getElementById('inf-calc-wastewater');
                if (usedEl) {
                    if (usedEl.tagName === 'INPUT') usedEl.value = used.toFixed(2);
                    else usedEl.textContent = used.toFixed(2);
                }
                if (wasteEl) {
                    if (wasteEl.tagName === 'INPUT') wasteEl.value = waste.toFixed(2);
                    else wasteEl.textContent = waste.toFixed(2);
                }
            };
            startInput.addEventListener('input', updateCalc);
            endInput.addEventListener('input', updateCalc);
        }
    }

    setActivePill(activeId) {
        ['pill-inf-all', 'pill-inf-this-year', 'pill-inf-this-month', 'pill-inf-today'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                if (id === activeId) {
                    el.classList.add('active', 'border-emerald-500/40', 'text-emerald-400', 'bg-emerald-950/40');
                    el.classList.remove('border-slate-700', 'text-slate-300', 'bg-slate-900/60');
                } else {
                    el.classList.remove('active', 'border-emerald-500/40', 'text-emerald-400', 'bg-emerald-950/40');
                    el.classList.add('border-slate-700', 'text-slate-300', 'bg-slate-900/60');
                }
            }
        });
    }

    resetFilters() {
        this.filters = {
            search: '',
            category: 'all',
            building: 'all',
            startDate: '',
            endDate: '',
            year: 'all',
            month: 'all'
        };
        const ids = ['filter-inf-search', 'filter-inf-building', 'filter-inf-category', 'filter-inf-start-date', 'filter-inf-end-date', 'filter-inf-year', 'filter-inf-month'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = el.tagName === 'SELECT' ? (id.includes('year') ? '2569' : (id.includes('month') ? '8' : 'all')) : '';
        });
    }

    async loadData() {
        this.items = await window.DataStore.getAll('influent_wastewater', { orderBy: 'recorded_at', ascending: false });
        this.applyFilters();
    }

    applyFilters() {
        this.filteredItems = this.items.filter(item => {
            if (this.filters.search) {
                const q = this.filters.search.toLowerCase();
                const matchSource = (item.water_source || item.sampling_point || '').toLowerCase().includes(q);
                const matchRecorder = (item.recorded_by || item.recorder_name || '').toLowerCase().includes(q);
                const matchNotes = (item.notes || item.note || '').toLowerCase().includes(q);
                if (!matchSource && !matchRecorder && !matchNotes) return false;
            }

            if (this.filters.building !== 'all') {
                const source = item.water_source || item.sampling_point || '';
                if (!source.includes(this.filters.building)) return false;
            }

            if (this.filters.startDate) {
                const itemDate = (item.recorded_at || '').substring(0, 10);
                if (itemDate < this.filters.startDate) return false;
            }

            if (this.filters.endDate) {
                const itemDate = (item.recorded_at || '').substring(0, 10);
                if (itemDate > this.filters.endDate) return false;
            }

            if (this.filters.year !== 'all') {
                const itemYear = new Date(item.recorded_at).getFullYear();
                const targetGregorianYear = parseInt(this.filters.year, 10) - 543;
                if (itemYear !== targetGregorianYear && itemYear !== parseInt(this.filters.year, 10)) return false;
            }

            if (this.filters.month !== 'all') {
                const itemMonth = new Date(item.recorded_at).getMonth() + 1;
                if (itemMonth !== parseInt(this.filters.month, 10)) return false;
            }

            return true;
        });

        // Sort items
        this.filteredItems.sort((a, b) => {
            let valA = a[this.sortField] || '';
            let valB = b[this.sortField] || '';
            if (this.sortDir === 'desc') {
                return valA < valB ? 1 : -1;
            } else {
                return valA > valB ? 1 : -1;
            }
        });

        this.renderTable(this.filteredItems);
    }

    renderTable(list) {
        const tbody = document.getElementById('table-influent-body');
        if (!tbody) return;

        const totalItems = list ? list.length : 0;

        // Update count badge in panel header
        const countBadge = document.getElementById('inf-total-count-badge');
        if (countBadge) countBadge.textContent = totalItems.toLocaleString();

        // Calculate Totals
        let totalWater = 0;
        let totalWastewater = 0;

        if (list && list.length > 0) {
            list.forEach(item => {
                const waterUsed = parseFloat(item.total_water_used !== undefined ? item.total_water_used : (item.tap_water_used !== undefined ? item.tap_water_used : 0));
                const wasteUsed = parseFloat(item.wastewater_influent !== undefined ? item.wastewater_influent : (item.wastewater_80 !== undefined ? item.wastewater_80 : 0));
                totalWater += isNaN(waterUsed) ? 0 : waterUsed;
                totalWastewater += isNaN(wasteUsed) ? 0 : wasteUsed;
            });
        }

        const avgWater = totalItems > 0 ? (totalWater / totalItems) : 0;
        const avgWastewater = totalItems > 0 ? (totalWastewater / totalItems) : 0;

        if (!list || list.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center py-8 text-slate-500">
                        <i class="fa-solid fa-inbox text-3xl mb-2"></i>
                        <div>ไม่พบรายการข้อมูลตามเงื่อนไขการค้นหา</div>
                    </td>
                </tr>
            `;
            const tfoot = document.getElementById('table-influent-foot');
            if (tfoot) tfoot.innerHTML = '';

            if (window.App && window.App.renderPagination) {
                window.App.renderPagination({
                    containerId: 'pagination-influent',
                    totalItems: 0,
                    currentPage: this.currentPage,
                    pageSize: this.pageSize,
                    summaryCards: [
                        { title: 'จำนวนรายการข้อมูลรวม', value: '0 รายการ', subText: 'ตามเงื่อนไขตัวกรองที่เลือก', icon: 'fa-solid fa-list-check', color: 'cyan' },
                        { title: 'ปริมาณน้ำประปารวม (TOTAL WATER)', value: '0.00 ลบ.ม.', subText: 'เฉลี่ย 0.00 ลบ.ม./รายการ', icon: 'fa-solid fa-faucet-drip', color: 'blue' },
                        { title: 'ปริมาณน้ำเสียประเมินรวม (TOTAL INFLOW)', value: '0.00 ลบ.ม.', subText: 'คิดเป็น 0.00 ลบ.ม./วัน (80%)', icon: 'fa-solid fa-water', color: 'emerald' },
                        { title: 'สถานะการกรองข้อมูล', value: 'ไม่พบรายการ', subText: 'กรุณาปรับเปลี่ยนตัวกรอง', icon: 'fa-solid fa-filter', color: 'purple' }
                    ]
                });
            }
            return;
        }

        const isAll = this.pageSize === 'all' || parseInt(this.pageSize, 10) >= 99999;
        const actualPageSize = isAll ? totalItems : parseInt(this.pageSize, 10);
        const totalPages = isAll ? 1 : Math.ceil(totalItems / actualPageSize);
        if (this.currentPage > totalPages) this.currentPage = 1;

        const startIndex = (this.currentPage - 1) * actualPageSize;
        const pageItems = isAll ? list : list.slice(startIndex, startIndex + actualPageSize);

        tbody.innerHTML = pageItems.map((item, idx) => {
            const globalIdx = startIndex + idx + 1;
            const meterStart = parseFloat(item.meter_start !== undefined ? item.meter_start : (item.meter_yesterday !== undefined ? item.meter_yesterday : 0)) || 0;
            const meterEnd = parseFloat(item.meter_today !== undefined ? item.meter_today : (item.meter_end !== undefined ? item.meter_end : 0)) || 0;
            const waterUsed = parseFloat(item.total_water_used !== undefined ? item.total_water_used : (item.tap_water_used !== undefined ? item.tap_water_used : 0)) || 0;
            const wastewater = parseFloat(item.wastewater_influent !== undefined ? item.wastewater_influent : (item.wastewater_80 !== undefined ? item.wastewater_80 : 0)) || 0;

            const sourceTitle = item.water_source || item.sampling_point || 'ระบบบำบัดรวมโรงพยาบาล';
            const sourceDetail = item.source_detail || item.notes || item.note || '(รวมทุกอาคารบริการผู้ป่วย, อาคารผู้ป่วยนอก, อาคารผู้ป่วยใน ฯลฯ)';
            const recorder = item.recorded_by || item.recorder_name || 'แสงตะวัน ชาวเขา';

            return `
            <tr class="hover:bg-slate-800/40 transition-colors">
                <td class="text-slate-400 font-mono text-center font-semibold text-xs">${globalIdx}</td>
                <td class="font-mono text-xs text-slate-300 whitespace-nowrap">${window.App ? window.App.formatDateTime(item.recorded_at) : item.recorded_at}</td>
                <td>
                    <div class="font-semibold text-slate-200 text-xs">${sourceTitle}</div>
                    <div class="text-[10px] text-slate-500 font-normal mt-0.5 leading-tight">${sourceDetail}</div>
                </td>
                <td class="font-mono text-right text-slate-300 text-xs">${meterStart > 0 ? meterStart.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
                <td class="font-mono text-right text-slate-200 font-semibold text-xs">${meterEnd > 0 ? meterEnd.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
                <td class="font-mono text-right text-cyan-400 font-bold text-xs sm:text-sm">${waterUsed.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td class="font-mono text-right text-emerald-400 font-bold text-xs sm:text-sm">${wastewater.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td class="text-xs text-slate-300 text-center whitespace-nowrap">${recorder}</td>
                <td class="text-center">
                    <div class="flex items-center justify-center gap-1.5">
                        <button type="button" class="w-7 h-7 rounded-lg bg-blue-500/15 hover:bg-blue-500 text-blue-400 hover:text-white border border-blue-500/30 flex items-center justify-center transition" onclick="window.InfluentModule.viewDetails('${item.id}')" title="ดูรายละเอียด">
                            <i class="fa-solid fa-eye text-xs"></i>
                        </button>
                        <button type="button" class="w-7 h-7 rounded-lg bg-amber-500/15 hover:bg-amber-500 text-amber-400 hover:text-white border border-amber-500/30 flex items-center justify-center transition" onclick="window.InfluentModule.openEditModal('${item.id}')" title="แก้ไข">
                            <i class="fa-solid fa-pen-to-square text-xs"></i>
                        </button>
                        <button type="button" class="w-7 h-7 rounded-lg bg-rose-500/15 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/30 flex items-center justify-center transition" onclick="window.InfluentModule.deleteRecord('${item.id}')" title="ลบ">
                            <i class="fa-solid fa-trash-can text-xs"></i>
                        </button>
                    </div>
                </td>
            </tr>
            `;
        }).join('');

        // Table Summary Footer
        const tfoot = document.getElementById('table-influent-foot');
        if (tfoot) {
            tfoot.innerHTML = `
                <tr class="table-summary-row border-t-2 border-emerald-500/60 bg-emerald-950/20">
                    <td class="text-center font-bold text-emerald-400 py-3.5"><i class="fa-solid fa-calculator"></i></td>
                    <td colspan="4" class="font-bold text-emerald-300 py-3.5">
                        <span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> ยอดรวมทั้งสิ้น (${totalItems.toLocaleString()} รายการ):</span>
                    </td>
                    <td class="font-mono text-right text-cyan-400 font-bold py-3.5 text-sm">${totalWater.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ลบ.ม.</td>
                    <td class="font-mono text-right text-emerald-400 font-bold py-3.5 text-sm">${totalWastewater.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ลบ.ม.</td>
                    <td colspan="2" class="text-center text-xs text-slate-300 py-3.5 font-mono">เฉลี่ย: ${(totalItems > 0 ? (totalWastewater / totalItems).toFixed(2) : '0.00')} ลบ.ม. / วัน</td>
                </tr>
            `;
        }

        // Summary Cards Configuration (Matching Exact 4 Cards in Reference Mockup)
        const summaryCards = [
            {
                title: 'จำนวนรายการข้อมูลรวม',
                value: `${totalItems.toLocaleString()} รายการ`,
                subText: 'ตามเงื่อนไขตัวกรองที่เลือก',
                icon: 'fa-solid fa-list-check',
                color: 'cyan'
            },
            {
                title: 'ปริมาณน้ำประปารวม (TOTAL WATER)',
                value: `${totalWater.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ลบ.ม.`,
                subText: `เฉลี่ย ${(avgWater).toFixed(2)} ลบ.ม./รายการ`,
                icon: 'fa-solid fa-faucet-drip',
                color: 'blue'
            },
            {
                title: 'ปริมาณน้ำเสียประเมินรวม (TOTAL INFLOW)',
                value: `${totalWastewater.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ลบ.ม.`,
                subText: `คิดเป็น ${(avgWastewater).toFixed(2)} ลบ.ม./วัน (80%)`,
                icon: 'fa-solid fa-water',
                color: 'emerald'
            },
            {
                title: 'สถานะการกรองข้อมูล',
                value: this.filters.search || this.filters.building !== 'all' ? 'กำลังกรองข้อมูล' : 'แสดงข้อความทั้งหมด',
                subText: `ทั้งหมดตามเงื่อนไข (${totalItems.toLocaleString()} รายการ)`,
                icon: 'fa-solid fa-filter',
                color: 'purple'
            }
        ];

        if (window.App && window.App.renderPagination) {
            window.App.renderPagination({
                containerId: 'pagination-influent',
                totalItems: totalItems,
                currentPage: this.currentPage,
                pageSize: this.pageSize,
                summaryCards: summaryCards,
                onPageChange: (newPage) => {
                    this.currentPage = newPage;
                    this.renderTable(this.filteredItems);
                },
                onPageSizeChange: (newSize) => {
                    this.pageSize = newSize;
                    this.currentPage = 1;
                    this.renderTable(this.filteredItems);
                }
            });
        }
    }

    openAddModal() {
        this.editingId = null;
        const form = document.getElementById('form-influent');
        const title = document.getElementById('modal-influent-title');
        if (!form) return;

        form.reset();
        if (title) title.innerHTML = '<i class="fa-solid fa-plus-circle text-blue-400"></i> ลงบันทึกปริมาณน้ำเสียเข้าระบบ';

        const dateInput = document.getElementById('inf-form-datetime') || document.getElementById('inf-form-date');
        if (dateInput) {
            const now = new Date();
            const localIso = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
            dateInput.value = localIso;
        }

        const sourceInput = document.getElementById('inf-form-source');
        if (sourceInput) sourceInput.value = 'รวมทุกอาคารโรงพยาบาล';

        const recorderInput = document.getElementById('inf-form-recorded-by') || document.getElementById('inf-form-recorder');
        if (recorderInput && window.AuthService) {
            const user = window.AuthService.getCurrentUser();
            recorderInput.value = user ? (user.full_name || user.username) : 'แสงตะวัน ชาวเขา';
        }

        const startInput = document.getElementById('inf-form-meter-start') || document.getElementById('inf-meter-start');
        if (startInput) {
            let lastMeter = 440924.22;
            if (this.items && this.items.length > 0) {
                const found = this.items.find(x => x.meter_today || x.meter_end);
                if (found) lastMeter = parseFloat(found.meter_today || found.meter_end) || lastMeter;
            }
            startInput.value = lastMeter;
        }

        const endInput = document.getElementById('inf-form-meter-today') || document.getElementById('inf-meter-end');
        if (endInput) endInput.value = '';

        const usedEl = document.getElementById('inf-form-total-used') || document.getElementById('inf-calc-water-used');
        const wasteEl = document.getElementById('inf-form-wastewater') || document.getElementById('inf-calc-wastewater');
        if (usedEl) { if (usedEl.tagName === 'INPUT') usedEl.value = '0.00'; else usedEl.textContent = '0.00'; }
        if (wasteEl) { if (wasteEl.tagName === 'INPUT') wasteEl.value = '0.00'; else wasteEl.textContent = '0.00'; }

        this.uploadedAttachments = [];
        if (window.AttachmentManager) {
            window.AttachmentManager.updateContainerDisplay(this, 'uploadedAttachments', 'inf-image-gallery-container', 'inf-image-count-badge', 'blue', false);
        }

        window.App.openModal('modal-influent');
    }

    autoFillForm() {
        // ดึงมิเตอร์เริ่มต้นจากฟอร์ม หรือมิเตอร์ล่าสุดในระบบ
        const startInput = document.getElementById('inf-form-meter-start') || document.getElementById('inf-meter-start');
        let startVal = parseFloat(startInput?.value);
        if (isNaN(startVal) || startVal <= 0) {
            if (this.items && this.items.length > 0) {
                const found = this.items.find(x => x.meter_today || x.meter_end);
                if (found) startVal = parseFloat(found.meter_today || found.meter_end) || 440924.22;
            } else {
                startVal = 440924.22;
            }
            if (startInput) startInput.value = startVal.toFixed(2);
        }

        // จำลองการใช้น้ำสมจริงของ รพ.๕๐ พรรษาฯ (~200 ลบ.ม. ต่อวัน + สุ่ม variance -5 ถึง +5)
        const randVar = (Math.random() - 0.5) * 10;
        const waterUsed = Math.round((200.0 + randVar) * 100) / 100;
        const endVal = Math.round((startVal + waterUsed) * 100) / 100;
        const wastewater = Math.round((waterUsed * 0.80) * 100) / 100;

        const endInput = document.getElementById('inf-form-meter-today') || document.getElementById('inf-meter-end');
        if (endInput) endInput.value = endVal.toFixed(2);

        const usedEl = document.getElementById('inf-form-total-used') || document.getElementById('inf-calc-water-used');
        const wasteEl = document.getElementById('inf-form-wastewater') || document.getElementById('inf-calc-wastewater');
        if (usedEl) {
            if (usedEl.tagName === 'INPUT') usedEl.value = waterUsed.toFixed(2);
            else usedEl.textContent = waterUsed.toFixed(2);
        }
        if (wasteEl) {
            if (wasteEl.tagName === 'INPUT') wasteEl.value = wastewater.toFixed(2);
            else wasteEl.textContent = wastewater.toFixed(2);
        }

        const notesInput = document.getElementById('inf-form-notes');
        if (notesInput && !notesInput.value) {
            notesInput.value = 'บันทึกอัตโนมัติประจำวัน น้ำเข้าสู่ระบบปกติ 100%';
        }

        const recorderInput = document.getElementById('inf-form-recorded-by') || document.getElementById('inf-form-recorder');
        if (recorderInput && !recorderInput.value && window.AuthService) {
            const user = window.AuthService.getCurrentUser();
            recorderInput.value = user ? (user.full_name || user.username) : 'แสงตะวัน ชาวเขา';
        }

        Swal.fire({
            icon: 'success',
            title: 'เติมค่าอัตโนมัติเรียบร้อย',
            html: `<div class="text-xs text-slate-300">น้ำใช้: <strong class="text-cyan-400 font-mono">${waterUsed}</strong> ลบ.ม. | น้ำเสีย 80%: <strong class="text-emerald-400 font-mono">${wastewater}</strong> ลบ.ม.</div>`,
            timer: 1200,
            showConfirmButton: false,
            toast: true,
            position: 'top-end',
            background: '#0c1322',
            color: '#f8fafc'
        });
    }

    openEditModal(id) {
        const item = this.items.find(x => x.id === id);
        if (!item) return;

        this.editingId = id;
        const form = document.getElementById('form-influent');
        const title = document.getElementById('modal-influent-title');
        if (!form) return;

        if (title) title.innerHTML = '<i class="fa-solid fa-pen-to-square text-amber-400"></i> แก้ไขบันทึกปริมาณน้ำเสีย';

        const dateInput = document.getElementById('inf-form-datetime') || document.getElementById('inf-form-date');
        if (dateInput) {
            const d = new Date(item.recorded_at);
            const localIso = !isNaN(d) ? new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16) : (item.recorded_at || '').substring(0, 16);
            dateInput.value = localIso;
        }

        const sourceInput = document.getElementById('inf-form-source');
        if (sourceInput) sourceInput.value = item.water_source || item.sampling_point || 'รวมทุกอาคารโรงพยาบาล';

        const startInput = document.getElementById('inf-form-meter-start') || document.getElementById('inf-meter-start');
        const endInput = document.getElementById('inf-form-meter-today') || document.getElementById('inf-meter-end');

        const sVal = item.meter_start !== undefined && item.meter_start !== null ? item.meter_start : (item.meter_yesterday || 0);
        const eVal = item.meter_today !== undefined && item.meter_today !== null ? item.meter_today : (item.meter_end || 0);

        if (startInput) startInput.value = sVal;
        if (endInput) endInput.value = eVal;

        const s = parseFloat(sVal) || 0;
        const en = parseFloat(eVal) || 0;
        const used = item.total_water_used !== undefined ? item.total_water_used : Math.max(0, en - s);
        const waste = item.wastewater_influent !== undefined ? item.wastewater_influent : used * 0.80;

        const usedEl = document.getElementById('inf-form-total-used') || document.getElementById('inf-calc-water-used');
        const wasteEl = document.getElementById('inf-form-wastewater') || document.getElementById('inf-calc-wastewater');
        if (usedEl) {
            if (usedEl.tagName === 'INPUT') usedEl.value = parseFloat(used).toFixed(2);
            else usedEl.textContent = parseFloat(used).toFixed(2);
        }
        if (wasteEl) {
            if (wasteEl.tagName === 'INPUT') wasteEl.value = parseFloat(waste).toFixed(2);
            else wasteEl.textContent = parseFloat(waste).toFixed(2);
        }

        const notesInput = document.getElementById('inf-form-notes');
        if (notesInput) notesInput.value = item.notes || item.note || '';

        const recorderInput = document.getElementById('inf-form-recorded-by') || document.getElementById('inf-form-recorder');
        if (recorderInput) recorderInput.value = item.recorded_by || item.recorder_name || 'แสงตะวัน ชาวเขา';

        const imgInput = document.getElementById('inf-form-image');
        if (imgInput) imgInput.value = item.meter_image_url || '';

        this.uploadedAttachments = Array.isArray(item.attachments) ? [...item.attachments] : [];
        if (window.AttachmentManager) {
            window.AttachmentManager.updateContainerDisplay(this, 'uploadedAttachments', 'inf-image-gallery-container', 'inf-image-count-badge', 'blue', false);
        }

        window.App.openModal('modal-influent');
    }

    async handleFormSubmit(e) {
        e.preventDefault();

        const dateInput = document.getElementById('inf-form-datetime') || document.getElementById('inf-form-date');
        const dateVal = dateInput?.value || new Date().toISOString();
        const sourceVal = document.getElementById('inf-form-source')?.value || 'รวมทุกอาคารโรงพยาบาล';

        const startInput = document.getElementById('inf-form-meter-start') || document.getElementById('inf-meter-start');
        const endInput = document.getElementById('inf-form-meter-today') || document.getElementById('inf-meter-end');
        const startVal = parseFloat(startInput?.value) || 0;
        const endVal = parseFloat(endInput?.value) || 0;

        const notesVal = document.getElementById('inf-form-notes')?.value || '';
        const recorderInput = document.getElementById('inf-form-recorded-by') || document.getElementById('inf-form-recorder');
        const recorderVal = recorderInput?.value || 'แสงตะวัน ชาวเขา';
        const imgInput = document.getElementById('inf-form-image');
        const imgVal = imgInput?.value || null;

        if (endVal < startVal) {
            Swal.fire({
                icon: 'warning',
                title: 'เลขมิเตอร์ไม่ถูกต้อง',
                text: 'เลขมิเตอร์สิ้นสุดต้องมากกว่าหรือเท่ากับเลขมิเตอร์เริ่มต้น'
            });
            return;
        }

        const waterUsed = Math.round((endVal - startVal) * 100) / 100;
        const wastewater = Math.round((waterUsed * 0.80) * 100) / 100;

        const record = {
            recorded_at: dateVal,
            water_source: sourceVal,
            meter_start: startVal,
            meter_yesterday: startVal,
            meter_today: endVal,
            meter_end: endVal,
            total_water_used: waterUsed,
            tap_water_used: waterUsed,
            wastewater_influent: wastewater,
            wastewater_80: wastewater,
            treated_water: wastewater,
            notes: notesVal,
            note: notesVal,
            meter_image_url: imgVal,
            recorded_by: recorderVal,
            recorder_name: recorderVal,
            attachments: this.uploadedAttachments || []
        };

        try {
            if (this.editingId) {
                await window.DataStore.update('influent_wastewater', this.editingId, record);
                Swal.fire({
                    icon: 'success',
                    title: 'บันทึกสำเร็จ',
                    text: 'แก้ไขข้อมูลปริมาณน้ำเสียเรียบร้อยแล้ว',
                    timer: 1200,
                    showConfirmButton: false
                });
            } else {
                record.id = 'inf-' + Date.now();
                record.created_at = new Date().toISOString();
                await window.DataStore.insert('influent_wastewater', record);
                Swal.fire({
                    icon: 'success',
                    title: 'บันทึกสำเร็จ',
                    text: 'เพิ่มข้อมูลปริมาณน้ำเสียใหม่เรียบร้อยแล้ว',
                    timer: 1200,
                    showConfirmButton: false
                });
            }

            window.App.closeModal('modal-influent');
            await this.loadData();
            if (window.DashboardModule && typeof window.DashboardModule.render === 'function') {
                await window.DashboardModule.render();
            }
        } catch (err) {
            console.error('Error saving influent record:', err);
            Swal.fire({
                icon: 'error',
                title: 'เกิดข้อผิดพลาด',
                text: 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง'
            });
        }
    }

    viewDetails(id) {
        const item = this.items.find(x => x.id === id);
        if (!item) return;

        const meterStart = parseFloat(item.meter_start !== undefined ? item.meter_start : (item.meter_yesterday || 0));
        const meterEnd = parseFloat(item.meter_today !== undefined ? item.meter_today : (item.meter_end || 0));
        const waterUsed = parseFloat(item.total_water_used !== undefined ? item.total_water_used : (item.tap_water_used || 0));
        const wastewater = parseFloat(item.wastewater_influent !== undefined ? item.wastewater_influent : (item.wastewater_80 || 0));

        Swal.fire({
            title: '<span class="text-lg font-bold text-white flex items-center gap-2 justify-center"><i class="fa-solid fa-faucet-drip text-cyan-400"></i> รายละเอียดบันทึกปริมาณน้ำเสีย</span>',
            html: `
                <div class="text-left text-xs text-slate-300 space-y-2.5 p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                    <div class="flex justify-between border-b border-slate-800 pb-1.5">
                        <span class="text-slate-400">วัน/เวลาที่บันทึก:</span>
                        <span class="font-mono font-bold text-white">${window.App.formatDateTime(item.recorded_at)}</span>
                    </div>
                    <div class="flex justify-between border-b border-slate-800 pb-1.5">
                        <span class="text-slate-400">แหล่งที่มาของน้ำ:</span>
                        <span class="font-semibold text-emerald-300">${item.water_source || item.sampling_point || 'ระบบบำบัดรวมโรงพยาบาล'}</span>
                    </div>
                    <div class="grid grid-cols-2 gap-2 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                        <div>
                            <span class="text-slate-400 block text-[10px]">เลขมิเตอร์เริ่มต้น:</span>
                            <span class="font-mono font-bold text-slate-200">${meterStart.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div>
                            <span class="text-slate-400 block text-[10px]">เลขมิเตอร์สิ้นสุด:</span>
                            <span class="font-mono font-bold text-white">${meterEnd.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div>
                            <span class="text-cyan-400 block text-[10px]">ปริมาณน้ำประปาที่ใช้:</span>
                            <span class="font-mono font-bold text-cyan-300">${waterUsed.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ลบ.ม.</span>
                        </div>
                        <div>
                            <span class="text-emerald-400 block text-[10px]">ปริมาณน้ำเสีย (80%):</span>
                            <span class="font-mono font-bold text-emerald-300">${wastewater.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ลบ.ม.</span>
                        </div>
                    </div>
                    <div class="flex justify-between border-b border-slate-800 pb-1.5">
                        <span class="text-slate-400">ผู้บันทึกข้อมูล:</span>
                        <span class="text-white font-medium">${item.recorded_by || item.recorder_name || '-'}</span>
                    </div>
                    ${item.notes || item.note ? `
                    <div class="border-t border-slate-800 pt-1.5">
                        <span class="text-slate-400 block text-[10px]">หมายเหตุ:</span>
                        <p class="text-slate-200 text-xs mt-0.5">${item.notes || item.note}</p>
                    </div>` : ''}
                </div>
            `,
            showConfirmButton: true,
            confirmButtonText: 'ปิด',
            confirmButtonColor: '#059669',
            background: '#0c1322',
            color: '#f8fafc'
        });
    }

    async deleteRecord(id) {
        const item = this.items.find(x => x.id === id);
        if (!item) return;

        const result = await Swal.fire({
            title: 'ยืนยันการลบรายการ?',
            text: `ต้องการลบข้อมูลวันที่ ${window.App.formatDateTime(item.recorded_at)} หรือไม่?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#e11d48',
            cancelButtonColor: '#334155',
            confirmButtonText: 'ใช่, ลบรายการ',
            cancelButtonText: 'ยกเลิก',
            background: '#0c1322',
            color: '#f8fafc'
        });

        if (result.isConfirmed) {
            await window.DataStore.delete('influent_wastewater', id);
            Swal.fire({
                icon: 'success',
                title: 'ลบสำเร็จ',
                text: 'ลบรายการข้อมูลเรียบร้อยแล้ว',
                timer: 1000,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });
            await this.loadData();
        }
    }

    async clearAllData() {
        const result = await Swal.fire({
            title: 'ลบข้อมูลปริมาณน้ำเสียทั้งหมด?',
            text: 'การกระทำนี้จะลบรายการบันทึกปริมาณน้ำเสียทั้งหมดในระบบ และไม่สามารถกู้คืนได้!',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#e11d48',
            cancelButtonColor: '#334155',
            confirmButtonText: 'ลบทั้งหมด',
            cancelButtonText: 'ยกเลิก',
            background: '#0c1322',
            color: '#f8fafc'
        });

        if (result.isConfirmed) {
            await window.DataStore.clearTable('influent_wastewater');
            Swal.fire({
                icon: 'success',
                title: 'ล้างข้อมูลสำเร็จ',
                text: 'ล้างข้อมูลตารางปริมาณน้ำเสียเรียบร้อยแล้ว',
                timer: 1200,
                showConfirmButton: false
            });
            await this.loadData();
        }
    }

    exportExcel() {
        if (!this.filteredItems || this.filteredItems.length === 0) {
            Swal.fire({ icon: 'info', title: 'ไม่มีข้อมูล', text: 'ไม่พบข้อมูลสำหรับส่งออก Excel' });
            return;
        }

        const data = this.filteredItems.map((item, idx) => ({
            'ลำดับ': idx + 1,
            'วัน/เวลา': window.App.formatDateTime(item.recorded_at),
            'แหล่งที่มาของน้ำ': item.water_source || item.sampling_point || 'ระบบบำบัดรวมโรงพยาบาล',
            'เลขมิเตอร์เริ่มต้น': item.meter_start !== undefined ? item.meter_start : (item.meter_yesterday || 0),
            'เลขมิเตอร์สิ้นสุด': item.meter_today !== undefined ? item.meter_today : (item.meter_end || 0),
            'น้ำประปา (ลบ.ม.)': item.total_water_used !== undefined ? item.total_water_used : (item.tap_water_used || 0),
            'น้ำเสีย 80% (ลบ.ม.)': item.wastewater_influent !== undefined ? item.wastewater_influent : (item.wastewater_80 || 0),
            'ผู้บันทึก': item.recorded_by || item.recorder_name || '-',
            'หมายเหตุ': item.notes || item.note || ''
        }));

        if (typeof XLSX !== 'undefined') {
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Influent_Records');
            XLSX.writeFile(wb, `Influent_Wastewater_50thHospital_${new Date().toISOString().substring(0, 10)}.xlsx`);
        }
    }

    exportCSV() {
        if (!this.filteredItems || this.filteredItems.length === 0) {
            Swal.fire({ icon: 'info', title: 'ไม่มีข้อมูล', text: 'ไม่พบข้อมูลสำหรับส่งออก CSV' });
            return;
        }

        let csv = '\uFEFFลำดับ,วัน/เวลา,แหล่งที่มาของน้ำ,เลขมิเตอร์เริ่มต้น,เลขมิเตอร์สิ้นสุด,น้ำประปา (ลบ.ม.),น้ำเสีย 80% (ลบ.ม.),ผู้บันทึก,หมายเหตุ\n';
        this.filteredItems.forEach((item, idx) => {
            const start = item.meter_start !== undefined ? item.meter_start : (item.meter_yesterday || 0);
            const end = item.meter_today !== undefined ? item.meter_today : (item.meter_end || 0);
            const water = item.total_water_used !== undefined ? item.total_water_used : (item.tap_water_used || 0);
            const waste = item.wastewater_influent !== undefined ? item.wastewater_influent : (item.wastewater_80 || 0);

            csv += `${idx + 1},"${window.App.formatDateTime(item.recorded_at)}","${item.water_source || item.sampling_point || ''}",${start},${end},${water},${waste},"${item.recorded_by || ''}","${item.notes || ''}"\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Influent_Wastewater_${new Date().toISOString().substring(0, 10)}.csv`;
        link.click();
    }

    exportPDF() {
        if (window.ExportImportModule && window.ExportImportModule.exportSectionPDF) {
            window.ExportImportModule.exportSectionPDF('influent');
        } else {
            window.print();
        }
    }

    previewData() {
        if (window.DocumentsModule && window.DocumentsModule.openPreviewModal) {
            window.DocumentsModule.openPreviewModal('influent');
        } else {
            window.print();
        }
    }
}

window.InfluentModule = new InfluentModule();
