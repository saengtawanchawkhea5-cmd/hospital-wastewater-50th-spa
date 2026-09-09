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

        // ผูก Universal Attachment Manager สำหรับความเสี่ยง (Risk Attachments)
        if (window.AttachmentManager) {
            window.AttachmentManager.bindFormAttachments({
                moduleInstance: this,
                itemsProperty: 'uploadedRiskAttachments',
                containerId: 'risk-image-gallery-container',
                fileInputId: 'risk-file-upload-input',
                browseBtnId: 'btn-risk-browse-files',
                cameraInputId: 'risk-file-camera-input',
                cameraBtnId: 'btn-risk-open-camera',
                urlInputId: 'risk-form-image-url-input',
                addUrlBtnId: 'btn-risk-add-url-image',
                clearBtnId: 'btn-risk-clear-all-images',
                badgeId: 'risk-image-count-badge',
                themeColor: 'amber',
                singleMode: false
            });

            // ผูก Universal Attachment Manager สำหรับอุบัติการณ์ (Incident Attachments)
            window.AttachmentManager.bindFormAttachments({
                moduleInstance: this,
                itemsProperty: 'uploadedIncidentAttachments',
                containerId: 'inc-image-gallery-container',
                fileInputId: 'inc-file-upload-input',
                browseBtnId: 'btn-inc-browse-files',
                cameraInputId: 'inc-file-camera-input',
                cameraBtnId: 'btn-inc-open-camera',
                urlInputId: 'inc-form-image-url-input',
                addUrlBtnId: 'btn-inc-add-url-image',
                clearBtnId: 'btn-inc-clear-all-images',
                badgeId: 'inc-image-count-badge',
                themeColor: 'rose',
                singleMode: false
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
        const activeRiskCount = list ? list.filter(item => item.status !== 'ยุติความเสี่ยง' && item.status !== 'ควบคุมได้แล้ว').length : 0;

        if (!list || list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-slate-500">ไม่พบรายการความเสี่ยง</td></tr>`;
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
            const isHigh = item.severity_level === 'สูง' || item.severity_level === 'สูงมาก';
            return `
                <tr>
                    <td class="text-slate-400 font-mono text-center">${globalIdx}</td>
                    <td class="font-semibold text-white">${item.risk_name}</td>
                    <td><span class="badge ${isHigh ? 'badge-danger' : 'badge-warning'}">${item.severity_level}</span></td>
                    <td class="text-xs text-slate-300">${item.impact}</td>
                    <td class="text-xs text-emerald-400 font-medium">${item.prevention_plan}</td>
                    <td><span class="badge badge-success">${item.status}</span></td>
                    <td class="text-xs text-slate-300">${item.risk_manager || '-'}</td>
                    <td class="text-center">
                        <div class="flex items-center justify-center gap-1.5">
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
                    <td class="font-bold text-emerald-300 py-3.5">
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

        tbody.innerHTML = list.map((item, idx) => `
            <tr>
                <td class="text-slate-400 font-mono text-center">${idx + 1}</td>
                <td class="font-mono text-xs text-slate-300">${window.App.formatDateTime(item.incident_date || item.recorded_at)}</td>
                <td class="font-semibold text-white">${item.incident_type}</td>
                <td class="text-xs text-slate-300">${item.description}</td>
                <td class="text-xs text-cyan-400">${item.action_taken || '-'}</td>
                <td><span class="badge badge-success">${item.resolution_status}</span></td>
                <td class="text-center">
                    <button class="btn btn-outline btn-icon btn-sm text-rose-400 hover:text-white" onclick="window.RiskIncidentModule.deleteIncidentRecord('${item.id}')" title="ลบ">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            </tr>
        `).join('');

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
                containerId: 'pagination-incident',
                totalItems: totalItems,
                currentPage: 1,
                pageSize: 'all',
                summaryCards: summaryCards
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
        title.innerHTML = '<i class="fa-solid fa-triangle-exclamation text-amber-400"></i> บันทึกความเสี่ยงระบบบำบัดน้ำเสีย';

        const currentUser = (window.AuthService && typeof window.AuthService.getCurrentUser === 'function') 
            ? window.AuthService.getCurrentUser() 
            : null;
        const currentName = currentUser ? (currentUser.full_name || currentUser.username) : "";
        const mgrInput = document.getElementById('risk-form-manager');
        if (mgrInput) mgrInput.value = currentName;

        this.uploadedRiskAttachments = [];
        if (window.AttachmentManager) {
            window.AttachmentManager.updateContainerDisplay(this, 'uploadedRiskAttachments', 'risk-image-gallery-container', 'risk-image-count-badge', 'amber', false);
        }

        window.App.openModal('modal-risk');
    }

    openEditRiskModal(id) {
        const item = this.risks.find(x => x.id === id);
        if (!item) return;

        this.editingRiskId = id;
        const title = document.getElementById('modal-risk-title');
        title.innerHTML = '<i class="fa-solid fa-pen-to-square text-amber-400"></i> แก้ไขบันทึกความเสี่ยง';

        document.getElementById('risk-form-name').value = item.risk_name;
        document.getElementById('risk-form-severity').value = item.severity_level || "ปานกลาง";
        document.getElementById('risk-form-impact').value = item.impact;
        document.getElementById('risk-form-likelihood').value = item.likelihood || "ต่ำ";
        document.getElementById('risk-form-plan').value = item.prevention_plan;
        document.getElementById('risk-form-status').value = item.status || "ควบคุมได้";
        document.getElementById('risk-form-manager').value = item.risk_manager || "";

        this.uploadedRiskAttachments = window.AttachmentManager 
            ? window.AttachmentManager.normalizeAttachments(item.image_url || item.file_url) 
            : [];
        if (window.AttachmentManager) {
            window.AttachmentManager.updateContainerDisplay(this, 'uploadedRiskAttachments', 'risk-image-gallery-container', 'risk-image-count-badge', 'amber', false);
        }

        window.App.openModal('modal-risk');
    }

    viewRiskDetails(id) {
        const item = this.risks.find(x => x.id === id);
        if (!item) return;

        const attachments = window.AttachmentManager 
            ? window.AttachmentManager.normalizeAttachments(item.image_url || item.file_url) 
            : [];

        Swal.fire({
            title: `<div class="text-base font-bold text-white"><i class="fa-solid fa-shield-halved text-rose-400"></i> รายละเอียดความเสี่ยง</div>`,
            width: '680px',
            html: `
                <div class="text-left text-xs space-y-2.5 p-3 bg-slate-900 rounded-xl border border-slate-800 text-slate-200">
                    <div class="grid grid-cols-2 gap-2 p-2 bg-slate-950/70 rounded-lg border border-slate-800">
                        <div><strong>ชื่อความเสี่ยง:</strong> <span class="text-white font-bold">${item.risk_name}</span></div>
                        <div><strong>ระดับความรุนแรง:</strong> <span class="badge ${item.severity_level === 'สูง' ? 'badge-danger' : 'badge-warning'}">${item.severity_level}</span></div>
                    </div>
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

        let riskFileVal = null;
        if (window.AttachmentManager && this.uploadedRiskAttachments && this.uploadedRiskAttachments.length > 0) {
            riskFileVal = window.AttachmentManager.serializeAttachments(this.uploadedRiskAttachments, false);
        }

        const payload = {
            risk_name: document.getElementById('risk-form-name').value.trim(),
            severity_level: document.getElementById('risk-form-severity').value,
            impact: document.getElementById('risk-form-impact').value.trim(),
            likelihood: document.getElementById('risk-form-likelihood').value,
            prevention_plan: document.getElementById('risk-form-plan').value.trim(),
            status: document.getElementById('risk-form-status').value,
            risk_manager: managerName,
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
        const form = document.getElementById('form-incident');
        if (form) form.reset();
        const now = new Date();
        const localIso = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        document.getElementById('inc-form-datetime').value = localIso;

        this.uploadedIncidentAttachments = [];
        if (window.AttachmentManager) {
            window.AttachmentManager.updateContainerDisplay(this, 'uploadedIncidentAttachments', 'inc-image-gallery-container', 'inc-image-count-badge', 'rose', false);
        }

        window.App.openModal('modal-incident');
    }

    async saveIncidentData() {
        const form = document.getElementById('form-incident');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        let incFileVal = null;
        if (window.AttachmentManager && this.uploadedIncidentAttachments && this.uploadedIncidentAttachments.length > 0) {
            incFileVal = window.AttachmentManager.serializeAttachments(this.uploadedIncidentAttachments, false);
        }

        const payload = {
            incident_date: document.getElementById('inc-form-datetime').value ? new Date(document.getElementById('inc-form-datetime').value).toISOString() : new Date().toISOString(),
            incident_type: document.getElementById('inc-form-type').value,
            severity_level: document.getElementById('inc-form-severity').value,
            description: document.getElementById('inc-form-desc').value.trim(),
            action_taken: document.getElementById('inc-form-action').value.trim(),
            resolution_status: document.getElementById('inc-form-status').value,
            reported_by: window.AuthService.getCurrentUser()?.full_name || 'เจ้าหน้าที่',
            image_url: incFileVal
        };

        const res = await window.DataStore.insert('incident_records', payload);
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
    }

    exportExcel() {
        const data = this.filteredRisks.map(item => ({
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
            'ชื่อความเสี่ยง': item.risk_name,
            'ระดับความรุนแรง': item.severity_level,
            'ผลกระทบ': item.impact,
            'แผนป้องกัน': item.prevention_plan,
            'สถานะ': item.status
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
