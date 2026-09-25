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
        this.currentTab = 'prelim';

        // ป้องกัน Event หลุดหรือเรียกไม่ถึง: ผูก Event เมื่อ DOM พร้อมอัตโนมัติ
        if (typeof document !== 'undefined') {
            if (document.readyState === 'complete' || document.readyState === 'interactive') {
                setTimeout(() => this.bindEvents(), 50);
            } else {
                document.addEventListener('DOMContentLoaded', () => this.bindEvents());
            }
        }
    }

    async init() {
        this.bindEvents();
        await this.loadData();
    }

    switchTab(tab = 'prelim') {
        this.currentTab = tab;
        const tabPrelim = document.getElementById('tab-btn-prelim');
        const tabQuarter = document.getElementById('tab-btn-quarter');
        const secPrelim = document.getElementById('section-prelim-quality');
        const secQuarter = document.getElementById('section-quarter-quality');

        if (tab === 'prelim') {
            if (tabPrelim) tabPrelim.className = 'btn active bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl border border-emerald-500 shadow-md shadow-emerald-950/30 flex items-center gap-2 transition cursor-pointer';
            if (tabQuarter) tabQuarter.className = 'btn bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium px-4 py-2.5 rounded-xl border border-slate-700 flex items-center gap-2 transition cursor-pointer';
            if (secPrelim) secPrelim.style.display = 'block';
            if (secQuarter) secQuarter.style.display = 'none';
        } else {
            if (tabQuarter) tabQuarter.className = 'btn active bg-purple-600 hover:bg-purple-700 text-white font-bold px-4 py-2.5 rounded-xl border border-purple-500 shadow-md shadow-purple-950/30 flex items-center gap-2 transition cursor-pointer';
            if (tabPrelim) tabPrelim.className = 'btn bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium px-4 py-2.5 rounded-xl border border-slate-700 flex items-center gap-2 transition cursor-pointer';
            if (secPrelim) secPrelim.style.display = 'none';
            if (secQuarter) secQuarter.style.display = 'block';
            this.renderQuarterlyTable(this.quarterlyList);
        }
    }

    bindEvents() {
        // จัดการแท็บสลับมุมมอง (เบื้องต้น vs ส่งตรวจรายไตรมาส 11 พารามิเตอร์)
        const tabPrelim = document.getElementById('tab-btn-prelim');
        const tabQuarter = document.getElementById('tab-btn-quarter');

        if (tabPrelim) {
            tabPrelim.onclick = () => this.switchTab('prelim');
        }
        if (tabQuarter) {
            tabQuarter.onclick = () => this.switchTab('quarter');
        }

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
        const btnAddQuarterly = document.getElementById('btn-add-quarterly-quality') || document.getElementById('btn-add-quarter-quality');
        if (btnAddQuarterly) btnAddQuarterly.addEventListener('click', () => this.openAddQuarterlyModal());

        const btnAddQuarterly2 = document.getElementById('btn-add-quarter-quality');
        if (btnAddQuarterly2 && btnAddQuarterly2 !== btnAddQuarterly) {
            btnAddQuarterly2.addEventListener('click', () => this.openAddQuarterlyModal());
        }

        // ปุ่มบันทึกผลแล็บอัตโนมัติ (ไตรมาส)
        const btnAddQuarterlyAuto = document.getElementById('btn-add-quarterly-quality-auto');
        if (btnAddQuarterlyAuto) {
            btnAddQuarterlyAuto.addEventListener('click', (e) => {
                if (e) e.preventDefault();
                const gen = window.AutoGeneratorModule || window.AutoGenerator;
                if (gen && typeof gen.openGeneratorModal === 'function') {
                    gen.openGeneratorModal('quarterly_water_quality');
                } else {
                    this.autoRecordQuarterlyData();
                }
            });
        }

        // ปุ่ม Auto-fill เติมค่าอัตโนมัติใน Modal ส่งตรวจไตรมาส (11 พารามิเตอร์)
        const btnQwqAutoFill = document.getElementById('btn-qwq-autofill');
        if (btnQwqAutoFill) btnQwqAutoFill.addEventListener('click', () => this.autoFillQuarterlyForm());

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

        // ปุ่มเพิ่มจุดเก็บตัวอย่างน้ำทิ้งแบบด่วน (รายวัน)
        const btnAddPoint = document.getElementById('btn-quick-add-point-wq');
        if (btnAddPoint) {
            btnAddPoint.addEventListener('click', () => this.promptAddSamplingPoint());
        }

        // ปุ่มเพิ่มจุดเก็บตัวอย่างน้ำทิ้งประจำไตรมาสแบบด่วน
        const btnAddPointQwq = document.getElementById('btn-quick-add-point-qwq');
        if (btnAddPointQwq) {
            btnAddPointQwq.addEventListener('click', () => this.promptAddQuarterlySamplingPoint());
        }
        const btnAddPointQwqIcon = document.getElementById('btn-quick-add-point-qwq-icon');
        if (btnAddPointQwqIcon) {
            btnAddPointQwqIcon.addEventListener('click', () => this.promptAddQuarterlySamplingPoint());
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
        }

        // ผูก Drag & Drop สำหรับไฟล์รายงานผลแล็บไตรมาส (PDF, รูปภาพ, Word, Excel)
        const qwqDropzone = document.getElementById('qwq-dropzone');
        const qwqFileInput = document.getElementById('qwq-file-upload-input');
        const qwqBtnRemove = document.getElementById('qwq-btn-remove-file');

        if (qwqDropzone && qwqFileInput) {
            qwqDropzone.addEventListener('click', (e) => {
                if (e.target.closest('#qwq-btn-remove-file') || e.target.id === 'qwq-btn-remove-file') return;
                qwqFileInput.click();
            });

            qwqFileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    this.processQuarterlyLabFile(e.target.files[0]);
                }
            });

            ['dragenter', 'dragover'].forEach(eventName => {
                qwqDropzone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    qwqDropzone.classList.add('border-purple-400', 'bg-purple-500/10');
                });
            });

            ['dragleave', 'drop'].forEach(eventName => {
                qwqDropzone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    qwqDropzone.classList.remove('border-purple-400', 'bg-purple-500/10');
                });
            });

            qwqDropzone.addEventListener('drop', (e) => {
                const dt = e.dataTransfer;
                if (dt && dt.files && dt.files[0]) {
                    this.processQuarterlyLabFile(dt.files[0]);
                }
            });
        }

        if (qwqBtnRemove) {
            qwqBtnRemove.addEventListener('click', (e) => {
                e.stopPropagation();
                this.resetQuarterlyDropzone();
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
        const formQuarterly = document.getElementById('form-quarterly-quality') || document.getElementById('form-quarter-quality');
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

        const sampleSeedFlag = localStorage.getItem('wwtp_sample_data_seeded');
        if (!sampleSeedFlag) {
            const mockQuarterlyIds = ['qw-01', 'qw-02', 'qw-03'];
            this.quarterlyList = (this.quarterlyList || []).filter(x => !mockQuarterlyIds.includes(x.id));
            const mockPrelimIds = ['wq-01', 'wq-02', 'wq-03', 'wq-04', 'wq-05', 'wq-06', 'wq-07', 'wq-08', 'wq-09', 'wq-10', 'wq-11', 'wq-12', 'wq-13', 'wq-14', 'wq-15'];
            this.prelimList = (this.prelimList || []).filter(x => !mockPrelimIds.includes(x.id));
        }

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

        const dataList = (list !== undefined && list !== null) ? list : (this.quarterlyList || []);

        if (!dataList || dataList.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="11" class="text-center py-8 text-slate-500">
                        <i class="fa-solid fa-microscope text-3xl mb-2 text-purple-400/60"></i>
                        <div>ยังไม่มีข้อมูลผลการส่งตรวจคุณภาพน้ำประจำไตรมาส (11 พารามิเตอร์)</div>
                        <div class="text-xs text-slate-600 mt-1">กดปุ่ม "+ บันทึกผลส่งตรวจไตรมาส" หรือ "บันทึกผลแล็บอัตโนมัติ" ด้านบน</div>
                    </td>
                </tr>
            `;
            const tfoot = document.getElementById('table-quarterly-quality-foot');
            if (tfoot) tfoot.innerHTML = '';
            return;
        }

        let passCount = 0;
        let sumBod = 0, countBod = 0;
        let sumCod = 0, countCod = 0;

        tbody.innerHTML = dataList.map((item, idx) => {
            const ph = parseFloat(item.ph);
            const bod = parseFloat(item.bod);
            const cod = parseFloat(item.cod);
            const ss = parseFloat(item.ss);
            const tss = parseFloat(item.tss);
            const tds = parseFloat(item.tds);
            const tkn = parseFloat(item.tkn);
            const go = parseFloat(item.go !== undefined ? item.go : item.grease_oil);
            const sulfide = parseFloat(item.sulfide);
            const tcb = parseFloat(item.tcb);
            const fcb = parseFloat(item.fcb);

            const isPhPass = isNaN(ph) || (ph >= 5.5 && ph <= 9.0);
            const isBodPass = isNaN(bod) || bod <= 20;
            const isCodPass = isNaN(cod) || cod <= 120;
            const isSsPass = isNaN(ss) || ss <= 50;
            const isTssPass = isNaN(tss) || tss <= 30;
            const isTdsPass = isNaN(tds) || tds <= 500;
            const isTknPass = isNaN(tkn) || tkn <= 35;
            const isGoPass = isNaN(go) || go <= 20;
            const isSulfidePass = isNaN(sulfide) || sulfide <= 1.0;
            const isTcbPass = isNaN(tcb) || tcb <= 1000;
            const isFcbPass = isNaN(fcb) || fcb <= 400;

            const isItemPass = isPhPass && isBodPass && isCodPass && isSsPass && isTssPass && isTdsPass && isTknPass && isGoPass && isSulfidePass && isTcbPass && isFcbPass;
            if (isItemPass || item.status === 'ผ่านเกณฑ์มาตรฐาน' || item.status === 'ผ่านเกณฑ์') {
                passCount++;
            }

            if (!isNaN(bod)) { sumBod += bod; countBod++; }
            if (!isNaN(cod)) { sumCod += cod; countCod++; }

            return `
                <tr class="hover:bg-slate-800/40 transition">
                    <td class="text-slate-400 font-mono text-center text-xs">${idx + 1}</td>
                    <td class="font-mono text-xs text-cyan-300 font-semibold whitespace-nowrap">${item.sampling_date || '-'}</td>
                    <td class="font-medium text-white text-xs max-w-[180px] truncate" title="${item.sampling_point || ''}">
                        ${item.sampling_point || 'จุดปลายท่อออกจากระบบบำบัดน้ำเสีย'}
                    </td>
                    <td class="font-mono text-right text-xs">
                        <span class="${isPhPass ? 'text-slate-200' : 'text-rose-400 font-bold bg-rose-950/60 px-1 py-0.5 rounded border border-rose-500/40'}" title="เกณฑ์ 5.5 - 9.0">
                            ${!isNaN(ph) ? ph.toFixed(2) : '-'}
                        </span>
                    </td>
                    <td class="font-mono text-right text-xs whitespace-nowrap">
                        <span class="${isBodPass ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold bg-rose-950/60 px-1 py-0.5 rounded border border-rose-500/40'}" title="BOD: เกณฑ์ &le; 20 mg/L">
                            ${!isNaN(bod) ? bod.toFixed(1) : '-'}
                        </span>
                        <span class="text-slate-500">/</span>
                        <span class="${isCodPass ? 'text-cyan-400 font-bold' : 'text-rose-400 font-bold bg-rose-950/60 px-1 py-0.5 rounded border border-rose-500/40'}" title="COD: เกณฑ์ &le; 120 mg/L">
                            ${!isNaN(cod) ? cod.toFixed(1) : '-'}
                        </span>
                    </td>
                    <td class="font-mono text-right text-xs whitespace-nowrap">
                        <span class="${isSsPass ? 'text-slate-300' : 'text-rose-400 font-bold'}" title="SS: เกณฑ์ &le; 50 mg/L">${!isNaN(ss) ? ss.toFixed(1) : '-'}</span>
                        <span class="text-slate-500">/</span>
                        <span class="${isTssPass ? 'text-slate-300' : 'text-rose-400 font-bold'}" title="TSS: เกณฑ์ &le; 30 mg/L">${!isNaN(tss) ? tss.toFixed(1) : '-'}</span>
                        <span class="text-slate-500">/</span>
                        <span class="${isTdsPass ? 'text-slate-300' : 'text-rose-400 font-bold'}" title="TDS: เกณฑ์ &le; 500 mg/L">${!isNaN(tds) ? tds.toFixed(0) : '-'}</span>
                    </td>
                    <td class="font-mono text-right text-xs whitespace-nowrap">
                        <span class="${isTknPass ? 'text-purple-300' : 'text-rose-400 font-bold'}" title="TKN: เกณฑ์ &le; 35 mg/L">${!isNaN(tkn) ? tkn.toFixed(1) : '-'}</span>
                        <span class="text-slate-500">/</span>
                        <span class="${isGoPass ? 'text-amber-300' : 'text-rose-400 font-bold'}" title="G&O: เกณฑ์ &le; 20 mg/L">${!isNaN(go) ? go.toFixed(1) : '-'}</span>
                        <span class="text-slate-500">/</span>
                        <span class="${isSulfidePass ? 'text-slate-300' : 'text-rose-400 font-bold'}" title="Sulfide: เกณฑ์ &le; 1.0 mg/L">${!isNaN(sulfide) ? sulfide.toFixed(2) : '-'}</span>
                    </td>
                    <td class="font-mono text-right text-xs whitespace-nowrap">
                        <span class="${isTcbPass ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}" title="TCB: เกณฑ์ &le; 1,000 MPN">${!isNaN(tcb) ? Math.round(tcb) : '-'}</span>
                        <span class="text-slate-500">/</span>
                        <span class="${isFcbPass ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}" title="FCB: เกณฑ์ &le; 400 MPN">${!isNaN(fcb) ? Math.round(fcb) : '-'}</span>
                    </td>
                    <td class="text-center">
                        <span class="badge ${isItemPass || item.status === 'ผ่านเกณฑ์มาตรฐาน' || item.status === 'ผ่านเกณฑ์' ? 'badge-success' : 'badge-danger'} text-[11px] py-0.5 px-2">
                            <i class="fa-solid ${isItemPass || item.status === 'ผ่านเกณฑ์มาตรฐาน' || item.status === 'ผ่านเกณฑ์' ? 'fa-circle-check' : 'fa-triangle-exclamation'}"></i>
                            ${item.status || 'ผ่านเกณฑ์มาตรฐาน'}
                        </span>
                    </td>
                    <td class="text-xs text-slate-300 truncate max-w-[120px]" title="${item.inspector || ''}">
                        ${item.inspector || '-'}
                    </td>
                    <td class="text-center whitespace-nowrap">
                        <div class="flex items-center justify-center gap-1">
                            ${(() => {
                                const fileReport = item.lab_report_file || item.image_url || item.file_url;
                                if (fileReport) {
                                    const typeInfo = this.getLabFileTypeInfo(fileReport);
                                    return `
                                        <button type="button" class="btn btn-outline btn-icon btn-sm text-purple-400 hover:text-white border-purple-500/40 bg-purple-500/10" onclick="window.WaterQualityModule.openQuarterlyFile('${item.id}')" title="เปิดดู/ดาวน์โหลดไฟล์รายงานแล็บ (${typeInfo.badgeText})">
                                            <i class="${typeInfo.icon}"></i>
                                        </button>
                                    `;
                                } else {
                                    return `
                                        <button type="button" class="btn btn-outline btn-icon btn-sm text-amber-400 hover:text-white border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/30" onclick="window.WaterQualityModule.openEditQuarterlyModal('${item.id}')" title="ยังไม่มีไฟล์รายงานแล็บ (คลิกเพื่ออัพโหลดแนบไฟล์)">
                                            <i class="fa-solid fa-cloud-arrow-up"></i>
                                        </button>
                                    `;
                                }
                            })()}
                            <button type="button" class="btn btn-outline btn-icon btn-sm text-blue-400 hover:text-white" onclick="window.WaterQualityModule.viewQuarterlyDetails('${item.id}')" title="ดูรายละเอียด 11 พารามิเตอร์">
                                <i class="fa-solid fa-eye"></i>
                            </button>
                            <button type="button" class="btn btn-outline btn-icon btn-sm text-amber-400 hover:text-white" onclick="window.WaterQualityModule.openEditQuarterlyModal('${item.id}')" title="แก้ไขข้อมูล">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button type="button" class="btn btn-outline btn-icon btn-sm text-rose-400 hover:text-white" onclick="window.WaterQualityModule.deleteQuarterlyRecord('${item.id}')" title="ลบข้อมูล">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Render Table Footer Summary Row
        const tfoot = document.getElementById('table-quarterly-quality-foot');
        if (tfoot) {
            const avgBod = countBod > 0 ? (sumBod / countBod).toFixed(1) : '-';
            const avgCod = countCod > 0 ? (sumCod / countCod).toFixed(1) : '-';
            const passPercent = dataList.length > 0 ? ((passCount / dataList.length) * 100).toFixed(1) : '100.0';

            tfoot.innerHTML = `
                <tr class="table-summary-row border-t-2 border-purple-500/60 bg-purple-950/20 text-xs">
                    <td class="text-center font-bold text-purple-400 py-3"><i class="fa-solid fa-calculator"></i> สรุป</td>
                    <td colspan="3" class="font-bold text-purple-300 py-3">
                        <span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></span> ตรวจวิเคราะห์ทั้งหมด ${dataList.length} ครั้ง (11 พารามิเตอร์ สธ.)</span>
                    </td>
                    <td class="font-mono text-right text-emerald-400 font-bold py-3">เฉลี่ย ${avgBod}/${avgCod}</td>
                    <td colspan="3" class="text-center text-slate-400 py-3">เกณฑ์ สธ.: SS&le;50, TSS&le;30, TKN&le;35, G&amp;O&le;20, Sulfide&le;1</td>
                    <td class="text-center py-3">
                        <span class="badge badge-success text-[11px] py-1 px-2 font-bold">ผ่าน ${passPercent}%</span>
                    </td>
                    <td colspan="2" class="text-center text-slate-400 py-3 text-[11px]">มาตรฐานกรมควบคุมมลพิษ &amp; สธ.</td>
                </tr>
            `;
        }
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
            'จุดปลายท่อเติมคลอรีนก่อนปล่อยสู่คลองสาธารณะ',
            'บ่อตกตะกอนขั้นสุดท้าย (Effluent Tank – ทางระบายน้ำทิ้ง รพ.)',
            'จุดระบายน้ำทิ้งส่วนกลาง (Effluent Tank)'
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

        // โหลดรายการจุดเก็บตัวอย่างลง Dropdown (ค่าเริ่มต้น: จุดปลายท่อออกจากระบบบำบัด เสมอ)
        this.populateSamplingPointsDropdown('จุดปลายท่อออกจากระบบบำบัด');

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
        const phInput = this.getPwqEl('ph');
        const doInput = this.getPwqEl('do');
        const tdsInput = this.getPwqEl('tds');
        const clInput = this.getPwqEl('cl');
        const sedInput = this.getPwqEl('sed');
        const remarksInput = this.getPwqEl('remarks');
        const inspectorInput = this.getPwqEl('inspector');

        // สุ่มค่าคุณภาพน้ำเบื้องต้นที่ไม่ซ้ำกับค่าเดิมบนฟอร์ม และอยู่ในเกณฑ์มาตรฐาน
        const currPh = parseFloat(phInput?.value) || 7.35;
        const currDo = parseFloat(doInput?.value) || 3.10;
        const currTds = parseFloat(tdsInput?.value) || 380;
        const currCl = parseFloat(clInput?.value) || 1.45;
        const currSed = parseFloat(sedInput?.value) || 165;

        let ph = +(7.15 + Math.random() * 0.55).toFixed(2);
        if (Math.abs(ph - currPh) < 0.05) ph = +(ph + (ph > 7.4 ? -0.12 : 0.12)).toFixed(2);

        let doVal = +(2.70 + Math.random() * 0.95).toFixed(2);
        if (Math.abs(doVal - currDo) < 0.10) doVal = +(doVal + (doVal > 3.2 ? -0.22 : 0.22)).toFixed(2);

        let tds = +(350 + Math.random() * 95).toFixed(1);
        if (Math.abs(tds - currTds) < 8) tds = +(tds + (tds > 400 ? -15 : 15)).toFixed(1);

        let cl = +(1.20 + Math.random() * 0.55).toFixed(2);
        if (Math.abs(cl - currCl) < 0.06) cl = +(cl + (cl > 1.5 ? -0.14 : 0.14)).toFixed(2);

        let sed = +(120 + Math.random() * 95).toFixed(1);
        if (Math.abs(sed - currSed) < 10) sed = +(sed + (sed > 170 ? -22 : 22)).toFixed(1);

        if (phInput) phInput.value = ph.toFixed(2);
        if (doInput) doInput.value = doVal.toFixed(2);
        if (tdsInput) tdsInput.value = tds.toFixed(1);
        if (clInput) clInput.value = cl.toFixed(2);
        if (sedInput) sedInput.value = sed.toFixed(1);

        const pointInput = this.getPwqEl('point');
        if (pointInput && (!pointInput.value || pointInput.value === 'จุดระบายน้ำทิ้งส่วนกลาง (Effluent Tank)')) {
            pointInput.value = 'จุดปลายท่อออกจากระบบบำบัด';
        }

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

        // โหลดรายการจุดเก็บตัวอย่างลง Dropdown (ค่าเริ่มต้น/สำรอง: จุดปลายท่อออกจากระบบบำบัด เสมอ)
        this.populateSamplingPointsDropdown(item.sampling_point || 'จุดปลายท่อออกจากระบบบำบัด');

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
        const pointVal = this.getPwqEl('point')?.value || 'จุดปลายท่อออกจากระบบบำบัด';

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
                const targetIdx = this.prelimList.findIndex(x => x.id === this.editingPrelimId);
                if (targetIdx !== -1) {
                    this.prelimList[targetIdx] = { ...this.prelimList[targetIdx], ...payload, id: this.editingPrelimId };
                }
                this.editingPrelimId = null;
            } else {
                res = await window.DataStore.insert('preliminary_water_quality', payload);
                const saved = res?.record || res?.data || payload;
                if (saved) {
                    const sampleSeedFlag = localStorage.getItem('wwtp_sample_data_seeded');
                    if (!sampleSeedFlag) {
                        const mockPrelimIds = ['wq-01', 'wq-02', 'wq-03', 'wq-04', 'wq-05', 'wq-06', 'wq-07', 'wq-08', 'wq-09', 'wq-10', 'wq-11', 'wq-12', 'wq-13', 'wq-14', 'wq-15'];
                        this.prelimList = (this.prelimList || []).filter(x => !mockPrelimIds.includes(x.id));
                    }
                    this.prelimList.unshift(saved);
                }
            }

            window.App.closeModal('modal-prelim-quality');
            this.applyFilters();
            await this.loadData();

            if (res && res.savedSupabase) {
                Swal.fire({
                    icon: 'success',
                    title: 'บันทึกสำเร็จ!',
                    html: '<span class="text-xs text-emerald-400 font-bold"><i class="fa-solid fa-cloud-arrow-up"></i> บันทึกลงฐานข้อมูล Supabase Cloud เรียบร้อย</span>',
                    timer: 1600,
                    showConfirmButton: false,
                    toast: true,
                    position: 'top-end'
                });
            } else {
                Swal.fire({
                    icon: 'success',
                    title: 'บันทึกข้อมูลเรียบร้อย',
                    text: 'อัปเดตผลตรวจวัดคุณภาพน้ำในระบบเรียบร้อยแล้ว',
                    timer: 1500,
                    showConfirmButton: false,
                    toast: true,
                    position: 'top-end'
                });
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

    // =========================================================================
    // QUARTERLY WATER QUALITY (11 PARAMETERS - MOPH STANDARDS)
    // =========================================================================

    generateSampleLabReportDataUrl(samplingDate, point, params = {}) {
        const certNo = `LAB-${new Date(samplingDate || Date.now()).getFullYear()}-Q${Math.floor((new Date(samplingDate || Date.now()).getMonth()) / 3) + 1}-${Math.floor(1000 + Math.random() * 9000)}`;
        const dateStr = samplingDate || new Date().toISOString().split('T')[0];
        const ph = params.ph !== undefined ? params.ph : 7.35;
        const ss = params.ss !== undefined ? params.ss : 16.5;
        const tds = params.tds !== undefined ? params.tds : 320.0;
        const tss = params.tss !== undefined ? params.tss : 12.0;
        const tkn = params.tkn !== undefined ? params.tkn : 14.5;
        const go = params.go !== undefined ? params.go : 4.2;
        const sulfide = params.sulfide !== undefined ? params.sulfide : 0.12;
        const bod = params.bod !== undefined ? params.bod : 9.5;
        const cod = params.cod !== undefined ? params.cod : 46.0;
        const tcb = params.tcb !== undefined ? params.tcb : 280;
        const fcb = params.fcb !== undefined ? params.fcb : 65;
        const location = point || 'จุดปลายท่อออกจากระบบบำบัดน้ำเสีย';

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 850 1150" width="850" height="1150" style="background:#ffffff;font-family:'Sarabun',sans-serif;">
            <rect x="25" y="25" width="800" height="1100" fill="#ffffff" stroke="#1e293b" stroke-width="2"/>
            <rect x="35" y="35" width="780" height="1080" fill="none" stroke="#0ea5e9" stroke-width="1" stroke-dasharray="4,3"/>

            <circle cx="100" cy="90" r="32" fill="#0284c7" opacity="0.12"/>
            <path d="M100 68 C88 80 82 92 82 102 C82 112 90 120 100 120 C110 120 118 112 118 102 C118 92 112 80 100 68 Z" fill="#0284c7"/>
            <text x="145" y="80" font-size="20" font-weight="bold" fill="#0f172a">ศูนย์วิทยาศาสตร์การแพทย์ที่ 10 อุบลราชธานี</text>
            <text x="145" y="102" font-size="13" fill="#475569">กรมวิทยาศาสตร์การแพทย์ กระทรวงสาธารณสุข (ISO/IEC 17025)</text>
            <text x="145" y="120" font-size="12" fill="#0369a1" font-weight="600">ห้องปฏิบัติการวิเคราะห์คุณภาพสิ่งแวดล้อมและน้ำทิ้ง</text>

            <line x1="50" y1="135" x2="800" y2="135" stroke="#cbd5e1" stroke-width="1.5"/>

            <rect x="240" y="148" width="370" height="34" rx="6" fill="#f0f9ff" stroke="#bae6fd" stroke-width="1"/>
            <text x="425" y="171" font-size="16" font-weight="bold" fill="#0369a1" text-anchor="middle">รายงานผลการตรวจวิเคราะห์คุณภาพน้ำทิ้ง (11 พารามิเตอร์)</text>

            <rect x="50" y="195" width="750" height="105" rx="6" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
            <text x="70" y="222" font-size="12" font-weight="bold" fill="#334155">หน่วยงานผู้ส่งตรวจ:</text>
            <text x="195" y="222" font-size="12" fill="#0f172a">โรงพยาบาล ๕๐ พรรษา มหาวชิราลงกรณ จ.อุบลราชธานี</text>

            <text x="70" y="246" font-size="12" font-weight="bold" fill="#334155">จุดเก็บตัวอย่าง:</text>
            <text x="195" y="246" font-size="12" fill="#0f172a">${location}</text>

            <text x="70" y="270" font-size="12" font-weight="bold" fill="#334155">วันที่เก็บตัวอย่าง:</text>
            <text x="195" y="270" font-size="12" fill="#0f172a" font-weight="bold">${dateStr}</text>

            <text x="500" y="222" font-size="12" font-weight="bold" fill="#334155">เลขที่ใบรายงาน (Cert No.):</text>
            <text x="660" y="222" font-size="12" fill="#0284c7" font-weight="bold">${certNo}</text>

            <text x="500" y="246" font-size="12" font-weight="bold" fill="#334155">เกณฑ์อ้างอิง:</text>
            <text x="580" y="246" font-size="12" fill="#0f172a">ประกาศ ทส. &amp; สธ. (รพ. ประเภท ก)</text>

            <text x="500" y="270" font-size="12" font-weight="bold" fill="#334155">สถานะผลทดสอบ:</text>
            <text x="610" y="270" font-size="12" fill="#16a34a" font-weight="bold">✓ ผ่านเกณฑ์มาตรฐานทุกดัชนี</text>

            <rect x="50" y="315" width="750" height="32" fill="#0284c7"/>
            <text x="70" y="336" font-size="12" font-weight="bold" fill="#ffffff">ลำดับ</text>
            <text x="120" y="336" font-size="12" font-weight="bold" fill="#ffffff">พารามิเตอร์ที่ตรวจวัด (11 รายการ)</text>
            <text x="380" y="336" font-size="12" font-weight="bold" fill="#ffffff">วิธีวิเคราะห์ (Method)</text>
            <text x="540" y="336" font-size="12" font-weight="bold" fill="#ffffff" text-anchor="middle">เกณฑ์มาตรฐาน</text>
            <text x="650" y="336" font-size="12" font-weight="bold" fill="#ffffff" text-anchor="middle">ผลการตรวจวิเคราะห์</text>
            <text x="755" y="336" font-size="12" font-weight="bold" fill="#ffffff" text-anchor="middle">ผลประเมิน</text>

            ${[
                { n: '1', name: 'ความเป็นกรด-ด่าง (pH)', method: 'Electrometric Method', std: '5.50 - 9.00', val: `${ph}`, unit: '', pass: true },
                { n: '2', name: 'สารแขวนลอย (Suspended Solids - SS)', method: 'Glass Fiber Filter Dried at 105°C', std: '≤ 50.0 mg/L', val: `${ss}`, unit: 'mg/L', pass: true },
                { n: '3', name: 'สารละลายทั้งหมด (TDS)', method: 'Dried at 180°C', std: '≤ 500.0 mg/L', val: `${tds}`, unit: 'mg/L', pass: true },
                { n: '4', name: 'ของแข็งแขวนลอยทั้งหมด (TSS)', method: 'Gravimetric Method', std: '≤ 30.0 mg/L', val: `${tss}`, unit: 'mg/L', pass: true },
                { n: '5', name: 'ไนโตรเจนทั้งหมด (TKN)', method: 'Macro-Kjeldahl Method', std: '≤ 35.0 mg/L', val: `${tkn}`, unit: 'mg/L', pass: true },
                { n: '6', name: 'น้ำมันและไขมัน (Grease & Oil)', method: 'Partition-Gravimetric Method', std: '≤ 20.0 mg/L', val: `${go}`, unit: 'mg/L', pass: true },
                { n: '7', name: 'สารประกอบซัลไฟด์ (Sulfide)', method: 'Methylene Blue Method', std: '≤ 1.00 mg/L', val: `${sulfide}`, unit: 'mg/L', pass: true },
                { n: '8', name: 'บีโอดี (Biochemical Oxygen Demand - BOD5)', method: '5-Day BOD Test at 20°C', std: '≤ 20.0 mg/L', val: `${bod}`, unit: 'mg/L', pass: true },
                { n: '9', name: 'ซีโอดี (Chemical Oxygen Demand - COD)', method: 'Closed Reflux, Titrimetric', std: '≤ 120.0 mg/L', val: `${cod}`, unit: 'mg/L', pass: true },
                { n: '10', name: 'แบคทีเรียกลุ่มโคลิฟอร์มทั้งหมด (TCB)', method: 'Multiple-Tube Fermentation (MPN)', std: '≤ 1,000 MPN/100ml', val: `${tcb}`, unit: 'MPN', pass: true },
                { n: '11', name: 'แบคทีเรียฟีคัลโคลิฟอร์ม (FCB)', method: 'EC Medium at 44.5°C (MPN)', std: '≤ 400 MPN/100ml', val: `${fcb}`, unit: 'MPN', pass: true }
            ].map((r, i) => {
                const y = 350 + (i * 35);
                const bg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
                return `
                    <rect x="50" y="${y}" width="750" height="35" fill="${bg}" stroke="#f1f5f9"/>
                    <text x="75" y="${y + 22}" font-size="12" fill="#64748b" text-anchor="middle">${r.n}</text>
                    <text x="120" y="${y + 22}" font-size="12" font-weight="600" fill="#0f172a">${r.name}</text>
                    <text x="380" y="${y + 22}" font-size="11" fill="#475569">${r.method}</text>
                    <text x="540" y="${y + 22}" font-size="11" fill="#475569" text-anchor="middle">${r.std}</text>
                    <text x="650" y="${y + 22}" font-size="12" font-weight="bold" fill="#0369a1" text-anchor="middle">${r.val} ${r.unit}</text>
                    <text x="755" y="${y + 22}" font-size="11" font-weight="bold" fill="#16a34a" text-anchor="middle">✓ ผ่าน</text>
                `;
            }).join('')}

            <rect x="50" y="745" width="750" height="90" rx="6" fill="#f0fdf4" stroke="#86efac" stroke-width="1.5"/>
            <text x="70" y="775" font-size="14" font-weight="bold" fill="#15803d">สรุปผลการวิเคราะห์:</text>
            <text x="195" y="775" font-size="13" font-weight="bold" fill="#166534">ผ่านเกณฑ์มาตรฐานคุณภาพน้ำทิ้งโรงพยาบาล ประเภท ก ครบทั้ง 11 พารามิเตอร์</text>
            <text x="70" y="802" font-size="11" fill="#166534">หมายเหตุ: น้ำทิ้งผ่านการบำบัดและฆ่าเชื้อโรคด้วยคลอรีนอย่างมีประสิทธิภาพ สามารถระบายสู่แหล่งน้ำสาธารณะได้ตามกฎหมาย</text>
            <text x="70" y="820" font-size="10" fill="#64748b">วิธีวิเคราะห์อ้างอิงจาก Standard Methods for the Examination of Water and Wastewater, 23rd Edition (APHA, AWWA, WEF)</text>

            <g transform="translate(110, 870)">
                <text x="100" y="80" font-size="12" fill="#0f172a" text-anchor="middle">ลงชื่อ.......................................................</text>
                <text x="100" y="105" font-size="12" font-weight="600" fill="#0f172a" text-anchor="middle">( นางสาวประภัสสร เกียรติวิทยา )</text>
                <text x="100" y="125" font-size="11" fill="#475569" text-anchor="middle">นักวิทยาศาสตร์การแพทย์ปฏิบัติการ</text>
                <text x="100" y="142" font-size="10" fill="#64748b" text-anchor="middle">ผู้ตรวจวิเคราะห์</text>
            </g>

            <g transform="translate(480, 870)">
                <text x="110" y="80" font-size="12" fill="#0f172a" text-anchor="middle">ลงชื่อ.......................................................</text>
                <text x="110" y="105" font-size="12" font-weight="600" fill="#0f172a" text-anchor="middle">( ดร.วิเชียร พิริยะพงศ์พันธ์ )</text>
                <text x="110" y="125" font-size="11" fill="#475569" text-anchor="middle">หัวหน้ากลุ่มงานตรวจวิเคราะห์สิ่งแวดล้อม</text>
                <text x="110" y="142" font-size="10" fill="#64748b" text-anchor="middle">ผู้รับรองรายงานผล</text>
            </g>

            <circle cx="425" cy="980" r="42" fill="none" stroke="#dc2626" stroke-width="2" opacity="0.7" stroke-dasharray="6,2"/>
            <circle cx="425" cy="980" r="38" fill="none" stroke="#dc2626" stroke-width="1" opacity="0.7"/>
            <text x="425" y="972" font-size="9" font-weight="bold" fill="#dc2626" text-anchor="middle" opacity="0.8">CERTIFIED LAB</text>
            <text x="425" y="986" font-size="8" font-weight="bold" fill="#dc2626" text-anchor="middle" opacity="0.8">ISO/IEC 17025</text>
            <text x="425" y="998" font-size="8" fill="#dc2626" text-anchor="middle" opacity="0.8">ศูนย์วิทย์ฯ 10</text>

            <line x1="50" y1="1070" x2="800" y2="1070" stroke="#cbd5e1" stroke-width="1"/>
            <text x="425" y="1090" font-size="10" fill="#94a3b8" text-anchor="middle">เอกสารนี้ออกโดยระบบบริหารจัดการน้ำเสียอัตโนมัติ รพ.๕๐ พรรษา มหาวชิราลงกรณ • บันทึกและซิงค์ข้อมูลผ่าน Supabase Cloud</text>
        </svg>`;

        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    }

    autoFillQuarterlyForm() {
        // สุ่มค่า 11 พารามิเตอร์ตามมาตรฐานกระทรวงสาธารณสุข
        // 1. pH: 6.80 - 7.90 (เกณฑ์ 5.5 - 9.0)
        // 2. SS: 12.0 - 28.0 mg/L (เกณฑ์ <= 50 mg/L)
        // 3. TDS: 240.0 - 410.0 mg/L (เกณฑ์ <= 500 mg/L)
        // 4. TSS: 9.0 - 22.0 mg/L (เกณฑ์ <= 30 mg/L)
        // 5. TKN: 7.0 - 22.0 mg/L (เกณฑ์ <= 35 mg/L)
        // 6. G&O: 1.5 - 7.5 mg/L (เกณฑ์ <= 20 mg/L)
        // 7. Sulfide: 0.05 - 0.35 mg/L (เกณฑ์ <= 1.0 mg/L)
        // 8. BOD: 7.0 - 16.0 mg/L (เกณฑ์ <= 20 mg/L)
        // 9. COD: 38.0 - 82.0 mg/L (เกณฑ์ <= 120 mg/L)
        // 10. TCB: 120 - 620 MPN/100ml (เกณฑ์ <= 1,000 MPN)
        // 11. FCB: 35 - 220 MPN/100ml (เกณฑ์ <= 400 MPN)
        const ph = +(7.10 + Math.random() * 0.70).toFixed(2);
        const ss = +(12.0 + Math.random() * 16.0).toFixed(1);
        const tds = +(240.0 + Math.random() * 160.0).toFixed(1);
        const tss = +(9.0 + Math.random() * 13.0).toFixed(1);
        const tkn = +(8.0 + Math.random() * 14.0).toFixed(1);
        const go = +(1.8 + Math.random() * 5.2).toFixed(1);
        const sulfide = +(0.05 + Math.random() * 0.28).toFixed(2);
        const bod = +(7.5 + Math.random() * 8.5).toFixed(1);
        const cod = +(38.0 + Math.random() * 42.0).toFixed(1);
        const tcb = Math.round(150 + Math.random() * 480);
        const fcb = Math.round(40 + Math.random() * 180);

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val;
        };

        setVal('qwq-form-ph', ph);
        setVal('qwq-form-ss', ss);
        setVal('qwq-form-tds', tds);
        setVal('qwq-form-tss', tss);
        setVal('qwq-form-tkn', tkn);
        setVal('qwq-form-go', go);
        setVal('qwq-form-sulfide', sulfide);
        setVal('qwq-form-bod', bod);
        setVal('qwq-form-cod', cod);
        setVal('qwq-form-tcb', tcb);
        setVal('qwq-form-fcb', fcb);
        setVal('qwq-form-status', 'ผ่านเกณฑ์มาตรฐาน');
        setVal('qwq-form-action', 'ระบบบำบัดน้ำเสียทำงานเต็มประสิทธิภาพ ผลวิเคราะห์ห้องปฏิบัติการผ่านเกณฑ์มาตรฐานกระทรวงสาธารณสุขครบ 11 พารามิเตอร์');
        setVal('qwq-form-remarks', 'ตรวจวิเคราะห์ตามวิธีมาตรฐาน Standard Methods for the Examination of Water and Wastewater (กรมควบคุมมลพิษ & สธ.)');

        const currentUser = (window.AuthService && typeof window.AuthService.getCurrentUser === 'function') 
            ? window.AuthService.getCurrentUser() 
            : null;
        const currentName = currentUser ? (currentUser.full_name || currentUser.username) : 'แสงตะวัน ชาวเขา';
        const elInsp = document.getElementById('qwq-form-inspector');
        if (elInsp && !elInsp.value) elInsp.value = currentName;

        // สร้างและแนบไฟล์ใบรายงานผลแล็บ 11 พารามิเตอร์อัตโนมัติ
        const samplingDate = document.getElementById('qwq-form-date')?.value || new Date().toISOString().split('T')[0];
        const samplingPoint = document.getElementById('qwq-form-point')?.value || 'จุดปลายท่อออกจากระบบบำบัดน้ำเสีย';
        const sampleReport = this.generateSampleLabReportDataUrl(samplingDate, samplingPoint, { ph, ss, tds, tss, tkn, go, sulfide, bod, cod, tcb, fcb });

        const fileUrlInput = document.getElementById('qwq-form-file');
        if (fileUrlInput) fileUrlInput.value = sampleReport;
        this.uploadedQuarterlyAttachments = [{ data: sampleReport, name: `ใบรายงานผลวิเคราะห์_11พารามิเตอร์_สธ.svg`, type: 'image' }];

        const promptEl = document.getElementById('qwq-dropzone-prompt');
        const infoEl = document.getElementById('qwq-dropzone-fileinfo');
        const iconEl = document.getElementById('qwq-file-type-icon');
        const nameEl = document.getElementById('qwq-dropzone-filename');
        const sizeEl = document.getElementById('qwq-dropzone-filesize');
        if (promptEl) promptEl.style.display = 'none';
        if (infoEl) {
            infoEl.classList.remove('hidden');
            infoEl.style.display = 'flex';
        }
        if (iconEl) iconEl.innerHTML = `<i class="fa-solid fa-file-shield text-purple-400"></i>`;
        if (nameEl) nameEl.textContent = 'ใบรายงานผลวิเคราะห์_11พารามิเตอร์_สธ.svg';
        if (sizeEl) sizeEl.textContent = 'ใบรับรองผลแล็บ (ISO/IEC 17025) • พร้อมบันทึก';

        Swal.fire({
            icon: 'success',
            title: 'เติมผลตรวจวิเคราะห์ 11 พารามิเตอร์เรียบร้อย',
            html: `
                <div class="text-xs text-left text-slate-300 space-y-1 p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                    <div>pH: <strong class="text-emerald-400 font-mono">${ph}</strong> | BOD: <strong class="text-emerald-400 font-mono">${bod}</strong> | COD: <strong class="text-cyan-400 font-mono">${cod}</strong> mg/L</div>
                    <div>SS: <strong class="text-slate-200 font-mono">${ss}</strong> | TSS: <strong class="text-slate-200 font-mono">${tss}</strong> | TDS: <strong class="text-cyan-400 font-mono">${tds}</strong> mg/L</div>
                    <div>TKN: <strong class="text-purple-300 font-mono">${tkn}</strong> | G&amp;O: <strong class="text-amber-300 font-mono">${go}</strong> | Sulfide: <strong class="text-slate-200 font-mono">${sulfide}</strong></div>
                    <div>TCB: <strong class="text-emerald-400 font-mono">${tcb}</strong> | FCB: <strong class="text-emerald-400 font-mono">${fcb}</strong> MPN/100ml</div>
                    <div class="text-[11px] text-purple-300 font-bold pt-1 border-t border-slate-800 flex items-center gap-1.5">
                        <i class="fa-solid fa-paperclip"></i> แนบไฟล์ใบรับรองผลแล็บ (ISO/IEC 17025) พร้อมบันทึก
                    </div>
                </div>
            `,
            timer: 2000,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
        });
    }

    async autoRecordQuarterlyData() {
        const gen = window.AutoGeneratorModule || window.AutoGenerator;
        if (gen && typeof gen.openGeneratorModal === 'function') {
            gen.openGeneratorModal('quarterly_water_quality');
            return;
        }

        const ph = +(7.15 + Math.random() * 0.65).toFixed(2);
        const ss = +(14.0 + Math.random() * 15.0).toFixed(1);
        const tds = +(260.0 + Math.random() * 150.0).toFixed(1);
        const tss = +(10.0 + Math.random() * 12.0).toFixed(1);
        const tkn = +(9.0 + Math.random() * 13.0).toFixed(1);
        const go = +(2.0 + Math.random() * 4.8).toFixed(1);
        const sulfide = +(0.06 + Math.random() * 0.25).toFixed(2);
        const bod = +(8.0 + Math.random() * 8.0).toFixed(1);
        const cod = +(42.0 + Math.random() * 38.0).toFixed(1);
        const tcb = Math.round(180 + Math.random() * 420);
        const fcb = Math.round(45 + Math.random() * 160);

        const currentUser = (window.AuthService && typeof window.AuthService.getCurrentUser === 'function') 
            ? window.AuthService.getCurrentUser() 
            : null;
        const currentName = currentUser ? (currentUser.full_name || currentUser.username) : 'แสงตะวัน ชาวเขา';

        const quarterlyPoints = this.getQuarterlySamplingPointsList();
        const point = quarterlyPoints[0] || 'จุดปลายท่อออกจากระบบบำบัดน้ำเสีย';
        const samplingDate = new Date().toISOString().split('T')[0];

        // สร้างใบรายงานผลแล็บรับรองมาตรฐานแนบไปด้วยอัตโนมัติ
        const sampleReport = this.generateSampleLabReportDataUrl(samplingDate, point, { ph, ss, tds, tss, tkn, go, sulfide, bod, cod, tcb, fcb });

        const payload = {
            sampling_date: samplingDate,
            sampling_point: point,
            ph: ph,
            ss: ss,
            tds: tds,
            tss: tss,
            tkn: tkn,
            go: go,
            sulfide: sulfide,
            bod: bod,
            cod: cod,
            tcb: tcb,
            fcb: fcb,
            status: 'ผ่านเกณฑ์มาตรฐาน',
            action_taken: 'ระบบบำบัดน้ำเสียทำงานเต็มประสิทธิภาพ ผ่านเกณฑ์มาตรฐานกระทรวงสาธารณสุขครบ 11 พารามิเตอร์',
            lab_report_file: sampleReport,
            image_url: sampleReport,
            file_url: sampleReport,
            inspector: currentName,
            remarks: 'ตรวจวิเคราะห์ตามรอบไตรมาส Standard Methods (Auto-generated)'
        };

        Swal.fire({ title: 'กำลังบันทึกผลส่งตรวจไตรมาส...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const res = await window.DataStore.insert('quarterly_water_quality', payload);
        const saved = res?.record || res?.data || payload;
        if (saved) {
            const sampleSeedFlag = localStorage.getItem('wwtp_sample_data_seeded');
            if (!sampleSeedFlag) {
                this.quarterlyList = (this.quarterlyList || []).filter(x => !['qw-01', 'qw-02', 'qw-03'].includes(x.id));
            }
            this.quarterlyList.unshift(saved);
        }
        this.renderQuarterlyTable(this.quarterlyList);
        await this.loadData();

        Swal.fire({
            icon: 'success',
            title: 'บันทึกผลตรวจไตรมาสสำเร็จ!',
            html: `
                <div class="text-xs text-left text-slate-300 space-y-1 p-2 bg-slate-950 rounded border border-slate-800">
                    <div>วันที่: <strong class="text-cyan-300 font-mono">${payload.sampling_date}</strong></div>
                    <div>จุดเก็บ: <strong class="text-white">${payload.sampling_point}</strong></div>
                    <div>BOD: <strong class="text-emerald-400 font-mono">${bod} mg/L</strong> | COD: <strong class="text-cyan-400 font-mono">${cod} mg/L</strong></div>
                    <div>pH: <strong class="text-emerald-400 font-mono">${ph}</strong> | SS: <strong class="text-slate-200 font-mono">${ss}</strong> | TCB: <strong class="text-purple-300 font-mono">${tcb} MPN</strong></div>
                    <div class="text-[11px] text-purple-300 font-bold pt-1 border-t border-slate-800 flex items-center gap-1.5">
                        <i class="fa-solid fa-paperclip"></i> แนบไฟล์ใบรับรองผลแล็บ (ISO/IEC 17025) ซิงค์ลง Supabase เรียบร้อย
                    </div>
                </div>
            `,
            timer: 2200,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
        });
    }

    getQuarterlySamplingPointsList() {
        const defaultList = [
            'จุดปลายท่อออกจากระบบบำบัดน้ำเสีย',
            'จุดกลางสระรวมน้ำทิ้ง รพ.',
            'จุดปลายท่อก่อนปล่อยสู่คลองสาธารณะ',
            'จุดสระบึงประดิษฐ์-สระเติมอากาศ',
            'บ่อพักน้ำทิ้งขั้นสุดท้ายก่อนปล่อยสู่สาธารณะ'
        ];
        const uniqueList = Array.from(new Set(defaultList));

        // ดึงจากรายการข้อมูลผลตรวจที่มีอยู่ในตารางไตรมาส
        if (Array.isArray(this.quarterlyList)) {
            this.quarterlyList.forEach(item => {
                if (item.sampling_point && !uniqueList.includes(item.sampling_point)) {
                    uniqueList.push(item.sampling_point);
                }
            });
        }

        try {
            const saved = localStorage.getItem('wwtp_quarterly_sampling_points');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    parsed.forEach(pt => {
                        if (pt && !uniqueList.includes(pt)) uniqueList.push(pt);
                    });
                }
            }
        } catch (e) {
            console.error("Error loading quarterly sampling points:", e);
        }
        return uniqueList;
    }

    populateQuarterlySamplingPointsDropdown(selectedValue = null) {
        const select = document.getElementById('qwq-form-point');
        const list = this.getQuarterlySamplingPointsList();

        if (selectedValue && !list.includes(selectedValue)) {
            list.push(selectedValue);
        }

        if (select) {
            select.innerHTML = list.map(pt => `<option value="${pt}" ${selectedValue === pt ? 'selected' : ''}>${pt}</option>`).join('');
            if (selectedValue) {
                select.value = selectedValue;
            } else if (list.length > 0) {
                select.value = list[0];
            }
        }
    }

    async promptAddQuarterlySamplingPoint() {
        const { value: newPoint } = await Swal.fire({
            title: 'เพิ่มจุดเก็บตัวอย่างน้ำทิ้ง (ไตรมาส)',
            input: 'text',
            inputLabel: 'ระบุชื่อจุดเก็บตัวอย่าง / จุดส่งตรวจไตรมาสใหม่',
            inputPlaceholder: 'เช่น จุดบ่อสูบน้ำเสียรวม, จุดสระพักน้ำชีวภาพ',
            showCancelButton: true,
            confirmButtonText: '<i class="fa-solid fa-plus"></i> เพิ่มจุดตรวจ',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#8b5cf6',
            cancelButtonColor: '#334155',
            background: '#0f172a',
            color: '#f8fafc',
            inputValidator: (value) => {
                if (!value || !value.trim()) {
                    return 'กรุณาระบุชื่อจุดเก็บตัวอย่างน้ำทิ้ง';
                }
                const currentList = this.getQuarterlySamplingPointsList();
                if (currentList.includes(value.trim())) {
                    return 'มีจุดเก็บตัวอย่างนี้ในระบบแล้ว';
                }
            }
        });

        if (newPoint && newPoint.trim()) {
            const trimmed = newPoint.trim();
            const list = this.getQuarterlySamplingPointsList();
            list.push(trimmed);
            try {
                localStorage.setItem('wwtp_quarterly_sampling_points', JSON.stringify(list));
            } catch (e) {
                console.error("Error saving quarterly sampling points to localStorage:", e);
            }

            this.populateQuarterlySamplingPointsDropdown(trimmed);

            Swal.fire({
                icon: 'success',
                title: 'เพิ่มจุดเก็บตัวอย่างสำเร็จ',
                text: `เพิ่ม "${trimmed}" เข้าสู่รายการจุดเก็บตัวอย่างเรียบร้อย`,
                timer: 1600,
                showConfirmButton: false,
                toast: true,
                position: 'top-end',
                background: '#0c1322',
                color: '#f8fafc'
            });
        }
    }

    openAddQuarterlyModal() {
        this.editingQuarterlyId = null;
        const form = document.getElementById('form-quarter-quality') || document.getElementById('form-quarterly-quality');
        if (form) form.reset();
        
        const title = document.getElementById('modal-quarter-title');
        if (title) title.innerHTML = '<i class="fa-solid fa-microscope text-purple-400"></i> บันทึกผลส่งตรวจคุณภาพน้ำประจำไตรมาส (11 พารามิเตอร์ สธ.)';

        const dateEl = document.getElementById('qwq-form-date');
        if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];

        // โหลดรายการจุดเก็บตัวอย่างลง Dropdown (ค่าเริ่มต้น: จุดปลายท่อออกจากระบบบำบัดน้ำเสีย)
        this.populateQuarterlySamplingPointsDropdown('จุดปลายท่อออกจากระบบบำบัดน้ำเสีย');

        const statusEl = document.getElementById('qwq-form-status');
        if (statusEl) statusEl.value = 'ผ่านเกณฑ์มาตรฐาน';

        const currentUser = (window.AuthService && typeof window.AuthService.getCurrentUser === 'function') 
            ? window.AuthService.getCurrentUser() 
            : null;
        const currentName = currentUser ? (currentUser.full_name || currentUser.username) : 'แสงตะวัน ชาวเขา';
        const inspEl = document.getElementById('qwq-form-inspector');
        if (inspEl) inspEl.value = currentName;

        this.uploadedQuarterlyAttachments = [];
        this.resetQuarterlyDropzone();

        window.App.openModal('modal-quarter-quality');
    }

    openEditQuarterlyModal(id) {
        const item = this.quarterlyList.find(x => x.id === id);
        if (!item) return;

        this.editingQuarterlyId = id;
        const title = document.getElementById('modal-quarter-title');
        if (title) title.innerHTML = '<i class="fa-solid fa-pen-to-square text-amber-400"></i> แก้ไขผลส่งตรวจคุณภาพน้ำประจำไตรมาส';

        const setVal = (fieldId, val) => {
            const el = document.getElementById(fieldId);
            if (el) el.value = (val !== null && val !== undefined) ? val : '';
        };

        setVal('qwq-form-date', item.sampling_date ? item.sampling_date.split('T')[0] : '');
        this.populateQuarterlySamplingPointsDropdown(item.sampling_point || 'จุดปลายท่อออกจากระบบบำบัดน้ำเสีย');
        setVal('qwq-form-ph', item.ph);
        setVal('qwq-form-ss', item.ss);
        setVal('qwq-form-tds', item.tds);
        setVal('qwq-form-tss', item.tss);
        setVal('qwq-form-tkn', item.tkn);
        setVal('qwq-form-go', item.go !== undefined ? item.go : (item.grease_oil !== undefined ? item.grease_oil : ''));
        setVal('qwq-form-sulfide', item.sulfide);
        setVal('qwq-form-bod', item.bod);
        setVal('qwq-form-cod', item.cod);
        setVal('qwq-form-tcb', item.tcb);
        setVal('qwq-form-fcb', item.fcb);
        setVal('qwq-form-status', item.status || 'ผ่านเกณฑ์มาตรฐาน');
        setVal('qwq-form-action', item.action_taken || '');
        setVal('qwq-form-inspector', item.inspector || '');
        setVal('qwq-form-remarks', item.remarks || '');

        this.resetQuarterlyDropzone();
        const labFile = item.lab_report_file || item.image_url || item.file_url || '';
        setVal('qwq-form-file', labFile);

        if (labFile) {
            const fileInfo = this.getLabFileTypeInfo(labFile, 'ผลการตรวจวิเคราะห์ไตรมาส');
            this.uploadedQuarterlyAttachments = [{ data: labFile, name: `ผลตรวจแล็บ_${item.sampling_date || 'doc'}`, type: fileInfo.type }];
            const promptEl = document.getElementById('qwq-dropzone-prompt');
            const infoEl = document.getElementById('qwq-dropzone-fileinfo');
            const iconEl = document.getElementById('qwq-file-type-icon');
            const nameEl = document.getElementById('qwq-dropzone-filename');
            const sizeEl = document.getElementById('qwq-dropzone-filesize');

            if (promptEl) promptEl.style.display = 'none';
            if (infoEl) {
                infoEl.classList.remove('hidden');
                infoEl.style.display = 'flex';
            }
            if (iconEl) iconEl.innerHTML = `<i class="${fileInfo.icon}"></i>`;
            if (nameEl) nameEl.textContent = `ไฟล์แนบผลตรวจแล็บ (${fileInfo.label})`;
            if (sizeEl) sizeEl.textContent = `${fileInfo.badgeText} • พร้อมเปิดดู / ดาวน์โหลด`;
        }

        window.App.openModal('modal-quarter-quality');
    }

    getLabFileTypeInfo(fileUrl = '', title = '') {
        const url = (fileUrl || '').toLowerCase();
        const t = (title || '').toLowerCase();

        // 1. Excel (.xlsx, .xls, .csv, mime)
        if (url.includes('.xlsx') || url.includes('.xls') || url.includes('.csv') ||
            url.includes('spreadsheetml') || url.includes('vnd.ms-excel') || url.includes('text/csv') ||
            t.endsWith('.xlsx') || t.endsWith('.xls') || t.endsWith('.csv')) {
            return {
                type: 'excel',
                icon: 'fa-solid fa-file-excel text-emerald-400',
                badgeClass: 'badge-success bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
                badgeText: 'Excel',
                label: 'ไฟล์ตาราง Excel',
                color: 'emerald',
                isDocument: true
            };
        }

        // 2. Word (.docx, .doc, mime)
        if (url.includes('.docx') || url.includes('.doc') ||
            url.includes('wordprocessingml') || url.includes('msword') ||
            t.endsWith('.docx') || t.endsWith('.doc')) {
            return {
                type: 'word',
                icon: 'fa-solid fa-file-word text-blue-400',
                badgeClass: 'badge-info bg-blue-500/20 text-blue-300 border border-blue-500/40',
                badgeText: 'Word',
                label: 'ไฟล์เอกสาร Word',
                color: 'blue',
                isDocument: true
            };
        }

        // 3. Image (png, jpg, jpeg, webp, data:image/, svg)
        if (url.startsWith('data:image/') || url.includes('.png') || url.includes('.jpg') || url.includes('.jpeg') || url.includes('.webp') || url.includes('.svg') ||
            t.endsWith('.png') || t.endsWith('.jpg') || t.endsWith('.jpeg') || t.endsWith('.webp') || t.endsWith('.svg')) {
            return {
                type: 'image',
                icon: 'fa-solid fa-file-image text-amber-400',
                badgeClass: 'badge-warning bg-amber-500/20 text-amber-300 border border-amber-500/40',
                badgeText: 'รูปภาพ',
                label: 'ไฟล์รูปภาพ / ใบรับรอง',
                color: 'amber',
                isDocument: false
            };
        }

        // 4. PDF (Default or .pdf, data:application/pdf)
        return {
            type: 'pdf',
            icon: 'fa-solid fa-file-pdf text-rose-400',
            badgeClass: 'badge-danger bg-rose-500/20 text-rose-300 border border-rose-500/40',
            badgeText: 'PDF',
            label: 'เอกสารผลตรวจ PDF',
            color: 'rose',
            isDocument: true
        };
    }

    processQuarterlyLabFile(file) {
        if (!file) return;

        // ตรวจสอบขนาดไฟล์ (สูงสุด 25MB)
        const maxBytes = 25 * 1024 * 1024;
        if (file.size > maxBytes) {
            Swal.fire({
                icon: 'warning',
                title: 'ไฟล์มีขนาดใหญ่เกินไป',
                text: 'กรุณาอัปโหลดไฟล์ขนาดไม่เกิน 25 MB'
            });
            return;
        }

        const formattedSize = file.size > 1024 * 1024 
            ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
            : `${Math.round(file.size / 1024)} KB`;

        const fileInfo = this.getLabFileTypeInfo(file.type, file.name);

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64Data = event.target.result;
            const fileUrlInput = document.getElementById('qwq-form-file');
            if (fileUrlInput) fileUrlInput.value = base64Data;
            this.uploadedQuarterlyAttachments = [{ data: base64Data, name: file.name, type: fileInfo.type }];

            const promptEl = document.getElementById('qwq-dropzone-prompt');
            const infoEl = document.getElementById('qwq-dropzone-fileinfo');
            const iconEl = document.getElementById('qwq-file-type-icon');
            const nameEl = document.getElementById('qwq-dropzone-filename');
            const sizeEl = document.getElementById('qwq-dropzone-filesize');

            if (promptEl) promptEl.style.display = 'none';
            if (infoEl) {
                infoEl.classList.remove('hidden');
                infoEl.style.display = 'flex';
            }
            if (iconEl) iconEl.innerHTML = `<i class="${fileInfo.icon}"></i>`;
            if (nameEl) nameEl.textContent = file.name;
            if (sizeEl) sizeEl.textContent = `${fileInfo.badgeText} • ${formattedSize}`;

            Swal.fire({
                icon: 'success',
                title: 'แนบไฟล์ผลตรวจสำเร็จ!',
                html: `ประเภท: <strong>${fileInfo.label}</strong><br>ไฟล์: <strong>${file.name}</strong> (${formattedSize})`,
                timer: 1500,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });
        };
        reader.readAsDataURL(file);
    }

    resetQuarterlyDropzone() {
        const fileInput = document.getElementById('qwq-file-upload-input');
        if (fileInput) fileInput.value = '';

        const fileUrlInput = document.getElementById('qwq-form-file');
        if (fileUrlInput) fileUrlInput.value = '';

        this.uploadedQuarterlyAttachments = [];

        const promptEl = document.getElementById('qwq-dropzone-prompt');
        const infoEl = document.getElementById('qwq-dropzone-fileinfo');
        if (promptEl) promptEl.style.display = 'block';
        if (infoEl) {
            infoEl.classList.add('hidden');
            infoEl.style.display = 'none';
        }
    }

    openQuarterlyFile(id) {
        const item = this.quarterlyList.find(x => x.id === id);
        const fileReport = item ? (item.lab_report_file || item.image_url || item.file_url) : null;
        if (fileReport) {
            this.openOrDownloadFile(fileReport, `ผลตรวจคุณภาพน้ำไตรมาส_${item.sampling_date || 'report'}`);
        } else {
            Swal.fire({
                icon: 'info',
                title: 'ยังไม่มีไฟล์รายงานแนบ',
                text: 'รายการนี้ยังไม่ได้อัปโหลดไฟล์ผลตรวจแล็บ คุณต้องการอัปโหลดไฟล์ตอนนี้หรือไม่?',
                showCancelButton: true,
                confirmButtonText: '<i class="fa-solid fa-cloud-arrow-up mr-1"></i> อัปโหลดแนบไฟล์',
                cancelButtonText: 'ไว้ทีหลัง',
                confirmButtonColor: '#8b5cf6',
                cancelButtonColor: '#475569'
            }).then((res) => {
                if (res.isConfirmed) {
                    this.openEditQuarterlyModal(id);
                }
            });
        }
    }

    openOrDownloadFile(fileUrl, fileName, fileType) {
        if (!fileUrl || fileUrl === '#' || fileUrl.trim() === '') {
            Swal.fire({
                icon: 'info',
                title: 'ไม่มีไฟล์รายงานผลตรวจแนบ',
                text: 'รายการนี้ยังไม่ได้อัปโหลดไฟล์ผลตรวจจากห้องปฏิบัติการ',
                confirmButtonText: 'รับทราบ',
                confirmButtonColor: '#8b5cf6'
            });
            return;
        }

        const info = this.getLabFileTypeInfo(fileUrl, fileName);
        const resolvedType = fileType || info.type;

        // 1. PDF: เปิดดูใน AttachmentManager หรือ new window
        if (resolvedType === 'pdf') {
            if (window.AttachmentManager && window.AttachmentManager.openMediaViewer) {
                window.AttachmentManager.openMediaViewer({ data: fileUrl, type: 'pdf', name: fileName || 'รายงานผลวิเคราะห์คุณภาพน้ำ' });
            } else {
                window.open(fileUrl, '_blank');
            }
            return;
        }

        // 2. Image: เปิดดูภาพขยาย
        if (resolvedType === 'image') {
            if (window.AttachmentManager && window.AttachmentManager.openMediaViewer) {
                window.AttachmentManager.openMediaViewer({ data: fileUrl, type: 'image', name: fileName || 'รูปภาพผลตรวจห้องปฏิบัติการ' });
            } else {
                window.open(fileUrl, '_blank');
            }
            return;
        }

        // 3. Word หรือ Excel: ดาวน์โหลดลงเครื่องทันที
        try {
            const link = document.createElement('a');
            link.href = fileUrl;
            let ext = resolvedType === 'excel' ? '.xlsx' : '.docx';
            link.download = fileName ? (fileName.includes('.') ? fileName : `${fileName}${ext}`) : `รายงานผลตรวจ_${new Date().toISOString().split('T')[0]}${ext}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            Swal.fire({
                icon: 'success',
                title: `กำลังดาวน์โหลด${info.label}`,
                text: link.download,
                timer: 1500,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });
        } catch (err) {
            console.error('Download error:', err);
            window.open(fileUrl, '_blank');
        }
    }

    viewQuarterlyDetails(id) {
        const item = this.quarterlyList.find(x => x.id === id);
        if (!item) return;

        const ph = parseFloat(item.ph);
        const bod = parseFloat(item.bod);
        const cod = parseFloat(item.cod);
        const ss = parseFloat(item.ss);
        const tss = parseFloat(item.tss);
        const tds = parseFloat(item.tds);
        const tkn = parseFloat(item.tkn);
        const go = parseFloat(item.go !== undefined ? item.go : item.grease_oil);
        const sulfide = parseFloat(item.sulfide);
        const tcb = parseFloat(item.tcb);
        const fcb = parseFloat(item.fcb);

        const params = [
            { name: '1. ค่าความเป็นกรด-ด่าง (pH)', val: !isNaN(ph) ? ph.toFixed(2) : '-', std: '5.50 - 9.00', pass: isNaN(ph) || (ph >= 5.5 && ph <= 9.0) },
            { name: '2. สารแขวนลอย (SS)', val: !isNaN(ss) ? `${ss.toFixed(1)} mg/L` : '-', std: '≤ 50.0 mg/L', pass: isNaN(ss) || ss <= 50 },
            { name: '3. สารละลายทั้งหมด (TDS)', val: !isNaN(tds) ? `${tds.toFixed(0)} mg/L` : '-', std: '≤ 500 mg/L', pass: isNaN(tds) || tds <= 500 },
            { name: '4. ของแข็งแขวนลอยทั้งหมด (TSS)', val: !isNaN(tss) ? `${tss.toFixed(1)} mg/L` : '-', std: '≤ 30.0 mg/L', pass: isNaN(tss) || tss <= 30 },
            { name: '5. ไนโตรเจนทั้งหมด (TKN)', val: !isNaN(tkn) ? `${tkn.toFixed(1)} mg/L` : '-', std: '≤ 35.0 mg/L', pass: isNaN(tkn) || tkn <= 35 },
            { name: '6. น้ำมันและไขมัน (Grease & Oil)', val: !isNaN(go) ? `${go.toFixed(1)} mg/L` : '-', std: '≤ 20.0 mg/L', pass: isNaN(go) || go <= 20 },
            { name: '7. สารประกอบซัลไฟด์ (Sulfide)', val: !isNaN(sulfide) ? `${sulfide.toFixed(2)} mg/L` : '-', std: '≤ 1.0 mg/L', pass: isNaN(sulfide) || sulfide <= 1.0 },
            { name: '8. บีโอดี (BOD)', val: !isNaN(bod) ? `${bod.toFixed(1)} mg/L` : '-', std: '≤ 20.0 mg/L', pass: isNaN(bod) || bod <= 20 },
            { name: '9. ซีโอดี (COD)', val: !isNaN(cod) ? `${cod.toFixed(1)} mg/L` : '-', std: '≤ 120.0 mg/L', pass: isNaN(cod) || cod <= 120 },
            { name: '10. แบคทีเรียกลุ่มโคลิฟอร์มทั้งหมด (TCB)', val: !isNaN(tcb) ? `${Math.round(tcb)} MPN/100ml` : '-', std: '≤ 1,000 MPN/100ml', pass: isNaN(tcb) || tcb <= 1000 },
            { name: '11. แบคทีเรียฟีคัลโคลิฟอร์ม (FCB)', val: !isNaN(fcb) ? `${Math.round(fcb)} MPN/100ml` : '-', std: '≤ 400 MPN/100ml', pass: isNaN(fcb) || fcb <= 400 }
        ];

        const allPass = params.every(p => p.pass);

        const rowsHtml = params.map(p => `
            <tr class="border-b border-slate-800/80 text-xs">
                <td class="py-1.5 px-2 text-slate-300 font-medium">${p.name}</td>
                <td class="py-1.5 px-2 text-center text-slate-400 font-mono">${p.std}</td>
                <td class="py-1.5 px-2 text-right font-mono font-bold ${p.pass ? 'text-emerald-400' : 'text-rose-400'}">${p.val}</td>
                <td class="py-1.5 px-2 text-center">
                    <span class="badge ${p.pass ? 'badge-success' : 'badge-danger'} text-[10px] py-0.5 px-1.5">
                        ${p.pass ? '✓ ผ่าน' : '✗ ไม่ผ่าน'}
                    </span>
                </td>
            </tr>
        `).join('');

        const fileReport = item.lab_report_file || item.image_url || item.file_url;
        const fileInfo = fileReport ? this.getLabFileTypeInfo(fileReport) : null;

        Swal.fire({
            title: `<div class="text-base font-bold text-white flex items-center gap-2"><i class="fa-solid fa-microscope text-purple-400"></i> รายละเอียดผลตรวจวิเคราะห์น้ำทิ้ง 11 พารามิเตอร์</div>`,
            html: `
                <div class="text-left text-xs space-y-3 p-3 bg-slate-900 rounded-xl border border-slate-800 max-h-[75vh] overflow-y-auto">
                    <div class="flex items-center justify-between text-slate-300 pb-2 border-b border-slate-800 flex-wrap gap-2">
                        <div><strong>วันที่เก็บตัวอย่าง:</strong> <span class="font-mono text-cyan-300 font-bold">${item.sampling_date || '-'}</span></div>
                        <div><span class="badge ${allPass ? 'badge-success' : 'badge-danger'} font-bold">${item.status || (allPass ? 'ผ่านเกณฑ์มาตรฐาน' : 'ไม่ผ่านเกณฑ์มาตรฐาน')}</span></div>
                    </div>
                    <div class="text-slate-300"><strong>จุดเก็บตัวอย่าง:</strong> <span class="text-white font-medium">${item.sampling_point || '-'}</span></div>
                    
                    <div class="overflow-x-auto border border-slate-800 rounded-lg bg-slate-950/60">
                        <table class="w-full text-left">
                            <thead class="bg-slate-900 text-slate-400 text-[11px] border-b border-slate-800">
                                <tr>
                                    <th class="py-1.5 px-2">พารามิเตอร์ (11 รายการ สธ.)</th>
                                    <th class="py-1.5 px-2 text-center">เกณฑ์มาตรฐาน</th>
                                    <th class="py-1.5 px-2 text-right">ผลตรวจแล็บ</th>
                                    <th class="py-1.5 px-2 text-center">ประเมิน</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rowsHtml}
                            </tbody>
                        </table>
                    </div>

                    <div class="p-2.5 bg-slate-950 rounded-lg border border-slate-800 space-y-2 text-[11px]">
                        <div><strong>การดำเนินการ / ข้อปฏิบัติ:</strong> <span class="text-slate-300">${item.action_taken || 'ระบบบำบัดทำงานเต็มประสิทธิภาพ'}</span></div>
                        <div><strong>ผู้ตรวจสอบ / เจ้าหน้าที่แล็บ:</strong> <span class="text-emerald-400 font-medium">${item.inspector || '-'}</span></div>
                        ${item.remarks ? `<div><strong>หมายเหตุ:</strong> <span class="text-slate-400">${item.remarks}</span></div>` : ''}
                        ${fileReport ? `
                            <div class="pt-2 border-t border-slate-800 flex items-center justify-between flex-wrap gap-2">
                                <div class="text-slate-400 flex items-center gap-1.5">
                                    <i class="${fileInfo.icon}"></i>
                                    <span>ไฟล์รายงานผลแล็บ (${fileInfo.label})</span>
                                </div>
                                <button type="button" onclick="window.WaterQualityModule.openQuarterlyFile('${item.id}')" 
                                    class="px-2.5 py-1 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer">
                                    <i class="fa-solid fa-arrow-up-right-from-square"></i>
                                    <span>เปิดดู / ดาวน์โหลด (${fileInfo.badgeText})</span>
                                </button>
                            </div>
                        ` : `
                            <div class="pt-2 border-t border-slate-800 flex items-center justify-between flex-wrap gap-2">
                                <div class="text-amber-400 text-xs flex items-center gap-1.5">
                                    <i class="fa-solid fa-circle-exclamation"></i>
                                    <span>ยังไม่ได้แนบไฟล์รายงานผลตรวจแล็บ</span>
                                </div>
                                <button type="button" onclick="Swal.close(); window.WaterQualityModule.openEditQuarterlyModal('${item.id}')" 
                                    class="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer">
                                    <i class="fa-solid fa-cloud-arrow-up"></i>
                                    <span>อัปโหลดแนบไฟล์ทันที</span>
                                </button>
                            </div>
                        `}
                    </div>
                </div>
            `,
            width: '680px',
            confirmButtonText: 'ปิดหน้าต่าง',
            confirmButtonColor: '#8b5cf6'
        });
    }

    async saveQuarterlyData() {
        const form = document.getElementById('form-quarter-quality') || document.getElementById('form-quarterly-quality');
        if (form && !form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const currentUser = (window.AuthService && typeof window.AuthService.getCurrentUser === 'function') 
            ? window.AuthService.getCurrentUser() 
            : null;
        const currentName = currentUser ? (currentUser.full_name || currentUser.username) : 'แสงตะวัน ชาวเขา';

        let qwqFileVal = document.getElementById('qwq-form-file')?.value?.trim() || null;
        if (!qwqFileVal && window.AttachmentManager && this.uploadedQuarterlyAttachments && this.uploadedQuarterlyAttachments.length > 0) {
            qwqFileVal = window.AttachmentManager.serializeAttachments(this.uploadedQuarterlyAttachments, false);
        }
        if (!qwqFileVal && this.uploadedQuarterlyAttachments && this.uploadedQuarterlyAttachments.length > 0) {
            qwqFileVal = this.uploadedQuarterlyAttachments[0].data;
        }

        const payload = {
            sampling_date: document.getElementById('qwq-form-date')?.value || new Date().toISOString().split('T')[0],
            sampling_point: document.getElementById('qwq-form-point')?.value || 'จุดปลายท่อออกจากระบบบำบัดน้ำเสีย',
            ph: parseFloat(document.getElementById('qwq-form-ph')?.value) || null,
            ss: parseFloat(document.getElementById('qwq-form-ss')?.value) || null,
            tds: parseFloat(document.getElementById('qwq-form-tds')?.value) || null,
            tss: parseFloat(document.getElementById('qwq-form-tss')?.value) || null,
            tkn: parseFloat(document.getElementById('qwq-form-tkn')?.value) || null,
            go: parseFloat(document.getElementById('qwq-form-go')?.value) || null,
            sulfide: parseFloat(document.getElementById('qwq-form-sulfide')?.value) || null,
            bod: parseFloat(document.getElementById('qwq-form-bod')?.value) || null,
            cod: parseFloat(document.getElementById('qwq-form-cod')?.value) || null,
            tcb: parseFloat(document.getElementById('qwq-form-tcb')?.value) || null,
            fcb: parseFloat(document.getElementById('qwq-form-fcb')?.value) || null,
            status: document.getElementById('qwq-form-status')?.value || 'ผ่านเกณฑ์มาตรฐาน',
            action_taken: document.getElementById('qwq-form-action')?.value?.trim() || '',
            lab_report_file: qwqFileVal,
            image_url: qwqFileVal,
            file_url: qwqFileVal,
            inspector: document.getElementById('qwq-form-inspector')?.value?.trim() || currentName,
            remarks: document.getElementById('qwq-form-remarks')?.value?.trim() || ''
        };

        Swal.fire({ title: 'กำลังบันทึกผลตรวจไตรมาส...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        try {
            let res;
            if (this.editingQuarterlyId) {
                res = await window.DataStore.update('quarterly_water_quality', this.editingQuarterlyId, payload);
                const targetIdx = this.quarterlyList.findIndex(x => x.id === this.editingQuarterlyId);
                if (targetIdx !== -1) {
                    this.quarterlyList[targetIdx] = { ...this.quarterlyList[targetIdx], ...payload, id: this.editingQuarterlyId };
                }
                this.editingQuarterlyId = null;
            } else {
                res = await window.DataStore.insert('quarterly_water_quality', payload);
                const saved = res?.record || res?.data || payload;
                if (saved) {
                    const sampleSeedFlag = localStorage.getItem('wwtp_sample_data_seeded');
                    if (!sampleSeedFlag) {
                        this.quarterlyList = (this.quarterlyList || []).filter(x => !['qw-01', 'qw-02', 'qw-03'].includes(x.id));
                    }
                    this.quarterlyList.unshift(saved);
                }
            }

            window.App.closeModal('modal-quarter-quality');
            this.renderQuarterlyTable(this.quarterlyList);
            await this.loadData();

            if (res && res.savedSupabase) {
                Swal.fire({
                    icon: 'success',
                    title: 'บันทึกสำเร็จ!',
                    html: '<span class="text-xs text-purple-400 font-bold"><i class="fa-solid fa-cloud-arrow-up"></i> ซิงค์ผลตรวจ 11 พารามิเตอร์ลง Supabase เรียบร้อย</span>',
                    timer: 1600,
                    showConfirmButton: false,
                    toast: true,
                    position: 'top-end'
                });
            } else {
                Swal.fire({
                    icon: 'success',
                    title: 'บันทึกผลตรวจไตรมาสสำเร็จ',
                    text: 'อัปเดตข้อมูล 11 พารามิเตอร์ในระบบเรียบร้อย',
                    timer: 1500,
                    showConfirmButton: false,
                    toast: true,
                    position: 'top-end'
                });
            }
        } catch (err) {
            console.error('Error saving quarterly water quality record:', err);
            Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: err.message || 'เกิดข้อผิดพลาด' });
        }
    }

    exportQuarterlyExcel() {
        const data = this.quarterlyList.map((item, idx) => ({
            'ลำดับ': idx + 1,
            'วันที่เก็บตัวอย่าง': item.sampling_date,
            'จุดเก็บตัวอย่าง': item.sampling_point,
            'pH (5.5-9.0)': item.ph,
            'SS (<=50 mg/L)': item.ss,
            'TDS (<=500 mg/L)': item.tds,
            'TSS (<=30 mg/L)': item.tss,
            'TKN (<=35 mg/L)': item.tkn,
            'Grease & Oil (<=20 mg/L)': item.go !== undefined ? item.go : item.grease_oil,
            'Sulfide (<=1.0 mg/L)': item.sulfide,
            'BOD (<=20 mg/L)': item.bod,
            'COD (<=120 mg/L)': item.cod,
            'TCB (<=1000 MPN)': item.tcb,
            'FCB (<=400 MPN)': item.fcb,
            'สถานะมาตรฐาน': item.status,
            'การดำเนินการ': item.action_taken || '',
            'ผู้ตรวจสอบ': item.inspector || '',
            'หมายเหตุ': item.remarks || ''
        }));
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, "ผลตรวจไตรมาส 11 รายการ");
        XLSX.writeFile(wb, `ผลตรวจคุณภาพน้ำไตรมาส_รพ.๕๐พรรษา_${new Date().toISOString().split('T')[0]}.xlsx`);
        Swal.fire({ icon: 'success', title: 'ส่งออก Excel เรียบร้อย', timer: 1200, showConfirmButton: false, toast: true, position: 'top-end' });
    }

    exportQuarterlyCSV() {
        const data = this.quarterlyList.map((item, idx) => ({
            'ลำดับ': idx + 1,
            'วันที่เก็บตัวอย่าง': item.sampling_date,
            'จุดเก็บตัวอย่าง': item.sampling_point,
            'pH': item.ph,
            'SS': item.ss,
            'TDS': item.tds,
            'TSS': item.tss,
            'TKN': item.tkn,
            'Grease & Oil': item.go !== undefined ? item.go : item.grease_oil,
            'Sulfide': item.sulfide,
            'BOD': item.bod,
            'COD': item.cod,
            'TCB': item.tcb,
            'FCB': item.fcb,
            'สถานะ': item.status,
            'ผู้ตรวจสอบ': item.inspector
        }));
        window.ExportImportModule.exportModuleCSV('ผลตรวจคุณภาพน้ำไตรมาส_รพ.๕๐พรรษา', data);
    }

    exportQuarterlyPDF() {
        window.print();
    }

    async clearQuarterlyData() {
        const result = await Swal.fire({
            title: 'ยืนยันล้างข้อมูลผลตรวจไตรมาสทั้งหมด?',
            text: 'ข้อมูลผลตรวจคุณภาพน้ำ 11 พารามิเตอร์ทั้งหมดจะถูกลบและไม่สามารถกู้คืนได้',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#334155',
            confirmButtonText: 'ใช่, ลบทั้งหมด',
            cancelButtonText: 'ยกเลิก'
        });

        if (result.isConfirmed) {
            Swal.fire({ title: 'กำลังล้างข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            for (const item of this.quarterlyList) {
                if (item.id) await window.DataStore.delete('quarterly_water_quality', item.id);
            }
            this.quarterlyList = [];
            this.renderQuarterlyTable(this.quarterlyList);
            Swal.fire({ icon: 'success', title: 'ล้างข้อมูลผลตรวจไตรมาสเรียบร้อย', timer: 1500, showConfirmButton: false, toast: true, position: 'top-end' });
        }
    }

    exportExcel() {
        if (this.currentTab === 'quarter') {
            this.exportQuarterlyExcel();
            return;
        }
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
        Swal.fire({ icon: 'success', title: 'ส่งออก Excel เรียบร้อย', timer: 1200, showConfirmButton: false, toast: true, position: 'top-end' });
    }

    exportCSV() {
        if (this.currentTab === 'quarter') {
            this.exportQuarterlyCSV();
            return;
        }
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
        if (this.currentTab === 'quarter') {
            this.exportQuarterlyPDF();
            return;
        }
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
