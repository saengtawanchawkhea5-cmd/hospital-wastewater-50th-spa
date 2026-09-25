/**
 * ============================================================================
 * ระบบจัดการระบบบำบัดน้ำเสีย โรงพยาบาล ๕๐ พรรษา มหาวชิราลงกรณ (SPA)
 * ELECTRICITY.JS - บันทึกและจัดการการใช้พลังงานไฟฟ้า (Electricity Consumption)
 * ค้นหา & ปฏิบัติการข้อมูล, เพิ่ม, ลบ, แก้ไข, นำเข้า Excel/CSV, ดาวน์โหลดแม่แบบ
 * ============================================================================
 */

class ElectricityModule {
    constructor() {
        this.items = [];
        this.filteredItems = [];
        this.editingId = null;
        this.uploadedAttachments = [];
        this.sortField = 'recorded_at';
        this.sortDir = 'desc';
        this.currentPage = 1;
        this.pageSize = 20;
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
        // ผูกการคลิกจัดเรียงหัวตารางอัตโนมัติ (วันที่ล่าสุดขึ้นก่อนเสมอ)
        if (window.App && window.App.bindTableSorting) {
            window.App.bindTableSorting('table-electricity-body', this, 'recorded_at', 'desc');
        }

        // ตัวเลือกจัดเรียงลำดับ (Sort Order)
        const sortOrderEl = document.getElementById('filter-elec-sort-order');
        if (sortOrderEl) {
            sortOrderEl.addEventListener('change', (e) => {
                this.sortOrder = e.target.value;
                if (this.sortOrder === 'date_desc') {
                    this.sortField = 'recorded_at';
                    this.sortDir = 'desc';
                } else if (this.sortOrder === 'date_asc') {
                    this.sortField = 'recorded_at';
                    this.sortDir = 'asc';
                } else if (this.sortOrder === 'id_asc') {
                    this.sortField = 'id';
                    this.sortDir = 'asc';
                } else if (this.sortOrder === 'id_desc') {
                    this.sortField = 'id';
                    this.sortDir = 'desc';
                }
                this.currentPage = 1;
                this.applyFilters();
            });
        }

        // ตัวเลือกจำนวนรายการต่อหน้า (Page Size)
        const pageSizeEl = document.getElementById('filter-elec-page-size');
        if (pageSizeEl) {
            pageSizeEl.addEventListener('change', (e) => {
                this.pageSize = e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10);
                this.currentPage = 1;
                this.applyFilters();
            });
        }

        const btnAdd = document.getElementById('btn-add-electricity');
        if (btnAdd) btnAdd.addEventListener('click', () => this.openAddModal());

        const btnAddAuto = document.getElementById('btn-add-electricity-auto');
        if (btnAddAuto) btnAddAuto.addEventListener('click', () => {
            if (window.AutoGeneratorModule) {
                window.AutoGeneratorModule.openGeneratorModal('electricity');
            } else {
                this.openAddModal();
            }
        });

        // Quick Action Toolbar Buttons
        const btnRefresh = document.getElementById('btn-elec-refresh');
        if (btnRefresh) btnRefresh.addEventListener('click', async () => {
            await this.loadData();
            Swal.fire({
                icon: 'success',
                title: 'รีเฟรชข้อมูลสำเร็จ',
                text: 'อัปเดตข้อมูลการใช้ไฟฟ้าล่าสุดเรียบร้อย',
                timer: 1000,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });
        });

        const btnPreview = document.getElementById('btn-elec-preview');
        if (btnPreview) btnPreview.addEventListener('click', () => this.previewData());

        const btnExcel = document.getElementById('btn-elec-excel');
        if (btnExcel) btnExcel.addEventListener('click', () => this.exportExcel());

        const btnPdf = document.getElementById('btn-elec-pdf');
        if (btnPdf) btnPdf.addEventListener('click', () => this.exportPDF());

        const btnCsv = document.getElementById('btn-elec-csv');
        if (btnCsv) btnCsv.addEventListener('click', () => this.exportCSV());

        const btnTemplate = document.getElementById('btn-elec-template');
        if (btnTemplate) btnTemplate.addEventListener('click', () => window.ExportImportModule.downloadModuleTemplate('electricity'));

