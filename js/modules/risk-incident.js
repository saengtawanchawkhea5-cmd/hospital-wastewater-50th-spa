/**
 * ============================================================================
 * ระบบจัดการระบบบำบัดน้ำเสีย โรงพยาบาล ๕๐ พรรษา มหาวชิราลงกรณ (SPA)
 * RISK-INCIDENT.JS - บริหารความเสี่ยง & รายงานเหตุการณ์ผิดปกติ
 * ค้นหา & ปฏิบัติการข้อมูล, เพิ่ม, ลบ, แก้ไข, นำเข้า Excel/CSV, ดาวน์โหลดแม่แบบ
 * ============================================================================
 */

class RiskIncidentModule {
    constructor() {
        this.risks = [];
        this.filteredRisks = [];
        this.incidents = [];
        this.filteredIncidents = [];
        this.editingRiskId = null;
        this.editingIncidentId = null;
        this.uploadedRiskAttachments = [];
        this.uploadedIncidentAttachments = [];
        this.sortField = 'recorded_at';
        this.sortDir = 'desc';
        this.currentPage = 1;
        this.pageSize = 20;
        this.sortOrder = 'date_desc';
        this.activeTab = 'risk'; // 'risk' or 'incident'
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
        // ผูกปุ่มสลับแท็บความเสี่ยง & เหตุการณ์ผิดปกติ
        const tabRisk = document.getElementById('tab-btn-risk');
        const tabIncident = document.getElementById('tab-btn-incident');
        if (tabRisk) tabRisk.addEventListener('click', () => this.switchTab('risk'));
        if (tabIncident) tabIncident.addEventListener('click', () => this.switchTab('incident'));

        // ผูกการคลิกจัดเรียงหัวตารางอัตโนมัติ (วันที่ล่าสุดขึ้นก่อนเสมอ)
        if (window.App && window.App.bindTableSorting) {
            window.App.bindTableSorting('table-risk-body', this, 'recorded_at', 'desc');
            window.App.bindTableSorting('table-incident-body', this, 'recorded_at', 'desc');
        }

        // ตัวเลือกจัดเรียงลำดับ (Sort Order)
        const sortOrderEl = document.getElementById('filter-risk-sort-order');
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
        const pageSizeEl = document.getElementById('filter-risk-page-size');
        if (pageSizeEl) {
            pageSizeEl.addEventListener('change', (e) => {
                this.pageSize = e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10);
                this.currentPage = 1;
                this.applyFilters();
            });
        }

        // ปุ่มเปิด Modal บันทึกความเสี่ยง
        const btnAddRisk = document.getElementById('btn-add-risk');
        if (btnAddRisk) btnAddRisk.addEventListener('click', () => this.openAddRiskModal());

        const btnAddRiskAuto = document.getElementById('btn-add-risk-auto');
        if (btnAddRiskAuto) btnAddRiskAuto.addEventListener('click', () => this.openAddRiskModal());

        // ปุ่มเปิด Modal บันทึกเหตุการณ์ผิดปกติ
        const btnAddIncident = document.getElementById('btn-add-incident');
        if (btnAddIncident) btnAddIncident.addEventListener('click', () => this.openAddIncidentModal());

        // Quick Action Toolbar Buttons
        const btnRefresh = document.getElementById('btn-risk-refresh');
        if (btnRefresh) btnRefresh.addEventListener('click', async () => {
            await this.loadData();
            Swal.fire({
                icon: 'success',
                title: 'รีเฟรชข้อมูลสำเร็จ',
                text: 'อัปเดตข้อมูลความเสี่ยงและเหตุการณ์ล่าสุดเรียบร้อย',
                timer: 1000,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });
        });

        const btnPreview = document.getElementById('btn-risk-preview');
        if (btnPreview) btnPreview.addEventListener('click', () => this.previewData());

        const btnExcel = document.getElementById('btn-risk-excel');
        if (btnExcel) btnExcel.addEventListener('click', () => this.exportExcel());

        const btnPdf = document.getElementById('btn-risk-pdf');
        if (btnPdf) btnPdf.addEventListener('click', () => this.exportPDF());

        const btnCsv = document.getElementById('btn-risk-csv');
        if (btnCsv) btnCsv.addEventListener('click', () => this.exportCSV());

        const btnTemplate = document.getElementById('btn-risk-template');
        if (btnTemplate) btnTemplate.addEventListener('click', () => window.ExportImportModule.downloadModuleTemplate('risk'));

