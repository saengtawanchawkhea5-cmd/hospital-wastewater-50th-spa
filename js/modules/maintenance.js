/**
 * ============================================================================
 * ระบบจัดการระบบบำบัดน้ำเสีย โรงพยาบาล ๕๐ พรรษา มหาวชิราลงกรณ (SPA)
 * MAINTENANCE.JS - บันทึกและประวัติการซ่อมบำรุงรักษาเครื่องจักร (PM & Corrective)
 * ค้นหา & ปฏิบัติการข้อมูล, เพิ่ม, ลบ, แก้ไข, นำเข้า Excel/CSV, ดาวน์โหลดแม่แบบ
 * ============================================================================
 */

class MaintenanceModule {
    constructor() {
        this.items = [];
        this.filteredItems = [];
        this.editingId = null;
        this.sortField = 'recorded_at';
        this.sortDir = 'desc';
        this.currentPage = 1;
        this.pageSize = 20;
        this.sortOrder = 'date_desc';
        this.uploadedImages = [];
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
            window.App.bindTableSorting('table-maintenance-body', this, 'recorded_at', 'desc');
        }

        // ตัวเลือกจัดเรียงลำดับ (Sort Order)
        const sortOrderEl = document.getElementById('filter-maint-sort-order');
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
        const pageSizeEl = document.getElementById('filter-maint-page-size');
        if (pageSizeEl) {
            pageSizeEl.addEventListener('change', (e) => {
                this.pageSize = e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10);
                this.currentPage = 1;
                this.applyFilters();
            });
        }

        const btnAdd = document.getElementById('btn-add-maintenance');
        if (btnAdd) btnAdd.addEventListener('click', () => this.openAddModal());

        const btnAddAuto = document.getElementById('btn-add-maintenance-auto');
        if (btnAddAuto) btnAddAuto.addEventListener('click', () => {
            if (window.AutoGeneratorModule) {
                window.AutoGeneratorModule.openGeneratorModal('all');
            } else {
                this.openAddModal();
            }
        });

        // Quick Action Toolbar Buttons
        const btnRefresh = document.getElementById('btn-maint-refresh');
        if (btnRefresh) btnRefresh.addEventListener('click', async () => {
            await this.loadData();
            Swal.fire({
                icon: 'success',
                title: 'รีเฟรชข้อมูลสำเร็จ',
                text: 'อัปเดตบันทึกงานซ่อมบำรุงล่าสุดเรียบร้อย',
                timer: 1000,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });
        });

        const btnPreview = document.getElementById('btn-maint-preview');
        if (btnPreview) btnPreview.addEventListener('click', () => this.previewData());

        const btnExcel = document.getElementById('btn-maint-excel');
        if (btnExcel) btnExcel.addEventListener('click', () => this.exportExcel());

        const btnPdf = document.getElementById('btn-maint-pdf');
        if (btnPdf) btnPdf.addEventListener('click', () => this.exportPDF());

        const btnCsv = document.getElementById('btn-maint-csv');
        if (btnCsv) btnCsv.addEventListener('click', () => this.exportCSV());

        const btnTemplate = document.getElementById('btn-maint-template');
        if (btnTemplate) btnTemplate.addEventListener('click', () => window.ExportImportModule.downloadModuleTemplate('maintenance'));

        const btnImportTrigger = document.getElementById('btn-maint-import-trigger');
        const fileImportInput = document.getElementById('file-maint-import');
        if (btnImportTrigger && fileImportInput) {
            btnImportTrigger.addEventListener('click', () => fileImportInput.click());
            fileImportInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    window.ExportImportModule.importModuleExcelOrCSV(file, 'maintenance', () => this.loadData());
                    e.target.value = '';
                }
            });
        }

        const btnClear = document.getElementById('btn-maint-clear-all');
        if (btnClear) btnClear.addEventListener('click', () => {
            window.ExportImportModule.clearModuleData('maintenance', 'maintenance_records', () => this.loadData());
        });

        const btnResetFilter = document.getElementById('btn-maint-reset-filter');
        if (btnResetFilter) btnResetFilter.addEventListener('click', () => this.resetFilters());

        // Status Header Pills
        const pillAll = document.getElementById('pill-maint-all');
        if (pillAll) pillAll.addEventListener('click', () => this.resetFilters());

        const pillYear = document.getElementById('pill-maint-year');
        if (pillYear) pillYear.addEventListener('click', () => this.filterByCurrentYear());

        const pillMonth = document.getElementById('pill-maint-month');
        if (pillMonth) pillMonth.addEventListener('click', () => this.filterByCurrentMonth());

        const btnAddYear = document.getElementById('btn-add-year-maint');
        if (btnAddYear) btnAddYear.addEventListener('click', () => this.promptAddYear());

        // ตัวกรอง 7 ช่อง
        const inputSearch = document.getElementById('filter-maint-search');
        if (inputSearch) inputSearch.addEventListener('input', (e) => { this.filters.search = e.target.value; this.applyFilters(); });

        const selectCategory = document.getElementById('filter-maint-category');
        if (selectCategory) selectCategory.addEventListener('change', (e) => { this.filters.category = e.target.value; this.applyFilters(); });

        const selectBuilding = document.getElementById('filter-maint-building');
        if (selectBuilding) selectBuilding.addEventListener('change', (e) => { this.filters.building = e.target.value; this.applyFilters(); });

        const inputStartDate = document.getElementById('filter-maint-start-date');
        if (inputStartDate) inputStartDate.addEventListener('change', (e) => { this.filters.startDate = e.target.value; this.applyFilters(); });

        const inputEndDate = document.getElementById('filter-maint-end-date');
        if (inputEndDate) inputEndDate.addEventListener('change', (e) => { this.filters.endDate = e.target.value; this.applyFilters(); });

        const selectYear = document.getElementById('filter-maint-year');
        if (selectYear) selectYear.addEventListener('change', (e) => { this.filters.year = e.target.value; this.applyFilters(); });

        const selectMonth = document.getElementById('filter-maint-month');
        if (selectMonth) selectMonth.addEventListener('change', (e) => { this.filters.month = e.target.value; this.applyFilters(); });

        // ปุ่มเพิ่มอุปกรณ์ใหม่ด่วน
        const btnQuickAddEq = document.getElementById('btn-quick-add-eq-maint');
        if (btnQuickAddEq) {
            btnQuickAddEq.addEventListener('click', () => this.quickAddNewEquipment());
        }

        // ผูก Universal Attachment Manager (รองรับ อัปโหลดรูปภาพ, PDF, ถ่ายรูปสด, URL)
        if (window.AttachmentManager) {
            window.AttachmentManager.bindFormAttachments({
                moduleInstance: this,
                itemsProperty: 'uploadedImages',
                containerId: 'maint-image-gallery-container',
                fileInputId: 'maint-file-upload-input',
                browseBtnId: 'btn-maint-browse-files',
                cameraInputId: 'maint-file-camera-input',
                cameraBtnId: 'btn-maint-open-camera',
                urlInputId: 'maint-form-image-url-input',
                addUrlBtnId: 'btn-maint-add-url-image',
                clearBtnId: 'btn-maint-clear-all-images',
                badgeId: 'maint-image-count-badge',
                themeColor: 'amber',
                singleMode: false
            });
        }

        // ฟอร์มบันทึก
        const form = document.getElementById('form-maintenance');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveData();
            });
        }
    }

    async quickAddNewEquipment() {
        const { value: formValues } = await Swal.fire({
            title: '<i class="fa-solid fa-plus-circle text-amber-400"></i> เพิ่มอุปกรณ์/เครื่องจักรใหม่',
            html: `
                <div class="space-y-3 text-left">
                    <div>
                        <label class="text-xs text-slate-300 block mb-1">ชื่ออุปกรณ์ / หมายเลขจุดตรวจ *</label>
                        <input id="swal-maint-input-eq-name" class="swal2-input !mt-0 !w-full text-xs" placeholder="เช่น เครื่องสูบน้ำ SP 4, มอเตอร์กวน 1">
                    </div>
                    <div>
                        <label class="text-xs text-slate-300 block mb-1">หมวดหมู่อุปกรณ์ *</label>
                        <select id="swal-maint-input-eq-cat" class="swal2-select !mt-0 !w-full text-xs">
                            <option value="เครื่องจักรบำบัดน้ำเสีย">เครื่องจักรบำบัดน้ำเสีย (WWTP)</option>
                            <option value="ท่อส่งน้ำและเมนต์โฮลด์">ท่อส่งน้ำและเมนต์โฮลด์ (Manhole)</option>
                            <option value="บ่อบำบัดเฉพาะที่ (On-site)">บ่อบำบัดเฉพาะที่ (On-site)</option>
                            <option value="ระบบไฟฟ้าและควบคุม">ระบบไฟฟ้าและควบคุม</option>
                            <option value="อื่นๆ">อื่นๆ</option>
                        </select>
                    </div>
                    <div>
                        <label class="text-xs text-slate-300 block mb-1">สถานที่ติดตั้ง / อาคาร</label>
                        <input id="swal-maint-input-eq-loc" class="swal2-input !mt-0 !w-full text-xs" placeholder="เช่น อาคารระบบบำบัดน้ำเสีย">
                    </div>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: '<i class="fa-solid fa-floppy-disk"></i> บันทึกอุปกรณ์',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#f59e0b',
            cancelButtonColor: '#334155',
            preConfirm: () => {
                const name = document.getElementById('swal-maint-input-eq-name')?.value.trim();
                const cat = document.getElementById('swal-maint-input-eq-cat')?.value;
                const loc = document.getElementById('swal-maint-input-eq-loc')?.value.trim() || 'อาคารระบบบำบัดน้ำเสีย';
                if (!name) {
                    Swal.showValidationMessage('กรุณาระบุชื่ออุปกรณ์');
                    return false;
                }
                return { equipment_name: name, category: cat, location: loc };
            }
        });

        if (formValues) {
            try {
                const newRecord = {
                    id: 'eq-' + Date.now(),
                    equipment_name: formValues.equipment_name,
                    category: formValues.category,
                    location: formValues.location,
                    status: 'active',
                    created_at: new Date().toISOString()
                };
                await window.DataStore.insert('equipment_ref', newRecord);
                await this.populateEquipmentSelect();
                const sel = document.getElementById('maint-form-equipment');
                if (sel) sel.value = formValues.equipment_name;

                Swal.fire({
                    icon: 'success',
                    title: 'เพิ่มอุปกรณ์ใหม่เรียบร้อย',
                    text: `เพิ่ม "${formValues.equipment_name}" เข้าสู่ฐานข้อมูล equipment_ref แล้ว`,
                    timer: 1500,
                    showConfirmButton: false
                });
            } catch (err) {
                Swal.fire({ icon: 'error', title: 'เพิ่มอุปกรณ์ไม่สำเร็จ', text: err.message });
            }
        }
    }

    async handleImageFiles(fileList) {
        if (!fileList || fileList.length === 0) return;

        Swal.fire({
            title: 'กำลังประมวลผลรูปภาพ...',
            text: `กำลังย่อขนาดและอ่านรูปภาพ ${fileList.length} ไฟล์`,
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        for (let i = 0; i < fileList.length; i++) {
            const file = fileList[i];
            try {
                const compressedDataUrl = await this.compressAndReadFile(file);
                if (compressedDataUrl) {
                    this.uploadedImages.push(compressedDataUrl);
                }
            } catch (err) {
                console.error("Error reading and compressing file:", err);
            }
        }

        Swal.close();
        this.renderImageGallery();
    }

    compressAndReadFile(file, maxWidth = 1200, maxHeight = 1200, quality = 0.8) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.src = e.target.result;
                img.onload = () => {
                    let width = img.width;
                    let height = img.height;
                    if (width > maxWidth || height > maxHeight) {
                        if (width > height) {
                            height = Math.round((height * maxWidth) / width);
                            width = maxWidth;
                        } else {
                            width = Math.round((width * maxHeight) / height);
                            height = maxHeight;
                        }
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
                img.onerror = () => resolve(e.target.result);
            };
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
        });
    }

    addImageFromUrl(url) {
        if (!url) return;
        this.uploadedImages.push(url.trim());
        this.renderImageGallery();
    }

    removeImageAt(index) {
        if (index >= 0 && index < this.uploadedImages.length) {
            this.uploadedImages.splice(index, 1);
            this.renderImageGallery();
        }
    }

    clearAllImages() {
        this.uploadedImages = [];
        this.renderImageGallery();
    }

    renderImageGallery() {
        const gallery = document.getElementById('maint-image-gallery-container');
        const countBadge = document.getElementById('maint-image-count-badge');
        const clearBtn = document.getElementById('btn-maint-clear-all-images');
        if (!gallery) return;

        const count = this.uploadedImages.length;
        if (countBadge) {
            countBadge.textContent = `${count} รูป`;
            countBadge.className = count > 0 
                ? 'badge bg-amber-950/70 text-amber-300 border border-amber-700 text-[11px]'
                : 'badge bg-slate-800 text-slate-400 border border-slate-700 text-[11px]';
        }

        if (clearBtn) {
            clearBtn.style.display = count > 0 ? 'inline-block' : 'none';
        }

        if (count === 0) {
            gallery.innerHTML = `
                <div class="image-fallback-box col-span-full py-4 text-center text-slate-500 text-xs">
                    <i class="fa-regular fa-images text-2xl mb-1.5 block text-slate-600"></i>
                    <span>ยังไม่มีรูปภาพที่แนบ (คลิกเลือกไฟล์, ถ่ายรูป หรือวาง URL เพื่อเพิ่มรูปภาพ)</span>
                </div>
            `;
            return;
        }

        gallery.innerHTML = this.uploadedImages.map((src, idx) => `
            <div class="mach-gallery-card">
                <span class="mach-gallery-badge">#${idx + 1}</span>
                <img src="${src}" alt="รูปภาพที่ ${idx + 1}" onclick="window.MaintenanceModule.previewImageModal('${idx}')" title="คลิกดูภาพขยาย" />
                <button type="button" class="mach-gallery-delete-btn" onclick="window.MaintenanceModule.removeImageAt(${idx})" title="ลบรูปนี้">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        `).join('');
    }

    previewImageModal(indexOrSrc) {
        let src = indexOrSrc;
        if (typeof indexOrSrc === 'number' || (typeof indexOrSrc === 'string' && !indexOrSrc.startsWith('http') && !indexOrSrc.startsWith('data:'))) {
            const idx = parseInt(indexOrSrc);
            src = this.uploadedImages[idx] || indexOrSrc;
        }

        Swal.fire({
            imageUrl: src,
            imageAlt: 'รูปภาพงานซ่อมบำรุง',
            showConfirmButton: true,
            confirmButtonText: 'ปิดรูปภาพ',
            confirmButtonColor: '#3b82f6',
            background: '#0f172a',
            customClass: {
                popup: 'border border-slate-700 rounded-2xl'
            }
        });
    }

    setActivePill(activeId) {
        ['pill-maint-all', 'pill-maint-year', 'pill-maint-month'].forEach(id => {
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
            title: 'เพิ่มปี พ.ศ. สำหรับตัวกรองงานซ่อมบำรุง',
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
            const select = document.getElementById('filter-maint-year');
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
        const select = document.getElementById('filter-maint-year');
        if (select) select.value = currentYearBE;
        this.filters.year = currentYearBE;
        this.setActivePill('pill-maint-year');
        this.applyFilters();
        Swal.fire({
            icon: 'success',
            title: `กรองข้อมูลซ่อมบำรุงปี พ.ศ. ${currentYearBE}`,
            timer: 900,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
        });
    }

    filterByCurrentMonth() {
        const now = new Date();
        const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');
        const select = document.getElementById('filter-maint-month');
        if (select) select.value = currentMonth;
        this.filters.month = currentMonth;
        this.applyFilters();
    }

    async loadData() {
        this.items = await window.DataStore.getAll('maintenance_records', { orderBy: 'recorded_at', ascending: false });
        this.applyFilters();
    }

    applyFilters() {
        this.filteredItems = this.items.filter(item => {
            if (this.filters.search) {
                const q = this.filters.search.toLowerCase();
                const matchProb = (item.problem || '').toLowerCase().includes(q);
                const matchLoc = (item.location || '').toLowerCase().includes(q);
                const matchOp = (item.operator || '').toLowerCase().includes(q);
                const matchEq = (item.equipment_list || []).join(' ').toLowerCase().includes(q);
                if (!matchProb && !matchLoc && !matchOp && !matchEq) return false;
            }

            if (this.filters.category !== 'all') {
                if (this.filters.category !== item.job_type) return false;
            }

            // สถานที่ / แผนก
            if (this.filters.building && this.filters.building !== 'all') {
                if (window.App && window.App.matchBuildingFilter) {
                    if (!window.App.matchBuildingFilter(item.location, this.filters.building)) return false;
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
            window.App.updateTableSortUI('table-maintenance-body', this.sortField, this.sortDir);
        }

        this.renderTable(this.filteredItems);
    }

    resetFilters() {
        this.filters = { search: '', category: 'all', building: 'all', startDate: '', endDate: '', year: 'all', month: 'all' };
        const ids = ['filter-maint-search', 'filter-maint-category', 'filter-maint-start-date', 'filter-maint-end-date', 'filter-maint-year', 'filter-maint-month'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = el.tagName === 'SELECT' ? 'all' : '';
        });
        this.setActivePill('pill-maint-all');
        this.applyFilters();
        Swal.fire({
            icon: 'info',
            title: 'แสดงข้อมูลซ่อมบำรุงทั้งหมด',
            text: 'ล้างตัวกรองเรียบร้อยแล้ว',
            timer: 900,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
        });
    }

    renderTable(list) {
        const tbody = document.getElementById('table-maintenance-body');
        if (!tbody) return;

        const totalItems = list ? list.length : 0;

        // คำนวณผลรวมตามรายการกรองข้อมูล (Filter Summary Calculation)
        const totalCost = list.reduce((sum, item) => sum + (parseFloat(item.cost) || 0), 0);
        const pmCount = list.filter(item => item.job_type === 'ป้องกัน').length;
        const correctiveCount = totalItems - pmCount;
        const completedCount = list.filter(item => !item.status || item.status === 'เสร็จสิ้น' || item.status === 'done' || item.status === 'completed').length;
        const avgCost = totalItems > 0 ? totalCost / totalItems : 0;

        if (!list || list.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center py-8 text-slate-500">
                        <i class="fa-solid fa-screwdriver-wrench text-3xl mb-2"></i>
                        <div>ไม่พบรายการบันทึกงานซ่อมบำรุง</div>
                    </td>
                </tr>
            `;
            const tfoot = document.getElementById('table-maintenance-foot');
            if (tfoot) tfoot.innerHTML = '';

            if (window.App && window.App.renderPagination) {
                window.App.renderPagination({
                    containerId: 'pagination-maintenance',
                    totalItems: 0,
                    currentPage: this.currentPage,
                    pageSize: this.pageSize,
                    summaryCards: [
                        { title: 'จำนวนรายการทั้งหมด', value: '0 รายการ', subText: 'ตามเงื่อนไขที่กรอง', icon: 'fa-solid fa-list-check', color: 'cyan' },
                        { title: 'ค่าใช้จ่ายซ่อมรวม (TOTAL COST)', value: '฿0.00', subText: 'เฉลี่ย ฿0.00/รายการ', icon: 'fa-solid fa-coins', color: 'emerald' },
                        { title: 'งานบำรุงรักษาเชิงป้องกัน (PM)', value: '0 รายการ', subText: 'งานแก้ไข 0 รายการ', icon: 'fa-solid fa-shield-halved', color: 'cyan' },
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
            const eqList = Array.isArray(item.equipment_list) ? item.equipment_list : [];
            const isPM = item.job_type === 'ป้องกัน';

            let imgCount = 0;
            if (item.image_url) {
                if (typeof item.image_url === 'string' && item.image_url.startsWith('[') && item.image_url.endsWith(']')) {
                    try { imgCount = JSON.parse(item.image_url).length; } catch(e) { imgCount = 1; }
                } else if (Array.isArray(item.image_url)) {
                    imgCount = item.image_url.length;
                } else if (typeof item.image_url === 'string' && item.image_url.trim()) {
                    imgCount = 1;
                }
            }

            return `
                <tr>
                    <td class="text-slate-400 font-mono text-center">${globalIdx}</td>
                    <td class="font-mono text-xs text-slate-300">${window.App.formatDateTime(item.recorded_at)}</td>
                    <td class="font-semibold text-white">
                        <div>${item.location || 'อาคารระบบบำบัดน้ำเสีย'}</div>
                        <div class="flex flex-wrap gap-1 mt-1">
                            ${eqList.map(e => `<span class="badge bg-slate-900 text-yellow-300 border border-amber-500/40 text-[10px]">${e}</span>`).join('')}
                        </div>
                    </td>
                    <td>
                        <span class="badge ${isPM ? 'badge-success' : 'badge-warning'}">
                            ${item.job_type || 'ทั่วไป'}
                        </span>
                        ${imgCount > 0 ? `<div class="mt-1"><span class="badge bg-amber-950/70 text-amber-300 border border-amber-700/60 text-[10px]"><i class="fa-solid fa-camera mr-1 text-amber-400"></i>${imgCount} รูป</span></div>` : ''}
                    </td>
                    <td class="text-xs text-slate-200">
                        <strong>${item.problem}</strong>
                        <div class="text-[11px] text-slate-400 mt-0.5">${item.fix_method || ''}</div>
                    </td>
                    <td class="font-mono text-right text-emerald-400 font-bold bg-emerald-950/20 px-2 py-1 rounded">
                        ฿${parseFloat(item.cost || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </td>
                    <td class="text-xs text-slate-200 font-medium">
                        <span class="inline-flex items-center gap-1 text-slate-200">
                            <i class="fa-solid fa-user-check text-cyan-400 text-xs"></i> ${item.operator || '-'}
                        </span>
                    </td>
                    <td class="text-center">
                        <div class="flex items-center justify-center gap-1.5">
                            <button class="btn btn-outline btn-icon btn-sm text-blue-400 hover:text-white" onclick="window.MaintenanceModule.viewDetails('${item.id}')" title="ดูรายละเอียด">
                                <i class="fa-solid fa-eye"></i>
                            </button>
                            <button class="btn btn-outline btn-icon btn-sm text-amber-400 hover:text-white" onclick="window.MaintenanceModule.openEditModal('${item.id}')" title="แก้ไข">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button class="btn btn-outline btn-icon btn-sm text-rose-400 hover:text-white" onclick="window.MaintenanceModule.deleteRecord('${item.id}')" title="ลบ">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Render Table Footer Summary Row
        const tfoot = document.getElementById('table-maintenance-foot');
        if (tfoot) {
            tfoot.innerHTML = `
                <tr class="table-summary-row border-t-2 border-emerald-500/60 bg-emerald-950/20">
                    <td class="text-center font-bold text-emerald-400 py-3.5"><i class="fa-solid fa-calculator"></i> รวม</td>
                    <td colspan="4" class="font-bold text-emerald-300 py-3.5">
                        <span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> รวมงานซ่อมบำรุง (${totalItems.toLocaleString()} รายการ - PM: ${pmCount} / แก้ไข: ${correctiveCount}):</span>
                    </td>
                    <td class="font-mono text-right text-emerald-400 font-bold py-3.5 text-sm bg-emerald-950/40 px-2 rounded">฿${totalCost.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td class="font-bold text-emerald-400 py-3.5 text-xs text-center">
                        <span class="badge badge-success text-[11px] py-1 px-2.5"><i class="fa-solid fa-circle-check mr-1"></i>เสร็จสิ้น ${completedCount}/${totalItems}</span>
                    </td>
                    <td class="text-center text-xs text-slate-300 py-3.5">ทีมวิศวกรรมบำรุงรักษา</td>
                    <td class="text-center text-xs text-emerald-400 py-3.5 font-bold"><span class="badge badge-success text-[11px] py-1 px-2">อนุมัติแล้ว</span></td>
                </tr>
            `;
        }

        // Summary Cards Configuration
        const summaryCards = [
            {
                title: 'รายการงานซ่อมบำรุงทั้งหมด',
                value: `${totalItems.toLocaleString()} รายการ`,
                subText: 'ตามตัวกรองที่เลือก',
                icon: 'fa-solid fa-screwdriver-wrench',
                color: 'cyan'
            },
            {
                title: 'บำรุงเชิงป้องกัน (PM) VS แก้ไข (CM)',
                value: `PM: ${pmCount} / CM: ${correctiveCount}`,
                subText: `สัดส่วน PM ${(totalItems > 0 ? ((pmCount / totalItems) * 100) : 0).toFixed(1)}% ของงานทั้งหมด`,
                icon: 'fa-solid fa-right-left',
                color: 'blue'
            },
            {
                title: 'งานที่ดำเนินการแล้วเสร็จ (DONE)',
                value: `${completedCount} / ${totalItems} รายการ`,
                subText: `อัตรางานเสร็จ ${(totalItems > 0 ? ((completedCount / totalItems) * 100) : 0).toFixed(1)}% สมบูรณ์`,
                icon: 'fa-solid fa-circle-check',
                color: 'emerald'
            },
            {
                title: 'มูลค่าค่าซ่อมบำรุงรวม (TOTAL COST)',
                value: `฿${totalCost.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`,
                subText: `เฉลี่ย ฿${(totalItems > 0 ? (totalCost / totalItems) : 0).toFixed(0)} บาท/รายการ`,
                icon: 'fa-solid fa-money-bill-wave',
                color: 'amber'
            }
        ];

        // Render pagination controls and summary cards
        if (window.App && window.App.renderPagination) {
            window.App.renderPagination({
                containerId: 'pagination-maintenance',
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
                    const sizeEl = document.getElementById('filter-maint-page-size');
                    if (sizeEl) sizeEl.value = String(s);
                    this.renderTable(this.filteredItems);
                }
            });
        }
    }

    async openAddModal() {
        this.editingId = null;
        const modal = document.getElementById('modal-maintenance');
        const title = document.getElementById('modal-maintenance-title');
        const form = document.getElementById('form-maintenance');
        if (!modal || !form) return;

        form.reset();
        title.innerHTML = '<i class="fa-solid fa-screwdriver-wrench text-amber-400"></i> บันทึกงานซ่อมบำรุงเครื่องจักร';

        const now = new Date();
        const localIso = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        document.getElementById('maint-form-datetime').value = localIso;

        const currentUser = (window.AuthService && typeof window.AuthService.getCurrentUser === 'function') 
            ? window.AuthService.getCurrentUser() 
            : null;
        const currentName = currentUser ? (currentUser.full_name || currentUser.username) : "";
        const elOp = document.getElementById('maint-form-operator');
        if (elOp) elOp.value = currentName;

        this.uploadedImages = [];
        if (window.AttachmentManager) {
            window.AttachmentManager.updateContainerDisplay(this, 'uploadedImages', 'maint-image-gallery-container', 'maint-image-count-badge', 'amber', false);
        } else {
            this.renderImageGallery();
        }

        await this.populateEquipmentSelect();

        window.App.openModal('modal-maintenance');
    }

    async openEditModal(id) {
        const item = this.items.find(x => x.id === id);
        if (!item) return;

        this.editingId = id;
        const title = document.getElementById('modal-maintenance-title');
        title.innerHTML = '<i class="fa-solid fa-pen-to-square text-amber-400"></i> แก้ไขบันทึกงานซ่อมบำรุง';

        const d = new Date(item.recorded_at);
        const localIso = !isNaN(d) ? new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16) : "";

        document.getElementById('maint-form-datetime').value = localIso;
        document.getElementById('maint-form-location').value = item.location || "";
        document.getElementById('maint-form-jobtype').value = item.job_type || "ป้องกัน";
        document.getElementById('maint-form-problem').value = item.problem || "";
        document.getElementById('maint-form-cause').value = item.cause || "";
        document.getElementById('maint-form-method').value = item.fix_method || "";
        document.getElementById('maint-form-result').value = item.fix_result || "";
        document.getElementById('maint-form-cost').value = item.cost || 0;
        document.getElementById('maint-form-operator').value = item.operator || "";
        document.getElementById('maint-form-remarks').value = item.remarks || "";

        // โหลดรูปภาพและไฟล์แนบที่มีอยู่
        this.uploadedImages = window.AttachmentManager 
            ? window.AttachmentManager.normalizeAttachments(item.image_url) 
            : [];
        if (window.AttachmentManager) {
            window.AttachmentManager.updateContainerDisplay(this, 'uploadedImages', 'maint-image-gallery-container', 'maint-image-count-badge', 'amber', false);
        } else {
            this.renderImageGallery();
        }

        await this.populateEquipmentSelect();
        const selEq = document.getElementById('maint-form-equipment');
        if (selEq && item.equipment_list && item.equipment_list.length > 0) {
            selEq.value = item.equipment_list[0];
        }

        window.App.openModal('modal-maintenance');
    }

    async populateEquipmentSelect() {
        const sel = document.getElementById('maint-form-equipment');
        if (!sel) return;

        const refList = await window.DataStore.getAll('equipment_ref');
        sel.innerHTML = refList.map(e => `<option value="${e.equipment_name}">${e.equipment_name} (${e.category || 'ทั่วไป'})</option>`).join('');
    }

    viewDetails(id) {
        const item = this.items.find(x => x.id === id);
        if (!item) return;

        const eqList = Array.isArray(item.equipment_list) ? item.equipment_list : [];

        const images = window.AttachmentManager 
            ? window.AttachmentManager.normalizeAttachments(item.image_url) 
            : [];

        const imagesHtml = images.length > 0 ? `
            <div class="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-2">
                <div class="text-xs font-bold text-amber-300 flex items-center justify-between">
                    <span class="flex items-center gap-1.5"><i class="fa-solid fa-paperclip text-amber-400"></i> รูปภาพและเอกสารแนบการซ่อมบำรุง</span>
                    <span class="badge bg-amber-950/70 text-amber-300 border border-amber-700/60 text-[10px]">${images.length} รายการ</span>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 pt-1">
                    ${images.map((att, i) => {
                        if (att.type === 'pdf') {
                            return `
                                <div class="p-2.5 rounded-lg bg-slate-950 border border-red-800/60 flex flex-col justify-between cursor-pointer hover:border-red-500 transition-all" onclick="window.AttachmentManager.openMediaViewer({data: '${att.data}', type: 'pdf', name: '${att.name}'})">
                                    <div class="flex items-center gap-2">
                                        <i class="fa-solid fa-file-pdf text-2xl text-red-400"></i>
                                        <span class="text-[11px] font-bold text-white truncate">${att.name}</span>
                                    </div>
                                    <span class="text-[10px] text-red-400 mt-2 block font-mono">เปิดเอกสาร PDF</span>
                                </div>
                            `;
                        }
                        return `
                            <div class="relative group rounded-lg overflow-hidden border border-slate-700/70 bg-slate-900 hover:border-amber-500/80 transition-all cursor-pointer" onclick="window.AttachmentManager.openMediaViewer({data: '${att.data}', type: 'image', name: '${att.name}'})">
                                <span class="absolute top-1 left-1 bg-slate-950/80 text-amber-300 font-mono text-[9px] px-1.5 py-0.5 rounded border border-amber-500/30 z-10">#${i + 1}</span>
                                <img src="${att.data}" alt="รูปภาพซ่อมบำรุง ${i + 1}" class="w-full h-24 object-cover group-hover:scale-105 transition-transform duration-300" />
                                <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs">
                                    <i class="fa-solid fa-magnifying-glass-plus text-base"></i>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        ` : '';

        Swal.fire({
            title: `<div class="text-base font-bold text-white flex items-center gap-2"><i class="fa-solid fa-screwdriver-wrench text-amber-400"></i> รายละเอียดงานซ่อมบำรุงรักษา</div>`,
            html: `
                <div class="text-left text-xs space-y-3.5 p-2">
                    <!-- Top Info Summary Bar -->
                    <div class="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-900/90 border border-slate-800 rounded-xl">
                        <div>
                            <span class="text-[11px] text-slate-400 block"><i class="fa-regular fa-clock text-cyan-400"></i> วัน-เวลาที่ดำเนินการ:</span>
                            <span class="text-sm font-bold text-white font-mono">${window.App.formatDateTime(item.recorded_at)}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="badge ${item.job_type === 'ป้องกัน' ? 'badge-success' : 'badge-warning'} text-xs py-1 px-2.5">
                                <i class="fa-solid fa-wrench mr-1"></i> ประเภท: ${item.job_type || 'ทั่วไป'}
                            </span>
                            <span class="badge bg-emerald-950/70 text-emerald-300 border border-emerald-700/60 font-mono font-bold text-xs py-1 px-2.5">
                                ฿${parseFloat(item.cost || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>

                    <!-- Location & Equipment -->
                    <div class="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-2">
                        <div class="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                            <i class="fa-solid fa-location-dot text-blue-400"></i> สถานที่ & อุปกรณ์ที่เกี่ยวข้อง
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            <div class="p-2 bg-slate-900 rounded border border-slate-800">
                                <span class="text-slate-400 block text-[10px]">สถานที่ตั้ง:</span>
                                <span class="text-slate-200 font-medium">${item.location || 'อาคารระบบบำบัดน้ำเสีย'}</span>
                            </div>
                            <div class="p-2 bg-slate-900 rounded border border-slate-800">
                                <span class="text-slate-400 block text-[10px]">อุปกรณ์:</span>
                                <span class="text-yellow-300 font-medium">${eqList.join(', ') || '-'}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Problem, Cause, Method, Result -->
                    <div class="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-2.5">
                        <div class="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                            <i class="fa-solid fa-clipboard-list text-amber-400"></i> บันทึกปัญหา & วิธีการแก้ไข
                        </div>
                        <div class="space-y-2 text-xs">
                            <div class="p-2.5 bg-rose-950/20 border border-rose-800/40 rounded-lg">
                                <span class="text-rose-300 font-bold block mb-0.5"><i class="fa-solid fa-triangle-exclamation mr-1"></i> ปัญหาที่พบ:</span>
                                <span class="text-slate-200">${item.problem || '-'}</span>
                            </div>
                            ${item.cause ? `
                                <div class="p-2 bg-slate-900 border border-slate-800 rounded-lg">
                                    <span class="text-slate-400 block text-[10px]">สาเหตุ:</span>
                                    <span class="text-slate-300">${item.cause}</span>
                                </div>
                            ` : ''}
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div class="p-2.5 bg-slate-900 border border-slate-800 rounded-lg">
                                    <span class="text-cyan-300 font-bold block mb-0.5"><i class="fa-solid fa-toolbox mr-1"></i> วิธีการแก้ไข:</span>
                                    <span class="text-slate-200">${item.fix_method || '-'}</span>
                                </div>
                                <div class="p-2.5 bg-emerald-950/20 border border-emerald-800/40 rounded-lg">
                                    <span class="text-emerald-300 font-bold block mb-0.5"><i class="fa-solid fa-circle-check mr-1"></i> ผลการแก้ไข:</span>
                                    <span class="text-emerald-200 font-medium">${item.fix_result || '-'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Operator & Remarks -->
                    <div class="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-2">
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            <div class="p-2 bg-slate-900 rounded border border-slate-800">
                                <span class="text-slate-400 block text-[10px]"><i class="fa-solid fa-user-check text-cyan-400"></i> ผู้ดำเนินการ:</span>
                                <span class="text-slate-200 font-bold">${item.operator || '-'}</span>
                            </div>
                            <div class="p-2 bg-slate-900 rounded border border-slate-800">
                                <span class="text-slate-400 block text-[10px]"><i class="fa-solid fa-comment-dots text-slate-400"></i> หมายเหตุ:</span>
                                <span class="text-slate-300">${item.remarks || '-'}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Photos Section -->
                    ${imagesHtml}
                </div>
            `,
            customClass: {
                popup: 'swal-machinery-wide-modal'
            },
            confirmButtonText: 'ปิดหน้าต่าง',
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
            await window.DataStore.delete('maintenance_records', id);
            Swal.fire({ icon: 'success', title: 'ลบข้อมูลสำเร็จ', timer: 1200, showConfirmButton: false });
            await this.loadData();
        }
    }

    async saveData() {
        const form = document.getElementById('form-maintenance');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        // ประมวลผลรูปภาพและเอกสารแนบ (Universal Attachment Manager)
        let finalImageUrl = null;
        if (window.AttachmentManager && this.uploadedImages && this.uploadedImages.length > 0) {
            finalImageUrl = window.AttachmentManager.serializeAttachments(this.uploadedImages, false);
        } else if (this.uploadedImages.length === 1) {
            finalImageUrl = typeof this.uploadedImages[0] === 'object' ? this.uploadedImages[0].data : this.uploadedImages[0];
        } else if (this.uploadedImages.length > 1) {
            finalImageUrl = JSON.stringify(this.uploadedImages);
        }

        const currentUser = (window.AuthService && typeof window.AuthService.getCurrentUser === 'function') 
            ? window.AuthService.getCurrentUser() 
            : null;
        const currentName = currentUser ? (currentUser.full_name || currentUser.username) : 'เจ้าหน้าที่';
        const elOp = document.getElementById('maint-form-operator');
        const operatorName = (elOp && elOp.value && elOp.value.trim()) ? elOp.value.trim() : currentName;

        const payload = {
            recorded_at: document.getElementById('maint-form-datetime').value ? new Date(document.getElementById('maint-form-datetime').value).toISOString() : new Date().toISOString(),
            location: document.getElementById('maint-form-location').value.trim() || 'อาคารระบบบำบัดน้ำเสีย',
            equipment_list: [selEq],
            job_type: document.getElementById('maint-form-jobtype').value,
            problem: document.getElementById('maint-form-problem').value.trim(),
            cause: document.getElementById('maint-form-cause').value.trim() || null,
            fix_method: document.getElementById('maint-form-method').value.trim() || null,
            fix_result: document.getElementById('maint-form-result').value.trim() || 'ใช้งานได้ปกติ',
            cost: parseFloat(document.getElementById('maint-form-cost').value) || 0,
            operator: operatorName,
            image_url: finalImageUrl,
            remarks: document.getElementById('maint-form-remarks').value.trim()
        };

        Swal.fire({ title: 'กำลังบันทึกข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        try {
            let res;
            if (this.editingId) {
                res = await window.DataStore.update('maintenance_records', this.editingId, payload);
            } else {
                res = await window.DataStore.insert('maintenance_records', payload);
            }

            window.App.closeModal('modal-maintenance');
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

    exportExcel() {
        const data = this.filteredItems.map(item => ({
            'วัน-เวลา': window.App.formatDateTime(item.recorded_at),
            'สถานที่': item.location,
            'ประเภทงาน': item.job_type,
            'อุปกรณ์': (item.equipment_list || []).join(', '),
            'ปัญหาที่พบ': item.problem,
            'วิธีการแก้ไข': item.fix_method || '',
            'ผลการซ่อม': item.fix_result || '',
            'ค่าใช้จ่าย (บาท)': item.cost || 0,
            'ผู้ดำเนินการ': item.operator,
            'หมายเหตุ': item.remarks || ''
        }));
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, "บันทึกการซ่อมบำรุง");
        XLSX.writeFile(wb, `รายงานซ่อมบำรุง_รพ.๕๐พรรษา_${new Date().toISOString().split('T')[0]}.xlsx`);
        Swal.fire({ icon: 'success', title: 'ส่งออก Excel เรียบร้อย', timer: 1200, showConfirmButton: false });
    }

    exportCSV() {
        const data = this.filteredItems.map(item => ({
            'วัน-เวลา': window.App.formatDateTime(item.recorded_at),
            'สถานที่': item.location,
            'ประเภทงาน': item.job_type,
            'อุปกรณ์': (item.equipment_list || []).join(', '),
            'ปัญหาที่พบ': item.problem,
            'ค่าใช้จ่าย': item.cost || 0,
            'ผู้ดำเนินการ': item.operator
        }));
        window.ExportImportModule.exportModuleCSV('รายงานซ่อมบำรุง_รพ.๕๐พรรษา', data);
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
        
        const docCode = `REP-MAINT-${Math.floor(200000 + Math.random() * 800000)}`;

        const totalItems = this.filteredItems.length;
        const totalCost = this.filteredItems.reduce((acc, x) => acc + (parseFloat(x.cost) || 0), 0);
        const preventiveCount = this.filteredItems.filter(x => (x.job_type || '').includes('ป้องกัน') || (x.job_type || '').includes('PM')).length;
        const correctiveCount = totalItems - preventiveCount;

        // สรุป 10 อันดับงานซ่อมบำรุงตามอุปกรณ์
        const eqMaintMap = {};
        this.filteredItems.forEach(item => {
            const eqName = (item.equipment_list && item.equipment_list.length > 0) ? item.equipment_list[0] : (item.location || 'อุปกรณ์ทั่วไป');
            const cost = parseFloat(item.cost) || 0;
            if (!eqMaintMap[eqName]) eqMaintMap[eqName] = { count: 0, cost: 0 };
            eqMaintMap[eqName].count++;
            eqMaintMap[eqName].cost += cost;
        });

        const topMaint = Object.entries(eqMaintMap).sort((a, b) => b[1].count - a[1].count);
        const top10RowsHtml = topMaint.map(([name, data], index) => {
            const percent = totalCost > 0 ? ((data.cost / totalCost) * 100).toFixed(1) : '0.0';
            return `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="text-align: center; color: #64748b; font-family: monospace; padding: 7px 12px;">${index + 1}</td>
                    <td style="font-weight: 600; color: #1e293b; padding: 7px 12px;">${name}</td>
                    <td style="text-align: right; font-family: monospace; color: #334155; padding: 7px 12px;">${data.count.toFixed(2)}</td>
                    <td style="text-align: right; font-family: monospace; font-weight: 700; color: #059669; padding: 7px 12px;">฿${data.cost.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                    <td style="text-align: right; font-family: monospace; color: #475569; padding: 7px 12px;">${percent}%</td>
                </tr>
            `;
        }).join('');

        const recentSlice = this.filteredItems.slice(0, 20);
        const recentRowsHtml = recentSlice.map((item, index) => {
            const dateFormatted = window.App.formatDateTime(item.recorded_at);
            return `
                <tr style="border-bottom: 1px solid #f1f5f9; font-size: 11px;">
                    <td style="text-align: center; color: #64748b; font-family: monospace; padding: 6px 10px;">${index + 1}</td>
                    <td style="font-family: monospace; color: #475569; padding: 6px 10px;">${dateFormatted}</td>
                    <td style="color: #1e293b; font-weight: 600; padding: 6px 10px;">${item.location || '-'}</td>
                    <td style="color: #475569; padding: 6px 10px;">${item.job_type || '-'}</td>
                    <td style="font-family: monospace; text-align: right; font-weight: 700; color: #059669; padding: 6px 10px;">฿${parseFloat(item.cost || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                    <td style="color: #475569; padding: 6px 10px;">${item.operator || '-'}</td>
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
                            งานบริหารสิ่งแวดล้อมและสุขาภิบาลเพื่อการจัดการน้ำเสีย และมาตรฐาน GREEN &amp; CLEAN Hospital (WWTP Maintenance &amp; PM)
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
                    <span>รายงานสรุปประวัติงานซ่อมบำรุงและบำรุงรักษาเชิงป้องกันระบบบำบัดน้ำเสีย</span>
                </div>
                <div class="text-[11px] font-bold text-emerald-700 hidden sm:block">
                    ระบบบำบัดน้ำเสีย โรงพยาบาล ๕๐ พรรษา มหาวชิราลงกรณ
                </div>
            </div>

            <!-- 4 KPI Boxes Grid -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                <div class="doc-kpi-card doc-kpi-green">
                    <div class="text-[11px] font-bold text-emerald-800">งานซ่อมบำรุงทั้งหมด (รายการ)</div>
                    <div class="text-xl font-black text-emerald-900 font-mono mt-1">${totalItems.toLocaleString()}.00 <span class="text-xs font-normal">รายการ</span></div>
                    <div class="text-[10px] text-emerald-700 mt-0.5">เสร็จสิ้นสมบูรณ์ 100%</div>
                </div>

                <div class="doc-kpi-card doc-kpi-blue">
                    <div class="text-[11px] font-bold text-blue-800">งานบำรุงรักษาเชิงป้องกัน (PM)</div>
                    <div class="text-xl font-black text-blue-900 font-mono mt-1">${preventiveCount.toLocaleString()}.00 <span class="text-xs font-normal">รายการ</span></div>
                    <div class="text-[10px] text-blue-700 mt-0.5">ตามรอบแผนงานประจำปี</div>
                </div>

                <div class="doc-kpi-card doc-kpi-purple">
                    <div class="text-[11px] font-bold text-purple-800">งานแก้ไข/ซ่อมแซมเร่งด่วน</div>
                    <div class="text-xl font-black text-purple-900 font-mono mt-1">${correctiveCount.toLocaleString()}.00 <span class="text-xs font-normal">รายการ</span></div>
                    <div class="text-[10px] text-purple-700 mt-0.5">ดำเนินการทันทีโดยทีมช่าง</div>
                </div>

                <div class="doc-kpi-card doc-kpi-amber">
                    <div class="text-[11px] font-bold text-amber-800">งบประมาณค่าใช้จ่ายรวม</div>
                    <div class="text-xl font-black text-amber-900 font-mono mt-1">฿${totalCost.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</div>
                    <div class="text-[10px] text-amber-700 mt-0.5">บริหารงบประมาณอย่างคุ้มค่า</div>
                </div>
            </div>

            <!-- Section 1: สรุปงานซ่อมบำรุงตามอุปกรณ์ -->
            <div class="mb-5">
                <div class="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                    <i class="fa-solid fa-chart-simple text-emerald-600"></i>
                    <span>สรุปงานซ่อมบำรุงและงบประมาณจำแนกตามเครื่องจักรและพื้นที่</span>
                </div>
                <div class="overflow-x-auto border border-slate-200 rounded-lg">
                    <table class="doc-table-clean">
                        <thead>
                            <tr>
                                <th style="width: 50px; text-align: center;">ลำดับ</th>
                                <th>อุปกรณ์ / พื้นที่ที่ดำเนินการ</th>
                                <th style="text-align: right;">จำนวนครั้ง (ครั้ง)</th>
                                <th style="text-align: right;">ค่าใช้จ่ายรวม (บาท)</th>
                                <th style="text-align: right;">สัดส่วนงบ (%)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${top10RowsHtml || '<tr><td colspan="5" class="text-center py-4 text-slate-400">ไม่พบข้อมูลสรุป</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Section 2: รายการบันทึกล่าสุด -->
            <div>
                <div class="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                    <i class="fa-solid fa-clock-rotate-left text-blue-600"></i>
                    <span>รายการบันทึกงานซ่อมบำรุงล่าสุด (${recentSlice.length} รายการ)</span>
                </div>
                <div class="overflow-x-auto border border-slate-200 rounded-lg">
                    <table class="doc-table-clean">
                        <thead>
                            <tr>
                                <th style="width: 40px; text-align: center;">ลำดับ</th>
                                <th>วัน-เวลา</th>
                                <th>สถานที่ / อุปกรณ์</th>
                                <th>ประเภทงาน</th>
                                <th style="text-align: right;">ค่าใช้จ่าย</th>
                                <th>ผู้ดำเนินงาน</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${recentRowsHtml || '<tr><td colspan="6" class="text-center py-4 text-slate-400">ไม่พบข้อมูลบันทึก</td></tr>'}
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

window.MaintenanceModule = new MaintenanceModule();
