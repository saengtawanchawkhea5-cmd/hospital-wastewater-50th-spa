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

        // File upload helper for Reports
        const drepFileInput = document.getElementById('drep-file-upload-input');
        if (drepFileInput) {
            drepFileInput.addEventListener('change', (e) => this.handleFileUpload(e, 'drep-form-url', 'drep-form-size'));
        }

        // File upload helper for Manuals
        const manFileInput = document.getElementById('man-file-upload-input');
        if (manFileInput) {
            manFileInput.addEventListener('change', (e) => this.handleFileUpload(e, 'man-form-url', 'man-form-size'));
        }
    }

    handleFileUpload(e, urlTargetId, sizeTargetId) {
        const file = e.target.files[0];
        if (!file) return;

        // คำนวณขนาดไฟล์ให้อัตโนมัติ (เช่น 2.1 MB)
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
        const sizeInput = document.getElementById(sizeTargetId);
        if (sizeInput) sizeInput.value = sizeMB;

        // อ่านไฟล์เป็น Base64 Data URI
        const reader = new FileReader();
        reader.onload = (event) => {
            const urlInput = document.getElementById(urlTargetId);
            if (urlInput) {
                urlInput.value = event.target.result;
            }
            Swal.fire({
                icon: 'success',
                title: 'แนบไฟล์สำเร็จ!',
                html: `ไฟล์: <strong>${file.name}</strong> (${sizeMB})`,
                timer: 1500,
                showConfirmButton: false
            });
        };
        reader.readAsDataURL(file);
    }

    switchTab() {
        const secRep = document.getElementById('section-docs-report');
        const secMan = document.getElementById('section-docs-manual');
        const tabRep = document.getElementById('tab-btn-docs-report');
        const tabMan = document.getElementById('tab-btn-docs-manual');

        if (this.activeTab === 'reports') {
            if (secRep) secRep.style.display = 'block';
            if (secMan) secMan.style.display = 'none';
            if (tabRep) tabRep.classList.add('active');
            if (tabMan) tabMan.classList.remove('active');
        } else {
            if (secRep) secRep.style.display = 'none';
            if (secMan) secMan.style.display = 'block';
            if (tabRep) tabRep.classList.remove('active');
            if (tabMan) tabMan.classList.add('active');
        }
    }

    async loadData() {
        try {
            this.reportDocs = await window.DataStore.getAll('report_storage', { orderBy: 'report_date', ascending: false });
            this.manualDocs = await window.DataStore.getAll('treatment_manuals', { orderBy: 'created_at', ascending: false });

            // หากไม่มีข้อมูลจาก Supabase ให้ใช้ชุดข้อมูลตั้งต้นมาตรฐาน
            if ((!this.reportDocs || this.reportDocs.length === 0) && window.SAMPLE_DATABASE && window.SAMPLE_DATABASE.report_storage) {
                this.reportDocs = JSON.parse(JSON.stringify(window.SAMPLE_DATABASE.report_storage));
            }
            if ((!this.manualDocs || this.manualDocs.length === 0) && window.SAMPLE_DATABASE && window.SAMPLE_DATABASE.treatment_manuals) {
                this.manualDocs = JSON.parse(JSON.stringify(window.SAMPLE_DATABASE.treatment_manuals));
            }

            this.applyFilters();
        } catch (err) {
            console.error("Error loading documents data:", err);
        }
    }

    applyFilters() {
        this.filteredReports = [...this.reportDocs];
        this.filteredManuals = [...this.manualDocs];

        if (window.App && window.App.sortData) {
            this.filteredReports = window.App.sortData(this.filteredReports, this.sortField, this.sortDir);
            window.App.updateTableSortUI('table-doc-reports-body', this.sortField, this.sortDir);

            this.filteredManuals = window.App.sortData(this.filteredManuals, this.sortField, this.sortDir);
            window.App.updateTableSortUI('table-doc-manuals-body', this.sortField, this.sortDir);
        }

        this.renderReportsTable(this.filteredReports);
        this.renderManualsTable(this.filteredManuals);
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
        if (title) title.innerHTML = '<i class="fa-solid fa-file-pdf text-rose-400"></i> อัปโหลด / บันทึกรายงาน';
        
        const dateInput = document.getElementById('drep-form-date');
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

        const currentUser = window.AuthService ? window.AuthService.getCurrentUser() : null;
        const uploaderInput = document.getElementById('drep-form-uploader');
        if (uploaderInput) uploaderInput.value = currentUser ? currentUser.full_name : "แสงตะวัน ชาวเขา (Super Admin)";

        const urlInput = document.getElementById('drep-form-url');
        if (urlInput) urlInput.value = '';

        const sizeInput = document.getElementById('drep-form-size');
        if (sizeInput) sizeInput.value = '2.1 MB';

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
        if (titleInput) titleInput.value = item.title || "";

        const catInput = document.getElementById('drep-form-category');
        if (catInput) catInput.value = item.category || "รายงานสิ่งแวดล้อม";

        const urlInput = document.getElementById('drep-form-url');
        if (urlInput) urlInput.value = item.file_url || "";

        const sizeInput = document.getElementById('drep-form-size');
        if (sizeInput) sizeInput.value = item.file_size || "2.1 MB";

        const uploaderInput = document.getElementById('drep-form-uploader');
        if (uploaderInput) uploaderInput.value = item.uploaded_by || "";

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
            category: document.getElementById('drep-form-category')?.value || 'รายงานสิ่งแวดล้อม',
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
            if (this.editingDocId) {
                await window.DataStore.set('report_storage', this.editingDocId, { ...payload, id: this.editingDocId });
            } else {
                await window.DataStore.insert('report_storage', payload);
            }

            Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ!', timer: 1500, showConfirmButton: false });
            window.App.closeModal('modal-doc-report');
            await this.loadData();
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
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-slate-500">ไม่พบเอกสารรายงานในระบบ</td></tr>`;
            const tfoot = document.getElementById('table-doc-reports-foot');
            if (tfoot) tfoot.innerHTML = '';

            if (window.App && window.App.renderPagination) {
                window.App.renderPagination({
                    containerId: 'pagination-doc-reports',
                    totalItems: 0,
                    currentPage: 1,
                    pageSize: 'all',
                    summaryCards: [
                        { title: 'จำนวนรายงานทั้งหมด', value: '0 ฉบับ', subText: 'เอกสารรายงาน', icon: 'fa-solid fa-file-pdf', color: 'cyan' },
                        { title: 'คลังเอกสารดิจิทัล', value: 'พร้อมใช้งาน', subText: 'ระบบจัดเก็บไฟล์ PDF', icon: 'fa-solid fa-folder-open', color: 'emerald' },
                        { title: 'ความสมบูรณ์ไฟล์รายงาน', value: '100%', subText: 'เชื่อมต่อคลาวด์', icon: 'fa-solid fa-cloud-check', color: 'cyan' },
                        { title: 'สถานะตัวกรอง & การเลือก', value: 'ไม่พบรายการ', subText: 'กรุณาปรับเปลี่ยนตัวกรอง', icon: 'fa-solid fa-filter', color: 'purple' }
                    ]
                });
            }
            return;
        }

        const isAdmin = window.AuthService ? window.AuthService.isAdmin() : true;

        tbody.innerHTML = list.map((item, idx) => {
            const isPdf = item.file_url && (item.file_url.startsWith('data:application/pdf') || item.file_url.toLowerCase().endsWith('.pdf'));
            return `
            <tr>
                <td class="text-slate-400 font-mono text-xs text-center">${idx + 1}</td>
                <td class="font-medium text-white whitespace-nowrap">${item.report_date || '-'}</td>
                <td class="font-semibold text-white">
                    <div class="flex items-center gap-2">
                        <i class="fa-solid fa-file-pdf text-rose-400 text-base shrink-0"></i>
                        <span>${item.title}</span>
                    </div>
                </td>
                <td><span class="badge badge-info">${item.category || 'รายงานสิ่งแวดล้อม'}</span></td>
                <td class="font-mono text-xs text-slate-400">${item.file_size || '2.1 MB'}</td>
                <td class="text-xs text-slate-300">${item.uploaded_by || 'แสงตะวัน'}</td>
                <td>
                    <div class="flex items-center gap-1.5">
                        <button onclick="window.AttachmentManager ? window.AttachmentManager.openMediaViewer({data: '${item.file_url}', type: '${isPdf ? 'pdf' : 'image'}', name: '${item.title}'}) : window.open('${item.file_url}', '_blank')" class="btn btn-secondary btn-icon btn-sm" title="เปิด/ดาวน์โหลดไฟล์">
                            <i class="fa-solid fa-arrow-up-right-from-square text-cyan-400"></i>
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
            if (this.editingManualId) {
                await window.DataStore.set('treatment_manuals', this.editingManualId, { ...payload, id: this.editingManualId });
            } else {
                await window.DataStore.insert('treatment_manuals', payload);
            }

            Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ!', timer: 1500, showConfirmButton: false });
            window.App.closeModal('modal-doc-manual');
            await this.loadData();
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
            const isPdf = item.file_url && (item.file_url.startsWith('data:application/pdf') || item.file_url.toLowerCase().endsWith('.pdf'));
            return `
            <tr>
                <td class="text-slate-400 font-mono text-xs text-center">${idx + 1}</td>
                <td class="font-semibold text-white">
                    <div class="flex items-center gap-2">
                        <i class="fa-solid fa-book text-emerald-400 text-base shrink-0"></i>
                        <span>${item.title}</span>
                    </div>
                </td>
                <td><span class="badge badge-purple">${item.category || 'คู่มือการปฏิบัติงาน (SOP)'}</span></td>
                <td class="font-mono text-xs text-slate-400">${item.file_size || '4.2 MB'}</td>
                <td class="text-xs text-slate-300">${item.uploaded_by || 'แสงตะวัน'}</td>
                <td>
                    <div class="flex items-center gap-1.5">
                        <button onclick="window.AttachmentManager ? window.AttachmentManager.openMediaViewer({data: '${item.file_url}', type: '${isPdf ? 'pdf' : 'image'}', name: '${item.title}'}) : window.open('${item.file_url}', '_blank')" class="btn btn-secondary btn-icon btn-sm" title="เปิด/อ่านคู่มือ">
                            <i class="fa-solid fa-book-open text-emerald-400"></i>
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