        const btnImportTrigger = document.getElementById('btn-risk-import-trigger');
        const fileImportInput = document.getElementById('file-risk-import');
        if (btnImportTrigger && fileImportInput) {
            btnImportTrigger.addEventListener('click', () => fileImportInput.click());
            fileImportInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    window.ExportImportModule.importModuleExcelOrCSV(file, 'risk', () => this.loadData());
                    e.target.value = '';
                }
            });
        }

        const btnClear = document.getElementById('btn-risk-clear-all');
        if (btnClear) btnClear.addEventListener('click', () => {
            window.ExportImportModule.clearModuleData('risk', 'risk_management', () => this.loadData());
        });

        const btnResetFilter = document.getElementById('btn-risk-reset-filter');
        if (btnResetFilter) btnResetFilter.addEventListener('click', () => this.resetFilters());

        // Status Header Pills
        const pillAll = document.getElementById('pill-risk-all');
        if (pillAll) pillAll.addEventListener('click', () => this.resetFilters());

        const pillYear = document.getElementById('pill-risk-year');
        if (pillYear) pillYear.addEventListener('click', () => this.filterByCurrentYear());

        const pillMonth = document.getElementById('pill-risk-month');
        if (pillMonth) pillMonth.addEventListener('click', () => this.filterByCurrentMonth());

        const btnAddYear = document.getElementById('btn-add-year-risk');
        if (btnAddYear) btnAddYear.addEventListener('click', () => this.promptAddYear());

        // ตัวกรอง 7 ช่อง
        const inputSearch = document.getElementById('filter-risk-search');
        if (inputSearch) inputSearch.addEventListener('input', (e) => { this.filters.search = e.target.value; this.applyFilters(); });

        const selectCategory = document.getElementById('filter-risk-category');
        if (selectCategory) selectCategory.addEventListener('change', (e) => { this.filters.category = e.target.value; this.applyFilters(); });

        const selectBuilding = document.getElementById('filter-risk-building');
        if (selectBuilding) selectBuilding.addEventListener('change', (e) => { this.filters.building = e.target.value; this.applyFilters(); });

        const inputStartDate = document.getElementById('filter-risk-start-date');
        if (inputStartDate) inputStartDate.addEventListener('change', (e) => { this.filters.startDate = e.target.value; this.applyFilters(); });

        const inputEndDate = document.getElementById('filter-risk-end-date');
        if (inputEndDate) inputEndDate.addEventListener('change', (e) => { this.filters.endDate = e.target.value; this.applyFilters(); });

        const selectYear = document.getElementById('filter-risk-year');
        if (selectYear) selectYear.addEventListener('change', (e) => { this.filters.year = e.target.value; this.applyFilters(); });

        const selectMonth = document.getElementById('filter-risk-month');
        if (selectMonth) selectMonth.addEventListener('change', (e) => { this.filters.month = e.target.value; this.applyFilters(); });

        // ผูก Drag & Drop สำหรับไฟล์เอกสาร/รูปภาพความเสี่ยง (PDF, รูปภาพ, Word, Excel)
        const riskDropzone = document.getElementById('risk-dropzone');
        const riskFileInput = document.getElementById('risk-file-upload-input');
        const riskBtnRemove = document.getElementById('risk-btn-remove-file');
        const riskFormImage = document.getElementById('risk-form-image');

        if (riskDropzone && riskFileInput) {
            riskDropzone.addEventListener('click', (e) => {
                if (e.target.closest('#risk-btn-remove-file') || e.target.id === 'risk-btn-remove-file') return;
                riskFileInput.click();
            });

            riskFileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    this.processRiskFile(e.target.files[0]);
                }
            });

            ['dragenter', 'dragover'].forEach(eventName => {
                riskDropzone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    riskDropzone.classList.add('border-emerald-400', 'bg-emerald-500/10');
                });
            });

            ['dragleave', 'drop'].forEach(eventName => {
                riskDropzone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    riskDropzone.classList.remove('border-emerald-400', 'bg-emerald-500/10');
                });
            });

            riskDropzone.addEventListener('drop', (e) => {
                const dt = e.dataTransfer;
                if (dt && dt.files && dt.files[0]) {
                    this.processRiskFile(dt.files[0]);
                }
            });
        }

        if (riskBtnRemove) {
            riskBtnRemove.addEventListener('click', (e) => {
                e.stopPropagation();
                this.resetRiskDropzone();
            });
        }

        if (riskFormImage) {
            riskFormImage.addEventListener('input', (e) => {
                const val = e.target.value.trim();
                if (val) {
                    this.uploadedRiskAttachments = [{ data: val, name: 'ลิงก์เอกสาร/ภาพแนบ', type: 'image' }];
                } else {
                    this.uploadedRiskAttachments = [];
                }
            });
        }

        // ผูก Drag & Drop สำหรับไฟล์เอกสาร/รูปภาพเหตุการณ์ผิดปกติ (PDF, รูปภาพ, Word, Excel)
        const incDropzone = document.getElementById('inc-dropzone');
        const incFileInput = document.getElementById('inc-file-upload-input');
        const incBtnRemove = document.getElementById('inc-btn-remove-file');
        const incFormImage = document.getElementById('inc-form-image');

        if (incDropzone && incFileInput) {
            incDropzone.addEventListener('click', (e) => {
                if (e.target.closest('#inc-btn-remove-file') || e.target.id === 'inc-btn-remove-file') return;
                incFileInput.click();
            });

            incFileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    this.processIncidentFile(e.target.files[0]);
                }
            });

            ['dragenter', 'dragover'].forEach(eventName => {
                incDropzone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    incDropzone.classList.add('border-rose-400', 'bg-rose-500/10');
                });
            });

            ['dragleave', 'drop'].forEach(eventName => {
                incDropzone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    incDropzone.classList.remove('border-rose-400', 'bg-rose-500/10');
                });
            });

            incDropzone.addEventListener('drop', (e) => {
                const dt = e.dataTransfer;
                if (dt && dt.files && dt.files[0]) {
                    this.processIncidentFile(dt.files[0]);
                }
            });
        }

        if (incBtnRemove) {
            incBtnRemove.addEventListener('click', (e) => {
                e.stopPropagation();
                this.resetIncidentDropzone();
            });
        }

        if (incFormImage) {
            incFormImage.addEventListener('input', (e) => {
                const val = e.target.value.trim();
                if (val) {
                    this.uploadedIncidentAttachments = [{ data: val, name: 'ลิงก์ภาพถ่ายเหตุการณ์', type: 'image' }];
                } else {
                    this.uploadedIncidentAttachments = [];
                }
            });
        }

        // ฟอร์มบันทึกความเสี่ยง
        const formRisk = document.getElementById('form-risk');
        if (formRisk) {
            formRisk.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveRiskData();
            });
        }

        // ฟอร์มบันทึกเหตุการณ์ผิดปกติ
        const formIncident = document.getElementById('form-incident');
        if (formIncident) {
            formIncident.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveIncidentData();
            });
        }
    }

    switchTab(tab = 'risk') {
        this.activeTab = tab;
        const secRisk = document.getElementById('section-risk-view');
        const secIncident = document.getElementById('section-incident-view');
        const tabRisk = document.getElementById('tab-btn-risk');
        const tabIncident = document.getElementById('tab-btn-incident');
        const btnAutoGen = document.getElementById('btn-risk-auto-gen');

        if (this.activeTab === 'risk') {
            if (secRisk) { secRisk.style.display = 'block'; secRisk.classList.remove('hidden'); }
            if (secIncident) { secIncident.style.display = 'none'; secIncident.classList.add('hidden'); }
            if (tabRisk) tabRisk.classList.add('active');
            if (tabIncident) tabIncident.classList.remove('active');
            if (btnAutoGen) {
                btnAutoGen.innerHTML = `<i class="fa-solid fa-bolt text-slate-950"></i> บันทึกความเสี่ยงตัวอย่าง`;
                btnAutoGen.onclick = () => this.generateSampleRisk();
            }
        } else {
            if (secRisk) { secRisk.style.display = 'none'; secRisk.classList.add('hidden'); }
            if (secIncident) { secIncident.style.display = 'block'; secIncident.classList.remove('hidden'); }
            if (tabRisk) tabRisk.classList.remove('active');
            if (tabIncident) tabIncident.classList.add('active');
            if (btnAutoGen) {
                btnAutoGen.innerHTML = `<i class="fa-solid fa-bolt text-slate-950"></i> บันทึกเหตุการณ์ตัวอย่าง`;
                btnAutoGen.onclick = () => this.generateSampleIncident();
            }
        }
        this.updateTotalBadge();
    }

    updateTotalBadge() {
        const badge = document.getElementById('risk-total-count-badge');
        if (badge) {
            const count = this.activeTab === 'incident'
                ? (this.filteredIncidents ? this.filteredIncidents.length : 0)
                : (this.filteredRisks ? this.filteredRisks.length : 0);
            badge.textContent = count;
        }
    }

    previewData() {
        if (window.App && window.App.handleModuleAction) {
            window.App.handleModuleAction('preview', 'risk-incident');
        }
    }

    exportExcel() {
        if (window.App && window.App.handleModuleAction) {
            window.App.handleModuleAction('excel', 'risk-incident');
        }
    }

    exportPDF() {
        if (window.App && window.App.handleModuleAction) {
            window.App.handleModuleAction('pdf', 'risk-incident');
        }
    }

    exportCSV() {
        if (window.App && window.App.handleModuleAction) {
            window.App.handleModuleAction('csv', 'risk-incident');
        }
    }

    async generateSampleRisk() {
        const sample = {
            risk_name: 'ความดันในท่อส่งน้ำเสียสูงผิดปกติจากเศษขยะอุดตัน',
            severity_level: 'ปานกลาง',
            impact: 'อาจทำให้ท่อแตกหรือปั๊มสูบน้ำเสียทำงานหนักเกินพิกัด',
            prevention_plan: 'ติดตั้งเกจวัดแรงดันพร้อมระบบแจ้งเตือน และกำหนดรอบตรวจล้างตะแกรงดักขยะทุกวัน',
            status: 'ควบคุมได้',
            risk_manager: (window.AuthService && window.AuthService.getCurrentUser()?.full_name) || 'แสงตะวัน ชาวเขา',
            recorded_at: new Date().toISOString()
        };
        try {
            await window.DataStore.create('risk_management', sample);
            await this.loadData();
            Swal.fire({
                icon: 'success',
                title: 'บันทึกความเสี่ยงตัวอย่างสำเร็จ',
                text: sample.risk_name,
                timer: 1500,
                showConfirmButton: false
            });
        } catch (err) {
            console.error('Error generating sample risk:', err);
            Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: err.message });
        }
    }

    async generateSampleIncident() {
        const sample = {
            incident_date: new Date().toISOString().split('T')[0],
            incident_type: 'ระดับน้ำในบ่อพักสูงเกินเกณฑ์ปกติ (High Level Alert)',
            description: 'ลูกลอยตัดต่อวงจรปั๊ม SP-1 ขัดข้องชั่วคราวจากคราบไขมันเกาะ',
            action_taken: 'ช่างเวรเข้าทำความสะอาดลูกลอยและทดสอบเดินปั๊ม SP-2 สำรองทันที',
            resolution_status: 'แก้ไขแล้ว',
            reporter: (window.AuthService && window.AuthService.getCurrentUser()?.full_name) || 'แสงตะวัน ชาวเขา',
            recorded_at: new Date().toISOString()
        };
        try {
            await window.DataStore.create('incident_records', sample);
            await this.loadData();
            Swal.fire({
                icon: 'success',
                title: 'บันทึกเหตุการณ์ตัวอย่างสำเร็จ',
                text: sample.incident_type,
                timer: 1500,
                showConfirmButton: false
            });
        } catch (err) {
            console.error('Error generating sample incident:', err);
            Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: err.message });
        }
    }

    setActivePill(activeId) {
        ['pill-risk-all', 'pill-risk-year', 'pill-risk-month'].forEach(id => {
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
            title: 'เพิ่มปี พ.ศ. สำหรับตัวกรองความเสี่ยง',
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
            const select = document.getElementById('filter-risk-year');
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
        const select = document.getElementById('filter-risk-year');
        if (select) select.value = currentYearBE;
        this.filters.year = currentYearBE;
        this.setActivePill('pill-risk-year');
        this.applyFilters();
        Swal.fire({
            icon: 'success',
            title: `กรองข้อมูลความเสี่ยงปี พ.ศ. ${currentYearBE}`,
            timer: 900,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
        });
    }

    filterByCurrentMonth() {
        const now = new Date();
        const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');
        const select = document.getElementById('filter-risk-month');
        if (select) select.value = currentMonth;
        this.filters.month = currentMonth;
        this.setActivePill('pill-risk-month');
        this.applyFilters();
        Swal.fire({
            icon: 'success',
            title: `กรองข้อมูลความเสี่ยงเดือนนี้ (เดือนที่ ${parseInt(currentMonth)})`,
            timer: 900,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
        });
    }

    async loadData() {
        this.risks = await window.DataStore.getAll('risk_management', { orderBy: 'recorded_at', ascending: false });
        this.incidents = await window.DataStore.getAll('incident_records', { orderBy: 'recorded_at', ascending: false });
        this.applyFilters();
    }

    applyFilters() {
        this.filteredRisks = this.risks.filter(item => {
            if (this.filters.search) {
                const q = this.filters.search.toLowerCase();
                const matchName = (item.risk_name || '').toLowerCase().includes(q);
                const matchPlan = (item.prevention_plan || '').toLowerCase().includes(q);
                const matchMgr = (item.risk_manager || '').toLowerCase().includes(q);
                if (!matchName && !matchPlan && !matchMgr) return false;
            }

            if (this.filters.category !== 'all') {
                if (this.filters.category !== item.severity_level) return false;
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

        this.filteredIncidents = this.incidents.filter(item => {
            if (this.filters.search) {
                const q = this.filters.search.toLowerCase();
                const matchType = (item.incident_type || '').toLowerCase().includes(q);
                const matchDesc = (item.description || '').toLowerCase().includes(q);
                if (!matchType && !matchDesc) return false;
            }

            // ตัวกรองวันที่เหตุการณ์
            if (window.App && window.App.matchDateFilter) {
                const incDate = item.incident_date || item.recorded_at;
                if (!window.App.matchDateFilter(incDate, this.filters)) return false;
            }

            return true;
        });

        // จัดเรียงข้อมูลตามคอลัมน์และลำดับที่เลือก
        if (window.App && window.App.sortData) {
            this.filteredRisks = window.App.sortData(this.filteredRisks, this.sortField, this.sortDir);
            window.App.updateTableSortUI('table-risk-body', this.sortField, this.sortDir);

            this.filteredIncidents = window.App.sortData(this.filteredIncidents, this.sortField, this.sortDir);
            window.App.updateTableSortUI('table-incident-body', this.sortField, this.sortDir);
        }

        this.renderRiskTable(this.filteredRisks);
        this.renderIncidentTable(this.filteredIncidents);
        this.updateTotalBadge();
    }

    resetFilters() {
        this.filters = { search: '', category: 'all', building: 'all', startDate: '', endDate: '', year: 'all', month: 'all' };
        const ids = ['filter-risk-search', 'filter-risk-category', 'filter-risk-start-date', 'filter-risk-end-date', 'filter-risk-year', 'filter-risk-month'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = el.tagName === 'SELECT' ? 'all' : '';
        });
        this.setActivePill('pill-risk-all');
        this.applyFilters();
        Swal.fire({
            icon: 'info',
            title: 'แสดงข้อมูลความเสี่ยงทั้งหมด',
            text: 'ล้างตัวกรองเรียบร้อยแล้ว',
            timer: 900,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
        });
    }

    renderRiskTable(list) {
        const tbody = document.getElementById('table-risk-body');
        if (!tbody) return;

        const totalItems = list ? list.length : 0;
        const highRiskCount = list ? list.filter(item => item.severity_level === 'สูง' || item.severity_level === 'สูงมาก').length : 0;
        const medRiskCount = list ? list.filter(item => item.severity_level === 'ปานกลาง' || item.severity_level === 'กลาง').length : 0;
        const lowRiskCount = list ? list.filter(item => item.severity_level === 'ต่ำ' || item.severity_level === 'ต่ำมาก').length : 0;
        const activeRiskCount = list ? list.filter(item => item.status !== 'ยุติความเสี่ยง' && item.status !== 'ควบคุมได้แล้ว').length : 0;

        if (!list || list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" class="text-center py-6 text-slate-500">ไม่พบรายการความเสี่ยง</td></tr>`;
            const tfoot = document.getElementById('table-risk-foot');
            if (tfoot) tfoot.innerHTML = '';

            if (window.App && window.App.renderPagination) {
                window.App.renderPagination({
                    containerId: 'pagination-risk',
                    totalItems: 0,
                    currentPage: this.currentPage,
                    pageSize: this.pageSize,
                    summaryCards: [
                        { title: 'ความเสี่ยงทั้งหมด', value: '0 รายการ', subText: 'ตามเงื่อนไขที่กรอง', icon: 'fa-solid fa-triangle-exclamation', color: 'cyan' },
                        { title: 'ความเสี่ยงระดับสูง/วิกฤต', value: '0 รายการ', subText: 'ต้องเฝ้าระวังใกล้ชิด', icon: 'fa-solid fa-fire', color: 'rose' },
                        { title: 'สถานะมาตรการป้องกัน', value: 'ควบคุมได้ 100%', subText: 'ดำเนินการตามแผน', icon: 'fa-solid fa-shield-halved', color: 'emerald' },
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
            const rkDate = item.recorded_at || item.created_at || '-';
            const formattedDate = (window.App && rkDate !== '-') ? window.App.formatDateTime(rkDate) : rkDate;
            const rkName = item.risk_name || item.risk_title || '-';
            const rkSev = item.severity_level || item.severity || 'ปานกลาง';
            const isHigh = rkSev === 'สูง' || rkSev === 'สูงมาก' || rkSev === 'high';
            const rkImpact = item.impact || '-';
            const rkPlan = item.prevention_plan || item.mitigation_measure || '-';
            const rkStatus = item.status || 'ควบคุมได้';
            const rkMgr = item.risk_manager || item.responsible_person || '-';
            return `
                <tr>
                    <td class="text-slate-400 font-mono text-center">${globalIdx}</td>
                    <td class="font-mono text-xs text-slate-300 whitespace-nowrap">${formattedDate}</td>
                    <td class="font-semibold text-white">${rkName}</td>
                    <td><span class="badge ${isHigh ? 'badge-danger' : 'badge-warning'}">${rkSev}</span></td>
                    <td class="text-xs text-slate-300">${rkImpact}</td>
                    <td class="text-xs text-emerald-400 font-medium">${rkPlan}</td>
                    <td><span class="badge badge-success">${rkStatus}</span></td>
                    <td class="text-xs text-slate-300">${rkMgr}</td>
                    <td class="text-center">
                        <div class="flex items-center justify-center gap-1.5">
                            ${item.image_url ? `
                                <button class="btn btn-outline btn-icon btn-sm text-emerald-400 hover:text-white" onclick="window.RiskIncidentModule.openRiskFile('${item.id}')" title="เปิดดู/ดาวน์โหลดเอกสารหรือรูปภาพแนบ">
                                    <i class="fa-solid fa-paperclip"></i>
                                </button>
                            ` : ''}
                            <button class="btn btn-outline btn-icon btn-sm text-blue-400 hover:text-white" onclick="window.RiskIncidentModule.viewRiskDetails('${item.id}')" title="ดูรายละเอียด">
                                <i class="fa-solid fa-eye"></i>
                            </button>
                            <button class="btn btn-outline btn-icon btn-sm text-amber-400 hover:text-white" onclick="window.RiskIncidentModule.openEditRiskModal('${item.id}')" title="แก้ไข">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button class="btn btn-outline btn-icon btn-sm text-rose-400 hover:text-white" onclick="window.RiskIncidentModule.deleteRiskRecord('${item.id}')" title="ลบ">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Render Table Footer Summary Row
        const tfoot = document.getElementById('table-risk-foot');
        if (tfoot) {
            tfoot.innerHTML = `
                <tr class="table-summary-row border-t-2 border-emerald-500/50">
                    <td class="text-center font-bold text-emerald-400 py-3.5"><i class="fa-solid fa-calculator"></i> รวม</td>
                    <td colspan="2" class="font-bold text-emerald-300 py-3.5">
                        <span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> ผลรวมทั้งสิ้น (${totalItems.toLocaleString()} รายการ):</span>
                    </td>
                    <td class="font-bold text-rose-400 py-3.5 text-xs">
                        ${highRiskCount > 0 ? `<span class="badge badge-danger text-xs py-1 px-2">ความเสี่ยงสูง ${highRiskCount} รายการ</span>` : '<span class="badge badge-success text-xs py-1 px-2">ปกติไม่มีความเสี่ยงสูง</span>'}
                    </td>
                    <td colspan="3" class="text-xs text-emerald-300 py-3.5">มีแผนควบคุมและแก้ไขครบทุกรายการ</td>
                    <td colspan="2" class="text-xs text-slate-400 text-center py-3.5">ติดตามผลต่อเนื่อง</td>
                </tr>
            `;
        }

        // Summary Cards Configuration
        const summaryCards = [
            {
                title: 'บันทึกประเมินความเสี่ยง',
                value: `${totalItems.toLocaleString()} รายการ`,
                subText: 'ตามตัวกรองที่เลือก',
                icon: 'fa-solid fa-shield-halved',
                color: 'cyan'
            },
            {
                title: 'ความเสี่ยงสูง (+) VS ต่ำ/กลาง (-)',
                value: `สูง: ${highRiskCount} / ต่ำ-กลาง: ${lowRiskCount + medRiskCount}`,
                subText: 'ระดับความเสี่ยงตามเกณฑ์ สร.',
                icon: 'fa-solid fa-right-left',
                color: 'blue'
            },
            {
                title: 'สถานะมาตรการป้องกัน (SAFE)',
                value: 'ควบคุมได้ 100%',
                subText: 'มีมาตรการลดความเสี่ยงทุกจุด',
                icon: 'fa-solid fa-circle-check',
                color: 'emerald'
            },
            {
                title: 'ความเสี่ยงระดับสูง/วิกฤต',
                value: `${highRiskCount} รายการ`,
                subText: 'ต้องเฝ้าระวังและติดตามใกล้ชิด',
                icon: 'fa-solid fa-triangle-exclamation',
                color: 'rose'
            }
        ];

        if (window.App && window.App.renderPagination) {
            window.App.renderPagination({
                containerId: 'pagination-risk',
                totalItems: totalItems,
                currentPage: this.currentPage,
                pageSize: this.pageSize,
                summaryCards: summaryCards,
                onPageChange: (p) => {
                    this.currentPage = p;
                    this.renderRiskTable(this.filteredRisks);
                },
                onPageSizeChange: (s) => {
                    this.pageSize = s;
                    this.currentPage = 1;
                    const sizeEl = document.getElementById('filter-risk-page-size');
                    if (sizeEl) sizeEl.value = String(s);
                    this.renderRiskTable(this.filteredRisks);
                }
            });
        }
    }

    renderIncidentTable(list) {
        const tbody = document.getElementById('table-incident-body');
        if (!tbody) return;

        const totalItems = list ? list.length : 0;
        const resolvedCount = list ? list.filter(item => item.resolution_status === 'แก้ไขแล้ว' || item.resolution_status === 'เสร็จสิ้น').length : 0;
        const pendingCount = totalItems - resolvedCount;

        if (!list || list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-500">ไม่มีประวัติเหตุการณ์ผิดปกติ</td></tr>`;
            const tfoot = document.getElementById('table-incident-foot');
            if (tfoot) tfoot.innerHTML = '';

            if (window.App && window.App.renderPagination) {
                window.App.renderPagination({
                    containerId: 'pagination-incident',
                    totalItems: 0,
                    currentPage: 1,
                    pageSize: 'all',
                    summaryCards: [
                        { title: 'เหตุการณ์ผิดปกติทั้งหมด', value: '0 เหตุการณ์', subText: 'ประวัติอุบัติการณ์', icon: 'fa-solid fa-bell', color: 'cyan' },
                        { title: 'สถานะแก้ไขแล้วเสร็จ', value: '100%', subText: 'แก้ไขเรียบร้อย 0 รายการ', icon: 'fa-solid fa-circle-check', color: 'emerald' },
                        { title: 'เหตุการณ์รอแก้ไข/ติดตาม', value: '0 รายการ', subText: 'ไม่มีเหตุการณ์ตกค้าง', icon: 'fa-solid fa-clock-rotate-left', color: 'emerald' },
                        { title: 'ความพร้อมระบบบำบัด', value: 'พร้อม 100%', subText: 'ไม่มีรายงานฉุกเฉิน', icon: 'fa-solid fa-shield-check', color: 'purple' }
                    ]
                });
            }
            return;
        }

        tbody.innerHTML = list.map((item, idx) => {
            const incDate = item.recorded_at || item.incident_date;
            const incType = item.incident_type || item.incident_title || 'เหตุการณ์ขัดข้องทั่วไป';
            const incDesc = item.description || item.root_cause || item.location || '-';
            const incAction = item.action_taken || item.corrective_action || '-';
            const incStatus = item.resolution_status || item.status || 'แก้ไขแล้ว';
            const statusClass = (incStatus.includes('แก้ไขแล้ว') || incStatus === 'resolved' || incStatus === 'เสร็จสิ้น') ? 'badge-success' : 'badge-warning';
            return `
            <tr>
                <td class="text-slate-400 font-mono text-center">${idx + 1}</td>
                <td class="font-mono text-xs text-slate-300">${window.App ? window.App.formatDateTime(incDate) : incDate}</td>
                <td class="font-semibold text-white">${incType}</td>
                <td class="text-xs text-slate-300">${incDesc}</td>
                <td class="text-xs text-cyan-400">${incAction}</td>
                <td><span class="badge ${statusClass}">${incStatus}</span></td>
                <td class="text-center">
                    <div class="flex items-center justify-center gap-1.5">
                        ${item.image_url ? `
                            <button class="btn btn-outline btn-icon btn-sm text-emerald-400 hover:text-white" onclick="window.RiskIncidentModule.openIncidentFile('${item.id}')" title="เปิดดู/ดาวน์โหลดภาพหรือเอกสารแนบ">
                                <i class="fa-solid fa-paperclip"></i>
                            </button>
                        ` : ''}
                        <button class="btn btn-outline btn-icon btn-sm text-blue-400 hover:text-white" onclick="window.RiskIncidentModule.viewIncidentDetails('${item.id}')" title="ดูรายละเอียด">
                            <i class="fa-solid fa-eye"></i>
                        </button>
                        <button class="btn btn-outline btn-icon btn-sm text-amber-400 hover:text-white" onclick="window.RiskIncidentModule.openEditIncidentModal('${item.id}')" title="แก้ไข">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button class="btn btn-outline btn-icon btn-sm text-rose-400 hover:text-white" onclick="window.RiskIncidentModule.deleteIncidentRecord('${item.id}')" title="ลบ">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            </tr>
            `;
        }).join('');

        // Render Table Footer Summary Row
        const tfoot = document.getElementById('table-incident-foot');
        if (tfoot) {
            tfoot.innerHTML = `
                <tr class="table-summary-row border-t-2 border-emerald-500/50">
                    <td class="text-center font-bold text-emerald-400 py-3.5"><i class="fa-solid fa-calculator"></i> รวม</td>
                    <td colspan="2" class="font-bold text-emerald-300 py-3.5">
                        <span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> รวมเหตุการณ์ทั้งหมด (${totalItems.toLocaleString()} รายการ):</span>
                    </td>
                    <td colspan="2" class="text-xs text-slate-300 py-3.5">แก้ไขแล้วเสร็จ ${resolvedCount} รายการ (${totalItems > 0 ? ((resolvedCount / totalItems) * 100).toFixed(1) : 100}%)</td>
                    <td class="font-bold text-emerald-400 py-3.5 text-xs">
                        ${pendingCount > 0 ? `<span class="badge badge-warning text-xs py-1 px-2">รอติดตาม ${pendingCount}</span>` : '<span class="badge badge-success text-xs py-1 px-2">แก้ไขครบ 100%</span>'}
                    </td>
                    <td></td>
                </tr>
            `;
        }

        // Summary Cards Configuration for Incidents
        const resolvedPct = totalItems > 0 ? Math.round((resolvedCount / totalItems) * 100) : 100;
        const summaryCards = [
            {
                title: 'เหตุการณ์ผิดปกติทั้งหมด',
                value: `${totalItems.toLocaleString()} เหตุการณ์`,
                subText: 'ประวัติอุบัติการณ์ในระบบ',
                icon: 'fa-solid fa-bell',
                color: 'cyan'
            },
            {
                title: 'สถานะแก้ไขแล้วเสร็จ',
                value: `${resolvedPct}% (${resolvedCount} เรื่อง)`,
                subText: 'แก้ไขและควบคุมเรียบร้อย',
                icon: 'fa-solid fa-circle-check',
                color: 'emerald'
            },
            {
                title: 'เหตุการณ์รอแก้ไข/ติดตาม',
                value: `${pendingCount} เรื่อง`,
                subText: pendingCount > 0 ? 'ต้องติดตามเร่งด่วน' : 'ไม่มีเหตุการณ์ตกค้าง',
                icon: 'fa-solid fa-clock-rotate-left',
                color: pendingCount > 0 ? 'amber' : 'emerald'
            },
            {
                title: 'ความพร้อมระบบบำบัดน้ำเสีย',
                value: 'พร้อม 100%',
                subText: 'ไม่มีรายงานฉุกเฉินวิกฤต',
                icon: 'fa-solid fa-shield-check',
                color: 'purple'
            }
        ];

        if (window.App && window.App.renderPagination) {
            window.App.renderPagination({
                containerId: 'pagination-incident',
                totalItems: totalItems,
                currentPage: 1,
                pageSize: 'all',
                summaryCards: summaryCards
            });
        }
    }

    getAttachmentTypeInfo(fileUrl = '', title = '') {
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

        // 3. Image (png, jpg, jpeg, webp, data:image/)
        if (url.startsWith('data:image/') || url.includes('.png') || url.includes('.jpg') || url.includes('.jpeg') || url.includes('.webp') ||
            t.endsWith('.png') || t.endsWith('.jpg') || t.endsWith('.jpeg') || t.endsWith('.webp')) {
            return {
                type: 'image',
                icon: 'fa-solid fa-file-image text-amber-400',
                badgeClass: 'badge-warning bg-amber-500/20 text-amber-300 border border-amber-500/40',
                badgeText: 'รูปภาพ',
                label: 'ไฟล์รูปภาพ / ภาพถ่าย',
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
            label: 'เอกสาร PDF',
            color: 'rose',
            isDocument: true
        };
    }

    openOrDownloadFile(fileUrl, fileName, fileType) {
        if (!fileUrl || fileUrl === '#' || fileUrl.trim() === '') {
            Swal.fire({
                icon: 'info',
                title: 'ไม่มีไฟล์แนบ',
                text: 'รายการนี้ยังไม่ได้อัปโหลดไฟล์หรือรูปภาพแนบ',
                confirmButtonText: 'รับทราบ',
                confirmButtonColor: '#3b82f6'
            });
            return;
        }

        const info = this.getAttachmentTypeInfo(fileUrl, fileName);
        const resolvedType = fileType || info.type;

        // 1. PDF: เปิดดูใน AttachmentManager หรือ new window
        if (resolvedType === 'pdf') {
            if (window.AttachmentManager && window.AttachmentManager.openMediaViewer) {
                window.AttachmentManager.openMediaViewer({ data: fileUrl, type: 'pdf', name: fileName || 'เอกสารแนบ' });
            } else {
                window.open(fileUrl, '_blank');
            }
            return;
        }

        // 2. Image: เปิดดูภาพขยาย
        if (resolvedType === 'image') {
            if (window.AttachmentManager && window.AttachmentManager.openMediaViewer) {
                window.AttachmentManager.openMediaViewer({ data: fileUrl, type: 'image', name: fileName || 'รูปภาพแนบ' });
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
            link.download = fileName ? (fileName.includes('.') ? fileName : `${fileName}${ext}`) : `เอกสารแนบ_${new Date().toISOString().split('T')[0]}${ext}`;
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

    processRiskFile(file) {
        if (!file) return;

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

        const fileInfo = this.getAttachmentTypeInfo(file.type, file.name);

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64Data = event.target.result;
            const fileUrlInput = document.getElementById('risk-form-image');
            if (fileUrlInput) fileUrlInput.value = base64Data;
            this.uploadedRiskAttachments = [{ data: base64Data, name: file.name, type: fileInfo.type }];

            const promptEl = document.getElementById('risk-dropzone-prompt');
            const infoEl = document.getElementById('risk-dropzone-fileinfo');
            const iconEl = document.getElementById('risk-file-type-icon');
            const nameEl = document.getElementById('risk-dropzone-filename');
            const sizeEl = document.getElementById('risk-dropzone-filesize');

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
                title: 'แนบไฟล์ประเมินความเสี่ยงสำเร็จ!',
                html: `ประเภท: <strong>${fileInfo.label}</strong><br>ไฟล์: <strong>${file.name}</strong> (${formattedSize})`,
                timer: 1500,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });
        };
        reader.readAsDataURL(file);
    }

    resetRiskDropzone() {
        const fileInput = document.getElementById('risk-file-upload-input');
        if (fileInput) fileInput.value = '';

        const fileUrlInput = document.getElementById('risk-form-image');
        if (fileUrlInput) fileUrlInput.value = '';

        this.uploadedRiskAttachments = [];

        const promptEl = document.getElementById('risk-dropzone-prompt');
        const infoEl = document.getElementById('risk-dropzone-fileinfo');
        if (promptEl) promptEl.style.display = 'block';
        if (infoEl) {
            infoEl.classList.add('hidden');
            infoEl.style.display = 'none';
        }
    }

    openRiskFile(id) {
        const item = this.risks.find(x => x.id === id);
        if (item && item.image_url) {
            this.openOrDownloadFile(item.image_url, `เอกสารประเมินความเสี่ยง_${item.risk_name || id}`);
        } else {
            Swal.fire({
                icon: 'info',
                title: 'ไม่มีไฟล์แนบ',
                text: 'รายการนี้ยังไม่ได้อัปโหลดเอกสารหรือรูปภาพแนบ',
                confirmButtonText: 'ตกลง',
                confirmButtonColor: '#10b981'
            });
        }
    }

    processIncidentFile(file) {
        if (!file) return;

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

        const fileInfo = this.getAttachmentTypeInfo(file.type, file.name);

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64Data = event.target.result;
            const fileUrlInput = document.getElementById('inc-form-image');
            if (fileUrlInput) fileUrlInput.value = base64Data;
            this.uploadedIncidentAttachments = [{ data: base64Data, name: file.name, type: fileInfo.type }];

            const promptEl = document.getElementById('inc-dropzone-prompt');
            const infoEl = document.getElementById('inc-dropzone-fileinfo');
            const iconEl = document.getElementById('inc-file-type-icon');
            const nameEl = document.getElementById('inc-dropzone-filename');
            const sizeEl = document.getElementById('inc-dropzone-filesize');

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
                title: 'แนบภาพ/รายงานเหตุการณ์สำเร็จ!',
                html: `ประเภท: <strong>${fileInfo.label}</strong><br>ไฟล์: <strong>${file.name}</strong> (${formattedSize})`,
                timer: 1500,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });
        };
        reader.readAsDataURL(file);
    }

    resetIncidentDropzone() {
        const fileInput = document.getElementById('inc-file-upload-input');
        if (fileInput) fileInput.value = '';

        const fileUrlInput = document.getElementById('inc-form-image');
        if (fileUrlInput) fileUrlInput.value = '';

        this.uploadedIncidentAttachments = [];

        const promptEl = document.getElementById('inc-dropzone-prompt');
        const infoEl = document.getElementById('inc-dropzone-fileinfo');
        if (promptEl) promptEl.style.display = 'block';
        if (infoEl) {
            infoEl.classList.add('hidden');
            infoEl.style.display = 'none';
        }
    }

    openIncidentFile(id) {
        const item = this.incidents.find(x => x.id === id);
        if (item && item.image_url) {
            this.openOrDownloadFile(item.image_url, `ภาพเหตุการณ์_${item.incident_type || id}`);
        } else {
            Swal.fire({
                icon: 'info',
                title: 'ไม่มีไฟล์แนบ',
                text: 'รายการนี้ยังไม่ได้อัปโหลดภาพถ่ายหรือเอกสารแนบ',
                confirmButtonText: 'ตกลง',
                confirmButtonColor: '#f43f5e'
            });
        }
    }

    openAddRiskModal() {
        this.editingRiskId = null;
        const modal = document.getElementById('modal-risk');
        const title = document.getElementById('modal-risk-title');
        const form = document.getElementById('form-risk');
        if (!modal || !form) return;

        form.reset();
        if (title) title.innerHTML = '<i class="fa-solid fa-triangle-exclamation text-amber-400"></i> บันทึกความเสี่ยงระบบบำบัดน้ำเสีย';

        const now = new Date();
        const localIso = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        const dtEl = document.getElementById('risk-form-datetime');
        if (dtEl) dtEl.value = localIso;

        const currentUser = (window.AuthService && typeof window.AuthService.getCurrentUser === 'function') 
            ? window.AuthService.getCurrentUser() 
            : null;
        const currentName = currentUser ? (currentUser.full_name || currentUser.username) : "";
        const mgrInput = document.getElementById('risk-form-manager');
        if (mgrInput) mgrInput.value = currentName;

        this.resetRiskDropzone();

        window.App.openModal('modal-risk');
    }

    openEditRiskModal(id) {
        const item = this.risks.find(x => x.id === id);
        if (!item) return;

        this.editingRiskId = id;
        const title = document.getElementById('modal-risk-title');
        if (title) title.innerHTML = '<i class="fa-solid fa-pen-to-square text-amber-400"></i> แก้ไขบันทึกความเสี่ยง';

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val !== undefined && val !== null ? val : '';
        };

        const rawDate = item.recorded_at || item.created_at || new Date().toISOString();
        try {
            const d = new Date(rawDate);
            const localIso = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
            setVal('risk-form-datetime', localIso);
        } catch (e) {
            setVal('risk-form-datetime', (rawDate || '').slice(0, 16));
        }

        setVal('risk-form-name', item.risk_name);
        setVal('risk-form-severity', item.severity_level || "ปานกลาง");
        setVal('risk-form-impact', item.impact);
        setVal('risk-form-likelihood', item.likelihood || "ต่ำ");
        setVal('risk-form-plan', item.prevention_plan);
        setVal('risk-form-status', item.status || "ควบคุมได้");
        setVal('risk-form-manager', item.risk_manager || "");

        this.resetRiskDropzone();
        const fileUrl = item.image_url || item.file_url || '';
        setVal('risk-form-image', fileUrl);

        if (fileUrl) {
            this.uploadedRiskAttachments = [{ data: fileUrl, name: 'เอกสารแนบความเสี่ยง', type: 'image' }];
            const fileInfo = this.getAttachmentTypeInfo(fileUrl, item.risk_name || 'ความเสี่ยง');
            const promptEl = document.getElementById('risk-dropzone-prompt');
            const infoEl = document.getElementById('risk-dropzone-fileinfo');
            const iconEl = document.getElementById('risk-file-type-icon');
            const nameEl = document.getElementById('risk-dropzone-filename');
            const sizeEl = document.getElementById('risk-dropzone-filesize');

            if (promptEl) promptEl.style.display = 'none';
            if (infoEl) {
                infoEl.classList.remove('hidden');
                infoEl.style.display = 'flex';
            }
            if (iconEl) iconEl.innerHTML = `<i class="${fileInfo.icon}"></i>`;
            if (nameEl) nameEl.textContent = `ไฟล์แนบ (${fileInfo.label})`;
            if (sizeEl) sizeEl.textContent = `${fileInfo.badgeText} • พร้อมเปิดดู / ดาวน์โหลด`;
        }

        window.App.openModal('modal-risk');
    }

    viewRiskDetails(id) {
        const item = this.risks.find(x => x.id === id);
        if (!item) return;

        const fileUrl = item.image_url || item.file_url || '';
        const fileInfo = fileUrl ? this.getAttachmentTypeInfo(fileUrl, item.risk_name) : null;
        const rkDate = item.recorded_at || item.created_at || '-';
        const formattedDate = (window.App && rkDate !== '-') ? window.App.formatDateTime(rkDate) : rkDate;

        Swal.fire({
            title: `<div class="text-base font-bold text-white"><i class="fa-solid fa-shield-halved text-rose-400"></i> รายละเอียดความเสี่ยง</div>`,
            width: '680px',
            html: `
                <div class="text-left text-xs space-y-2.5 p-3 bg-slate-900 rounded-xl border border-slate-800 text-slate-200">
                    <div class="grid grid-cols-2 gap-2 p-2 bg-slate-950/70 rounded-lg border border-slate-800">
                        <div><strong>วัน/เวลาที่บันทึก:</strong> <span class="font-mono text-cyan-300 font-semibold">${formattedDate}</span></div>
                        <div><strong>ระดับความรุนแรง:</strong> <span class="badge ${item.severity_level === 'สูง' ? 'badge-danger' : 'badge-warning'}">${item.severity_level}</span></div>
                    </div>
                    <div><strong>ชื่อความเสี่ยง:</strong> <span class="text-white font-bold">${item.risk_name}</span></div>
                    <div><strong>ผลกระทบ:</strong> ${item.impact}</div>
                    <div><strong>โอกาสเกิด:</strong> ${item.likelihood}</div>
                    <div class="p-2.5 bg-emerald-950/30 border border-emerald-800/50 rounded-lg">
                        <strong class="text-emerald-400 block mb-1">แผนป้องกันและแก้ไข:</strong>
                        <span class="text-slate-200 leading-relaxed">${item.prevention_plan}</span>
                    </div>
                    <div class="flex items-center justify-between text-slate-300">
                        <div><strong>สถานะ:</strong> <span class="badge badge-success">${item.status}</span></div>
                        <div><strong>ผู้รับผิดชอบ:</strong> <span class="text-emerald-400 font-medium">${item.risk_manager || '-'}</span></div>
                    </div>

                    ${fileUrl ? `
                        <div class="pt-2 border-t border-slate-800">
                            <strong class="text-amber-400 block mb-2"><i class="fa-solid fa-paperclip"></i> ไฟล์และเอกสารแนบ:</strong>
                            <div class="flex items-center justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                                <div class="flex items-center gap-2.5">
                                    <i class="${fileInfo.icon} text-xl"></i>
                                    <div>
                                        <div class="font-semibold text-white">${fileInfo.label}</div>
                                        <div class="text-[11px] text-slate-400 font-mono">${fileInfo.badgeText}</div>
                                    </div>
                                </div>
                                <button type="button" class="btn btn-sm btn-primary" onclick="window.RiskIncidentModule.openRiskFile('${item.id}')">
                                    <i class="fa-solid fa-arrow-up-right-from-square mr-1"></i> เปิดดู / ดาวน์โหลด
                                </button>
                            </div>
                        </div>
                    ` : ''}
                </div>
            `,
            confirmButtonText: 'ปิดหน้าต่าง',
            confirmButtonColor: '#3b82f6'
        });
    }

    async deleteRiskRecord(id) {
        const result = await Swal.fire({
            title: 'ยืนยันการลบรายการความเสี่ยงนี้?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#334155',
            confirmButtonText: 'ใช่, ลบรายการ',
            cancelButtonText: 'ยกเลิก'
        });

        if (result.isConfirmed) {
            await window.DataStore.delete('risk_management', id);
            Swal.fire({ icon: 'success', title: 'ลบข้อมูลสำเร็จ', timer: 1200, showConfirmButton: false });
            await this.loadData();
        }
    }

    async deleteIncidentRecord(id) {
        const result = await Swal.fire({
            title: 'ยืนยันการลบเหตุการณ์นี้?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#334155',
            confirmButtonText: 'ใช่, ลบรายการ',
            cancelButtonText: 'ยกเลิก'
        });

        if (result.isConfirmed) {
            await window.DataStore.delete('incident_records', id);
            Swal.fire({ icon: 'success', title: 'ลบข้อมูลสำเร็จ', timer: 1200, showConfirmButton: false });
            await this.loadData();
        }
    }

    async saveRiskData() {
        const form = document.getElementById('form-risk');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const currentUser = (window.AuthService && typeof window.AuthService.getCurrentUser === 'function') 
            ? window.AuthService.getCurrentUser() 
            : null;
        const currentName = currentUser ? (currentUser.full_name || currentUser.username) : 'ผู้ดูแลระบบ';
        const mgrInput = document.getElementById('risk-form-manager');
        const managerName = (mgrInput && mgrInput.value && mgrInput.value.trim()) ? mgrInput.value.trim() : currentName;

        let riskFileVal = document.getElementById('risk-form-image')?.value?.trim() || null;
        if (!riskFileVal && window.AttachmentManager && this.uploadedRiskAttachments && this.uploadedRiskAttachments.length > 0) {
            riskFileVal = window.AttachmentManager.serializeAttachments(this.uploadedRiskAttachments, false);
        } else if (!riskFileVal && this.uploadedRiskAttachments && this.uploadedRiskAttachments.length > 0) {
            riskFileVal = this.uploadedRiskAttachments[0].data;
        }

        const dtEl = document.getElementById('risk-form-datetime');
        let recordedAtVal = new Date().toISOString();
        if (dtEl && dtEl.value) {
            try {
                recordedAtVal = new Date(dtEl.value).toISOString();
            } catch (e) {
                recordedAtVal = dtEl.value;
            }
        }

        const rkNameVal = document.getElementById('risk-form-name').value.trim();
        const rkSevVal = document.getElementById('risk-form-severity').value;
        const rkImpactVal = document.getElementById('risk-form-impact').value.trim();
        const rkLikeVal = document.getElementById('risk-form-likelihood').value;
        const rkPlanVal = document.getElementById('risk-form-plan').value.trim();
        const rkStatusVal = document.getElementById('risk-form-status').value;

        const payload = {
            recorded_at: recordedAtVal,
            risk_name: rkNameVal,
            risk_title: rkNameVal,
            severity_level: rkSevVal,
            severity: rkSevVal,
            impact: rkImpactVal,
            likelihood: rkLikeVal,
            prevention_plan: rkPlanVal,
            mitigation_measure: rkPlanVal,
            status: rkStatusVal,
            risk_manager: managerName,
            responsible_person: managerName,
            image_url: riskFileVal
        };

        Swal.fire({ title: 'กำลังบันทึกข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        try {
            let res;
            if (this.editingRiskId) {
                res = await window.DataStore.update('risk_management', this.editingRiskId, payload);
            } else {
                res = await window.DataStore.insert('risk_management', payload);
            }

            window.App.closeModal('modal-risk');
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
            Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: err.message });
        }
    }

    openAddIncidentModal() {
        this.editingIncidentId = null;
        const form = document.getElementById('form-incident');
        if (form) form.reset();
        const title = document.getElementById('modal-incident-title');
        if (title) title.innerHTML = '<i class="fa-solid fa-bell text-rose-400"></i> บันทึกเหตุการณ์ผิดปกติ';

        const now = new Date();
        const localIso = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        const dtEl = document.getElementById('inc-form-datetime');
        if (dtEl) dtEl.value = localIso;

        const reporterEl = document.getElementById('inc-form-reporter');
        const currentUser = window.AuthService?.getCurrentUser();
        if (reporterEl) reporterEl.value = currentUser?.full_name || currentUser?.username || 'เจ้าหน้าที่ประจำเวร';

        this.resetIncidentDropzone();

        window.App.openModal('modal-incident');
    }

    openEditIncidentModal(id) {
        const item = this.incidents.find(x => x.id === id);
        if (!item) return;

        this.editingIncidentId = id;
        const title = document.getElementById('modal-incident-title');
        if (title) title.innerHTML = '<i class="fa-solid fa-pen-to-square text-amber-400"></i> แก้ไขบันทึกเหตุการณ์ผิดปกติ';

        const setVal = (fieldId, val) => {
            const el = document.getElementById(fieldId);
            if (el) el.value = val !== undefined && val !== null ? val : '';
        };

        const rawDate = item.recorded_at || item.incident_date || new Date().toISOString();
        const localIso = new Date(new Date(rawDate).getTime() - (new Date(rawDate).getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        setVal('inc-form-datetime', localIso);
        setVal('inc-form-type', item.incident_type || item.incident_title || '');
        setVal('inc-form-severity', item.severity || item.severity_level || 'เล็กน้อย');
        setVal('inc-form-status', item.resolution_status || item.status || 'รอดำเนินการ');
        setVal('inc-form-desc', item.description || item.root_cause || '');
        setVal('inc-form-action', item.action_taken || item.corrective_action || '');
        setVal('inc-form-reporter', item.reporter || item.reported_by || '');

        this.resetIncidentDropzone();
        const fileUrl = item.image_url || item.file_url || '';
        setVal('inc-form-image', fileUrl);

        if (fileUrl) {
            this.uploadedIncidentAttachments = [{ data: fileUrl, name: 'ไฟล์แนบเหตุการณ์', type: 'image' }];
            const fileInfo = this.getAttachmentTypeInfo(fileUrl, item.incident_type || 'เหตุการณ์');
            const promptEl = document.getElementById('inc-dropzone-prompt');
            const infoEl = document.getElementById('inc-dropzone-fileinfo');
            const iconEl = document.getElementById('inc-file-type-icon');
            const nameEl = document.getElementById('inc-dropzone-filename');
            const sizeEl = document.getElementById('inc-dropzone-filesize');

            if (promptEl) promptEl.style.display = 'none';
            if (infoEl) {
                infoEl.classList.remove('hidden');
                infoEl.style.display = 'flex';
            }
            if (iconEl) iconEl.innerHTML = `<i class="${fileInfo.icon}"></i>`;
            if (nameEl) nameEl.textContent = `ไฟล์แนบ (${fileInfo.label})`;
            if (sizeEl) sizeEl.textContent = `${fileInfo.badgeText} • พร้อมเปิดดู / ดาวน์โหลด`;
        }

        window.App.openModal('modal-incident');
    }

    viewIncidentDetails(id) {
        const item = this.incidents.find(x => x.id === id);
        if (!item) return;

        const fileUrl = item.image_url || item.file_url;
        const fileInfo = fileUrl ? this.getAttachmentTypeInfo(fileUrl, item.incident_type) : null;
        const incDate = item.recorded_at || item.incident_date;

        Swal.fire({
            title: `<div class="text-base font-bold text-white"><i class="fa-solid fa-bell text-rose-400"></i> รายละเอียดเหตุการณ์ผิดปกติ</div>`,
            width: '680px',
            html: `
                <div class="text-left text-xs space-y-2.5 p-3 bg-slate-900 rounded-xl border border-slate-800 text-slate-200">
                    <div class="grid grid-cols-2 gap-2 p-2 bg-slate-950/70 rounded-lg border border-slate-800">
                        <div><strong>ประเภทเหตุการณ์:</strong> <span class="text-white font-bold">${item.incident_type || '-'}</span></div>
                        <div><strong>ความรุนแรง:</strong> <span class="badge ${item.severity === 'วิกฤต' || item.severity === 'รุนแรง' ? 'badge-danger' : 'badge-warning'}">${item.severity || '-'}</span></div>
                        <div><strong>วัน/เวลาที่เกิดเหตุ:</strong> <span class="font-mono text-cyan-400">${window.App ? window.App.formatDateTime(incDate) : incDate}</span></div>
                        <div><strong>สถานะการแก้ไข:</strong> <span class="badge ${item.resolution_status === 'แก้ไขแล้วเสร็จ' || item.resolution_status === 'แก้ไขแล้ว' ? 'badge-success' : 'badge-warning'}">${item.resolution_status || '-'}</span></div>
                    </div>
                    <div><strong>รายละเอียดเหตุการณ์:</strong> <span class="text-slate-300">${item.description || '-'}</span></div>
                    <div class="p-2.5 bg-emerald-950/30 border border-emerald-800/50 rounded-lg">
                        <strong class="text-emerald-400 block mb-1">การดำเนินการแก้ไข:</strong>
                        <span class="text-slate-200 leading-relaxed">${item.action_taken || '-'}</span>
                    </div>
                    <div class="flex items-center justify-between text-slate-300">
                        <div><strong>ผู้รายงาน / เจ้าหน้าที่เวร:</strong> <span class="text-emerald-400 font-medium">${item.reporter || item.reported_by || '-'}</span></div>
                    </div>

                    ${fileUrl ? `
                        <div class="pt-2 border-t border-slate-800">
                            <strong class="text-amber-400 block mb-2"><i class="fa-solid fa-paperclip"></i> ไฟล์และรูปภาพแนบ:</strong>
                            <div class="flex items-center justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                                <div class="flex items-center gap-2.5">
                                    <i class="${fileInfo.icon} text-xl"></i>
                                    <div>
                                        <div class="font-semibold text-white">${fileInfo.label}</div>
                                        <div class="text-[11px] text-slate-400 font-mono">${fileInfo.badgeText}</div>
                                    </div>
                                </div>
                                <button type="button" class="btn btn-sm btn-primary" onclick="window.RiskIncidentModule.openIncidentFile('${item.id}')">
                                    <i class="fa-solid fa-arrow-up-right-from-square mr-1"></i> เปิดดู / ดาวน์โหลด
                                </button>
                            </div>
                        </div>
                    ` : ''}
                </div>
            `,
            confirmButtonText: 'ปิดหน้าต่าง',
            confirmButtonColor: '#3b82f6'
        });
    }

    async saveIncidentData() {
        const form = document.getElementById('form-incident');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        let incFileVal = document.getElementById('inc-form-image')?.value?.trim() || null;
        if (!incFileVal && window.AttachmentManager && this.uploadedIncidentAttachments && this.uploadedIncidentAttachments.length > 0) {
            incFileVal = window.AttachmentManager.serializeAttachments(this.uploadedIncidentAttachments, false);
        } else if (!incFileVal && this.uploadedIncidentAttachments && this.uploadedIncidentAttachments.length > 0) {
            incFileVal = this.uploadedIncidentAttachments[0].data;
        }

        const incDate = document.getElementById('inc-form-datetime').value ? new Date(document.getElementById('inc-form-datetime').value).toISOString() : new Date().toISOString();
        const incType = document.getElementById('inc-form-type').value;
        const incSev = document.getElementById('inc-form-severity').value;
        const incDesc = document.getElementById('inc-form-desc').value.trim();
        const incAction = document.getElementById('inc-form-action').value.trim();
        const incStatus = document.getElementById('inc-form-status').value;
        const incReporter = document.getElementById('inc-form-reporter')?.value?.trim() || window.AuthService?.getCurrentUser()?.full_name || 'เจ้าหน้าที่';

        const payload = {
            recorded_at: incDate,
            incident_date: incDate,
            incident_type: incType,
            incident_title: incType,
            severity: incSev,
            severity_level: incSev,
            description: incDesc,
            root_cause: incDesc,
            action_taken: incAction,
            corrective_action: incAction,
            resolution_status: incStatus,
            status: incStatus,
            reporter: incReporter,
            reported_by: incReporter,
            image_url: incFileVal
        };

        Swal.fire({ title: 'กำลังบันทึกข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        try {
            let res;
            if (this.editingIncidentId) {
                res = await window.DataStore.update('incident_records', this.editingIncidentId, payload);
                this.editingIncidentId = null;
            } else {
                res = await window.DataStore.insert('incident_records', payload);
            }

            window.App.closeModal('modal-incident');
            await this.loadData();

            if (res && res.savedSupabase) {
                Swal.fire({
                    icon: 'success',
                    title: 'บันทึกเหตุการณ์สำเร็จ!',
                    html: '<span class="text-xs text-emerald-400 font-bold"><i class="fa-solid fa-cloud-arrow-up"></i> ซิงค์ลง Supabase สำเร็จ</span>',
                    timer: 1500,
                    showConfirmButton: false
                });
            } else {
                Swal.fire({ icon: 'success', title: 'บันทึกเหตุการณ์สำเร็จ', timer: 1200, showConfirmButton: false });
            }
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: err.message });
        }
    }

    exportExcel() {
        const data = this.filteredRisks.map(item => ({
            'วัน-เวลาที่บันทึก': window.App ? window.App.formatDateTime(item.recorded_at || item.created_at) : (item.recorded_at || item.created_at || '-'),
            'ชื่อความเสี่ยง': item.risk_name,
            'ระดับความรุนแรง': item.severity_level,
            'ผลกระทบ': item.impact,
            'โอกาสเกิด': item.likelihood,
            'แผนป้องกันและแก้ไข': item.prevention_plan,
            'สถานะ': item.status,
            'ผู้รับผิดชอบ': item.risk_manager
        }));
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, "บริหารความเสี่ยง");
        XLSX.writeFile(wb, `รายงานความเสี่ยง_รพ.๕๐พรรษา_${new Date().toISOString().split('T')[0]}.xlsx`);
        Swal.fire({ icon: 'success', title: 'ส่งออก Excel เรียบร้อย', timer: 1200, showConfirmButton: false });
    }

    exportCSV() {
        const data = this.filteredRisks.map(item => ({
            'วัน-เวลาที่บันทึก': window.App ? window.App.formatDateTime(item.recorded_at || item.created_at) : (item.recorded_at || item.created_at || '-'),
            'ชื่อความเสี่ยง': item.risk_name,
            'ระดับความรุนแรง': item.severity_level,
            'ผลกระทบ': item.impact,
            'แผนป้องกัน': item.prevention_plan,
            'สถานะ': item.status,
            'ผู้รับผิดชอบ': item.risk_manager
        }));
        window.ExportImportModule.exportModuleCSV('รายงานความเสี่ยง_รพ.๕๐พรรษา', data);
    }

    exportPDF() {
        window.print();
    }

    previewData() {
        const totalItems = this.filteredRisks.length;
        const highCount = this.filteredRisks.filter(x => (x.severity_level || '').includes('สูง') || (x.severity_level || '').includes('วิกฤต')).length;
        const controlledCount = this.filteredRisks.filter(x => (x.status || '').includes('ควบคุมได้') || (x.status || '').includes('เสร็จสิ้น')).length;

        const rowsHtml = this.filteredRisks.slice(0, 5).map((item, i) => `
            <tr class="text-[11px] border-b border-slate-800">
                <td class="p-1.5 text-slate-400 font-mono text-center">${i + 1}</td>
                <td class="p-1.5 text-slate-300 font-mono">${window.App.formatDateTime(item.recorded_at || item.created_at)}</td>
                <td class="p-1.5 text-white font-medium">${item.risk_name || '-'}</td>
                <td class="p-1.5 text-center">
                    <span class="badge ${item.severity_level === 'สูง' ? 'badge-danger' : item.severity_level === 'ปานกลาง' ? 'badge-warning' : 'badge-info'} text-[10px]">${item.severity_level || '-'}</span>
                </td>
                <td class="p-1.5 text-center">
                    <span class="badge ${item.status === 'ควบคุมได้' ? 'badge-success' : 'badge-warning'} text-[10px]">${item.status || '-'}</span>
                </td>
                <td class="p-1.5 text-slate-300 text-xs">${item.risk_manager || '-'}</td>
            </tr>
        `).join('');

        Swal.fire({
            title: `<div class="text-base font-bold text-white"><i class="fa-solid fa-eye text-purple-400"></i> พรีวิวข้อมูลการบริหารความเสี่ยง (Risk Management)</div>`,
            html: `
                <div class="text-left space-y-3">
                    <div class="grid grid-cols-3 gap-2 text-center text-xs">
                        <div class="p-2 bg-slate-900 rounded border border-slate-800">
                            <span class="text-slate-400 block text-[10px]">จำนวนความเสี่ยง</span>
                            <strong class="text-white font-mono text-sm">${totalItems} รายการ</strong>
                        </div>
                        <div class="p-2 bg-slate-900 rounded border border-slate-800">
                            <span class="text-slate-400 block text-[10px]">ความเสี่ยงสูง/วิกฤต</span>
                            <strong class="${highCount > 0 ? 'text-rose-400' : 'text-slate-400'} font-mono text-sm">${highCount} รายการ</strong>
                        </div>
                        <div class="p-2 bg-slate-900 rounded border border-slate-800">
                            <span class="text-slate-400 block text-[10px]">สถานะควบคุมได้</span>
                            <strong class="text-emerald-400 font-mono text-sm">${controlledCount} รายการ</strong>
                        </div>
                    </div>
                    <div class="max-h-48 overflow-y-auto border border-slate-800 rounded bg-slate-950/60">
                        <table class="w-full text-left">
                            <thead class="text-[10px] text-slate-400 bg-slate-900/80 border-b border-slate-800 sticky top-0">
                                <tr><th class="p-1.5 text-center">#</th><th class="p-1.5">วัน-เวลา</th><th class="p-1.5">ประเด็นความเสี่ยง</th><th class="p-1.5 text-center">ระดับ</th><th class="p-1.5 text-center">สถานะ</th><th class="p-1.5">ผู้รับผิดชอบ</th></tr>
                            </thead>
                            <tbody>${rowsHtml || '<tr><td colspan="6" class="text-center py-4 text-slate-500">ไม่พบข้อมูลตามตัวกรอง</td></tr>'}</tbody>
                        </table>
                    </div>
                    ${totalItems > 5 ? `<div class="text-[11px] text-center text-slate-500">...แสดงตัวอย่าง 5 จากทั้งหมด ${totalItems} รายการ...</div>` : ''}
                </div>
            `,
            width: '650px',
            showCancelButton: true,
            confirmButtonText: '<i class="fa-solid fa-file-excel"></i> ส่งออก Excel',
            cancelButtonText: 'ปิด',
            confirmButtonColor: '#10b981',
            cancelButtonColor: '#334155'
        }).then((result) => {
            if (result.isConfirmed) {
                this.exportExcel();
            }
        });
    }
}

window.RiskIncidentModule = new RiskIncidentModule();
