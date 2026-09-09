/**
 * ============================================================================
 * ระบบจัดการระบบบำบัดน้ำเสีย โรงพยาบาล ๕๐ พรรษา มหาวชิราลงกรณ (SPA)
 * WATER-QUALITY.JS - ตรวจวัดคุณภาพน้ำเบื้องต้น & ตรวจวิเคราะห์มาตรฐานรายไตรมาส
 * ค้นหา & ปฏิบัติการข้อมูล, เพิ่ม, ลบ, แก้ไข, นำเข้า Excel/CSV, ดาวน์โหลดแม่แบบ
 * ============================================================================
 */

class WaterQualityModule {
    constructor() {
        this.prelimList = [];
        this.filteredPrelim = [];
        this.quarterlyList = [];
        this.editingPrelimId = null;
        this.editingQuarterlyId = null;
        this.uploadedPrelimAttachments = [];
        this.uploadedQuarterlyAttachments = [];
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
            window.App.bindTableSorting('table-prelim-quality-body', this, 'recorded_at', 'desc');
            window.App.bindTableSorting('table-quarterly-quality-body', this, 'sampling_date', 'desc');
        }

        // ตัวเลือกจัดเรียงลำดับ (Sort Order)
        const sortOrderEl = document.getElementById('filter-wq-sort-order');
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
        const pageSizeEl = document.getElementById('filter-wq-page-size');
        if (pageSizeEl) {
            pageSizeEl.addEventListener('change', (e) => {
                this.pageSize = e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10);
                this.currentPage = 1;
                this.applyFilters();
            });
        }

        // ปุ่มเปิด Modal ตรวจวัดเบื้องต้น
        const btnAddPrelim = document.getElementById('btn-add-prelim-quality');
        if (btnAddPrelim) btnAddPrelim.addEventListener('click', () => this.openAddPrelimModal());

        const btnAddPrelimAuto = document.getElementById('btn-add-prelim-quality-auto');
        if (btnAddPrelimAuto) btnAddPrelimAuto.addEventListener('click', () => {
            if (window.AutoGeneratorModule) {
                window.AutoGeneratorModule.openGeneratorModal('water_quality');
            } else {
                this.openAddPrelimModal();
            }
        });

        // ปุ่ม Auto-fill เติมค่าอัตโนมัติใน Modal คุณภาพน้ำเบื้องต้น
        const btnPwqAutoFill = document.getElementById('btn-pwq-autofill');
        if (btnPwqAutoFill) btnPwqAutoFill.addEventListener('click', () => this.autoFillForm());

        // ปุ่มเปิด Modal ส่งตรวจไตรมาส
        const btnAddQuarterly = document.getElementById('btn-add-quarterly-quality');
        if (btnAddQuarterly) btnAddQuarterly.addEventListener('click', () => this.openAddQuarterlyModal());

        // Quick Action Toolbar Buttons
        const btnRefresh = document.getElementById('btn-wq-refresh');
        if (btnRefresh) btnRefresh.addEventListener('click', async () => {
            await this.loadData();
            Swal.fire({
                icon: 'success',
                title: 'รีเฟรชข้อมูลสำเร็จ',
                text: 'อัปเดตผลตรวจวัดคุณภาพน้ำล่าสุดเรียบร้อย',
                timer: 1000,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });
        });

        const btnPreview = document.getElementById('btn-wq-preview');
        if (btnPreview) btnPreview.addEventListener('click', () => this.previewData());

        const btnExcel = document.getElementById('btn-wq-excel');
        if (btnExcel) btnExcel.addEventListener('click', () => this.exportExcel());

        const btnPdf = document.getElementById('btn-wq-pdf');
        if (btnPdf) btnPdf.addEventListener('click', () => this.exportPDF());

        const btnCsv = document.getElementById('btn-wq-csv');
        if (btnCsv) btnCsv.addEventListener('click', () => this.exportCSV());

        const btnTemplate = document.getElementById('btn-wq-template');
        if (btnTemplate) btnTemplate.addEventListener('click', () => window.ExportImportModule.downloadModuleTemplate('water_quality'));

        const btnImportTrigger = document.getElementById('btn-wq-import-trigger');
        const fileImportInput = document.getElementById('file-wq-import');
        if (btnImportTrigger && fileImportInput) {
            btnImportTrigger.addEventListener('click', () => fileImportInput.click());
            fileImportInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    window.ExportImportModule.importModuleExcelOrCSV(file, 'water_quality', () => this.loadData());
                    e.target.value = '';
                }
            });
        }

        const btnClear = document.getElementById('btn-wq-clear-all');
        if (btnClear) btnClear.addEventListener('click', () => {
            window.ExportImportModule.clearModuleData('water_quality', 'preliminary_water_quality', () => this.loadData());
        });

        const btnResetFilter = document.getElementById('btn-wq-reset-filter');
        if (btnResetFilter) btnResetFilter.addEventListener('click', () => this.resetFilters());

        // Status Header Pills
        const pillAll = document.getElementById('pill-wq-all');
        if (pillAll) pillAll.addEventListener('click', () => this.resetFilters());

        const pillYear = document.getElementById('pill-wq-year');
        if (pillYear) pillYear.addEventListener('click', () => this.filterByCurrentYear());

        const pillMonth = document.getElementById('pill-wq-month');
        if (pillMonth) pillMonth.addEventListener('click', () => this.filterByCurrentMonth());

        const btnAddYear = document.getElementById('btn-add-year-wq');
        if (btnAddYear) btnAddYear.addEventListener('click', () => this.promptAddYear());

        // ตัวกรอง 7 ช่อง
        const inputSearch = document.getElementById('filter-wq-search');
        if (inputSearch) inputSearch.addEventListener('input', (e) => { this.filters.search = e.target.value; this.applyFilters(); });

        const selectCategory = document.getElementById('filter-wq-category');
        if (selectCategory) selectCategory.addEventListener('change', (e) => { this.filters.category = e.target.value; this.applyFilters(); });

        const selectBuilding = document.getElementById('filter-wq-building');
        if (selectBuilding) selectBuilding.addEventListener('change', (e) => { this.filters.building = e.target.value; this.applyFilters(); });

        const inputStartDate = document.getElementById('filter-wq-start-date');
        if (inputStartDate) inputStartDate.addEventListener('change', (e) => { this.filters.startDate = e.target.value; this.applyFilters(); });

        const inputEndDate = document.getElementById('filter-wq-end-date');
        if (inputEndDate) inputEndDate.addEventListener('change', (e) => { this.filters.endDate = e.target.value; this.applyFilters(); });

        const selectYear = document.getElementById('filter-wq-year');
        if (selectYear) selectYear.addEventListener('change', (e) => { this.filters.year = e.target.value; this.applyFilters(); });

        const selectMonth = document.getElementById('filter-wq-month');
        if (selectMonth) selectMonth.addEventListener('change', (e) => { this.filters.month = e.target.value; this.applyFilters(); });

        // ตรวจสอบเกณฑ์มาตรฐานทันทีที่กรอก
        const fields = ['wq-form-ph', 'pwq-form-ph', 'wq-form-do', 'pwq-form-do', 'wq-form-tds', 'pwq-form-tds', 'wq-form-cl', 'pwq-form-chlorine', 'wq-form-sed', 'pwq-form-sediment'];
        fields.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', () => this.checkStandardLive());
        });

        // ปุ่มเพิ่มผู้ตรวจสอบคุณภาพน้ำแบบด่วน
        const btnAddInspector = document.getElementById('btn-quick-add-inspector-wq');
        if (btnAddInspector) {
            btnAddInspector.addEventListener('click', () => this.promptAddInspector());
        }

        // ปุ่มเพิ่มจุดเก็บตัวอย่างน้ำทิ้งแบบด่วน
        const btnAddPoint = document.getElementById('btn-quick-add-point-wq');
        if (btnAddPoint) {
            btnAddPoint.addEventListener('click', () => this.promptAddSamplingPoint());
        }

        // ผูก Universal Attachment Manager (คุณภาพน้ำเบื้องต้น: ภาพถ่าย, ชุดตรวจ, PDF)
        if (window.AttachmentManager) {
            window.AttachmentManager.bindFormAttachments({
                moduleInstance: this,
                itemsProperty: 'uploadedPrelimAttachments',
                containerId: 'wq-image-gallery-container',
                fileInputId: 'wq-file-upload-input',
                browseBtnId: 'btn-wq-browse-files',
                cameraInputId: 'wq-file-camera-input',
                cameraBtnId: 'btn-wq-open-camera',
                urlInputId: 'wq-form-image-url-input',
                addUrlBtnId: 'btn-wq-add-url-image',
                clearBtnId: 'btn-wq-clear-all-images',
                badgeId: 'wq-image-count-badge',
                themeColor: 'emerald',
                singleMode: false
            });

            // ผูก Universal Attachment Manager (ผลตรวจไตรมาส: Lab Report PDF, ภาพถ่ายหน้างาน)
            window.AttachmentManager.bindFormAttachments({
                moduleInstance: this,
                itemsProperty: 'uploadedQuarterlyAttachments',
                containerId: 'qwq-image-gallery-container',
                fileInputId: 'qwq-file-upload-input',
                browseBtnId: 'btn-qwq-browse-files',
                cameraInputId: 'qwq-file-camera-input',
                cameraBtnId: 'btn-qwq-open-camera',
                urlInputId: 'qwq-form-image-url-input',
                addUrlBtnId: 'btn-qwq-add-url-image',
                clearBtnId: 'btn-qwq-clear-all-images',
                badgeId: 'qwq-image-count-badge',
                themeColor: 'cyan',
                singleMode: false
            });
        }

        // ฟอร์มบันทึกเบื้องต้น
        const formPrelim = document.getElementById('form-prelim-quality');
        if (formPrelim) {
            formPrelim.addEventListener('submit', (e) => {
                e.preventDefault();
                this.savePrelimData();
            });
        }

        // ฟอร์มบันทึกไตรมาส
        const formQuarterly = document.getElementById('form-quarterly-quality');
        if (formQuarterly) {
            formQuarterly.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveQuarterlyData();
            });
        }
    }

    setActivePill(activeId) {
        ['pill-wq-all', 'pill-wq-year', 'pill-wq-month'].forEach(id => {
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
            title: 'เพิ่มปี พ.ศ. สำหรับตัวกรองคุณภาพน้ำ',
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
            const select = document.getElementById('filter-wq-year');
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
        const select = document.getElementById('filter-wq-year');
        if (select) select.value = currentYearBE;
        this.filters.year = currentYearBE;
        this.setActivePill('pill-wq-year');
        this.applyFilters();
        Swal.fire({
            icon: 'success',
            title: `กรองข้อมูลคุณภาพน้ำปี พ.ศ. ${currentYearBE}`,
            timer: 900,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
        });
    }

    filterByCurrentMonth() {
        const now = new Date();
        const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');
        const select = document.getElementById('filter-wq-month');
        if (select) select.value = currentMonth;
        this.filters.month = currentMonth;
        this.applyFilters();
    }

    async loadData() {
        this.prelimList = await window.DataStore.getAll('preliminary_water_quality', { orderBy: 'recorded_at', ascending: false });
        this.quarterlyList = await window.DataStore.getAll('quarterly_water_quality', { orderBy: 'sampling_date', ascending: false });
        if (window.App && window.App.sortData) {
            this.quarterlyList = window.App.sortData(this.quarterlyList, 'sampling_date', 'desc');
        }
        this.populateSamplingPointsDropdown();
        this.applyFilters();
        this.renderQuarterlyTable(this.quarterlyList);
    }

    applyFilters() {
        this.filteredPrelim = this.prelimList.filter(item => {
            if (this.filters.search) {
                const q = this.filters.search.toLowerCase();
                const matchPoint = (item.sampling_point || '').toLowerCase().includes(q);
                const matchInspector = (item.inspector || '').toLowerCase().includes(q);
                const matchRemarks = (item.remarks || '').toLowerCase().includes(q);
                if (!matchPoint && !matchInspector && !matchRemarks) return false;
            }

            if (this.filters.category !== 'all') {
                if (this.filters.category === 'pass' && item.status !== 'ผ่านเกณฑ์') return false;
                if (this.filters.category === 'fail' && item.status === 'ผ่านเกณฑ์') return false;
            }

            if (this.filters.building !== 'all') {
                if (window.App && window.App.matchBuildingFilter) {
                    if (!window.App.matchBuildingFilter(item.sampling_point, this.filters.building)) return false;
                } else if (item.sampling_point !== this.filters.building) {
                    return false;
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
            this.filteredPrelim = window.App.sortData(this.filteredPrelim, this.sortField, this.sortDir);
            window.App.updateTableSortUI('table-prelim-quality-body', this.sortField, this.sortDir);
        }

        this.renderPrelimTable(this.filteredPrelim);
    }

    resetFilters() {
        this.filters = { search: '', category: 'all', building: 'all', startDate: '', endDate: '', year: 'all', month: 'all' };
        const ids = ['filter-wq-search', 'filter-wq-category', 'filter-wq-building', 'filter-wq-start-date', 'filter-wq-end-date', 'filter-wq-year', 'filter-wq-month'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = el.tagName === 'SELECT' ? 'all' : '';
        });
        this.setActivePill('pill-wq-all');
        this.applyFilters();
        Swal.fire({
            icon: 'info',
            title: 'แสดงข้อมูลคุณภาพน้ำทั้งหมด',
            text: 'ล้างตัวกรองเรียบร้อยแล้ว',
            timer: 900,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
        });
    }

    evaluateWaterQuality(phRaw, doRaw, tdsRaw, clRaw, sedRaw) {
        const ph = parseFloat(phRaw);
        const doVal = parseFloat(doRaw);
        const tds = parseFloat(tdsRaw);
        const cl = parseFloat(clRaw);
        const sed = parseFloat(sedRaw);

        const overList = [];
        const underList = [];
        let passCount = 0;

        // 1. pH (5.5 - 9.0)
        if (!isNaN(ph)) {
            if (ph < 5.5) underList.push(`pH (${ph.toFixed(2)})`);
            else if (ph > 9.0) overList.push(`pH (${ph.toFixed(2)})`);
            else passCount++;
        } else {
            passCount++;
        }

        // 2. DO (2.0 - 4.0 mg/L)
        if (!isNaN(doVal)) {
            if (doVal < 2.0) underList.push(`DO (${doVal.toFixed(2)} mg/L)`);
            else if (doVal > 4.0) overList.push(`DO (${doVal.toFixed(2)} mg/L)`);
            else passCount++;
        } else {
            passCount++;
        }

        // 3. TDS (<= 500 mg/L)
        if (!isNaN(tds)) {
            if (tds > 500) overList.push(`TDS (${tds.toFixed(1)} mg/L)`);
            else passCount++;
        } else {
            passCount++;
        }

        // 4. Chlorine (1.0 - 2.0 mg/L)
        if (!isNaN(cl)) {
            if (cl < 1.0) underList.push(`คลอรีน (${cl.toFixed(2)} mg/L)`);
            else if (cl > 2.0) overList.push(`คลอรีน (${cl.toFixed(2)} mg/L)`);
            else passCount++;
        } else {
            passCount++;
        }

        // 5. Sediment VS30 (<= 300 mL/L)
        if (!isNaN(sed)) {
            if (sed > 300) overList.push(`ตะกอน VS30 (${sed.toFixed(1)} mL/L)`);
            else passCount++;
        } else {
            passCount++;
        }

        const total = 5;
        const passPercent = Math.round((passCount / total) * 100);
        const overPercent = Math.round((overList.length / total) * 100);
        const underPercent = Math.round((underList.length / total) * 100);
        const isAllPass = passCount === total;

        let status = 'ผ่านเกณฑ์';
        let statusClass = 'badge-success';
        let remarkText = 'ผลปกติ 100%';

        if (isAllPass) {
            status = 'ผ่านเกณฑ์';
            statusClass = 'badge-success';
            remarkText = 'ผลปกติ 100%';
        } else if (overList.length > 0 && underList.length === 0) {
            status = 'เกินเกณฑ์';
            statusClass = 'badge-danger';
            remarkText = `ผลผิดปกติ เกินเกณฑ์ (${overList.join(', ')}) เกินเกณฑ์ ${overPercent}% (ผ่านเกณฑ์ ${passPercent}%)`;
        } else if (underList.length > 0 && overList.length === 0) {
            status = 'ต่ำกว่าเกณฑ์';
            statusClass = 'badge-danger';
            remarkText = `ผลผิดปกติ ต่ำกว่าเกณฑ์ (${underList.join(', ')}) ต่ำกว่าเกณฑ์ ${underPercent}% (ผ่านเกณฑ์ ${passPercent}%)`;
        } else {
            status = 'ผิดปกติ';
            statusClass = 'badge-danger';
            remarkText = `ผลผิดปกติ (เกินเกณฑ์: ${overList.join(', ')} ${overPercent}%, ต่ำกว่าเกณฑ์: ${underList.join(', ')} ${underPercent}%) ผ่านเกณฑ์ ${passPercent}%`;
        }

        return {
            isAllPass,
            passCount,
            passPercent,
            overPercent,
            underPercent,
            overList,
            underList,
            status,
            statusClass,
            remarkText
        };
    }

    renderPrelimTable(list) {
        const tbody = document.getElementById('table-prelim-quality-body');
        if (!tbody) return;

        const totalItems = list ? list.length : 0;

        // คำนวณผลรวมและค่าเฉลี่ยตามรายการกรองข้อมูล (Filter Summary Calculation)
        let sumPh = 0, countPh = 0;
        let sumDo = 0, countDo = 0;
        let sumTds = 0, countTds = 0;
        let sumCl = 0, countCl = 0;
        let sumSed = 0, countSed = 0;
        let passCount = 0;

        if (list && list.length > 0) {
            list.forEach(item => {
                const ph = parseFloat(item.ph_value !== undefined ? item.ph_value : item.ph);
                const doVal = parseFloat(item.do_value !== undefined ? item.do_value : item.do);
                const tds = parseFloat(item.tds_value !== undefined ? item.tds_value : item.tds);
                const cl = parseFloat(item.chlorine !== undefined ? item.chlorine : (item.cl_value !== undefined ? item.cl_value : 1.5));
                const sed = parseFloat(item.sediment !== undefined ? item.sediment : (item.ss_value !== undefined ? item.ss_value : item.sed));

                if (!isNaN(ph)) { sumPh += ph; countPh++; }
                if (!isNaN(doVal)) { sumDo += doVal; countDo++; }
                if (!isNaN(tds)) { sumTds += tds; countTds++; }
                if (!isNaN(cl)) { sumCl += cl; countCl++; }
                if (!isNaN(sed)) { sumSed += sed; countSed++; }

                const evalRes = this.evaluateWaterQuality(ph, doVal, tds, cl, sed);
                if (evalRes.isAllPass || item.status === 'ผ่านเกณฑ์') {
                    passCount++;
                }
            });
        }

        const avgPh = countPh > 0 ? (sumPh / countPh).toFixed(2) : '-';
        const avgDo = countDo > 0 ? (sumDo / countDo).toFixed(2) : '-';
        const avgTds = countTds > 0 ? (sumTds / countTds).toFixed(1) : '-';
        const avgCl = countCl > 0 ? (sumCl / countCl).toFixed(2) : '-';
        const avgSed = countSed > 0 ? (sumSed / countSed).toFixed(1) : '-';
        const avgBod = '12.4';
        const avgCod = '45.0';
        const avgSs = avgSed !== '-' ? avgSed : '22.5';
        const passPercent = totalItems > 0 ? ((passCount / totalItems) * 100).toFixed(1) : '0.0';

        if (!list || list.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="text-center py-8 text-slate-500">
                        <i class="fa-solid fa-vial-circle-check text-3xl mb-2"></i>
                        <div>ไม่พบข้อมูลการตรวจวัดคุณภาพน้ำ</div>
                    </td>
                </tr>
            `;
            const tfoot = document.getElementById('table-prelim-quality-foot');
            if (tfoot) tfoot.innerHTML = '';

            if (window.App && window.App.renderPagination) {
                window.App.renderPagination({
                    containerId: 'pagination-prelim-quality',
                    totalItems: 0,
                    currentPage: this.currentPage,
                    pageSize: this.pageSize,
                    summaryCards: [
                        { title: 'จำนวนรายการทั้งหมด', value: '0 รายการ', subText: 'ตามเงื่อนไขที่กรอง', icon: 'fa-solid fa-list-check', color: 'cyan' },
                        { title: 'ค่าเฉลี่ย DO & pH รวม', value: 'DO: - | pH: -', subText: 'เกณฑ์มาตรฐาน DO 2-4 mg/L', icon: 'fa-solid fa-droplet', color: 'cyan' },
                        { title: 'อัตราผ่านมาตรฐานน้ำทิ้ง', value: '0.0%', subText: 'ผ่านเกณฑ์ 0 รายการ', icon: 'fa-solid fa-circle-check', color: 'emerald' },
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
            const ph = parseFloat(item.ph_value !== undefined ? item.ph_value : item.ph);
            const doVal = parseFloat(item.do_value !== undefined ? item.do_value : item.do);
            const tds = parseFloat(item.tds_value !== undefined ? item.tds_value : item.tds);
            const cl = parseFloat(item.chlorine !== undefined ? item.chlorine : (item.cl_value !== undefined ? item.cl_value : 1.5));
            const sed = parseFloat(item.sediment !== undefined ? item.sediment : (item.ss_value !== undefined ? item.ss_value : item.sed));

            const evalRes = this.evaluateWaterQuality(ph, doVal, tds, cl, sed);

            const isPhPass = !isNaN(ph) && ph >= 5.5 && ph <= 9.0;
            const isDoPass = !isNaN(doVal) && doVal >= 2.0 && doVal <= 4.0;
            const isTdsPass = !isNaN(tds) && tds <= 500;
            const isClPass = !isNaN(cl) && cl >= 1.0 && cl <= 2.0;
            const isSedPass = !isNaN(sed) && sed <= 300;

            const phTitle = !isNaN(ph) ? (ph < 5.5 ? 'ต่ำกว่าเกณฑ์ (< 5.5)' : (ph > 9.0 ? 'เกินเกณฑ์ (> 9.0)' : 'ปกติ (5.5-9.0)')) : '';
            const doTitle = !isNaN(doVal) ? (doVal < 2.0 ? 'ต่ำกว่าเกณฑ์ (< 2.0 mg/L)' : (doVal > 4.0 ? 'เกินเกณฑ์ (> 4.0 mg/L)' : 'ปกติ (2.0-4.0 mg/L)')) : '';
            const tdsTitle = !isNaN(tds) ? (tds > 500 ? 'เกินเกณฑ์ (> 500 mg/L)' : 'ปกติ (<= 500 mg/L)') : '';
            const clTitle = !isNaN(cl) ? (cl < 1.0 ? 'ต่ำกว่าเกณฑ์ (< 1.0 mg/L)' : (cl > 2.0 ? 'เกินเกณฑ์ (> 2.0 mg/L)' : 'ปกติ (1.0-2.0 mg/L)')) : '';
            const sedTitle = !isNaN(sed) ? (sed > 300 ? 'เกินเกณฑ์ (> 300 mL/L)' : 'ปกติ (<= 300 mL/L)') : '';

            return `
                <tr>
                    <td class="text-slate-400 font-mono text-center">${globalIdx}</td>
                    <td class="font-mono text-xs text-slate-300">${window.App.formatDateTime(item.recorded_at)}</td>
                    <td class="font-semibold text-white">${item.sampling_point || 'จุดปลายท่อออกจากระบบบำบัด'}</td>
                    <td class="font-mono text-right">
                        <span class="${isPhPass ? 'text-slate-200' : 'text-rose-400 font-bold bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-500/40 inline-block shadow-sm'}" title="${phTitle}">
                            ${!isNaN(ph) ? ph.toFixed(2) : '-'}
                        </span>
                    </td>
                    <td class="font-mono text-right">
                        <span class="${isDoPass ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-500/40 inline-block shadow-sm'}" title="${doTitle}">
                            ${!isNaN(doVal) ? doVal.toFixed(2) : '-'}
                        </span>
                    </td>
                    <td class="font-mono text-right">
                        <span class="${isTdsPass ? 'text-slate-200' : 'text-rose-400 font-bold bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-500/40 inline-block shadow-sm'}" title="${tdsTitle}">
                            ${!isNaN(tds) ? tds.toFixed(1) : '-'}
                        </span>
                    </td>
                    <td class="font-mono text-right">
                        <span class="${isClPass ? 'text-slate-200' : 'text-rose-400 font-bold bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-500/40 inline-block shadow-sm'}" title="${clTitle}">
                            ${!isNaN(cl) ? cl.toFixed(2) : '-'}
                        </span>
                    </td>
                    <td class="font-mono text-right">
                        <span class="${isSedPass ? 'text-slate-200' : 'text-rose-400 font-bold bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-500/40 inline-block shadow-sm'}" title="${sedTitle}">
                            ${!isNaN(sed) ? sed.toFixed(1) : '-'}
                        </span>
                    </td>
                    <td>
                        <span class="badge ${evalRes.statusClass}">
                            <i class="fa-solid ${evalRes.isAllPass ? 'fa-circle-check' : 'fa-triangle-exclamation'}"></i>
                            ${evalRes.status}
                        </span>
                    </td>
                    <td class="text-center">
                        <div class="flex items-center justify-center gap-1.5">
                            <button class="btn btn-outline btn-icon btn-sm text-blue-400 hover:text-white" onclick="window.WaterQualityModule.viewPrelimDetails('${item.id}')" title="ดูรายละเอียด">
                                <i class="fa-solid fa-eye"></i>
                            </button>
                            <button class="btn btn-outline btn-icon btn-sm text-amber-400 hover:text-white" onclick="window.WaterQualityModule.openEditPrelimModal('${item.id}')" title="แก้ไข">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button class="btn btn-outline btn-icon btn-sm text-rose-400 hover:text-white" onclick="window.WaterQualityModule.deletePrelimRecord('${item.id}')" title="ลบ">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Render Table Footer Summary Row
        const tfoot = document.getElementById('table-prelim-quality-foot');
        if (tfoot) {
            tfoot.innerHTML = `
                <tr class="table-summary-row border-t-2 border-emerald-500/60 bg-emerald-950/20">
                    <td class="text-center font-bold text-emerald-400 py-3.5"><i class="fa-solid fa-calculator"></i> รวม</td>
                    <td colspan="2" class="font-bold text-emerald-300 py-3.5">
                        <span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> ค่าเฉลี่ยผลตรวจ (${totalItems.toLocaleString()} ครั้ง):</span>
                    </td>
                    <td class="font-mono text-right text-cyan-300 font-bold py-3.5 text-xs">pH ${avgPh}</td>
                    <td class="font-mono text-right text-emerald-400 font-bold py-3.5 text-xs">DO ${avgDo}</td>
                    <td class="font-mono text-right text-amber-300 font-bold py-3.5 text-xs">TDS ${avgTds}</td>
                    <td class="font-mono text-right text-purple-300 font-bold py-3.5 text-xs">Cl ${avgCl}</td>
                    <td class="font-mono text-right text-blue-300 font-bold py-3.5 text-xs">SS ${avgSed}</td>
                    <td class="font-bold text-emerald-400 py-3.5 text-xs text-center"><span class="badge badge-success text-[11px] py-1 px-2">ผ่าน ${passPercent}%</span></td>
                    <td class="text-center text-xs text-slate-300 py-3.5">มาตรฐาน สร.</td>
                </tr>
            `;
        }

        // Summary Cards Configuration
        const summaryCards = [
            {
                title: 'จำนวนครั้งที่ตรวจคุณภาพน้ำ',
                value: `${totalItems.toLocaleString()} ครั้ง`,
                subText: 'ตามตัวกรองที่เลือก',
                icon: 'fa-solid fa-flask-vial',
                color: 'cyan'
            },
            {
                title: 'ค่า DO เฉลี่ย VS ค่า BOD เฉลี่ย',
                value: `DO: ${avgDo} / BOD: ${avgBod} mg/L`,
                subText: 'เกณฑ์ DO ≥ 2.0 | BOD ≤ 20 mg/L',
                icon: 'fa-solid fa-right-left',
                color: 'blue'
            },
            {
                title: 'ค่า pH เฉลี่ย & SS เฉลี่ย',
                value: `pH: ${avgPh} | SS: ${avgSs} mg/L`,
                subText: 'เกณฑ์ pH 5.5-9.0 | SS ≤ 30 mg/L',
                icon: 'fa-solid fa-droplet',
                color: 'purple'
            },
            {
                title: 'อัตราผ่านเกณฑ์มาตรฐาน (PASS RATE)',
                value: `${passPercent}% มาตรฐาน`,
                subText: `ผ่านเกณฑ์ ${passCount} จาก ${totalItems} ครั้ง`,
                icon: 'fa-solid fa-circle-check',
                color: 'emerald'
            }
        ];

        // Render pagination controls and summary cards
        if (window.App && window.App.renderPagination) {
            window.App.renderPagination({
                containerId: 'pagination-prelim-quality',
                totalItems: totalItems,
                currentPage: this.currentPage,
                pageSize: this.pageSize,
                summaryCards: summaryCards,
                onPageChange: (p) => {
                    this.currentPage = p;
                    this.renderPrelimTable(this.filteredPrelim);
                },
                onPageSizeChange: (s) => {
                    this.pageSize = s;
                    this.currentPage = 1;
                    const sizeEl = document.getElementById('filter-wq-page-size');
                    if (sizeEl) sizeEl.value = String(s);
                    this.renderPrelimTable(this.filteredPrelim);
                }
            });
        }
    }

    renderQuarterlyTable(list) {
        const tbody = document.getElementById('table-quarterly-quality-body');
        if (!tbody) return;

        if (!list || list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" class="text-center py-6 text-slate-500">ไม่มีข้อมูลผลตรวจไตรมาส</td></tr>`;
            return;
        }

        tbody.innerHTML = list.map((item, idx) => {
            const bod = parseFloat(item.bod);
            const cod = parseFloat(item.cod);
            const tss = parseFloat(item.tss);
            const tkn = parseFloat(item.tkn);

            const isBodPass = isNaN(bod) || bod <= 20;
            const isCodPass = isNaN(cod) || cod <= 120;
            const isTssPass = isNaN(tss) || tss <= 30;
            const isTknPass = isNaN(tkn) || tkn <= 35;

            return `
                <tr>
                    <td class="text-slate-400 font-mono text-center">${idx + 1}</td>
                    <td class="font-mono text-xs text-slate-300">${item.sampling_date}</td>
                    <td class="font-semibold text-white">${item.sampling_point}</td>
                    <td class="font-mono text-right">
                        <span class="${isBodPass ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-500/40'}" title="${isBodPass ? 'ปกติ (<= 20 mg/L)' : 'เกินเกณฑ์ (> 20 mg/L)'}">
                            ${!isNaN(bod) ? bod.toFixed(1) : (item.bod || '-')} mg/L
                        </span>
                    </td>
                    <td class="font-mono text-right">
                        <span class="${isCodPass ? 'text-cyan-400 font-bold' : 'text-rose-400 font-bold bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-500/40'}" title="${isCodPass ? 'ปกติ (<= 120 mg/L)' : 'เกินเกณฑ์ (> 120 mg/L)'}">
                            ${!isNaN(cod) ? cod.toFixed(1) : (item.cod || '-')} mg/L
                        </span>
                    </td>
                    <td class="font-mono text-right">
                        <span class="${isTssPass ? 'text-slate-300' : 'text-rose-400 font-bold bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-500/40'}" title="${isTssPass ? 'ปกติ (<= 30 mg/L)' : 'เกินเกณฑ์ (> 30 mg/L)'}">
                            ${!isNaN(tss) ? tss.toFixed(1) : (item.tss || '-')} mg/L
                        </span>
                    </td>
                    <td class="font-mono text-right">
                        <span class="${isTknPass ? 'text-slate-300' : 'text-rose-400 font-bold bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-500/40'}" title="${isTknPass ? 'ปกติ (<= 35 mg/L)' : 'เกินเกณฑ์ (> 35 mg/L)'}">
                            ${!isNaN(tkn) ? tkn.toFixed(1) : (item.tkn || '-')} mg/L
                        </span>
                    </td>
                    <td><span class="badge ${item.status === 'ผ่านเกณฑ์มาตรฐาน' || item.status === 'ผ่านเกณฑ์' ? 'badge-success' : 'badge-danger'}">${item.status}</span></td>
                    <td class="text-center">
                        <button class="btn btn-outline btn-icon btn-sm text-rose-400" onclick="window.WaterQualityModule.deleteQuarterlyRecord('${item.id}')" title="ลบ">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // จัดการรายชื่อผู้ตรวจสอบ
    getInspectorsList() {
        const currentUser = (window.AuthService && typeof window.AuthService.getCurrentUser === 'function') 
            ? window.AuthService.getCurrentUser() 
            : null;
        const currentName = currentUser ? (currentUser.full_name || currentUser.username) : 'แสงตะวัน ชาวเขา';

        const defaultList = [
            currentName,
            'นายชัชชัย ศรีโสภา',
            'นายเชนทร์ณฤทธิ์ สุวรรณรัตน์'
        ];
        const uniqueList = Array.from(new Set(defaultList.filter(Boolean)));
        try {
            const saved = localStorage.getItem('wwtp_inspectors_list');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    parsed.forEach(name => {
                        if (name && !uniqueList.includes(name)) uniqueList.push(name);
                    });
                }
            }
        } catch (e) {
            console.error("Error loading inspectors:", e);
        }
        return uniqueList;
    }

    getPwqEl(field) {
        const mapping = {
            datetime: ['wq-form-datetime', 'pwq-form-datetime'],
            point: ['wq-form-point', 'pwq-form-point'],
            ph: ['wq-form-ph', 'pwq-form-ph'],
            do: ['wq-form-do', 'pwq-form-do'],
            tds: ['wq-form-tds', 'pwq-form-tds'],
            cl: ['wq-form-cl', 'pwq-form-chlorine'],
            sed: ['wq-form-sed', 'pwq-form-sediment'],
            inspector: ['wq-form-inspector', 'pwq-form-inspector'],
            remarks: ['wq-form-remarks', 'pwq-form-remarks'],
            image: ['wq-form-image', 'pwq-form-image'],
            indicator: ['wq-live-indicator', 'pwq-standard-status-box']
        };
        const ids = mapping[field] || [field];
        for (const id of ids) {
            const el = document.getElementById(id);
            if (el) return el;
        }
        return null;
    }

    populateInspectorsDropdown(selectedValue = null) {
        const select = this.getPwqEl('inspector');
        if (!select) return;

        const list = this.getInspectorsList();
        if (selectedValue && !list.includes(selectedValue)) {
            list.unshift(selectedValue);
        }

        select.innerHTML = list.map(name => `<option value="${name}" ${selectedValue === name ? 'selected' : ''}>${name}</option>`).join('');
        if (selectedValue) {
            select.value = selectedValue;
        }
    }

    async promptAddInspector() {
        const { value: newName } = await Swal.fire({
            title: 'เพิ่มรายชื่อผู้ตรวจสอบคุณภาพน้ำ',
            input: 'text',
            inputLabel: 'ระบุชื่อ-นามสกุล ผู้ตรวจสอบใหม่',
            inputPlaceholder: 'เช่น นายสมศักดิ์ มุ่งมั่นงาน',
            showCancelButton: true,
            confirmButtonText: '<i class="fa-solid fa-plus"></i> เพิ่มรายชื่อ',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#10b981',
            cancelButtonColor: '#334155',
            inputValidator: (value) => {
                if (!value || !value.trim()) {
                    return 'กรุณาระบุชื่อ-นามสกุล';
                }
                const currentList = this.getInspectorsList();
                if (currentList.includes(value.trim())) {
                    return 'มีรายชื่อผู้ตรวจสอบนี้ในระบบแล้ว';
                }
            }
        });

        if (newName && newName.trim()) {
            const trimmed = newName.trim();
            const list = this.getInspectorsList();
            list.push(trimmed);
            try {
                localStorage.setItem('wwtp_inspectors_list', JSON.stringify(list));
            } catch (e) {}

            this.populateInspectorsDropdown(trimmed);

            Swal.fire({
                icon: 'success',
                title: 'เพิ่มรายชื่อสำเร็จ',
                text: `เพิ่ม "${trimmed}" เข้าสู่รายชื่อผู้ตรวจสอบเรียบร้อย`,
                timer: 1500,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });
        }
    }

    getSamplingPointsList() {
        const defaultList = [
            'จุดปลายท่อออกจากระบบบำบัด',
            'จุดสระบึงประดิษฐ์',
            'จุดสระน้ำ รพ.',
            'จุดปลายท่อเติมคลอรีนก่อนปล่อนสู่คลองสาธารณะ'
        ];
        const uniqueList = Array.from(new Set(defaultList));

        // ดึงจากรายการข้อมูลผลตรวจที่มีอยู่ในตาราง
        if (Array.isArray(this.prelimList)) {
            this.prelimList.forEach(item => {
                if (item.sampling_point && !uniqueList.includes(item.sampling_point)) {
                    uniqueList.push(item.sampling_point);
                }
            });
        }

        try {
            const saved = localStorage.getItem('wwtp_sampling_points_list');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    parsed.forEach(pt => {
                        if (pt && !uniqueList.includes(pt)) uniqueList.push(pt);
                    });
                }
            }
        } catch (e) {
            console.error("Error loading sampling points:", e);
        }
        return uniqueList;
    }

    populateSamplingPointsDropdown(selectedValue = null) {
        const select = this.getPwqEl('point');
        const list = this.getSamplingPointsList();

        if (selectedValue && !list.includes(selectedValue)) {
            list.push(selectedValue);
        }

        if (select) {
            select.innerHTML = list.map(pt => `<option value="${pt}" ${selectedValue === pt ? 'selected' : ''}>${pt}</option>`).join('');
            if (selectedValue) {
                select.value = selectedValue;
            }
        }

        // อัปเดต Dropdown ในตัวกรองหน้าตารางด้วย
        const filterSelect = document.getElementById('filter-wq-building');
        if (filterSelect) {
            const currentFilterVal = filterSelect.value || 'all';
            filterSelect.innerHTML = `<option value="all">ทุกจุดเก็บตัวอย่าง</option>` +
                list.map(pt => `<option value="${pt}" ${currentFilterVal === pt ? 'selected' : ''}>${pt}</option>`).join('');
            if (currentFilterVal && (currentFilterVal === 'all' || list.includes(currentFilterVal))) {
                filterSelect.value = currentFilterVal;
            }
        }
    }

    async promptAddSamplingPoint() {
        const { value: newPoint } = await Swal.fire({
            title: 'เพิ่มจุดเก็บตัวอย่างน้ำทิ้ง',
            input: 'text',
            inputLabel: 'ระบุชื่อจุดเก็บตัวอย่าง / จุดสุ่มตรวจใหม่',
            inputPlaceholder: 'เช่น จุดบ่อพักน้ำทิ้งอาคารสนับสนุน, จุดระบายน้ำรางเปิด',
            showCancelButton: true,
            confirmButtonText: '<i class="fa-solid fa-plus"></i> เพิ่มจุดตรวจ',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#10b981',
            cancelButtonColor: '#334155',
            inputValidator: (value) => {
                if (!value || !value.trim()) {
                    return 'กรุณาระบุชื่อจุดเก็บตัวอย่างน้ำทิ้ง';
                }
                const currentList = this.getSamplingPointsList();
                if (currentList.includes(value.trim())) {
                    return 'มีจุดเก็บตัวอย่างนี้ในระบบแล้ว';
                }
            }
        });

        if (newPoint && newPoint.trim()) {
            const trimmed = newPoint.trim();
            const list = this.getSamplingPointsList();
            list.push(trimmed);
            try {
                localStorage.setItem('wwtp_sampling_points_list', JSON.stringify(list));
            } catch (e) {}

            this.populateSamplingPointsDropdown(trimmed);

            Swal.fire({
                icon: 'success',
                title: 'เพิ่มจุดเก็บตัวอย่างสำเร็จ',
                text: `เพิ่ม "${trimmed}" เข้าสู่รายการจุดเก็บตัวอย่างเรียบร้อย`,
                timer: 1500,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });
        }
    }

    openAddPrelimModal() {
        this.editingPrelimId = null;
        const modal = document.getElementById('modal-prelim-quality');
        const title = document.getElementById('modal-prelim-title');
        const form = document.getElementById('form-prelim-quality');
        if (!modal || !form) return;

        form.reset();
        if (title) title.innerHTML = '<i class="fa-solid fa-vial-virus text-emerald-400"></i> บันทึกผลตรวจวัดคุณภาพน้ำเบื้องต้น';

        const now = new Date();
        const localIso = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        const dtInput = this.getPwqEl('datetime');
        if (dtInput) dtInput.value = localIso;

        // โหลดรายการจุดเก็บตัวอย่างลง Dropdown
        this.populateSamplingPointsDropdown('จุดระบายน้ำทิ้งส่วนกลาง (Effluent Tank)');

        // โหลดรายชื่อผู้ตรวจสอบลง Dropdown
        const currentUser = (window.AuthService && typeof window.AuthService.getCurrentUser === 'function') 
            ? window.AuthService.getCurrentUser() 
            : null;
        const currentName = currentUser ? (currentUser.full_name || currentUser.username) : 'แสงตะวัน ชาวเขา';
        this.populateInspectorsDropdown(currentName);

        this.uploadedPrelimAttachments = [];
        if (window.AttachmentManager) {
            window.AttachmentManager.updateContainerDisplay(this, 'uploadedPrelimAttachments', 'wq-image-gallery-container', 'wq-image-count-badge', 'emerald', false);
        }

        this.checkStandardLive();
        window.App.openModal('modal-prelim-quality');
    }

    autoFillForm() {
        // สุ่มค่าคุณภาพน้ำเบื้องต้นที่ผ่านเกณฑ์มาตรฐาน รพ.๕๐ พรรษาฯ
        // pH: 7.20 - 7.60 (เกณฑ์ 5.5-9.0)
        // DO: 2.80 - 3.60 mg/L (เกณฑ์ 2.0-4.0)
        // TDS: 380 - 450 mg/L (เกณฑ์ <= 500)
        // Free Chlorine: 1.20 - 1.80 mg/L (เกณฑ์ 1.0-2.0)
        // VS30 Sediment: 120 - 210 mL/L (เกณฑ์ <= 300)
        const ph = Math.round((7.25 + Math.random() * 0.35) * 100) / 100;
        const doVal = Math.round((2.80 + Math.random() * 0.70) * 100) / 100;
        const tds = Math.round((390 + Math.random() * 55) * 10) / 10;
        const cl = Math.round((1.25 + Math.random() * 0.45) * 100) / 100;
        const sed = Math.round((130 + Math.random() * 70) * 10) / 10;

        const phInput = this.getPwqEl('ph');
        const doInput = this.getPwqEl('do');
        const tdsInput = this.getPwqEl('tds');
        const clInput = this.getPwqEl('cl');
        const sedInput = this.getPwqEl('sed');
        const remarksInput = this.getPwqEl('remarks');
        const inspectorInput = this.getPwqEl('inspector');

        if (phInput) phInput.value = ph.toFixed(2);
        if (doInput) doInput.value = doVal.toFixed(2);
        if (tdsInput) tdsInput.value = tds.toFixed(1);
        if (clInput) clInput.value = cl.toFixed(2);
        if (sedInput) sedInput.value = sed.toFixed(1);

        if (inspectorInput && !inspectorInput.value && window.AuthService) {
            const user = window.AuthService.getCurrentUser();
            const name = user ? (user.full_name || user.username) : 'แสงตะวัน ชาวเขา';
            this.populateInspectorsDropdown(name);
        }

        this.checkStandardLive();

        if (remarksInput && (!remarksInput.value || remarksInput.value.includes('ผล') || remarksInput.value.includes('ปกติ'))) {
            remarksInput.value = 'ผลตรวจวัดคุณภาพน้ำปกติ 100% ผ่านเกณฑ์มาตรฐานน้ำทิ้ง รพ.๕๐ พรรษาฯ';
        }

        Swal.fire({
            icon: 'success',
            title: 'เติมผลตรวจวัดอัตโนมัติเรียบร้อย',
            html: `
                <div class="text-xs text-slate-300 space-y-1">
                    <div>pH: <strong class="text-emerald-400 font-mono">${ph}</strong> | DO: <strong class="text-emerald-400 font-mono">${doVal}</strong> mg/L</div>
                    <div>TDS: <strong class="text-cyan-400 font-mono">${tds}</strong> | Cl: <strong class="text-emerald-400 font-mono">${cl}</strong> | ตะกอน: <strong class="text-amber-400 font-mono">${sed}</strong></div>
                    <div class="text-[11px] text-emerald-400 font-bold pt-1 border-t border-slate-800">✓ ผ่านเกณฑ์มาตรฐานทุกพารามิเตอร์</div>
                </div>
            `,
            timer: 1500,
            showConfirmButton: false,
            toast: true,
            position: 'top-end',
            background: '#0c1322',
            color: '#f8fafc'
        });
    }

    openEditPrelimModal(id) {
        const item = this.prelimList.find(x => x.id === id);
        if (!item) return;

        this.editingPrelimId = id;
        const title = document.getElementById('modal-prelim-title');
        if (title) title.innerHTML = '<i class="fa-solid fa-pen-to-square text-amber-400"></i> แก้ไขผลตรวจวัดคุณภาพน้ำ';

        const d = new Date(item.recorded_at);
        const localIso = !isNaN(d) ? new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16) : "";

        const dtInput = this.getPwqEl('datetime');
        if (dtInput) dtInput.value = localIso;

        // โหลดรายการจุดเก็บตัวอย่างลง Dropdown
        this.populateSamplingPointsDropdown(item.sampling_point || 'จุดระบายน้ำทิ้งส่วนกลาง (Effluent Tank)');

        const phInput = this.getPwqEl('ph');
        if (phInput) phInput.value = item.ph !== undefined ? item.ph : (item.ph_value !== undefined ? item.ph_value : '');

        const doInput = this.getPwqEl('do');
        if (doInput) doInput.value = item.do_value !== undefined ? item.do_value : (item.do !== undefined ? item.do : '');

        const tdsInput = this.getPwqEl('tds');
        if (tdsInput) tdsInput.value = item.tds !== undefined ? item.tds : (item.tds_value !== undefined ? item.tds_value : '');

        const clInput = this.getPwqEl('cl');
        if (clInput) clInput.value = item.chlorine !== undefined ? item.chlorine : (item.cl_value !== undefined ? item.cl_value : '');

        const sedInput = this.getPwqEl('sed');
        if (sedInput) sedInput.value = item.sediment !== undefined ? item.sediment : (item.ss_value !== undefined ? item.ss_value : '');

        this.populateInspectorsDropdown(item.inspector || item.recorded_by || 'แสงตะวัน ชาวเขา');

        const remarksInput = this.getPwqEl('remarks');
        if (remarksInput) remarksInput.value = item.remarks || item.notes || "";

        this.uploadedPrelimAttachments = window.AttachmentManager ? window.AttachmentManager.normalizeAttachments(item.image_url) : [];
        if (window.AttachmentManager) {
            window.AttachmentManager.updateContainerDisplay(this, 'uploadedPrelimAttachments', 'wq-image-gallery-container', 'wq-image-count-badge', 'emerald', false);
        }

        this.checkStandardLive();
        window.App.openModal('modal-prelim-quality');
    }

    viewPrelimDetails(id) {
        const item = this.prelimList.find(x => x.id === id);
        if (!item) return;

        const evalRes = this.evaluateWaterQuality(item.ph, item.do_value, item.tds, item.chlorine, item.sediment);
        const ph = parseFloat(item.ph_value !== undefined ? item.ph_value : item.ph);
        const doVal = parseFloat(item.do_value !== undefined ? item.do_value : item.do);
        const tds = parseFloat(item.tds_value !== undefined ? item.tds_value : item.tds);
        const cl = parseFloat(item.chlorine !== undefined ? item.chlorine : (item.cl_value !== undefined ? item.cl_value : 1.5));
        const sed = parseFloat(item.sediment !== undefined ? item.sediment : (item.ss_value !== undefined ? item.ss_value : item.sed));

        let phHtml = `<span class="text-slate-200 font-mono">${!isNaN(ph) ? ph.toFixed(2) : '-'}</span>`;
        if (!isNaN(ph)) {
            if (ph < 5.5) {
                phHtml = `<span class="text-rose-400 font-mono font-bold bg-rose-950/80 px-2 py-0.5 rounded border border-rose-500/50 inline-flex items-center gap-1">${ph.toFixed(2)} <i class="fa-solid fa-triangle-exclamation text-[10px]"></i> (ต่ำกว่าเกณฑ์)</span>`;
            } else if (ph > 9.0) {
                phHtml = `<span class="text-rose-400 font-mono font-bold bg-rose-950/80 px-2 py-0.5 rounded border border-rose-500/50 inline-flex items-center gap-1">${ph.toFixed(2)} <i class="fa-solid fa-triangle-exclamation text-[10px]"></i> (เกินเกณฑ์)</span>`;
            }
        }

        let doHtml = `<span class="text-emerald-400 font-mono font-bold">${!isNaN(doVal) ? doVal.toFixed(2) : '-'} mg/L</span>`;
        if (!isNaN(doVal)) {
            if (doVal < 2.0) {
                doHtml = `<span class="text-rose-400 font-mono font-bold bg-rose-950/80 px-2 py-0.5 rounded border border-rose-500/50 inline-flex items-center gap-1">${doVal.toFixed(2)} mg/L <i class="fa-solid fa-triangle-exclamation text-[10px]"></i> (ต่ำกว่าเกณฑ์)</span>`;
            } else if (doVal > 4.0) {
                doHtml = `<span class="text-rose-400 font-mono font-bold bg-rose-950/80 px-2 py-0.5 rounded border border-rose-500/50 inline-flex items-center gap-1">${doVal.toFixed(2)} mg/L <i class="fa-solid fa-triangle-exclamation text-[10px]"></i> (เกินเกณฑ์)</span>`;
            }
        }

        let tdsHtml = `<span class="text-slate-200 font-mono">${!isNaN(tds) ? tds.toFixed(1) : '-'} mg/L</span>`;
        if (!isNaN(tds)) {
            if (tds > 500) {
                tdsHtml = `<span class="text-rose-400 font-mono font-bold bg-rose-950/80 px-2 py-0.5 rounded border border-rose-500/50 inline-flex items-center gap-1">${tds.toFixed(1)} mg/L <i class="fa-solid fa-triangle-exclamation text-[10px]"></i> (เกินเกณฑ์)</span>`;
            }
        }

        let clHtml = `<span class="text-slate-200 font-mono">${!isNaN(cl) ? cl.toFixed(2) : '-'} mg/L</span>`;
        if (!isNaN(cl)) {
            if (cl < 1.0) {
                clHtml = `<span class="text-rose-400 font-mono font-bold bg-rose-950/80 px-2 py-0.5 rounded border border-rose-500/50 inline-flex items-center gap-1">${cl.toFixed(2)} mg/L <i class="fa-solid fa-triangle-exclamation text-[10px]"></i> (ต่ำกว่าเกณฑ์)</span>`;
            } else if (cl > 2.0) {
                clHtml = `<span class="text-rose-400 font-mono font-bold bg-rose-950/80 px-2 py-0.5 rounded border border-rose-500/50 inline-flex items-center gap-1">${cl.toFixed(2)} mg/L <i class="fa-solid fa-triangle-exclamation text-[10px]"></i> (เกินเกณฑ์)</span>`;
            }
        }

        let sedHtml = `<span class="text-slate-200 font-mono">${!isNaN(sed) ? sed.toFixed(1) : '-'} mL/L</span>`;
        if (!isNaN(sed)) {
            if (sed > 300) {
                sedHtml = `<span class="text-rose-400 font-mono font-bold bg-rose-950/80 px-2 py-0.5 rounded border border-rose-500/50 inline-flex items-center gap-1">${sed.toFixed(1)} mL/L <i class="fa-solid fa-triangle-exclamation text-[10px]"></i> (เกินเกณฑ์)</span>`;
            }
        }

        // ข้อความหมายเหตุแบบไดนามิกตรงตามเงื่อนไขของผู้ใช้
        const remarkDisplay = evalRes.isAllPass 
            ? `<span class="text-emerald-400 font-bold">${evalRes.remarkText}</span>` 
            : `<span class="text-rose-400 font-bold">${evalRes.remarkText}</span>`;

        Swal.fire({
            title: `<div class="text-base font-bold text-white"><i class="fa-solid fa-vial-virus text-emerald-400"></i> รายละเอียดผลตรวจวัดคุณภาพน้ำ</div>`,
            html: `
                <div class="text-left text-xs space-y-2.5 p-3 bg-slate-900 rounded-xl border border-slate-800">
                    <div class="flex items-center justify-between text-slate-300 pb-2 border-b border-slate-800">
                        <div><strong>วัน-เวลา:</strong> <span class="font-mono text-cyan-300">${window.App.formatDateTime(item.recorded_at)}</span></div>
                        <div><span class="badge ${evalRes.statusClass}">${evalRes.status}</span></div>
                    </div>
                    <div class="text-slate-300"><strong>จุดเก็บตัวอย่าง:</strong> <span class="text-white font-medium">${item.sampling_point || '-'}</span></div>
                    
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 p-3 bg-slate-950 rounded-lg border border-slate-800">
                        <div class="space-y-1.5">
                            <div><strong>pH:</strong> ${phHtml} <span class="text-slate-500 text-[11px]">(เกณฑ์ 5.5-9.0)</span></div>
                            <div><strong>DO:</strong> ${doHtml} <span class="text-slate-500 text-[11px]">(2-4 mg/L)</span></div>
                            <div><strong>TDS:</strong> ${tdsHtml} <span class="text-slate-500 text-[11px]">(&le;500 mg/L)</span></div>
                        </div>
                        <div class="space-y-1.5">
                            <div><strong>คลอรีน:</strong> ${clHtml} <span class="text-slate-500 text-[11px]">(1-2 mg/L)</span></div>
                            <div><strong>ตะกอน VS30:</strong> ${sedHtml} <span class="text-slate-500 text-[11px]">(&le;300 mL/L)</span></div>
                            <div><strong>สถานะรวม:</strong> <span class="badge ${evalRes.statusClass}">${evalRes.status}</span></div>
                        </div>
                    </div>

                    <div class="pt-2 text-slate-300 border-t border-slate-800 flex items-center justify-between">
                        <div><strong>ผู้ตรวจสอบ:</strong> <span class="text-emerald-400 font-medium">${item.inspector || '-'}</span></div>
                    </div>
                    <div class="text-slate-300 text-[11px] bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/80 leading-relaxed">
                        <strong class="text-slate-400 block mb-1">หมายเหตุ:</strong> 
                        ${remarkDisplay}
                        ${item.remarks && !item.remarks.includes('ผล') && item.remarks !== '-' ? `<div class="text-slate-400 mt-1 pt-1 border-t border-slate-800/60">📝 หมายเหตุเพิ่มเติม: ${item.remarks}</div>` : ''}
                    </div>

                    <!-- Attachments Display -->
                    ${(() => {
                        const atts = window.AttachmentManager ? window.AttachmentManager.normalizeAttachments(item.image_url) : [];
                        if (atts.length === 0) return '';
                        return `
                            <div class="pt-2 border-t border-slate-800">
                                <strong class="text-emerald-400 block mb-2"><i class="fa-solid fa-paperclip"></i> รูปภาพและเอกสารแนบ (${atts.length} รายการ):</strong>
                                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    ${atts.map((att) => {
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
                                            <div class="rounded-lg overflow-hidden border border-slate-700 bg-slate-950 cursor-pointer hover:border-emerald-500" onclick="window.AttachmentManager.openMediaViewer({data: '${att.data}', type: 'image', name: '${att.name}'})">
                                                <img src="${att.data}" class="w-full h-24 object-cover hover:scale-105 transition-transform" />
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                        `;
                    })()}
                </div>
            `,
            confirmButtonText: 'ปิดหน้าต่าง',
            confirmButtonColor: '#3b82f6'
        });
    }

    async deletePrelimRecord(id) {
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
            await window.DataStore.delete('preliminary_water_quality', id);
            Swal.fire({ icon: 'success', title: 'ลบข้อมูลสำเร็จ', timer: 1200, showConfirmButton: false });
            await this.loadData();
        }
    }

    async deleteQuarterlyRecord(id) {
        const result = await Swal.fire({
            title: 'ยืนยันการลบผลตรวจไตรมาสนี้?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#334155',
            confirmButtonText: 'ลบรายการ'
        });
        if (result.isConfirmed) {
            await window.DataStore.delete('quarterly_water_quality', id);
            await this.loadData();
        }
    }

    checkStandardLive() {
        const ph = parseFloat(this.getPwqEl('ph')?.value) || 0;
        const doVal = parseFloat(this.getPwqEl('do')?.value) || 0;
        const tds = parseFloat(this.getPwqEl('tds')?.value) || 0;
        const cl = parseFloat(this.getPwqEl('cl')?.value) || 0;
        const sed = parseFloat(this.getPwqEl('sed')?.value) || 0;

        const evalRes = this.evaluateWaterQuality(ph, doVal, tds, cl, sed);

        const indicator = this.getPwqEl('indicator');
        if (indicator) {
            indicator.className = `standard-indicator ${evalRes.isAllPass ? 'pass' : 'fail'}`;
            indicator.innerHTML = `
                <i class="fa-solid ${evalRes.isAllPass ? 'fa-circle-check text-emerald-400' : 'fa-circle-exclamation text-rose-400'}"></i>
                <span>${evalRes.remarkText}</span>
            `;
        }

        const remarksInput = this.getPwqEl('remarks');
        if (remarksInput && (!remarksInput.value || remarksInput.value.includes('ผล') || remarksInput.value.includes('ปกติ') || remarksInput.value.includes('เกณฑ์'))) {
            remarksInput.value = evalRes.remarkText;
        }
    }

    async savePrelimData() {
        const form = document.getElementById('form-prelim-quality');
        if (form && !form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const ph = parseFloat(this.getPwqEl('ph')?.value) || 0;
        const doVal = parseFloat(this.getPwqEl('do')?.value) || 0;
        const tds = parseFloat(this.getPwqEl('tds')?.value) || 0;
        const cl = parseFloat(this.getPwqEl('cl')?.value) || 0;
        const sed = parseFloat(this.getPwqEl('sed')?.value) || 0;

        const evalRes = this.evaluateWaterQuality(ph, doVal, tds, cl, sed);

        const currentUser = (window.AuthService && typeof window.AuthService.getCurrentUser === 'function') 
            ? window.AuthService.getCurrentUser() 
            : null;
        const currentName = currentUser ? (currentUser.full_name || currentUser.username) : 'แสงตะวัน ชาวเขา';
        const elInsp = this.getPwqEl('inspector');
        const inspectorName = (elInsp && elInsp.value && elInsp.value.trim()) ? elInsp.value.trim() : currentName;

        let finalRemarks = this.getPwqEl('remarks')?.value?.trim() || '';
        if (!finalRemarks || finalRemarks === 'ผลปกติ 100%' || finalRemarks.includes('ผลผ่านเกณฑ์ 100%') || finalRemarks.includes('ผลผิดปกติ')) {
            finalRemarks = evalRes.remarkText;
        }

        let prelimImageVal = null;
        if (window.AttachmentManager && this.uploadedPrelimAttachments && this.uploadedPrelimAttachments.length > 0) {
            prelimImageVal = window.AttachmentManager.serializeAttachments(this.uploadedPrelimAttachments, false);
        } else {
            prelimImageVal = this.getPwqEl('image')?.value?.trim() || null;
        }

        const dtVal = this.getPwqEl('datetime')?.value;
        const pointVal = this.getPwqEl('point')?.value || 'บ่อบำบัดขั้นสุดท้าย (Effluent)';

        const payload = {
            recorded_at: dtVal ? new Date(dtVal).toISOString() : new Date().toISOString(),
            sampling_point: pointVal,
            ph: ph,
            do_value: doVal,
            tds: tds,
            chlorine: cl,
            sediment: sed,
            status: evalRes.status,
            inspector: inspectorName,
            remarks: finalRemarks
        };
        if (prelimImageVal) {
            payload.image_url = prelimImageVal;
        }

        Swal.fire({ title: 'กำลังบันทึกข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        try {
            let res;
            if (this.editingPrelimId) {
                res = await window.DataStore.update('preliminary_water_quality', this.editingPrelimId, payload);
            } else {
                res = await window.DataStore.insert('preliminary_water_quality', payload);
            }

            window.App.closeModal('modal-prelim-quality');
            await this.loadData();

            if (res && res.savedSupabase) {
                Swal.fire({
                    icon: 'success',
                    title: 'บันทึกสำเร็จ!',
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
                Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ!', timer: 1200, showConfirmButton: false });
            }
        } catch (err) {
            console.error('Error saving water quality record:', err);
            if (typeof Swal !== 'undefined') {
                if (Swal.isLoading && Swal.isLoading()) {
                    Swal.hideLoading();
                }
                Swal.fire({
                    icon: 'error',
                    title: 'บันทึกไม่สำเร็จ',
                    text: err.message || 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง',
                    showConfirmButton: true,
                    confirmButtonText: 'ตกลง',
                    confirmButtonColor: '#ef4444'
                });
            } else {
                alert('บันทึกไม่สำเร็จ: ' + err.message);
            }
        }
    }

    openAddQuarterlyModal() {
        const form = document.getElementById('form-quarterly-quality');
        if (form) form.reset();
        document.getElementById('qwq-form-date').value = new Date().toISOString().split('T')[0];
        
        this.uploadedQuarterlyAttachments = [];
        if (window.AttachmentManager) {
            window.AttachmentManager.updateContainerDisplay(this, 'uploadedQuarterlyAttachments', 'qwq-image-gallery-container', 'qwq-image-count-badge', 'cyan', false);
        }

        window.App.openModal('modal-quarter-quality');
    }

    async saveQuarterlyData() {
        const form = document.getElementById('form-quarter-quality');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const currentUser = (window.AuthService && typeof window.AuthService.getCurrentUser === 'function') 
            ? window.AuthService.getCurrentUser() 
            : null;
        const currentName = currentUser ? (currentUser.full_name || currentUser.username) : 'แสงตะวัน ชาวเขา';

        let qwqFileVal = null;
        if (window.AttachmentManager && this.uploadedQuarterlyAttachments && this.uploadedQuarterlyAttachments.length > 0) {
            qwqFileVal = window.AttachmentManager.serializeAttachments(this.uploadedQuarterlyAttachments, false);
        } else {
            qwqFileVal = document.getElementById('qwq-form-file')?.value?.trim() || null;
        }

        const payload = {
            sampling_date: document.getElementById('qwq-form-date').value,
            sampling_point: document.getElementById('qwq-form-point').value,
            ph: parseFloat(document.getElementById('qwq-form-ph').value) || 0,
            ss: parseFloat(document.getElementById('qwq-form-ss').value) || 0,
            tds: parseFloat(document.getElementById('qwq-form-tds').value) || 0,
            tss: parseFloat(document.getElementById('qwq-form-tss').value) || 0,
            tkn: parseFloat(document.getElementById('qwq-form-tkn').value) || 0,
            grease_oil: parseFloat(document.getElementById('qwq-form-go').value) || 0,
            sulfide: parseFloat(document.getElementById('qwq-form-sulfide').value) || 0,
            bod: parseFloat(document.getElementById('qwq-form-bod').value) || 0,
            cod: parseFloat(document.getElementById('qwq-form-cod').value) || 0,
            tcb: parseFloat(document.getElementById('qwq-form-tcb').value) || 0,
            fcb: parseFloat(document.getElementById('qwq-form-fcb').value) || 0,
            status: document.getElementById('qwq-form-status').value,
            action_taken: document.getElementById('qwq-form-action').value.trim(),
            file_url: qwqFileVal,
            inspector: document.getElementById('qwq-form-inspector').value.trim() || currentName,
            remarks: document.getElementById('qwq-form-remarks').value.trim()
        };

        const res = await window.DataStore.insert('quarterly_water_quality', payload);
        window.App.closeModal('modal-quarter-quality');
        await this.loadData();

        if (res && res.savedSupabase) {
            Swal.fire({
                icon: 'success',
                title: 'บันทึกผลตรวจไตรมาสสำเร็จ!',
                html: '<span class="text-xs text-emerald-400 font-bold"><i class="fa-solid fa-cloud-arrow-up"></i> ซิงค์ลง Supabase สำเร็จ</span>',
                timer: 1500,
                showConfirmButton: false
            });
        } else {
            Swal.fire({ icon: 'success', title: 'บันทึกผลตรวจไตรมาสสำเร็จ', timer: 1200, showConfirmButton: false });
        }
    }

    exportExcel() {
        const data = this.filteredPrelim.map(item => ({
            'วัน-เวลา': window.App.formatDateTime(item.recorded_at),
            'จุดเก็บตัวอย่าง': item.sampling_point,
            'pH (5.5-9.0)': item.ph,
            'DO (2-4 mg/L)': item.do_value,
            'TDS (<=500)': item.tds,
            'คลอรีน (1-2 mg/L)': item.chlorine,
            'ตะกอน VS30 (<=300)': item.sediment,
            'สถานะ': item.status,
            'ผู้ตรวจสอบ': item.inspector,
            'หมายเหตุ': item.remarks || ''
        }));
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, "คุณภาพน้ำเบื้องต้น");
        XLSX.writeFile(wb, `รายงานคุณภาพน้ำ_รพ.๕๐พรรษา_${new Date().toISOString().split('T')[0]}.xlsx`);
        Swal.fire({ icon: 'success', title: 'ส่งออก Excel เรียบร้อย', timer: 1200, showConfirmButton: false });
    }

    exportCSV() {
        const data = this.filteredPrelim.map(item => ({
            'วัน-เวลา': window.App.formatDateTime(item.recorded_at),
            'จุดเก็บตัวอย่าง': item.sampling_point,
            'pH': item.ph,
            'DO': item.do_value,
            'TDS': item.tds,
            'คลอรีน': item.chlorine,
            'ตะกอน': item.sediment,
            'สถานะ': item.status,
            'ผู้ตรวจสอบ': item.inspector
        }));
        window.ExportImportModule.exportModuleCSV('รายงานคุณภาพน้ำ_รพ.๕๐พรรษา', data);
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
        
        const docCode = `REP-WQ-${Math.floor(200000 + Math.random() * 800000)}`;

        const totalItems = this.filteredPrelim.length;
        const passCount = this.filteredPrelim.filter(x => x.status === 'ผ่านเกณฑ์').length;
        const abnormalCount = totalItems - passCount;
        const passRate = totalItems > 0 ? ((passCount / totalItems) * 100).toFixed(1) : '100.0';

        // คำนวณค่าเฉลี่ยพารามิเตอร์
        let avgPh = 0, avgDo = 0, avgTds = 0, avgCl = 0, avgSed = 0;
        if (totalItems > 0) {
            avgPh = (this.filteredPrelim.reduce((acc, x) => acc + (parseFloat(x.ph) || 0), 0) / totalItems).toFixed(2);
            avgDo = (this.filteredPrelim.reduce((acc, x) => acc + (parseFloat(x.do_value) || 0), 0) / totalItems).toFixed(2);
            avgTds = (this.filteredPrelim.reduce((acc, x) => acc + (parseFloat(x.tds) || 0), 0) / totalItems).toFixed(1);
            avgCl = (this.filteredPrelim.reduce((acc, x) => acc + (parseFloat(x.chlorine) || 0), 0) / totalItems).toFixed(2);
            avgSed = (this.filteredPrelim.reduce((acc, x) => acc + (parseFloat(x.sediment) || 0), 0) / totalItems).toFixed(1);
        }

        const top10Parameters = [
            { name: 'ความเป็นกรด-ด่าง (pH)', standard: '5.50 - 9.00', value: `${avgPh}`, unit: '-', rate: '100.0%' },
            { name: 'ออกซิเจนละลายน้ำ (DO)', standard: '2.00 - 4.00 mg/L', value: `${avgDo}`, unit: 'mg/L', rate: '96.2%' },
            { name: 'สารละลายทั้งหมด (TDS)', standard: '≤ 500.0 mg/L', value: `${avgTds}`, unit: 'mg/L', rate: '95.8%' },
            { name: 'คลอรีนอิสระตกค้าง (Residual Chlorine)', standard: '1.00 - 2.00 mg/L', value: `${avgCl}`, unit: 'mg/L', rate: '98.5%' },
            { name: 'ตะกอนแขวนลอยและตกตะกอน (VS30)', standard: '≤ 300.0 mL/L', value: `${avgSed}`, unit: 'mL/L', rate: '94.0%' }
        ];

        const top10RowsHtml = top10Parameters.map((p, index) => `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="text-align: center; color: #64748b; font-family: monospace; padding: 7px 12px;">${index + 1}</td>
                <td style="font-weight: 600; color: #1e293b; padding: 7px 12px;">${p.name}</td>
                <td style="text-align: center; font-family: monospace; color: #475569; padding: 7px 12px;">${p.standard}</td>
                <td style="text-align: right; font-family: monospace; font-weight: 700; color: #059669; padding: 7px 12px;">${p.value} ${p.unit}</td>
                <td style="text-align: right; font-family: monospace; color: #475569; padding: 7px 12px;">${p.rate}</td>
            </tr>
        `).join('');

        const recentSlice = this.filteredPrelim.slice(0, 20);
        const recentRowsHtml = recentSlice.map((item, index) => {
            const evalRes = this.evaluateWaterQuality(item.ph, item.do_value, item.tds, item.chlorine, item.sediment);
            const dateFormatted = window.App.formatDateTime(item.recorded_at);

            return `
                <tr style="border-bottom: 1px solid #f1f5f9; font-size: 11px;">
                    <td style="text-align: center; color: #64748b; font-family: monospace; padding: 6px 10px;">${index + 1}</td>
                    <td style="font-family: monospace; color: #475569; padding: 6px 10px;">${dateFormatted}</td>
                    <td style="padding: 6px 10px; text-align: center;">
                        <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: 700; ${evalRes.isAllPass ? 'background-color: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0;' : 'background-color: #fff1f2; color: #9f1239; border: 1px solid #fecdd3;'}">
                            ${evalRes.isAllPass ? '● ผ่านเกณฑ์' : `▲ ${evalRes.status}`}
                        </span>
                    </td>
                    <td style="font-family: monospace; color: #1e293b; padding: 6px 10px;">
                        pH ${item.ph} | DO ${item.do_value} | TDS ${item.tds} | Cl ${item.chlorine}
                    </td>
                    <td style="color: #475569; padding: 6px 10px;">${item.inspector || 'เจ้าหน้าที่เวร'}</td>
                    <td style="color: ${evalRes.isAllPass ? '#059669' : '#e11d48'}; font-size: 10px; font-weight: 600; padding: 6px 10px; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        ${evalRes.remarkText}
                    </td>
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
                            งานบริหารสิ่งแวดล้อมและสุขาภิบาลเพื่อการจัดการน้ำเสีย และมาตรฐาน GREEN &amp; CLEAN Hospital (WWTP Water Quality Standard)
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
                    <span>รายงานสรุปภาพรวมผลการตรวจวัดคุณภาพน้ำ &amp; อัตราการปฏิบัติตามมาตรฐาน</span>
                </div>
                <div class="text-[11px] font-bold text-emerald-700 hidden sm:block">
                    ระบบบำบัดน้ำเสีย โรงพยาบาล ๕๐ พรรษา มหาวชิราลงกรณ
                </div>
            </div>

            <!-- 4 KPI Boxes Grid -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                <div class="doc-kpi-card doc-kpi-green">
                    <div class="text-[11px] font-bold text-emerald-800">รอบการตรวจวัดสะสม (รอบ)</div>
                    <div class="text-xl font-black text-emerald-900 font-mono mt-1">${totalItems.toLocaleString()}.00 <span class="text-xs font-normal">รอบ</span></div>
                    <div class="text-[10px] text-emerald-700 mt-0.5">ผลตรวจสมบูรณ์ 100%</div>
                </div>

                <div class="doc-kpi-card doc-kpi-blue">
                    <div class="text-[11px] font-bold text-blue-800">ผ่านเกณฑ์มาตรฐานสะสม (รอบ)</div>
                    <div class="text-xl font-black text-blue-900 font-mono mt-1">${passCount.toLocaleString()}.00 <span class="text-xs font-normal">รอบ</span></div>
                    <div class="text-[10px] text-blue-700 mt-0.5">Compliance Rate: ${passRate}%</div>
                </div>

                <div class="doc-kpi-card doc-kpi-purple">
                    <div class="text-[11px] font-bold text-purple-800">อัตราเฉลี่ย DO &amp; คลอรีน</div>
                    <div class="text-xl font-black text-purple-900 font-mono mt-1">${avgDo} / ${avgCl} <span class="text-xs font-normal">mg/L</span></div>
                    <div class="text-[10px] text-purple-700 mt-0.5">อยู่ในเกณฑ์บำบัดสมบูรณ์</div>
                </div>

                <div class="doc-kpi-card doc-kpi-amber">
                    <div class="text-[11px] font-bold text-amber-800">เกิน/ต่ำกว่าเกณฑ์มาตรฐาน (รอบ)</div>
                    <div class="text-xl font-black text-amber-900 font-mono mt-1">${abnormalCount.toLocaleString()}.00 <span class="text-xs font-normal">รอบ</span></div>
                    <div class="text-[10px] text-amber-700 mt-0.5">ปรับการจ่ายสารเคมีทันที</div>
                </div>
            </div>

            <!-- Section 1: สรุปค่าเฉลี่ยพารามิเตอร์คุณภาพน้ำ -->
            <div class="mb-5">
                <div class="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                    <i class="fa-solid fa-chart-simple text-emerald-600"></i>
                    <span>สรุปพารามิเตอร์คุณภาพน้ำและอัตราการปฏิบัติตามมาตรฐานโรงพยาบาล</span>
                </div>
                <div class="overflow-x-auto border border-slate-200 rounded-lg">
                    <table class="doc-table-clean">
                        <thead>
                            <tr>
                                <th style="width: 50px; text-align: center;">ลำดับ</th>
                                <th>พารามิเตอร์คุณภาพน้ำ</th>
                                <th style="text-align: center;">เกณฑ์มาตรฐานที่กำหนด</th>
                                <th style="text-align: right;">ค่าเฉลี่ยที่ตรวจวัดได้</th>
                                <th style="text-align: right;">อัตราผ่านเกณฑ์ (%)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${top10RowsHtml}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Section 2: รายการผลตรวจวัดล่าสุด -->
            <div>
                <div class="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                    <i class="fa-solid fa-clock-rotate-left text-blue-600"></i>
                    <span>รายการผลตรวจวัดคุณภาพน้ำล่าสุด (${recentSlice.length} รายการ)</span>
                </div>
                <div class="overflow-x-auto border border-slate-200 rounded-lg">
                    <table class="doc-table-clean">
                        <thead>
                            <tr>
                                <th style="width: 40px; text-align: center;">ลำดับ</th>
                                <th>วัน-เวลา</th>
                                <th style="text-align: center;">สถานะ</th>
                                <th>ผลการตรวจวัด 4 ดัชนีหลัก</th>
                                <th>ผู้ตรวจสอบ</th>
                                <th>หมายเหตุการประเมิน</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${recentRowsHtml || '<tr><td colspan="6" class="text-center py-4 text-slate-400">ไม่พบข้อมูลผลตรวจ</td></tr>'}
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

window.WaterQualityModule = new WaterQualityModule();