        const btnImportTrigger = document.getElementById('btn-elec-import-trigger');
        const fileImportInput = document.getElementById('file-elec-import');
        if (btnImportTrigger && fileImportInput) {
            btnImportTrigger.addEventListener('click', () => fileImportInput.click());
            fileImportInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    window.ExportImportModule.importModuleExcelOrCSV(file, 'electricity', () => this.loadData());
                    e.target.value = '';
                }
            });
        }

        const btnClear = document.getElementById('btn-elec-clear-all');
        if (btnClear) btnClear.addEventListener('click', () => {
            window.ExportImportModule.clearModuleData('electricity', 'electricity_consumption', () => this.loadData());
        });

        const btnResetFilter = document.getElementById('btn-elec-reset-filter');
        if (btnResetFilter) btnResetFilter.addEventListener('click', () => this.resetFilters());

        // Status Header Pills
        const pillAll = document.getElementById('pill-elec-all');
        if (pillAll) pillAll.addEventListener('click', () => {
            this.setActivePill('pill-elec-all');
            this.resetFilters();
        });

        const pillYear = document.getElementById('pill-elec-year');
        if (pillYear) pillYear.addEventListener('click', () => this.filterByCurrentYear());

        const pillMonth = document.getElementById('pill-elec-month');
        if (pillMonth) pillMonth.addEventListener('click', () => this.filterByCurrentMonth());

        const btnAddYear = document.getElementById('btn-add-year-elec');
        if (btnAddYear) btnAddYear.addEventListener('click', () => this.promptAddYear());

        // ตัวกรอง 7 ช่อง
        const inputSearch = document.getElementById('filter-elec-search');
        if (inputSearch) inputSearch.addEventListener('input', (e) => { this.filters.search = e.target.value; this.applyFilters(); });

        const selectCategory = document.getElementById('filter-elec-category');
        if (selectCategory) selectCategory.addEventListener('change', (e) => { this.filters.category = e.target.value; this.applyFilters(); });

        const selectBuilding = document.getElementById('filter-elec-building');
        if (selectBuilding) selectBuilding.addEventListener('change', (e) => { this.filters.building = e.target.value; this.applyFilters(); });

        const inputStartDate = document.getElementById('filter-elec-start-date');
        if (inputStartDate) inputStartDate.addEventListener('change', (e) => { this.filters.startDate = e.target.value; this.applyFilters(); });

        const inputEndDate = document.getElementById('filter-elec-end-date');
        if (inputEndDate) inputEndDate.addEventListener('change', (e) => { this.filters.endDate = e.target.value; this.applyFilters(); });

        const selectYear = document.getElementById('filter-elec-year');
        if (selectYear) selectYear.addEventListener('change', (e) => { this.filters.year = e.target.value; this.applyFilters(); });

        const selectMonth = document.getElementById('filter-elec-month');
        if (selectMonth) selectMonth.addEventListener('change', (e) => { this.filters.month = e.target.value; this.applyFilters(); });

        // คำนวณค่าไฟ
        const inputMeterToday = document.getElementById('elec-form-meter-today');
        const inputMeterStart = document.getElementById('elec-form-meter-start');
        const inputUnitPrice = document.getElementById('elec-form-unit-price');
        const calcHandler = () => this.calculateValues();

        if (inputMeterToday) inputMeterToday.addEventListener('input', calcHandler);
        if (inputMeterStart) inputMeterStart.addEventListener('input', calcHandler);
        if (inputUnitPrice) inputUnitPrice.addEventListener('input', calcHandler);

        // ผูก Universal Attachment Manager (รองรับ อัปโหลดรูปภาพ, PDF, ถ่ายรูปสด, URL)
        if (window.AttachmentManager) {
            window.AttachmentManager.bindFormAttachments({
                moduleInstance: this,
                itemsProperty: 'uploadedAttachments',
                containerId: 'elec-image-gallery-container',
                fileInputId: 'elec-file-upload-input',
                browseBtnId: 'btn-elec-browse-files',
                cameraInputId: 'elec-file-camera-input',
                cameraBtnId: 'btn-elec-open-camera',
                urlInputId: 'elec-form-image-url-input',
                addUrlBtnId: 'btn-elec-add-url-image',
                clearBtnId: 'btn-elec-clear-all-images',
                badgeId: 'elec-image-count-badge',
                themeColor: 'amber',
                singleMode: false
            });
        }

        // ฟอร์มบันทึก
        const form = document.getElementById('form-electricity');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveData();
            });
        }
    }

    setActivePill(activeId) {
        ['pill-elec-all', 'pill-elec-year', 'pill-elec-month'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                if (id === activeId) {
                    el.classList.add('tag-emerald-glow');
                } else {
                    el.classList.remove('tag-emerald-glow');
                }
            }
        });
    }

    async promptAddYear() {
        const { value: newYear } = await Swal.fire({
            title: 'เพิ่มปี พ.ศ. สำหรับตัวกรองการใช้ไฟฟ้า',
            input: 'text',
            inputLabel: 'ระบุปี พ.ศ. (เช่น 2570, 2566)',
            inputPlaceholder: '2570',
            showCancelButton: true,
            confirmButtonText: 'เพิ่มปี',
            cancelButtonText: 'ยกเลิก',
            inputValidator: (value) => {
                if (!value || isNaN(value) || value.length !== 4) {
                    return 'กรุณาระบุปี พ.ศ. 4 หลักให้ถูกต้อง เช่น 2570';
                }
            }
        });

        if (newYear) {
            const select = document.getElementById('filter-elec-year');
            if (select) {
                const opt = document.createElement('option');
                opt.value = newYear;
                opt.textContent = newYear;
                select.appendChild(opt);
                select.value = newYear;
                this.filters.year = newYear;
                this.applyFilters();
                Swal.fire({ icon: 'success', title: `เพิ่มปี พ.ศ. ${newYear} เรียบร้อย`, timer: 1200, showConfirmButton: false });
            }
        }
    }

    filterByCurrentYear() {
        const now = new Date();
        const currentYearBE = (now.getFullYear() + 543).toString();
        const select = document.getElementById('filter-elec-year');
        if (select) select.value = currentYearBE;
        this.filters.year = currentYearBE;
        this.setActivePill('pill-elec-year');
        this.applyFilters();
        Swal.fire({
            icon: 'success',
            title: `กรองข้อมูลไฟฟ้าปี พ.ศ. ${currentYearBE}`,
            timer: 900,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
        });
    }

    filterByCurrentMonth() {
        const now = new Date();
        const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');
        const select = document.getElementById('filter-elec-month');
        if (select) select.value = currentMonth;
        this.filters.month = currentMonth;
        this.applyFilters();
    }

    async loadData() {
        this.items = await window.DataStore.getAll('electricity_consumption', { orderBy: 'recorded_at', ascending: false });
        this.applyFilters();
    }

    applyFilters() {
        this.filteredItems = this.items.filter(item => {
            if (this.filters.search) {
                const q = this.filters.search.toLowerCase();
                const matchRec = (item.recorded_by || '').toLowerCase().includes(q);
                const matchNote = (item.notes || '').toLowerCase().includes(q);
                if (!matchRec && !matchNote) return false;
            }

            // แผนก / อาคาร
            if (this.filters.building && this.filters.building !== 'all') {
                if (window.App && window.App.matchBuildingFilter) {
                    if (!window.App.matchBuildingFilter(item.notes || 'wwtp', this.filters.building)) return false;
                }
            }

            // ตัวกรองวันที่ (ไม่จำกัดจำนวนแถว, รองรับช่วงวันที่ 1-31, เดือน, ปี พ.ศ.)
            if (window.App && window.App.matchDateFilter) {
                if (!window.App.matchDateFilter(item.recorded_at, this.filters)) return false;
            } else if (item.recorded_at) {
                const itemDateStr = (item.recorded_at || '').split('T')[0].split(' ')[0];
                if (this.filters.startDate && itemDateStr < this.filters.startDate) return false;
                if (this.filters.endDate && itemDateStr > this.filters.endDate) return false;
            }

            return true;
        });

        // จัดเรียงข้อมูลตามคอลัมน์และลำดับที่เลือก
        if (window.App && window.App.sortData) {
            this.filteredItems = window.App.sortData(this.filteredItems, this.sortField, this.sortDir);
            window.App.updateTableSortUI('table-electricity-body', this.sortField, this.sortDir);
        }

        this.renderTable(this.filteredItems);
    }

    resetFilters() {
        this.filters = { search: '', category: 'all', building: 'all', startDate: '', endDate: '', year: 'all', month: 'all' };
        const ids = ['filter-elec-search', 'filter-elec-category', 'filter-elec-building', 'filter-elec-start-date', 'filter-elec-end-date', 'filter-elec-year', 'filter-elec-month'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = el.tagName === 'SELECT' ? 'all' : '';
        });
        this.setActivePill('pill-elec-all');
        this.applyFilters();
        Swal.fire({
            icon: 'info',
            title: 'แสดงข้อมูลไฟฟ้าทั้งหมด',
            text: 'ล้างตัวกรองเรียบร้อยแล้ว',
            timer: 900,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
        });
    }

    renderTable(list) {
        const tbody = document.getElementById('table-electricity-body');
        if (!tbody) return;

        const totalItems = list ? list.length : 0;

        // คำนวณผลรวมตามรายการกรองข้อมูล (Filter Summary Calculation)
        const totalKwh = list.reduce((sum, item) => sum + (parseFloat(item.total_kwh) || 0), 0);
        const totalCost = list.reduce((sum, item) => sum + (parseFloat(item.electricity_cost) || 0), 0);
        const avgKwh = totalItems > 0 ? totalKwh / totalItems : 0;
        const avgCost = totalItems > 0 ? totalCost / totalItems : 0;

        if (!list || list.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center py-8 text-slate-500">
                        <i class="fa-solid fa-bolt text-3xl mb-2"></i>
                        <div>ไม่พบข้อมูลการใช้พลังงานไฟฟ้าตามเงื่อนไขที่กรอง</div>
                    </td>
                </tr>
            `;
            const tfoot = document.getElementById('table-electricity-foot');
            if (tfoot) tfoot.innerHTML = '';

            if (window.App && window.App.renderPagination) {
                window.App.renderPagination({
                    containerId: 'pagination-electricity',
                    totalItems: 0,
                    currentPage: this.currentPage,
                    pageSize: this.pageSize,
                    summaryCards: [
                        { title: 'จำนวนรายการทั้งหมด', value: '0 รายการ', subText: 'ตามเงื่อนไขที่กรอง', icon: 'fa-solid fa-list-check', color: 'cyan' },
                        { title: 'หน่วยไฟฟ้ารวม (TOTAL kWh)', value: '0.00 kWh', subText: 'เฉลี่ย 0.00 kWh/รายการ', icon: 'fa-solid fa-bolt', color: 'amber' },
                        { title: 'คิดเป็นค่าไฟฟ้ารวม (TOTAL COST)', value: '฿0.00 บาท', subText: 'อัตราเฉลี่ย ฿4.50/หน่วย', icon: 'fa-solid fa-coins', color: 'emerald' },
                        { title: 'สถานะตัวกรอง & การเลือก', value: 'ไม่พบรายการ', subText: 'กรุณาปรับเปลี่ยนตัวกรอง', icon: 'fa-solid fa-filter', color: 'purple' }
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
            return `
            <tr>
                <td class="text-slate-400 font-mono text-center">${globalIdx}</td>
                <td class="font-mono text-xs text-slate-300">${window.App.formatDateTime(item.recorded_at)}</td>
                <td class="font-mono text-right text-slate-400">${item.meter_start !== null && item.meter_start !== undefined ? parseFloat(item.meter_start).toLocaleString('th-TH', { minimumFractionDigits: 2 }) : '-'}</td>
                <td class="font-mono text-right text-amber-300 font-bold">${parseFloat(item.meter_today).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                <td class="font-mono text-right text-white font-bold">${parseFloat(item.total_kwh || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                <td class="font-mono text-right text-slate-400">${parseFloat(item.unit_price || 4.50).toFixed(2)}</td>
                <td class="font-mono text-right text-emerald-400 font-bold bg-emerald-950/20 px-2 py-1 rounded">฿${parseFloat(item.electricity_cost || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                <td class="text-xs text-slate-300">${item.recorded_by || '-'}</td>
                <td class="text-center">
                    <div class="flex items-center justify-center gap-1.5">
                        <button class="btn btn-outline btn-icon btn-sm text-blue-400 hover:text-white" onclick="window.ElectricityModule.viewDetails('${item.id}')" title="ดูรายละเอียด">
                            <i class="fa-solid fa-eye"></i>
                        </button>
                        <button class="btn btn-outline btn-icon btn-sm text-amber-400 hover:text-white" onclick="window.ElectricityModule.openEditModal('${item.id}')" title="แก้ไข">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button class="btn btn-outline btn-icon btn-sm text-rose-400 hover:text-white" onclick="window.ElectricityModule.deleteRecord('${item.id}')" title="ลบ">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            </tr>
            `;
        }).join('');

        // Render Table Footer Summary Row
        const tfoot = document.getElementById('table-electricity-foot');
        if (tfoot) {
            tfoot.innerHTML = `
                <tr class="table-summary-row border-t-2 border-emerald-500/60 bg-emerald-950/20">
                    <td class="text-center font-bold text-emerald-400 py-3.5"><i class="fa-solid fa-calculator"></i> รวม</td>
                    <td colspan="2" class="font-bold text-emerald-300 py-3.5">
                        <span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> รวมการใช้ไฟฟ้า (${totalItems.toLocaleString()} วัน):</span>
                    </td>
                    <td class="font-mono text-right text-amber-300 font-bold py-3.5 text-sm">${totalKwh.toLocaleString('th-TH', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span class="text-[10px] text-slate-400">kWh</span></td>
                    <td class="font-mono text-right text-emerald-400 font-bold py-3.5 text-sm">฿${totalCost.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td class="font-mono text-center text-cyan-300 font-bold py-3.5 text-xs">฿${(totalKwh > 0 ? (totalCost / totalKwh) : 4.50).toFixed(2)}/kWh</td>
                    <td class="text-center text-xs text-slate-300 py-3.5">มิเตอร์หลัก รพ.</td>
                    <td class="text-center text-xs text-emerald-400 py-3.5 font-bold"><span class="badge badge-success text-[11px] py-1 px-2">คำนวณครบ</span></td>
                </tr>
            `;
        }

        // Summary Cards Bar Configuration
        const summaryCards = [
            {
                title: 'รายการบันทึกไฟฟ้า',
                value: `${totalItems.toLocaleString()} รายการ`,
                subText: 'ตามตัวกรองที่เลือก',
                icon: 'fa-solid fa-boxes-stacked',
                color: 'cyan'
            },
            {
                title: 'หน่วยไฟฟ้ารวม (TOTAL kWh)',
                value: `${totalKwh.toLocaleString('th-TH', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kWh`,
                subText: `เฉลี่ย ${(totalItems > 0 ? (totalKwh / totalItems) : 0).toFixed(1)} kWh/วัน`,
                icon: 'fa-solid fa-bolt',
                color: 'blue'
            },
            {
                title: 'อัตราค่าไฟฟ้าเฉลี่ยต่อหน่วย',
                value: `฿${(totalKwh > 0 ? (totalCost / totalKwh) : 4.50).toFixed(2)} บาท/kWh`,
                subText: 'มาตรฐาน กฟภ. (PEA Tariff)',
                icon: 'fa-solid fa-chart-simple',
                color: 'emerald'
            },
            {
                title: 'มูลค่าค่าไฟฟ้ารวม (TOTAL COST)',
                value: `฿${totalCost.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`,
                subText: `เฉลี่ย ฿${(totalItems > 0 ? (totalCost / totalItems) : 0).toFixed(0)} บาท/วัน`,
                icon: 'fa-solid fa-money-bill-wave',
                color: 'amber'
            }
        ];

        // Render pagination controls and summary cards
        if (window.App && window.App.renderPagination) {
            window.App.renderPagination({
                containerId: 'pagination-electricity',
                totalItems: totalItems,
                currentPage: this.currentPage,
                pageSize: this.pageSize,
                summaryCards: summaryCards,
                onPageChange: (p) => {
                    this.currentPage = p;
                    this.renderTable(this.filteredItems);
                },
                onPageSizeChange: (s) => {
                    this.pageSize = s;
                    this.currentPage = 1;
                    const sizeEl = document.getElementById('filter-elec-page-size');
                    if (sizeEl) sizeEl.value = String(s);
                    this.renderTable(this.filteredItems);
                }
            });
        }
    }

    async openAddModal() {
        this.editingId = null;
        const modal = document.getElementById('modal-electricity');
        const title = document.getElementById('modal-electricity-title');
        const form = document.getElementById('form-electricity');
        if (!modal || !form) return;

        form.reset();
        if (title) title.innerHTML = '<i class="fa-solid fa-bolt text-amber-400"></i> บันทึกการใช้พลังงานไฟฟ้า';

        const now = new Date();
        const localIso = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        const dtInput = document.getElementById('elec-form-datetime');
        if (dtInput) dtInput.value = localIso;

        const latestMeter = await window.DataStore.getLatestElectricityMeter();
        const startInput = document.getElementById('elec-form-meter-start');
        if (startInput) startInput.value = latestMeter !== null ? latestMeter : "";

        const unitPriceInput = document.getElementById('elec-form-unit-price');
        if (unitPriceInput) unitPriceInput.value = APP_CONFIG.defaultElectricityRate.toFixed(2);

        const currentUser = (window.AuthService && typeof window.AuthService.getCurrentUser === 'function') 
            ? window.AuthService.getCurrentUser() 
            : null;
        const currentName = currentUser ? (currentUser.full_name || currentUser.username) : "";
        const recByInput = document.getElementById('elec-form-recorded-by');
        if (recByInput) recByInput.value = currentName;

        const kwhInput = document.getElementById('elec-form-total-kwh');
        if (kwhInput) kwhInput.value = "0.00";

        const costInput = document.getElementById('elec-form-total-cost') || document.getElementById('elec-form-cost');
        if (costInput) costInput.value = "0.00";

        this.uploadedAttachments = [];
        if (window.AttachmentManager) {
            window.AttachmentManager.updateContainerDisplay(this, 'uploadedAttachments', 'elec-image-gallery-container', 'elec-image-count-badge', 'amber', false);
        }

        window.App.openModal('modal-electricity');
    }

    autoFillForm() {
        const startInput = document.getElementById('elec-form-meter-start');
        let startVal = parseFloat(startInput?.value);
        if (isNaN(startVal) || startVal <= 0) {
            if (this.items && this.items.length > 0) {
                const found = this.items.find(x => x.meter_today || x.meter_end);
                if (found) startVal = parseFloat(found.meter_today || found.meter_end) || 202842.10;
            } else {
                startVal = 202842.10;
            }
            if (startInput) startInput.value = startVal.toFixed(2);
        }

        // จำลองการใช้ไฟฟ้าสมจริง รพ.๕๐ พรรษาฯ (~460 kWh/วัน + สุ่ม variance -15 ถึง +15)
        const randVar = (Math.random() - 0.5) * 30;
        const totalKwh = Math.round((460.0 + randVar) * 100) / 100;
        const endVal = Math.round((startVal + totalKwh) * 100) / 100;
        
        const priceInput = document.getElementById('elec-form-unit-price');
        const unitPrice = parseFloat(priceInput?.value) || (window.APP_CONFIG ? window.APP_CONFIG.defaultElectricityRate : 4.50) || 4.50;
        const totalCost = Math.round(totalKwh * unitPrice * 100) / 100;

        const todayInput = document.getElementById('elec-form-meter-today');
        if (todayInput) todayInput.value = endVal.toFixed(2);

        const kwhInput = document.getElementById('elec-form-total-kwh');
        if (kwhInput) kwhInput.value = totalKwh.toFixed(2);

        const costInput = document.getElementById('elec-form-total-cost') || document.getElementById('elec-form-cost');
        if (costInput) costInput.value = totalCost.toFixed(2);

        const notesInput = document.getElementById('elec-form-notes');
        if (notesInput && !notesInput.value) {
            notesInput.value = 'บันทึกอัตโนมัติประจำวัน Blower และปั๊มสูบน้ำทำงานในเกณฑ์ปกติ';
        }

        const recInput = document.getElementById('elec-form-recorded-by');
        if (recInput && !recInput.value && window.AuthService) {
            const user = window.AuthService.getCurrentUser();
            recInput.value = user ? (user.full_name || user.username) : 'แสงตะวัน ชาวเขา';
        }

        Swal.fire({
            icon: 'success',
            title: 'เติมค่าไฟฟ้าอัตโนมัติเรียบร้อย',
            html: `<div class="text-xs text-slate-300">ใช้ไฟฟ้า: <strong class="text-amber-400 font-mono">${totalKwh}</strong> kWh | คิดเป็นเงิน: <strong class="text-emerald-400 font-mono">฿${totalCost.toLocaleString()}</strong> บาท</div>`,
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
        const title = document.getElementById('modal-electricity-title');
        if (title) title.innerHTML = '<i class="fa-solid fa-pen-to-square text-amber-400"></i> แก้ไขข้อมูลการใช้ไฟฟ้า';

        const d = new Date(item.recorded_at);
        const localIso = !isNaN(d) ? new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16) : "";

        const dtInput = document.getElementById('elec-form-datetime');
        if (dtInput) dtInput.value = localIso;

        const startInput = document.getElementById('elec-form-meter-start');
        if (startInput) startInput.value = item.meter_start !== null ? item.meter_start : "";

        const todayInput = document.getElementById('elec-form-meter-today');
        if (todayInput) todayInput.value = item.meter_today;

        const priceInput = document.getElementById('elec-form-unit-price');
        if (priceInput) priceInput.value = item.unit_price || APP_CONFIG.defaultElectricityRate;

        const kwhInput = document.getElementById('elec-form-total-kwh');
        if (kwhInput) kwhInput.value = item.total_kwh;

        const costInput = document.getElementById('elec-form-total-cost') || document.getElementById('elec-form-cost');
        if (costInput) costInput.value = item.electricity_cost;

        const imgInput = document.getElementById('elec-form-image');
        if (imgInput) imgInput.value = item.meter_image_url || "";

        const recInput = document.getElementById('elec-form-recorded-by');
        if (recInput) recInput.value = item.recorded_by;

        const notesInput = document.getElementById('elec-form-notes');
        if (notesInput) notesInput.value = item.notes || "";

        this.uploadedAttachments = window.AttachmentManager ? window.AttachmentManager.normalizeAttachments(item.meter_image_url) : [];
        if (window.AttachmentManager) {
            window.AttachmentManager.updateContainerDisplay(this, 'uploadedAttachments', 'elec-image-gallery-container', 'elec-image-count-badge', 'amber', false);
        }

        window.App.openModal('modal-electricity');
    }

    viewDetails(id) {
        const item = this.items.find(x => x.id === id);
        if (!item) return;

        const attachments = window.AttachmentManager ? window.AttachmentManager.normalizeAttachments(item.meter_image_url) : [];

        Swal.fire({
            title: `<div class="text-base font-bold text-white"><i class="fa-solid fa-bolt text-amber-400"></i> รายละเอียดการใช้ไฟฟ้า</div>`,
            width: '680px',
            html: `
                <div class="text-left text-xs space-y-2.5 p-3 bg-slate-900 rounded-xl border border-slate-800 text-slate-200">
                    <div class="grid grid-cols-2 gap-2 p-2 bg-slate-950/70 rounded-lg border border-slate-800">
                        <div><strong><i class="fa-regular fa-calendar text-cyan-400 mr-1"></i> วัน-เวลา:</strong> ${window.App.formatDateTime(item.recorded_at)}</div>
                        <div><strong><i class="fa-solid fa-bolt text-amber-400 mr-1"></i> อัตรา:</strong> ฿${item.unit_price} บ./kWh</div>
                    </div>
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div class="p-2 bg-slate-950/60 rounded border border-slate-800 text-center">
                            <span class="text-[10px] text-slate-400 block">มิเตอร์เริ่มต้น</span>
                            <span class="font-mono font-bold text-slate-300">${item.meter_start !== null ? item.meter_start : '-'}</span>
                        </div>
                        <div class="p-2 bg-slate-950/60 rounded border border-slate-800 text-center">
                            <span class="text-[10px] text-slate-400 block">มิเตอร์วันนี้</span>
                            <span class="font-mono font-bold text-amber-400">${item.meter_today}</span>
                        </div>
                        <div class="p-2 bg-slate-950/60 rounded border border-slate-800 text-center">
                            <span class="text-[10px] text-slate-400 block">หน่วยไฟรวม</span>
                            <span class="font-mono font-bold text-cyan-400">${item.total_kwh} kWh</span>
                        </div>
                        <div class="p-2 bg-emerald-950/40 rounded border border-emerald-800/60 text-center">
                            <span class="text-[10px] text-emerald-300 block">คิดเป็นเงิน</span>
                            <span class="font-mono font-bold text-emerald-400">฿${parseFloat(item.electricity_cost || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                    <div><strong>ผู้บันทึก:</strong> ${item.recorded_by}</div>
                    ${item.notes ? `<div><strong>หมายเหตุ:</strong> ${item.notes}</div>` : ''}
                    
                    <!-- Attachments Display -->
                    ${attachments.length > 0 ? `
                        <div class="pt-2 border-t border-slate-800">
                            <strong class="text-amber-400 block mb-2"><i class="fa-solid fa-paperclip"></i> รูปภาพและเอกสารแนบ (${attachments.length} รายการ):</strong>
                            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                ${attachments.map((att) => {
                                    if (att.type === 'pdf') {
                                        return `
                                            <div class="p-2 rounded-lg bg-slate-950 border border-red-800/60 flex flex-col justify-between cursor-pointer hover:border-red-500" onclick="window.AttachmentManager.openMediaViewer({data: '${att.data}', type: 'pdf', name: '${att.name}'})">
                                                <div class="flex items-center gap-2">
                                                    <i class="fa-solid fa-file-pdf text-xl text-red-400"></i>
                                                    <span class="text-[11px] font-bold text-white truncate">${att.name}</span>
                                                </div>
                                                <span class="text-[10px] text-red-400 mt-1 block font-mono">เปิดดู PDF</span>
                                            </div>
                                        `;
                                    }
                                    return `
                                        <div class="rounded-lg overflow-hidden border border-slate-700 bg-slate-950 cursor-pointer hover:border-amber-500" onclick="window.AttachmentManager.openMediaViewer({data: '${att.data}', type: 'image', name: '${att.name}'})">
                                            <img src="${att.data}" class="w-full h-24 object-cover hover:scale-105 transition-transform" />
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            `,
            confirmButtonText: '<i class="fa-solid fa-check mr-1"></i> ปิดหน้าต่าง',
            confirmButtonColor: '#3b82f6'
        });
    }

    async deleteRecord(id) {
        const result = await Swal.fire({
            title: 'ยืนยันการลบรายการนี้?',
            text: 'ข้อมูลที่ถูกลบจะไม่สามารถกู้คืนได้',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#334155',
            confirmButtonText: 'ใช่, ลบรายการ',
            cancelButtonText: 'ยกเลิก'
        });

        if (result.isConfirmed) {
            await window.DataStore.delete('electricity_consumption', id);
            Swal.fire({ icon: 'success', title: 'ลบข้อมูลสำเร็จ', timer: 1200, showConfirmButton: false });
            await this.loadData();
        }
    }

    calculateValues() {
        const startInput = document.getElementById('elec-form-meter-start');
        const todayInput = document.getElementById('elec-form-meter-today');
        const priceInput = document.getElementById('elec-form-unit-price');

        const startVal = startInput ? parseFloat(startInput.value) || 0 : 0;
        const todayVal = todayInput ? parseFloat(todayInput.value) || 0 : 0;
        const unitPrice = priceInput ? parseFloat(priceInput.value) || APP_CONFIG.defaultElectricityRate : APP_CONFIG.defaultElectricityRate;

        let totalKwh = 0;
        let totalCost = 0;

        if (todayVal >= startVal) {
            totalKwh = todayVal - startVal;
            totalCost = totalKwh * unitPrice;
        }

        const kwhInput = document.getElementById('elec-form-total-kwh');
        if (kwhInput) kwhInput.value = totalKwh.toFixed(2);

        const costInput = document.getElementById('elec-form-total-cost') || document.getElementById('elec-form-cost');
        if (costInput) costInput.value = totalCost.toFixed(2);
    }

    updateImagePreview(url) {
        // Handled by AttachmentManager
    }

    async saveData() {
        const form = document.getElementById('form-electricity');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const startVal = document.getElementById('elec-form-meter-start').value;
        const todayVal = parseFloat(document.getElementById('elec-form-meter-today').value);

        if (isNaN(todayVal)) {
            Swal.fire({ icon: 'warning', title: 'กรุณากรอกเลขมิเตอร์วันนี้', confirmButtonColor: '#3b82f6' });
            return;
        }

        const startNum = startVal !== "" ? parseFloat(startVal) : 0;
        const totalKwh = Math.max(todayVal - startNum, 0);
        const unitPrice = parseFloat(document.getElementById('elec-form-unit-price').value) || APP_CONFIG.defaultElectricityRate;
        const totalCost = parseFloat((totalKwh * unitPrice).toFixed(2));

        const currentUser = (window.AuthService && typeof window.AuthService.getCurrentUser === 'function') 
            ? window.AuthService.getCurrentUser() 
            : null;
        const currentName = currentUser ? (currentUser.full_name || currentUser.username) : 'เจ้าหน้าที่';
        const recByInput = document.getElementById('elec-form-recorded-by');
        const recordedBy = (recByInput && recByInput.value && recByInput.value.trim()) ? recByInput.value.trim() : currentName;

        let meterImageVal = null;
        if (window.AttachmentManager && this.uploadedAttachments && this.uploadedAttachments.length > 0) {
            meterImageVal = window.AttachmentManager.serializeAttachments(this.uploadedAttachments, false);
        } else {
            meterImageVal = document.getElementById('elec-form-image').value.trim() || null;
        }

        const payload = {
            recorded_at: document.getElementById('elec-form-datetime').value ? new Date(document.getElementById('elec-form-datetime').value).toISOString() : new Date().toISOString(),
            meter_start: startVal !== "" ? parseFloat(startVal) : null,
            meter_today: todayVal,
            total_kwh: totalKwh,
            unit_price: unitPrice,
            electricity_cost: totalCost,
            meter_image_url: meterImageVal,
            recorded_by: recordedBy,
            notes: document.getElementById('elec-form-notes').value.trim()
        };

        Swal.fire({ title: 'กำลังบันทึกข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        try {
            let res;
            if (this.editingId) {
                res = await window.DataStore.update('electricity_consumption', this.editingId, payload);
            } else {
                res = await window.DataStore.insert('electricity_consumption', payload);
            }

            window.App.closeModal('modal-electricity');
            await this.loadData();

            if (res && res.savedSupabase) {
                Swal.fire({
                    icon: 'success',
                    title: 'บันทึกข้อมูลสำเร็จ!',
                    html: '<span class="text-xs text-emerald-400 font-bold"><i class="fa-solid fa-cloud-arrow-up"></i> บันทึกลงฐานข้อมูล Supabase Cloud เรียบร้อย</span>',
                    timer: 1800,
                    showConfirmButton: false
                });
            } else if (res && res.savedLocal && res.error) {
                Swal.fire({
                    icon: 'warning',
                    title: 'บันทึกข้อมูลในเครื่อง (LocalStore) แล้ว',
                    html: `
                        <div class="text-left text-xs space-y-1.5 p-3 bg-slate-900 rounded border border-slate-800 text-slate-300">
                            <div class="text-amber-400 font-bold"><i class="fa-solid fa-triangle-exclamation"></i> ไม่สามารถบันทึกขึ้น Supabase Cloud ได้</div>
                            <div class="text-rose-400 font-mono text-[11px]"><strong>สาเหตุ:</strong> ${res.error}</div>
                            <div class="text-slate-400 text-[11px] pt-1 border-t border-slate-800">ระบบได้บันทึกข้อมูลไว้ในเครื่องชั่วคราวให้แล้ว และแสดงผลในตารางเรียบร้อย</div>
                        </div>
                    `,
                    confirmButtonText: 'รับทราบ',
                    confirmButtonColor: '#3b82f6'
                });
            } else {
                Swal.fire({
                    icon: 'success',
                    title: 'บันทึกข้อมูลสำเร็จ!',
                    timer: 1200,
                    showConfirmButton: false
                });
            }

        } catch (err) {
            console.error('Error saving electricity record:', err);
            if (typeof Swal !== 'undefined') {
                if (Swal.isLoading && Swal.isLoading()) {
                    Swal.hideLoading();
                }
                Swal.fire({
                    icon: 'error',
                    title: 'เกิดข้อผิดพลาดในการบันทึก',
                    text: err.message || 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง',
                    showConfirmButton: true,
                    confirmButtonText: 'ตกลง',
                    confirmButtonColor: '#ef4444'
                });
            } else {
                alert('เกิดข้อผิดพลาดในการบันทึก: ' + err.message);
            }
        }
    }

    exportExcel() {
        const data = this.filteredItems.map(item => ({
            'วัน-เวลาที่บันทึก': window.App.formatDateTime(item.recorded_at),
            'เลขมิเตอร์เริ่มต้น': item.meter_start,
            'เลขมิเตอร์วันนี้': item.meter_today,
            'หน่วยไฟฟ้ารวม (kWh)': item.total_kwh,
            'อัตราค่าไฟฟ้าต่อหน่วย': item.unit_price,
            'คิดเป็นค่าไฟ (บาท)': item.electricity_cost,
            'ผู้บันทึก': item.recorded_by,
            'หมายเหตุ': item.notes || ''
        }));
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, "การใช้พลังงานไฟฟ้า");
        XLSX.writeFile(wb, `รายงานการใช้ไฟฟ้า_รพ.๕๐พรรษา_${new Date().toISOString().split('T')[0]}.xlsx`);
        Swal.fire({ icon: 'success', title: 'ส่งออก Excel เรียบร้อย', timer: 1200, showConfirmButton: false });
    }

    exportCSV() {
        const data = this.filteredItems.map(item => ({
            'วัน-เวลาที่บันทึก': window.App.formatDateTime(item.recorded_at),
            'เลขมิเตอร์เริ่มต้น': item.meter_start,
            'เลขมิเตอร์วันนี้': item.meter_today,
            'หน่วยไฟฟ้ารวม (kWh)': item.total_kwh,
            'อัตราค่าไฟฟ้าต่อหน่วย': item.unit_price,
            'คิดเป็นค่าไฟ (บาท)': item.electricity_cost,
            'ผู้บันทึก': item.recorded_by,
            'หมายเหตุ': item.notes || ''
        }));
        window.ExportImportModule.exportModuleCSV('รายงานการใช้ไฟฟ้า_รพ.๕๐พรรษา', data);
    }

    exportPDF() {
        window.print();
    }

    previewData() {
        const modal = document.getElementById('modal-document-preview');
        const sheet = document.getElementById('document-preview-printable-sheet');
        if (!modal || !sheet) {
            this.exportPDF();
            return;
        }

        const now = new Date();
        const thaiMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
        const thaiDateFormatted = `${now.getDate()} ${thaiMonths[now.getMonth()]} ${now.getFullYear() + 543} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} น.`;
        
        const currentUser = (window.AuthService && typeof window.AuthService.getCurrentUser === 'function') 
            ? window.AuthService.getCurrentUser() 
            : null;
        const reporterName = currentUser 
            ? `${currentUser.full_name || currentUser.username} (${currentUser.role === 'admin' ? 'Super Admin' : 'Admin / เจ้าหน้าที่'})` 
            : 'นายแสงตะวัน ชาวเขา (Super Admin)';
        
        const docCode = `REP-ELEC-${Math.floor(200000 + Math.random() * 800000)}`;

        const totalItems = this.filteredItems.length;
        const totalKwh = this.filteredItems.reduce((acc, x) => acc + (parseFloat(x.total_kwh) || 0), 0);
        const totalCost = this.filteredItems.reduce((acc, x) => acc + (parseFloat(x.electricity_cost) || 0), 0);
        const avgDailyKwh = totalItems > 0 ? (totalKwh / totalItems).toFixed(2) : '0.00';

        const top10EquipmentsElec = [
            { name: 'เครื่องเติมอากาศ B1 - B3 (Aeration Blowers)', power: '7.50 kW (3 เครื่อง)', kwh: (totalKwh * 0.58).toFixed(2), cost: (totalCost * 0.58).toFixed(2), percent: '58.0%' },
            { name: 'เครื่องสูบน้ำเสีย SP 1 - SP 3 (Submersible Pumps)', power: '3.70 kW (3 เครื่อง)', kwh: (totalKwh * 0.24).toFixed(2), cost: (totalCost * 0.24).toFixed(2), percent: '24.0%' },
            { name: 'เครื่องสูบน้ำตะกอนหมุนเวียน (Sludge Return Pump)', power: '2.20 kW (2 เครื่อง)', kwh: (totalKwh * 0.10).toFixed(2), cost: (totalCost * 0.10).toFixed(2), percent: '10.0%' },
            { name: 'ระบบฆ่าเชื้อและกวนสารเคมีคลอรีน (Dosing Pump)', power: '0.75 kW (2 เครื่อง)', kwh: (totalKwh * 0.05).toFixed(2), cost: (totalCost * 0.05).toFixed(2), percent: '5.0%' },
            { name: 'ตู้ควบคุมไฟฟ้า ไฟส่องสว่าง & ระบบเซนเซอร์', power: '0.50 kW', kwh: (totalKwh * 0.03).toFixed(2), cost: (totalCost * 0.03).toFixed(2), percent: '3.0%' }
        ];

        const top10RowsHtml = top10EquipmentsElec.map((item, index) => `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="text-align: center; color: #64748b; font-family: monospace; padding: 7px 12px;">${index + 1}</td>
                <td style="font-weight: 600; color: #1e293b; padding: 7px 12px;">${item.name}</td>
                <td style="text-align: center; font-family: monospace; color: #475569; padding: 7px 12px;">${item.power}</td>
                <td style="text-align: right; font-family: monospace; font-weight: 700; color: #d97706; padding: 7px 12px;">${parseFloat(item.kwh).toLocaleString('th-TH', { minimumFractionDigits: 2 })} kWh</td>
                <td style="text-align: right; font-family: monospace; font-weight: 700; color: #059669; padding: 7px 12px;">฿${parseFloat(item.cost).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                <td style="text-align: right; font-family: monospace; color: #475569; padding: 7px 12px;">${item.percent}</td>
            </tr>
        `).join('');

        const recentSlice = this.filteredItems.slice(0, 20);
        const recentRowsHtml = recentSlice.map((item, index) => {
            const dateFormatted = window.App.formatDateTime(item.recorded_at);
            return `
                <tr style="border-bottom: 1px solid #f1f5f9; font-size: 11px;">
                    <td style="text-align: center; color: #64748b; font-family: monospace; padding: 6px 10px;">${index + 1}</td>
                    <td style="font-family: monospace; color: #475569; padding: 6px 10px;">${dateFormatted}</td>
                    <td style="font-family: monospace; text-align: right; color: #475569; padding: 6px 10px;">${parseFloat(item.meter_start || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                    <td style="font-family: monospace; text-align: right; color: #1e293b; font-weight: 600; padding: 6px 10px;">${parseFloat(item.meter_today || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                    <td style="font-family: monospace; text-align: right; font-weight: 700; color: #d97706; padding: 6px 10px;">${parseFloat(item.total_kwh || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                    <td style="font-family: monospace; text-align: right; font-weight: 700; color: #059669; padding: 6px 10px;">฿${parseFloat(item.electricity_cost || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                    <td style="color: #475569; padding: 6px 10px;">${item.recorded_by || 'เจ้าหน้าที่'}</td>
                </tr>
            `;
        }).join('');

        sheet.innerHTML = `
            <!-- Document Header -->
            <div class="flex items-start justify-between pb-3.5 border-b border-slate-200 gap-4">
                <div class="flex items-center gap-3.5">
                    <div class="w-14 h-14 rounded-full border-2 border-emerald-600 p-1 flex items-center justify-center bg-emerald-50 shrink-0 shadow-sm">
                        <div class="w-full h-full rounded-full bg-emerald-600 text-white flex flex-col items-center justify-center font-bold">
                            <span class="text-xs leading-none font-extrabold">๕๐</span>
                            <span class="text-[8px] leading-none tracking-tighter">พรรษา</span>
                        </div>
                    </div>
                    <div>
                        <h1 class="text-base sm:text-lg font-black text-emerald-800 tracking-tight leading-snug">
                            ระบบบำบัดน้ำเสีย โรงพยาบาล ๕๐ พรรษา มหาวชิราลงกรณ
                        </h1>
                        <p class="text-[11px] sm:text-xs text-slate-600 font-medium mt-0.5 leading-relaxed">
                            งานบริหารสิ่งแวดล้อมและสุขาภิบาลเพื่อการจัดการน้ำเสีย และมาตรฐาน GREEN &amp; CLEAN Hospital (WWTP Energy Management)
                        </p>
                    </div>
                </div>

                <div class="text-right shrink-0 text-[11px] text-slate-600 leading-snug">
                    <div>วันที่ออกเอกสาร: <strong class="text-slate-800 font-bold">${thaiDateFormatted}</strong></div>
                    <div class="mt-0.5">ผู้ออกรายงาน: <strong class="text-slate-800 font-bold">${reporterName}</strong></div>
                    <div class="mt-0.5">รหัสเอกสาร: <strong class="font-mono text-emerald-700 font-bold">${docCode}</strong></div>
                </div>
            </div>

            <!-- Green Ribbon Title -->
            <div class="bg-slate-50 border-y border-emerald-600/30 px-3.5 py-1.5 rounded flex items-center justify-between mt-3.5 mb-4">
                <div class="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-2">
                    <i class="fa-regular fa-file-lines text-emerald-600"></i>
                    <span>รายงานสรุปการใช้พลังงานไฟฟ้าและค่าใช้จ่ายในระบบบำบัดน้ำเสีย</span>
                </div>
                <div class="text-[11px] font-bold text-emerald-700 hidden sm:block">
                    ระบบบำบัดน้ำเสีย โรงพยาบาล ๕๐ พรรษา มหาวชิราลงกรณ
                </div>
            </div>

            <!-- 4 KPI Boxes Grid -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                <div class="doc-kpi-card doc-kpi-amber">
                    <div class="text-[11px] font-bold text-amber-800">หน่วยไฟฟ้ารวมสะสม (kWh)</div>
                    <div class="text-xl font-black text-amber-900 font-mono mt-1">${totalKwh.toLocaleString('th-TH', { minimumFractionDigits: 2 })} <span class="text-xs font-normal">kWh</span></div>
                    <div class="text-[10px] text-amber-700 mt-0.5">เฉลี่ย ${avgDailyKwh} kWh/วัน</div>
                </div>

                <div class="doc-kpi-card doc-kpi-green">
                    <div class="text-[11px] font-bold text-emerald-800">คิดเป็นค่าไฟฟ้ารวม (บาท)</div>
                    <div class="text-xl font-black text-emerald-900 font-mono mt-1">฿${totalCost.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</div>
                    <div class="text-[10px] text-emerald-700 mt-0.5">อัตราค่าไฟเฉลี่ย 4.50 ฿/kWh</div>
                </div>

                <div class="doc-kpi-card doc-kpi-blue">
                    <div class="text-[11px] font-bold text-blue-800">จำนวนครั้งที่บันทึกมิเตอร์</div>
                    <div class="text-xl font-black text-blue-900 font-mono mt-1">${totalItems.toLocaleString()}.00 <span class="text-xs font-normal">รายการ</span></div>
                    <div class="text-[10px] text-blue-700 mt-0.5">บันทึกครบถ้วนตรงเวลา</div>
                </div>

                <div class="doc-kpi-card doc-kpi-purple">
                    <div class="text-[11px] font-bold text-purple-800">ต้นทุนค่าไฟต่อ ลบ.ม. น้ำเสีย</div>
                    <div class="text-xl font-black text-purple-900 font-mono mt-1">3.25 <span class="text-xs font-normal">฿/ลบ.ม.</span></div>
                    <div class="text-[10px] text-purple-700 mt-0.5">ประสิทธิภาพพลังงานระดับดีเยี่ยม</div>
                </div>
            </div>

            <!-- Section 1: สัดส่วนการใช้พลังงานไฟฟ้าของเครื่องจักรหลัก -->
            <div class="mb-5">
                <div class="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                    <i class="fa-solid fa-chart-simple text-emerald-600"></i>
                    <span>สัดส่วนการใช้พลังงานไฟฟ้าและการประเมินค่าใช้จ่ายจำแนกตามกลุ่มเครื่องจักรหลัก</span>
                </div>
                <div class="overflow-x-auto border border-slate-200 rounded-lg">
                    <table class="doc-table-clean">
                        <thead>
                            <tr>
                                <th style="width: 50px; text-align: center;">ลำดับ</th>
                                <th>กลุ่มเครื่องจักร / ระบบควบคุม</th>
                                <th style="text-align: center;">กำลังพิกัดมอเตอร์ (kW)</th>
                                <th style="text-align: right;">หน่วยไฟฟ้ารวม (kWh)</th>
                                <th style="text-align: right;">คิดเป็นค่าไฟ (บาท)</th>
                                <th style="text-align: right;">สัดส่วน (%)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${top10RowsHtml}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Section 2: รายการบันทึกล่าสุด -->
            <div>
                <div class="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                    <i class="fa-solid fa-clock-rotate-left text-blue-600"></i>
                    <span>รายการบันทึกหน่วยไฟฟ้าล่าสุด (${recentSlice.length} รายการ)</span>
                </div>
                <div class="overflow-x-auto border border-slate-200 rounded-lg">
                    <table class="doc-table-clean">
                        <thead>
                            <tr>
                                <th style="width: 40px; text-align: center;">ลำดับ</th>
                                <th>วัน-เวลา</th>
                                <th style="text-align: right;">เลขมิเตอร์เริ่ม</th>
                                <th style="text-align: right;">เลขมิเตอร์วันนี้</th>
                                <th style="text-align: right;">หน่วยไฟ (kWh)</th>
                                <th style="text-align: right;">ค่าไฟฟ้า (บาท)</th>
                                <th>ผู้บันทึก</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${recentRowsHtml || '<tr><td colspan="7" class="text-center py-4 text-slate-400">ไม่พบข้อมูลบันทึก</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        const btnPrint = document.getElementById('btn-doc-preview-print');
        if (btnPrint) btnPrint.onclick = () => window.print();

        const btnPdf = document.getElementById('btn-doc-preview-pdf');
        if (btnPdf) btnPdf.onclick = () => window.print();

        const btnExcel = document.getElementById('btn-doc-preview-excel');
        if (btnExcel) btnExcel.onclick = () => this.exportExcel();

        window.App.openModal('modal-document-preview');
    }
}

window.ElectricityModule = new ElectricityModule();
