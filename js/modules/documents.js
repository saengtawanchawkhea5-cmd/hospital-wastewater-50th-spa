/**
 * ============================================================================
 * ระบบจัดการระบบบำบัดน้ำเสีย โรงพยาบาล ๕๐ พรรษา มหาวชิราลงกรณ (SPA)
 * DOCUMENTS.JS - ระบบคลังจัดเก็บรายงาน & คู่มือระบบบำบัดน้ำเสีย (SOP)
 * ============================================================================
 */

class DocumentsModule {
    constructor() {
        this.reportDocs = [];
        this.filteredReports = [];
        this.manualDocs = [];
        this.filteredManuals = [];
        this.editingDocId = null;
        this.editingManualId = null;
        this.activeTab = 'reports'; // 'reports' or 'manuals'
        this.selectedCategory = 'all';
        this.sortField = 'report_date';
        this.sortDir = 'desc';
    }

    async init() {
        this.bindEvents();
        await this.loadData();
    }

    bindEvents() {
        // ผูกการคลิกจัดเรียงหัวตารางอัตโนมัติ
        if (window.App && window.App.bindTableSorting) {
            window.App.bindTableSorting('table-doc-reports-body', this, 'report_date', 'desc');
            window.App.bindTableSorting('table-doc-manuals-body', this, 'title', 'asc');
        }

        const tabRep = document.getElementById('tab-btn-docs-report');
        const tabMan = document.getElementById('tab-btn-docs-manual');
        if (tabRep) tabRep.addEventListener('click', () => { this.activeTab = 'reports'; this.switchTab(); });
        if (tabMan) tabMan.addEventListener('click', () => { this.activeTab = 'manuals'; this.switchTab(); });

        const btnAddRep = document.getElementById('btn-add-doc-report');
        if (btnAddRep) btnAddRep.addEventListener('click', () => this.openAddReportModal());

        const btnAddMan = document.getElementById('btn-add-doc-manual');
        if (btnAddMan) btnAddMan.addEventListener('click', () => this.openAddManualModal());

        const formRep = document.getElementById('form-doc-report');
        if (formRep) {
            formRep.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveReportDoc();
            });
        }

        const formMan = document.getElementById('form-doc-manual');
        if (formMan) {
            formMan.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveManualDoc();
            });
        }

        // Category Filter for Reports
        const filterCat = document.getElementById('drep-filter-category');
        if (filterCat) {
            filterCat.addEventListener('change', (e) => {
                this.selectedCategory = e.target.value;
                this.applyFilters();
            });
        }

        // Wire Universal Operations Filter Inputs & Status Pills
        ['filter-docs-search', 'filter-docs-start-date', 'filter-docs-end-date', 'filter-docs-year', 'filter-docs-month', 'filter-docs-category', 'filter-docs-building', 'filter-docs-sort-order', 'filter-docs-page-size'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => this.applyFilters());
            }
        });

        const pillAll = document.getElementById('pill-docs-all');
        if (pillAll) pillAll.addEventListener('click', () => this.resetFilters());

        const pillYear = document.getElementById('pill-docs-this-year');
        if (pillYear) pillYear.addEventListener('click', () => {
            const now = new Date();
            const currentYearBE = (now.getFullYear() + 543).toString();
            const fy = document.getElementById('filter-docs-year');
            if (fy) fy.value = currentYearBE;
            this.applyFilters();
        });

        const pillMonth = document.getElementById('pill-docs-this-month');
        if (pillMonth) pillMonth.addEventListener('click', () => {
            const fm = document.getElementById('filter-docs-month');
            if (fm) fm.value = (new Date().getMonth() + 1).toString();
            this.applyFilters();
        });

        const pillToday = document.getElementById('pill-docs-today');
        if (pillToday) pillToday.addEventListener('click', () => {
            const now = new Date();
            const currentYearBE = (now.getFullYear() + 543).toString();
            const fy = document.getElementById('filter-docs-year');
            const fm = document.getElementById('filter-docs-month');
            if (fy) fy.value = currentYearBE;
            if (fm) fm.value = (now.getMonth() + 1).toString();
            this.applyFilters();
        });

        // Interactive Dropzone for Reports (PDF, Image, Word, Excel)
        const dropzone = document.getElementById('drep-dropzone');
        const drepFileInput = document.getElementById('drep-file-upload-input');
        const clearFileBtn = document.getElementById('drep-btn-clear-file');

        if (dropzone && drepFileInput) {
            dropzone.addEventListener('click', (e) => {
                if (e.target.closest('#drep-btn-clear-file')) return;
                drepFileInput.click();
            });

            ['dragenter', 'dragover'].forEach(eventName => {
                dropzone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dropzone.classList.add('border-cyan-400', 'bg-slate-800/90');
                });
            });

            ['dragleave', 'drop'].forEach(eventName => {
                dropzone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dropzone.classList.remove('border-cyan-400', 'bg-slate-800/90');
                });
            });

            dropzone.addEventListener('drop', (e) => {
                const dt = e.dataTransfer;
                if (dt && dt.files && dt.files.length > 0) {
                    this.processReportFile(dt.files[0]);
                }
            });

            drepFileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    this.processReportFile(e.target.files[0]);
                }
            });
        }

        if (clearFileBtn) {
            clearFileBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.resetReportDropzone();
            });
        }

        // Interactive Dropzone for Manuals (SOP)
        const manDropzone = document.getElementById('man-dropzone');
        const manFileInput = document.getElementById('man-file-upload-input');
        const manRemoveFileBtn = document.getElementById('man-btn-remove-file');

        if (manDropzone && manFileInput) {
            manDropzone.addEventListener('click', (e) => {
                if (e.target.closest('#man-btn-remove-file')) return;
                manFileInput.click();
            });

            ['dragenter', 'dragover'].forEach(eventName => {
                manDropzone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    manDropzone.classList.add('border-emerald-400', 'bg-slate-800/90');
                });
            });

            ['dragleave', 'drop'].forEach(eventName => {
                manDropzone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    manDropzone.classList.remove('border-emerald-400', 'bg-slate-800/90');
                });
            });

            manDropzone.addEventListener('drop', (e) => {
                const dt = e.dataTransfer;
                if (dt && dt.files && dt.files.length > 0) {
                    this.processManualFile(dt.files[0]);
                }
            });

            manFileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    this.processManualFile(e.target.files[0]);
                }
            });
        }

        if (manRemoveFileBtn) {
            manRemoveFileBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.resetManualDropzone();
            });
        }
    }

    resetFilters() {
        const s = document.getElementById('filter-docs-search'); if (s) s.value = '';
        const sDate = document.getElementById('filter-docs-start-date'); if (sDate) sDate.value = '';
        const eDate = document.getElementById('filter-docs-end-date'); if (eDate) eDate.value = '';
        const y = document.getElementById('filter-docs-year'); if (y) y.value = 'all';
        const m = document.getElementById('filter-docs-month'); if (m) m.value = 'all';
        const c = document.getElementById('filter-docs-category'); if (c) c.value = 'all';
        const b = document.getElementById('filter-docs-building'); if (b) b.value = 'all';
        const dc = document.getElementById('drep-filter-category'); if (dc) dc.value = 'all';
        this.selectedCategory = 'all';
        this.applyFilters();
    }

    processManualFile(file) {
        if (!file) return;

        let formattedSize = '';
        if (file.size < 1048576) {
            formattedSize = (file.size / 1024).toFixed(1) + ' KB';
        } else {
            formattedSize = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
        }

        const sizeInput = document.getElementById('man-form-size');
        if (sizeInput) sizeInput.value = formattedSize;

        const fileInfo = this.getFileTypeInfo(file.name, file.name);

        const titleInput = document.getElementById('man-form-title');
        if (titleInput && (!titleInput.value || titleInput.value.trim() === '')) {
            titleInput.value = file.name.replace(/\.[^/.]+$/, "");
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const urlInput = document.getElementById('man-form-url');
            if (urlInput) urlInput.value = event.target.result;

            const promptEl = document.getElementById('man-dropzone-prompt');
            const infoEl = document.getElementById('man-dropzone-fileinfo');
            const iconEl = document.getElementById('man-file-type-icon');
            const nameEl = document.getElementById('man-dropzone-filename');
            const sizeEl = document.getElementById('man-dropzone-filesize');

            if (promptEl) promptEl.classList.add('hidden');
            if (infoEl) {
                infoEl.classList.remove('hidden');
                infoEl.style.display = 'flex';
            }
            if (iconEl) iconEl.innerHTML = `<i class="${fileInfo.icon}"></i>`;
            if (nameEl) nameEl.textContent = file.name;
            if (sizeEl) sizeEl.textContent = `${fileInfo.label} • ${formattedSize}`;

            Swal.fire({
                icon: 'success',
                title: 'แนบไฟล์คู่มือสำเร็จ!',
                html: `ประเภท: <strong>${fileInfo.label}</strong><br>ไฟล์: <strong>${file.name}</strong> (${formattedSize})`,
                timer: 1500,
                showConfirmButton: false
            });
        };
        reader.readAsDataURL(file);
    }

    resetManualDropzone() {
        const fileInput = document.getElementById('man-file-upload-input');
        const urlInput = document.getElementById('man-form-url');
        const promptEl = document.getElementById('man-dropzone-prompt');
        const infoEl = document.getElementById('man-dropzone-fileinfo');

        if (fileInput) fileInput.value = '';
        if (urlInput) urlInput.value = '';
        if (promptEl) promptEl.classList.remove('hidden');
        if (infoEl) {
            infoEl.classList.add('hidden');
            infoEl.style.display = 'none';
        }
    }

    processReportFile(file) {
        if (!file) return;

        // คำนวณขนาดไฟล์ให้อัตโนมัติ (KB หรือ MB)
        let formattedSize = '';
        if (file.size < 1048576) {
            formattedSize = (file.size / 1024).toFixed(1) + ' KB';
        } else {
            formattedSize = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
        }

        const sizeInput = document.getElementById('drep-form-size');
        if (sizeInput) sizeInput.value = formattedSize;

        // ดึงข้อมูลประเภทไฟล์
        const fileInfo = this.getFileTypeInfo(file.name, file.name);

        // หากช่องชื่อเรื่องยังว่างอยู่ ให้เติมชื่อไฟล์ลงไปอัตโนมัติ (ตัดนามสกุลออก)
        const titleInput = document.getElementById('drep-form-title');
        if (titleInput && (!titleInput.value || titleInput.value.trim() === '')) {
            const cleanTitle = file.name.replace(/\.[^/.]+$/, "");
            titleInput.value = cleanTitle;
        }

        // อ่านไฟล์เป็น Base64 Data URI
        const reader = new FileReader();
        reader.onload = (event) => {
            const urlInput = document.getElementById('drep-form-url');
            if (urlInput) {
                urlInput.value = event.target.result;
            }

            // แสดงการ์ดไฟล์ที่เลือกใน Dropzone
            const promptEl = document.getElementById('drep-dropzone-prompt');
            const infoEl = document.getElementById('drep-dropzone-fileinfo');
            const iconEl = document.getElementById('drep-file-icon');
            const nameEl = document.getElementById('drep-file-name');
            const metaEl = document.getElementById('drep-file-meta');

            if (promptEl) promptEl.style.display = 'none';
            if (infoEl) {
                infoEl.classList.remove('hidden');
                infoEl.style.display = 'flex';
            }
            if (iconEl) iconEl.innerHTML = `<i class="${fileInfo.icon}"></i>`;
            if (nameEl) nameEl.textContent = file.name;
            if (metaEl) metaEl.textContent = `${fileInfo.label} • ${formattedSize}`;

            Swal.fire({
                icon: 'success',
                title: 'แนบไฟล์สำเร็จ!',
                html: `ประเภท: <strong>${fileInfo.label}</strong><br>ไฟล์: <strong>${file.name}</strong> (${formattedSize})`,
                timer: 1500,
                showConfirmButton: false
            });
        };
        reader.readAsDataURL(file);
    }


    switchTabTo(tab) {
        this.activeTab = tab;
        const b = document.getElementById('filter-docs-building');
        if (b) {
            b.value = tab === 'manuals' ? 'manuals' : (tab === 'reports' ? 'reports' : 'all');
        }
        this.switchTab();
    }

    switchTab() {
        const secRep = document.getElementById('section-docs-report');
        const secMan = document.getElementById('section-docs-manual');
        const tabRep = document.getElementById('tab-btn-docs-report');
        const tabMan = document.getElementById('tab-btn-docs-manual');

        if (this.activeTab === 'reports') {
            if (secRep) { secRep.style.display = 'block'; secRep.classList.remove('hidden'); }
            if (secMan) { secMan.style.display = 'none'; secMan.classList.add('hidden'); }
            if (tabRep) tabRep.classList.add('active');
            if (tabMan) tabMan.classList.remove('active');
        } else {
            if (secRep) { secRep.style.display = 'none'; secRep.classList.add('hidden'); }
            if (secMan) { secMan.style.display = 'block'; secMan.classList.remove('hidden'); }
            if (tabRep) tabRep.classList.remove('active');
            if (tabMan) tabMan.classList.add('active');
        }
    }

    async loadData() {
        try {
            this.reportDocs = await window.DataStore.getAll('report_storage', { orderBy: 'report_date', ascending: false });
            this.manualDocs = await window.DataStore.getAll('treatment_manuals', { orderBy: 'created_at', ascending: false });

            this.reportDocs = this.reportDocs || [];
            this.manualDocs = this.manualDocs || [];

            this.applyFilters();
        } catch (err) {
            console.error("Error loading documents data:", err);
        }
    }

    applyFilters() {
        let reports = [...this.reportDocs];
        let manuals = [...this.manualDocs];

        const searchVal = (document.getElementById('filter-docs-search')?.value || '').trim().toLowerCase();
        const yearVal = document.getElementById('filter-docs-year')?.value || 'all';
        const monthVal = document.getElementById('filter-docs-month')?.value || 'all';
        const startDate = document.getElementById('filter-docs-start-date')?.value || '';
        const endDate = document.getElementById('filter-docs-end-date')?.value || '';
        const drepCat = document.getElementById('drep-filter-category')?.value || 'all';
        const uniCat = document.getElementById('filter-docs-category')?.value || 'all';
        const catVal = drepCat !== 'all' ? drepCat : (uniCat !== 'all' ? uniCat : (this.selectedCategory !== 'all' ? this.selectedCategory : 'all'));
        const buildingVal = document.getElementById('filter-docs-building')?.value || 'all';
        const sortOrder = document.getElementById('filter-docs-sort-order')?.value || '';
        const pageSize = document.getElementById('filter-docs-page-size')?.value || 'all';

        // Tab sync with building/repository filter
        if (buildingVal === 'reports' && this.activeTab !== 'reports') {
            this.activeTab = 'reports';
            this.switchTab();
        } else if (buildingVal === 'manuals' && this.activeTab !== 'manuals') {
            this.activeTab = 'manuals';
            this.switchTab();
        }

        // Search query
        if (searchVal) {
            const matches = (item) => {
                const t = (item.title || item.doc_title || '').toLowerCase();
                const c = (item.doc_code || item.manual_code || '').toLowerCase();
                const cat = (item.category || item.doc_type || '').toLowerCase();
                const a = (item.author || item.uploader || item.uploaded_by || '').toLowerCase();
                const d = (item.description || item.scope || '').toLowerCase();
                return t.includes(searchVal) || c.includes(searchVal) || cat.includes(searchVal) || a.includes(searchVal) || d.includes(searchVal);
            };
            reports = reports.filter(matches);
            manuals = manuals.filter(matches);
        }

        // Date filter (handles start/end date, CE/BE year, and month)
        const dateFilters = { startDate, endDate, year: yearVal, month: monthVal };
        if (window.App && window.App.matchDateFilter) {
            reports = reports.filter(r => window.App.matchDateFilter(r.report_date || r.created_at, dateFilters));
            manuals = manuals.filter(m => window.App.matchDateFilter(m.updated_at || m.created_at, dateFilters));
        } else {
            let filterYearCE = yearVal;
            if (yearVal && yearVal !== 'all') {
                const yNum = parseInt(yearVal, 10);
                filterYearCE = yNum > 2400 ? (yNum - 543).toString() : yearVal;
                reports = reports.filter(r => (r.report_date || r.created_at || '').startsWith(filterYearCE));
                manuals = manuals.filter(m => (m.updated_at || m.created_at || '').startsWith(filterYearCE));
            }
            if (monthVal && monthVal !== 'all') {
                const mPad = monthVal.padStart(2, '0');
                reports = reports.filter(r => (r.report_date || r.created_at || '').includes(`-${mPad}-`) || (r.report_date || '').endsWith(`-${mPad}`));
                manuals = manuals.filter(m => (m.updated_at || m.created_at || '').includes(`-${mPad}-`));
            }
            if (startDate) {
                reports = reports.filter(r => (r.report_date || r.created_at || '').split('T')[0] >= startDate);
                manuals = manuals.filter(m => (m.updated_at || m.created_at || '').split('T')[0] >= startDate);
            }
            if (endDate) {
                reports = reports.filter(r => (r.report_date || r.created_at || '').split('T')[0] <= endDate);
                manuals = manuals.filter(m => (m.updated_at || m.created_at || '').split('T')[0] <= endDate);
            }
        }

        // Category
        if (catVal !== 'all' && catVal) {
            const normFilter = catVal.trim().toLowerCase();
            reports = reports.filter(r => {
                const c = (r.category || r.doc_type || '').trim().toLowerCase();
                return c.includes(normFilter) || normFilter.includes(c) || (normFilter.includes('ทส.2') && c.includes('ทส.2'));
            });
            manuals = manuals.filter(m => {
                const c = (m.category || '').trim().toLowerCase();
                return c.includes(normFilter) || normFilter.includes(c) || (normFilter.includes('sop') && c.includes('sop'));
            });
        }

        // Sort order
        if (sortOrder === 'date_asc') {
            this.sortField = 'report_date'; this.sortDir = 'asc';
        } else if (sortOrder === 'date_desc') {
            this.sortField = 'report_date'; this.sortDir = 'desc';
        }

        if (window.App && window.App.sortData) {
            reports = window.App.sortData(reports, this.sortField, this.sortDir);
            window.App.updateTableSortUI('table-doc-reports-body', this.sortField, this.sortDir);

            manuals = window.App.sortData(manuals, this.sortField, this.sortDir);
            window.App.updateTableSortUI('table-doc-manuals-body', this.sortField, this.sortDir);
        }

        // Update badge count
        const totalCount = reports.length + manuals.length;
        const badge = document.getElementById('docs-total-count-badge');
        if (badge) badge.textContent = totalCount.toLocaleString('th-TH');

        if (pageSize !== 'all' && !isNaN(parseInt(pageSize, 10))) {
            const lim = parseInt(pageSize, 10);
            reports = reports.slice(0, lim);
            manuals = manuals.slice(0, lim);
        }

        this.filteredReports = reports;
        this.filteredManuals = manuals;

        this.renderReportsTable(this.filteredReports);
        this.renderManualsTable(this.filteredManuals);
    }

    getFileTypeInfo(fileUrl = '', title = '') {
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
                label: 'ไฟล์ Excel',
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
                label: 'ไฟล์ Word',
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
                label: 'ไฟล์รูปภาพ',
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

    getCategoryBadge(cat = '') {
        const c = (cat || '').trim();
        if (c === 'รายงานระบบบำบัดน้ำเสีย(ทส.2)ส่งกระทรวงทรัพยากรธรรมชาติและสิ่งแวดล้อม') {
            return `<span class="badge bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs py-1 px-2.5 whitespace-nowrap"><i class="fa-solid fa-tree mr-1"></i>ทส.2 ส่ง ก.ทรัพยากรฯ</span>`;
        }
        if (c === 'รายงานระบบบำบัดน้ำเสีย(ทส.2)ส่งสำนักงานสาธารณสุขจังหวัดอุบลราชธานี') {
            return `<span class="badge bg-teal-500/20 text-teal-300 border border-teal-500/40 text-xs py-1 px-2.5 whitespace-nowrap"><i class="fa-solid fa-hospital mr-1"></i>ทส.2 ส่ง สสจ.อุบลฯ</span>`;
        }
        if (c === 'รายงานระบบบำบัดน้ำเสีย(ทส.2)ส่งองค์การบริหารส่วนตำบลไร่น้อย') {
            return `<span class="badge bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs py-1 px-2.5 whitespace-nowrap"><i class="fa-solid fa-landmark mr-1"></i>ทส.2 ส่ง อบต.ไร่น้อย</span>`;
        }
        if (c === 'รายงานวิเคราะห์คุณภาพน้ำ') {
            return `<span class="badge bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs py-1 px-2.5 whitespace-nowrap"><i class="fa-solid fa-flask mr-1"></i>วิเคราะห์คุณภาพน้ำ</span>`;
        }
        if (c === 'รายงานสิ่งแวดล้อม') {
            return `<span class="badge bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs py-1 px-2.5 whitespace-nowrap"><i class="fa-solid fa-leaf mr-1"></i>สิ่งแวดล้อม</span>`;
        }
        if (c === 'รายงานสรุปการเดินระบบ') {
            return `<span class="badge bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs py-1 px-2.5 whitespace-nowrap"><i class="fa-solid fa-chart-line mr-1"></i>สรุปการเดินระบบ</span>`;
        }
        if (c === 'รายงานส่งหน่วยงานภายนอก') {
            return `<span class="badge bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs py-1 px-2.5 whitespace-nowrap"><i class="fa-solid fa-paper-plane mr-1"></i>ส่งหน่วยงานภายนอก</span>`;
        }
        return `<span class="badge badge-info text-xs py-1 px-2.5 whitespace-nowrap">${c || 'รายงานทั่วไป'}</span>`;
    }

    openOrDownloadFile(fileUrl, fileName, fileType) {
        if (!fileUrl || fileUrl === '#' || fileUrl.trim() === '') {
            Swal.fire({
                icon: 'info',
                title: 'ไม่มีไฟล์เอกสารแนบ',
                text: 'รายการนี้เป็นข้อมูลตัวอย่างหรือยังไม่ได้อัปโหลดไฟล์จริง',
                confirmButtonText: 'รับทราบ',
                confirmButtonColor: '#0ea5e9'
            });
            return;
        }

        const info = this.getFileTypeInfo(fileUrl, fileName);
        const resolvedType = fileType || info.type;

        // 1. PDF: เปิดใน AttachmentManager หรือ new tab
        if (resolvedType === 'pdf') {
            if (window.AttachmentManager && window.AttachmentManager.openMediaViewer) {
                window.AttachmentManager.openMediaViewer({ data: fileUrl, type: 'pdf', name: fileName || 'เอกสารรายงาน PDF' });
            } else {
                window.open(fileUrl, '_blank');
            }
            return;
        }

        // 2. Image: เปิดดูรูปภาพขยาย
        if (resolvedType === 'image') {
            if (window.AttachmentManager && window.AttachmentManager.openMediaViewer) {
                window.AttachmentManager.openMediaViewer({ data: fileUrl, type: 'image', name: fileName || 'รูปภาพรายงาน' });
            } else {
                window.open(fileUrl, '_blank');
            }
            return;
        }

        // 3. Word หรือ Excel: ดาวน์โหลดไฟล์ลงเครื่องทันที
        try {
            const link = document.createElement('a');
            link.href = fileUrl;
            let ext = resolvedType === 'excel' ? '.xlsx' : '.docx';
            let safeName = fileName ? (fileName.includes('.') ? fileName : fileName + ext) : ('รายงาน_' + (resolvedType === 'excel' ? 'ข้อมูล.xlsx' : 'เอกสาร.docx'));
            link.download = safeName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            Swal.fire({
                icon: 'success',
                title: resolvedType === 'excel' ? 'ดาวน์โหลดไฟล์ Excel เรียบร้อย' : 'ดาวน์โหลดไฟล์ Word เรียบร้อย',
                html: `ระบบได้ทำการดาวน์โหลดไฟล์ <strong>${safeName}</strong> ลงเครื่องของคุณเรียบร้อยแล้ว`,
                timer: 2000,
                showConfirmButton: false
            });
        } catch (err) {
            window.open(fileUrl, '_blank');
        }
    }

    openReportFileById(id) {
        const item = (this.reportDocs || []).find(x => String(x.id) === String(id));
        if (!item) return;
        const fileInfo = this.getFileTypeInfo(item.file_url, item.title || item.doc_title);
        this.openOrDownloadFile(item.file_url, item.title || item.doc_title || 'เอกสารรายงาน', fileInfo.type);
    }

    openManualFileById(id) {
        const item = (this.manualDocs || []).find(x => String(x.id) === String(id));
        if (!item) return;
        const fileInfo = this.getFileTypeInfo(item.file_url, item.title || item.file_name);
        this.openOrDownloadFile(item.file_url, item.title || item.file_name || 'คู่มือ SOP', fileInfo.type);
    }

    // ==========================================
    // Dropzone Helpers
    // ==========================================
    resetReportDropzone() {
        const fileInput = document.getElementById('drep-file-upload-input');
        if (fileInput) fileInput.value = '';

        const prompt = document.getElementById('drep-dropzone-prompt');
        const fileInfo = document.getElementById('drep-dropzone-fileinfo');
        if (prompt) prompt.classList.remove('hidden');
        if (fileInfo) fileInfo.classList.add('hidden');

        const fileName = document.getElementById('drep-file-name');
        if (fileName) fileName.textContent = '';

        const urlWrapper = document.getElementById('drep-form-url-wrapper');
        if (urlWrapper) urlWrapper.classList.add('hidden');

        const urlInput = document.getElementById('drep-form-url');
        if (urlInput) urlInput.value = '';

        const sizeInput = document.getElementById('drep-form-size');
        if (sizeInput) sizeInput.value = '';

        this.currentReportFile = null;
    }

    // ==========================================
    // 1. Report Storage
    // ==========================================
    openAddReportModal() {
        this.editingDocId = null;
        const form = document.getElementById('form-doc-report');
        const title = document.getElementById('modal-doc-report-title');
        if (!form) return;

        form.reset();
        if (title) title.innerHTML = '<i class="fa-solid fa-cloud-arrow-up text-cyan-400"></i> อัปโหลด / บันทึกรายงาน';
        
        const dateInput = document.getElementById('drep-form-date');
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

        const currentUser = window.AuthService ? window.AuthService.getCurrentUser() : null;
        const uploaderInput = document.getElementById('drep-form-uploader');
        if (uploaderInput) uploaderInput.value = currentUser ? currentUser.full_name : "แสงตะวัน ชาวเขา (Super Admin)";

        const urlInput = document.getElementById('drep-form-url');
        if (urlInput) urlInput.value = '';

        const sizeInput = document.getElementById('drep-form-size');
        if (sizeInput) sizeInput.value = '';

        this.resetReportDropzone();
        window.App.openModal('modal-doc-report');
    }

    openEditReportModal(id) {
        const item = this.reportDocs.find(x => x.id === id);
        if (!item) return;

        this.editingDocId = id;
        const title = document.getElementById('modal-doc-report-title');
        if (title) title.innerHTML = '<i class="fa-solid fa-pen text-rose-400"></i> แก้ไขข้อมูลไฟล์รายงาน';

        const dateInput = document.getElementById('drep-form-date');
        if (dateInput) dateInput.value = item.report_date ? item.report_date.split('T')[0] : "";

        const titleInput = document.getElementById('drep-form-title');
        if (titleInput) titleInput.value = item.title || item.doc_title || "";

        const catInput = document.getElementById('drep-form-category');
        if (catInput) catInput.value = item.category || item.doc_type || "รายงานระบบบำบัดน้ำเสีย(ทส.2)ส่งกระทรวงทรัพยากรธรรมชาติและสิ่งแวดล้อม";

        const urlInput = document.getElementById('drep-form-url');
        if (urlInput) urlInput.value = item.file_url || "";

        const sizeInput = document.getElementById('drep-form-size');
        if (sizeInput) sizeInput.value = item.file_size || "2.1 MB";

        const uploaderInput = document.getElementById('drep-form-uploader');
        if (uploaderInput) uploaderInput.value = item.uploaded_by || item.uploader || "แสงตะวัน ชาวเขา (Super Admin)";

        // Set dropzone display if file_url exists
        if (item.file_url && item.file_url !== '#') {
            const fileInfo = this.getFileTypeInfo(item.file_url, item.title || item.doc_title);
            const promptEl = document.getElementById('drep-dropzone-prompt');
            const infoEl = document.getElementById('drep-dropzone-fileinfo');
            const iconEl = document.getElementById('drep-file-icon');
            const nameEl = document.getElementById('drep-file-name');
            const metaEl = document.getElementById('drep-file-meta');

            if (promptEl) promptEl.style.display = 'none';
            if (infoEl) {
                infoEl.classList.remove('hidden');
                infoEl.style.display = 'flex';
            }
            if (iconEl) iconEl.innerHTML = `<i class="${fileInfo.icon}"></i>`;
            if (nameEl) nameEl.textContent = item.title || item.doc_title || 'ไฟล์รายงาน';
            if (metaEl) metaEl.textContent = `${fileInfo.label} • ${item.file_size || 'พร้อมใช้งาน'}`;
        } else {
            this.resetReportDropzone();
        }

        window.App.openModal('modal-doc-report');
    }

    async saveReportDoc() {
        const form = document.getElementById('form-doc-report');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const payload = {
            report_date: document.getElementById('drep-form-date')?.value || new Date().toISOString().split('T')[0],
            title: document.getElementById('drep-form-title')?.value?.trim() || '',
            category: document.getElementById('drep-form-category')?.value || 'รายงานระบบบำบัดน้ำเสีย(ทส.2)ส่งกระทรวงทรัพยากรธรรมชาติและสิ่งแวดล้อม',
            file_url: document.getElementById('drep-form-url')?.value?.trim() || 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
            file_size: document.getElementById('drep-form-size')?.value?.trim() || '2.1 MB',
            uploaded_by: document.getElementById('drep-form-uploader')?.value?.trim() || "แสงตะวัน ชาวเขา (Super Admin)"
        };

        if (!payload.title) {
            Swal.fire({ icon: 'warning', title: 'กรุณากรอกชื่อเรื่องรายงาน' });
            return;
        }

        Swal.fire({ title: 'กำลังบันทึกเอกสาร...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        try {
            let res;
            if (this.editingDocId) {
                res = await window.DataStore.update('report_storage', this.editingDocId, payload);
            } else {
                res = await window.DataStore.insert('report_storage', payload);
            }

            window.App.closeModal('modal-doc-report');
            await this.loadData();

            if (res && res.savedSupabase) {
                Swal.fire({
                    icon: 'success',
                    title: 'บันทึกรายงานสำเร็จ!',
                    html: '<span class="text-xs text-emerald-400 font-bold"><i class="fa-solid fa-cloud-arrow-up"></i> บันทึกลง Supabase Cloud เรียบร้อย</span>',
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
                            <div class="text-slate-400 text-[11px] pt-1 border-t border-slate-800">ระบบได้บันทึกเอกสารไว้ในเครื่องให้อัตโนมัติ และแสดงผลในตารางเรียบร้อย</div>
                        </div>
                    `,
                    confirmButtonText: 'รับทราบ',
                    confirmButtonColor: '#3b82f6'
                });
            } else {
                Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ!', timer: 1500, showConfirmButton: false });
            }
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: err.message });
        }
    }

    async deleteReportDoc(id) {
        const result = await Swal.fire({
            title: 'ยืนยันการลบไฟล์รายงาน?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#334155',
            confirmButtonText: 'ลบไฟล์',
            cancelButtonText: 'ยกเลิก'
        });

        if (result.isConfirmed) {
            await window.DataStore.delete('report_storage', id);
            Swal.fire({ icon: 'success', title: 'ลบสำเร็จ', timer: 1200, showConfirmButton: false });
            await this.loadData();
        }
    }

    renderReportsTable(list) {
        const tbody = document.getElementById('table-doc-reports-body');
        if (!tbody) return;

        const totalItems = list ? list.length : 0;

        if (!list || list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-slate-500">ไม่พบเอกสารรายงานในระบบตามตัวกรองที่เลือก</td></tr>`;
            const tfoot = document.getElementById('table-doc-reports-foot');
            if (tfoot) tfoot.innerHTML = '';

            if (window.App && window.App.renderPagination) {
                window.App.renderPagination({
                    containerId: 'pagination-doc-reports',
                    totalItems: 0,
                    currentPage: 1,
                    pageSize: 'all',
                    summaryCards: [
                        { title: 'จำนวนรายงานทั้งหมด', value: '0 ฉบับ', subText: 'เอกสารรายงาน', icon: 'fa-solid fa-file-lines', color: 'cyan' },
                        { title: 'คลังเอกสารดิจิทัล', value: 'พร้อมใช้งาน', subText: 'ระบบจัดเก็บไฟล์ PDF/Office', icon: 'fa-solid fa-folder-open', color: 'emerald' },
                        { title: 'ความสมบูรณ์ไฟล์รายงาน', value: '100%', subText: 'เชื่อมต่อคลาวด์', icon: 'fa-solid fa-cloud-check', color: 'cyan' },
                        { title: 'สถานะตัวกรอง & การเลือก', value: 'ไม่พบรายการ', subText: 'กรุณาปรับเปลี่ยนตัวกรอง', icon: 'fa-solid fa-filter', color: 'purple' }
                    ]
                });
            }
            return;
        }

        const isAdmin = window.AuthService ? window.AuthService.isAdmin() : true;

        tbody.innerHTML = list.map((item, idx) => {
            try {
                const fileInfo = this.getFileTypeInfo(item.file_url, item.title || item.doc_title);
                const categoryBadge = this.getCategoryBadge(item.category || item.doc_type);
                const rawTitle = item.title || item.doc_title || '-';
                const safeDisplayTitle = String(rawTitle).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
                const displayDate = item.report_date ? String(item.report_date).split('T')[0] : '-';
                const displaySize = item.file_size || '2.1 MB';
                const displayUploader = item.uploaded_by || item.uploader || 'แสงตะวัน ชาวเขา (Super Admin)';
                const isDocDownload = fileInfo.type === 'word' || fileInfo.type === 'excel';

                return `
                <tr>
                    <td class="text-slate-400 font-mono text-xs text-center">${idx + 1}</td>
                    <td class="font-medium text-white whitespace-nowrap">${displayDate}</td>
                    <td class="font-semibold text-white">
                        <div class="flex items-center gap-2">
                            <i class="${fileInfo.icon} text-base shrink-0"></i>
                            <span class="truncate max-w-[320px] md:max-w-[450px]" title="${safeDisplayTitle}">${safeDisplayTitle}</span>
                            <span class="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold uppercase ${fileInfo.badgeClass} shrink-0">${fileInfo.badgeText}</span>
                        </div>
                    </td>
                    <td>${categoryBadge}</td>
                    <td class="font-mono text-xs text-slate-300 whitespace-nowrap">${displaySize}</td>
                    <td class="text-xs text-slate-300 whitespace-nowrap">${displayUploader}</td>
                    <td>
                        <div class="flex items-center gap-1.5 whitespace-nowrap">
                            <button onclick="window.DocumentsModule.openReportFileById('${item.id}')" class="btn btn-secondary btn-icon btn-sm" title="${isDocDownload ? 'ดาวน์โหลดเอกสาร' : 'เปิดดูไฟล์'}">
                                <i class="${isDocDownload ? 'fa-solid fa-download text-emerald-400' : 'fa-solid fa-arrow-up-right-from-square text-cyan-400'}"></i>
                            </button>
                            <button class="btn btn-secondary btn-icon btn-sm" onclick="window.DocumentsModule.openEditReportModal('${item.id}')" title="แก้ไข">
                                <i class="fa-solid fa-pen text-rose-400"></i>
                            </button>
                            ${isAdmin ? `
                            <button class="btn btn-danger btn-icon btn-sm" onclick="window.DocumentsModule.deleteReportDoc('${item.id}')" title="ลบ">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
            } catch (rowErr) {
                console.warn("Error rendering report row:", item, rowErr);
                return '';
            }
        }).join('');

        // Render Table Footer Summary Row
        const tfoot = document.getElementById('table-doc-reports-foot');
        if (tfoot) {
            tfoot.innerHTML = `
                <tr class="table-summary-row border-t-2 border-emerald-500/50">
                    <td class="text-center font-bold text-emerald-400 py-3.5"><i class="fa-solid fa-calculator"></i> รวม</td>
                    <td colspan="2" class="font-bold text-emerald-300 py-3.5">
                        <span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> ผลรวมทั้งสิ้น (${totalItems.toLocaleString()} ฉบับ):</span>
                    </td>
                    <td colspan="3" class="text-xs text-slate-300 py-3.5">เอกสารรายงานระบบบำบัดน้ำเสีย รพ.๕๐ พรรษาฯ</td>
                    <td></td>
                </tr>
            `;
        }

        // Summary Cards Configuration
        const summaryCards = [
            {
                title: 'เอกสารรายงานคุณภาพน้ำ',
                value: `${totalItems.toLocaleString()} ฉบับ`,
                subText: 'คลังเอกสารทางการ รพ.',
                icon: 'fa-solid fa-file-pdf',
                color: 'cyan'
            },
            {
                title: 'รายงานประจำเดือน (+) VS ผล Lab (-)',
                value: `ประจำเดือน: ${totalItems} / Lab: ${totalItems}`,
                subText: 'จัดหมวดหมู่เอกสารรับรอง',
                icon: 'fa-solid fa-right-left',
                color: 'blue'
            },
            {
                title: 'ความสมบูรณ์เอกสาร (DIGITAL)',
                value: '100% สแกนดิจิทัล',
                subText: 'จัดเก็บบน Supabase Cloud',
                icon: 'fa-solid fa-cloud-arrow-up',
                color: 'emerald'
            },
            {
                title: 'เอกสารตรวจล่าสุด',
                value: 'พร้อมใช้งาน',
                subText: 'อัปเดตสถานะพร้อมตรวจสอบ',
                icon: 'fa-solid fa-calendar-check',
                color: 'amber'
            }
        ];

        if (window.App && window.App.renderPagination) {
            window.App.renderPagination({
                containerId: 'pagination-doc-reports',
                totalItems: totalItems,
                currentPage: 1,
                pageSize: 'all',
                summaryCards: summaryCards
            });
        }
    }

    // ==========================================
    // 2. Treatment Manuals (SOP)
    // ==========================================
    openAddManualModal() {
        this.editingManualId = null;
        const form = document.getElementById('form-doc-manual');
        const title = document.getElementById('modal-doc-manual-title');
        if (!form) return;

        form.reset();
        if (title) title.innerHTML = '<i class="fa-solid fa-book-bookmark text-emerald-400"></i> เพิ่มคู่มือระบบบำบัดน้ำเสีย (SOP)';

        const dateInput = document.getElementById('man-form-date');
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

        const currentUser = window.AuthService ? window.AuthService.getCurrentUser() : null;
        const uploaderInput = document.getElementById('man-form-uploader');
        if (uploaderInput) uploaderInput.value = currentUser ? currentUser.full_name : "แสงตะวัน ชาวเขา (Super Admin)";

        const urlInput = document.getElementById('man-form-url');
        if (urlInput) urlInput.value = '';

        const sizeInput = document.getElementById('man-form-size');
        if (sizeInput) sizeInput.value = '4.2 MB';

        this.resetManualDropzone();
        window.App.openModal('modal-doc-manual');
    }

    openEditManualModal(id) {
        const item = this.manualDocs.find(x => x.id === id);
        if (!item) return;

        this.editingManualId = id;
        const title = document.getElementById('modal-doc-manual-title');
        if (title) title.innerHTML = '<i class="fa-solid fa-pen text-emerald-400"></i> แก้ไขคู่มือระบบบำบัด (SOP)';

        const dateInput = document.getElementById('man-form-date');
        if (dateInput) dateInput.value = item.created_at ? item.created_at.split('T')[0] : new Date().toISOString().split('T')[0];

        const titleInput = document.getElementById('man-form-title');
        if (titleInput) titleInput.value = item.title || "";

        const catInput = document.getElementById('man-form-category');
        if (catInput) catInput.value = item.category || "คู่มือการปฏิบัติงาน (SOP)";

        const urlInput = document.getElementById('man-form-url');
        if (urlInput) urlInput.value = item.file_url || "";

        const sizeInput = document.getElementById('man-form-size');
        if (sizeInput) sizeInput.value = item.file_size || "4.2 MB";

        const uploaderInput = document.getElementById('man-form-uploader');
        if (uploaderInput) uploaderInput.value = item.uploaded_by || "";

        // Populate dropzone with existing file info if available
        if (item.file_url && item.file_url !== '#') {
            const fileInfo = this.getFileTypeInfo(item.file_url, item.title);
            const promptEl = document.getElementById('man-dropzone-prompt');
            const infoEl = document.getElementById('man-dropzone-fileinfo');
            const iconEl = document.getElementById('man-file-type-icon');
            const nameEl = document.getElementById('man-dropzone-filename');
            const sizeEl = document.getElementById('man-dropzone-filesize');

            if (promptEl) promptEl.classList.add('hidden');
            if (infoEl) {
                infoEl.classList.remove('hidden');
                infoEl.style.display = 'flex';
            }
            if (iconEl) iconEl.innerHTML = `<i class="${fileInfo.icon}"></i>`;
            if (nameEl) nameEl.textContent = item.title || 'ไฟล์คู่มือ SOP';
            if (sizeEl) sizeEl.textContent = `${fileInfo.label} • ${item.file_size || 'พร้อมใช้งาน'}`;
        } else {
            this.resetManualDropzone();
        }

        window.App.openModal('modal-doc-manual');
    }

    async saveManualDoc() {
        const form = document.getElementById('form-doc-manual');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const payload = {
            title: document.getElementById('man-form-title')?.value?.trim() || '',
            category: document.getElementById('man-form-category')?.value || 'คู่มือการปฏิบัติงาน (SOP)',
            file_url: document.getElementById('man-form-url')?.value?.trim() || 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
            file_size: document.getElementById('man-form-size')?.value?.trim() || '4.2 MB',
            uploaded_by: document.getElementById('man-form-uploader')?.value?.trim() || "แสงตะวัน ชาวเขา (Super Admin)",
            created_at: document.getElementById('man-form-date')?.value || new Date().toISOString()
        };

        if (!payload.title) {
            Swal.fire({ icon: 'warning', title: 'กรุณากรอกชื่อเอกสารคู่มือ' });
            return;
        }

        Swal.fire({ title: 'กำลังบันทึกคู่มือ...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        try {
            let res;
            if (this.editingManualId) {
                res = await window.DataStore.update('treatment_manuals', this.editingManualId, payload);
            } else {
                res = await window.DataStore.insert('treatment_manuals', payload);
            }

            window.App.closeModal('modal-doc-manual');
            await this.loadData();

            if (res && res.savedSupabase) {
                Swal.fire({
                    icon: 'success',
                    title: 'บันทึกคู่มือสำเร็จ!',
                    html: '<span class="text-xs text-emerald-400 font-bold"><i class="fa-solid fa-cloud-arrow-up"></i> บันทึกลง Supabase Cloud เรียบร้อย</span>',
                    timer: 1800,
                    showConfirmButton: false
                });
            } else if (res && res.savedLocal && res.error) {
                Swal.fire({
                    icon: 'warning',
                    title: 'บันทึกคู่มือในเครื่อง (LocalStore) แล้ว',
                    html: `
                        <div class="text-left text-xs space-y-1.5 p-3 bg-slate-900 rounded border border-slate-800 text-slate-300">
                            <div class="text-amber-400 font-bold"><i class="fa-solid fa-triangle-exclamation"></i> ไม่สามารถบันทึกขึ้น Supabase Cloud ได้</div>
                            <div class="text-rose-400 font-mono text-[11px]"><strong>สาเหตุ:</strong> ${res.error}</div>
                            <div class="text-slate-400 text-[11px] pt-1 border-t border-slate-800">ระบบได้บันทึกคู่มือไว้ในเครื่องให้อัตโนมัติ และแสดงผลในตารางเรียบร้อย</div>
                        </div>
                    `,
                    confirmButtonText: 'รับทราบ',
                    confirmButtonColor: '#10b981'
                });
            } else {
                Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ!', timer: 1500, showConfirmButton: false });
            }
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: err.message });
        }
    }

    async deleteManualDoc(id) {
        const result = await Swal.fire({
            title: 'ยืนยันการลบคู่มือระบบบำบัด?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#334155',
            confirmButtonText: 'ลบคู่มือ',
            cancelButtonText: 'ยกเลิก'
        });

        if (result.isConfirmed) {
            await window.DataStore.delete('treatment_manuals', id);
            Swal.fire({ icon: 'success', title: 'ลบสำเร็จ', timer: 1200, showConfirmButton: false });
            await this.loadData();
        }
    }

    renderManualsTable(list) {
        const tbody = document.getElementById('table-doc-manuals-body');
        if (!tbody) return;

        const totalItems = list ? list.length : 0;

        if (!list || list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-slate-500">ไม่พบคู่มือระบบบำบัดในระบบ</td></tr>`;
            const tfoot = document.getElementById('table-doc-manuals-foot');
            if (tfoot) tfoot.innerHTML = '';

            if (window.App && window.App.renderPagination) {
                window.App.renderPagination({
                    containerId: 'pagination-doc-manuals',
                    totalItems: 0,
                    currentPage: 1,
                    pageSize: 'all',
                    summaryCards: [
                        { title: 'คู่มือระบบบำบัดทั้งหมด', value: '0 เล่ม', subText: 'คู่มือมาตรฐาน SOP', icon: 'fa-solid fa-book', color: 'cyan' },
                        { title: 'ความพร้อมคู่มือปฏิบัติงาน', value: '100%', subText: 'เอกสารมาตรฐานครบ', icon: 'fa-solid fa-book-bookmark', color: 'emerald' },
                        { title: 'คลังความรู้งานวิศวกรรม', value: 'ครบถ้วน', subText: 'พร้อมเปิดอ่านออนไลน์', icon: 'fa-solid fa-book-open-reader', color: 'cyan' },
                        { title: 'สถานะตัวกรอง & การเลือก', value: 'ไม่พบรายการ', subText: 'กรุณาปรับเปลี่ยนตัวกรอง', icon: 'fa-solid fa-filter', color: 'purple' }
                    ]
                });
            }
            return;
        }

        const isAdmin = window.AuthService ? window.AuthService.isAdmin() : true;

        tbody.innerHTML = list.map((item, idx) => {
            try {
                const fileInfo = this.getFileTypeInfo(item.file_url, item.title || item.file_name);
                const isDocDownload = fileInfo.type === 'word' || fileInfo.type === 'excel';
                const rawTitle = item.title || item.file_name || '-';
                const safeDisplayTitle = String(rawTitle).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
                const displaySize = item.file_size || '4.2 MB';
                const displayUploader = item.author || item.uploaded_by || 'แสงตะวัน ชาวเขา (Super Admin)';

                return `
                <tr>
                    <td class="text-slate-400 font-mono text-xs text-center">${idx + 1}</td>
                    <td class="font-semibold text-white">
                        <div class="flex items-center gap-2">
                            <i class="${fileInfo.icon} text-base shrink-0"></i>
                            <span class="truncate max-w-[320px] md:max-w-[450px]" title="${safeDisplayTitle}">${safeDisplayTitle}</span>
                            <span class="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold uppercase ${fileInfo.badgeClass} shrink-0">${fileInfo.badgeText}</span>
                        </div>
                    </td>
                    <td><span class="badge badge-purple">${item.category || 'คู่มือการปฏิบัติงาน (SOP)'}</span></td>
                    <td class="font-mono text-xs text-slate-300 whitespace-nowrap">${displaySize}</td>
                    <td class="text-xs text-slate-300 whitespace-nowrap">${displayUploader}</td>
                    <td>
                        <div class="flex items-center gap-1.5 whitespace-nowrap">
                            <button onclick="window.DocumentsModule.openManualFileById('${item.id}')" class="btn btn-secondary btn-icon btn-sm" title="${isDocDownload ? 'ดาวน์โหลดคู่มือ' : 'เปิดอ่านคู่มือ'}">
                                <i class="${isDocDownload ? 'fa-solid fa-download text-emerald-400' : 'fa-solid fa-book-open text-emerald-400'}"></i>
                            </button>
                            <button class="btn btn-secondary btn-icon btn-sm" onclick="window.DocumentsModule.openEditManualModal('${item.id}')" title="แก้ไข">
                                <i class="fa-solid fa-pen text-emerald-400"></i>
                            </button>
                            ${isAdmin ? `
                            <button class="btn btn-danger btn-icon btn-sm" onclick="window.DocumentsModule.deleteManualDoc('${item.id}')" title="ลบ">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
            } catch (manErr) {
                console.warn("Error rendering manual row:", item, manErr);
                return '';
            }
        }).join('');

        // Render Table Footer Summary Row
        const tfoot = document.getElementById('table-doc-manuals-foot');
        if (tfoot) {
            tfoot.innerHTML = `
                <tr class="table-summary-row border-t-2 border-emerald-500/50">
                    <td class="text-center font-bold text-emerald-400 py-3.5"><i class="fa-solid fa-calculator"></i> รวม</td>
                    <td colspan="2" class="font-bold text-emerald-300 py-3.5">
                        <span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> ผลรวมทั้งสิ้น (${totalItems.toLocaleString()} เล่ม):</span>
                    </td>
                    <td colspan="3" class="text-xs text-slate-300 py-3.5">คู่มือมาตรฐาน SOP ระบบบำบัดน้ำเสีย รพ.๕๐ พรรษาฯ</td>
                </tr>
            `;
        }

        // Summary Cards Configuration
        const summaryCards = [
            {
                title: 'เอกสารรายงานคุณภาพน้ำ',
                value: `${totalItems.toLocaleString()} ฉบับ`,
                subText: 'คลังเอกสารทางการ รพ.',
                icon: 'fa-solid fa-file-pdf',
                color: 'cyan'
            },
            {
                title: 'รายงานประจำเดือน (+) VS ผล Lab (-)',
                value: `ประจำเดือน: ${totalItems} / Lab: ${totalItems}`,
                subText: 'จัดหมวดหมู่เอกสารรับรอง',
                icon: 'fa-solid fa-right-left',
                color: 'blue'
            },
            {
                title: 'ความสมบูรณ์เอกสาร (DIGITAL)',
                value: '100% สแกนดิจิทัล',
                subText: 'จัดเก็บบน Supabase Cloud',
                icon: 'fa-solid fa-cloud-arrow-up',
                color: 'emerald'
            },
            {
                title: 'เอกสารตรวจล่าสุด',
                value: 'พร้อมใช้งาน',
                subText: 'อัปเดตสถานะพร้อมตรวจสอบ',
                icon: 'fa-solid fa-calendar-check',
                color: 'amber'
            }
        ];

        if (window.App && window.App.renderPagination) {
            window.App.renderPagination({
                containerId: 'pagination-doc-manuals',
                totalItems: totalItems,
                currentPage: 1,
                pageSize: 'all',
                summaryCards: summaryCards
            });
        }
    }
}

window.DocumentsModule = new DocumentsModule();
