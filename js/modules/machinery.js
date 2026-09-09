/**
 * ============================================================================
 * ระบบจัดการระบบบำบัดน้ำเสีย โรงพยาบาล ๕๐ พรรษา มหาวชิราลงกรณ (SPA)
 * MACHINERY.JS - ตรวจสอบการทำงานของเครื่องจักร & เช็คลิสต์อุปกรณ์
 * ค้นหา & ปฏิบัติการข้อมูล, เพิ่ม, ลบ, แก้ไข, นำเข้า Excel/CSV, ดาวน์โหลดแม่แบบ
 * ============================================================================
 */

class MachineryModule {
    constructor() {
        this.items = [];
        this.filteredItems = [];
        this.editingId = null;
        this.selectedEquipments = new Set();
        this.uploadedImages = [];
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

        // โครงสร้างการตรวจสอบเครื่องจักร: 17 รายการรายเครื่องประจำวัน + เมนต์โฮลด์และบ่อออนไซน์ตามรอบวันในสัปดาห์
        this.machinerySchedule = {
            dailyItems: [
                'ความสะอาดอาคาร',
                'เครื่องสูบน้ำ SP 1',
                'เครื่องสูบน้ำ SP 2',
                'เครื่องสูบน้ำ SP 3',
                'เครื่องเติมอากาศ B1',
                'เครื่องเติมอากาศ B2',
                'เครื่องเติมอากาศ B3',
                'ตู้คอนโทรลควบคุมระบบไฟฟ้า',
                'มิเตอร์วัดหน่วยไฟฟ้า',
                'สายพานเครื่องเติมอากาศ B1',
                'สายพานเครื่องเติมอากาศ B2',
                'สายพานเครื่องเติมอากาศ B3',
                'ตะแกรงดักขยะ',
                'โซ่ดึงรอกเครื่องสูบ SP 1',
                'โซ่ดึงรอกเครื่องสูบ SP 2',
                'โซ่ดึงรอกเครื่องสูบ SP 3',
                'สระน้ำ'
            ],
            daySpecificItems: {
                1: {
                    dayName: 'วันจันทร์',
                    items: [
                        'เมนต์โฮลด์ที่ 1-14',
                        'บ่อพักน้ำเสียไตเทียมหลังห้องการเงิน',
                        'บ่อออนไซน์หลังวิหาร',
                        'บ่อออนไซน์หลัง X-RAY'
                    ]
                },
                2: {
                    dayName: 'วันอังคาร',
                    items: [
                        'เมนต์โฮลด์ที่ 15-21',
                        'บ่อออนไซน์อาคารผู้ป่วยใน 1 (IPD 1)',
                        'บ่อออนไซน์อาคารโภชนาการ',
                        'บ่อออนไซน์อาคารซักฟอก'
                    ]
                },
                3: {
                    dayName: 'วันพุธ',
                    items: [
                        'เมนต์โฮลด์ที่ 22-35',
                        'บ่อออนไซน์อาคารผู้ป่วยนอก (OPD)',
                        'บ่อออนไซน์อาคารพยาธิวิทยา',
                        'บ่อออนไซน์อาคารคลังเวชภัณฑ์และเภสัชกรรม'
                    ]
                },
                4: {
                    dayName: 'วันพฤหัสบดี',
                    items: [
                        'เมนต์โฮลด์ที่ 36-42',
                        'บ่อออนไซน์อาคารอุบัติเหตุและฉุกเฉิน (ER)',
                        'บ่อออนไซน์อาคารผ่าตัดและห้องคลอด',
                        'บ่อออนไซน์อาคารสนับสนุนบริการ'
                    ]
                },
                5: {
                    dayName: 'วันศุกร์',
                    items: [
                        'เมนต์โฮลด์ที่ 43-53',
                        'บ่อออนไซน์อาคารแพทย์แผนไทย',
                        'บ่อออนไซน์อาคารกายภาพบำบัด',
                        'บ่อออนไซน์ศูนย์ไตเทียม (ส่วนขยาย)'
                    ]
                },
                6: {
                    dayName: 'วันเสาร์',
                    items: [
                        'เมนต์โฮลด์ที่ 54-67',
                        'บ่อออนไซน์บ้านพักบุคลากร โซน A',
                        'บ่อออนไซน์บ้านพักแพทย์และพยาบาล',
                        'บ่อออนไซน์อาคารอำนวยการและสำนักงาน'
                    ]
                },
                0: {
                    dayName: 'วันอาทิตย์',
                    items: [
                        'เมนต์โฮลด์ที่ 68-87',
                        'บ่อออนไซน์บ้านพักบุคลากร โซน B',
                        'บ่อออนไซน์โรงอาหารกลาง',
                        'บ่อออนไซน์บ่อรับน้ำทิ้งโซนหลังโรงพยาบาล'
                    ]
                }
            }
        };
    }

    // ฟังก์ชันแปลง equipment_list จากทุกรูปแบบ (Array, Postgres array literal {"a","b"}, JSON string, CSV) ให้เป็น Array อย่างปลอดภัย
    normalizeEquipmentList(eq) {
        if (!eq) return [];
        if (Array.isArray(eq)) return eq;
        if (typeof eq === 'string') {
            const str = eq.trim();
            if (str.startsWith('[') && str.endsWith(']')) {
                try {
                    const parsed = JSON.parse(str);
                    if (Array.isArray(parsed)) return parsed;
                } catch (e) {}
            }
            if (str.startsWith('{') && str.endsWith('}')) {
                return str.slice(1, -1)
                    .split(',')
                    .map(s => s.replace(/^"|"$/g, '').trim())
                    .filter(Boolean);
            }
            if (str.includes(',')) {
                return str.split(',').map(s => s.trim()).filter(Boolean);
            }
            if (str) return [str];
        }
        return [];
    }

    // คำนวณและจัดสรรรายการเช็คลิสต์เครื่องจักร, เมนต์โฮลด์ และบ่อออนไซน์จากฐานข้อมูล equipment_ref โดยตรง
    getMachineryChecklistForDate(dateStrOrObj, refList = null) {
        let d;
        if (!dateStrOrObj) {
            d = new Date();
        } else if (typeof dateStrOrObj === 'string') {
            const datePart = dateStrOrObj.split('T')[0];
            const parts = datePart.split('-');
            if (parts.length === 3) {
                d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            } else {
                d = new Date(dateStrOrObj);
            }
        } else {
            d = new Date(dateStrOrObj);
        }

        const dayOfWeek = isNaN(d.getDay()) ? new Date().getDay() : d.getDay();
        const dayNames = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];
        const dayName = dayNames[dayOfWeek];

        // ดึงรายการสดจากฐานข้อมูล equipment_ref อย่างปลอดภัย
        let allRefs = [];
        if (refList && Array.isArray(refList) && refList.length > 0) {
            allRefs = refList;
        } else if (window.DataStore && typeof window.DataStore.getLocalDatabase === 'function') {
            const db = window.DataStore.getLocalDatabase();
            allRefs = (db && Array.isArray(db['equipment_ref'])) ? db['equipment_ref'] : [];
        } else if (typeof SAMPLE_DATABASE !== 'undefined' && Array.isArray(SAMPLE_DATABASE.equipment_ref)) {
            allRefs = SAMPLE_DATABASE.equipment_ref;
        }

        if (allRefs.length === 0) {
            const sched = this.machinerySchedule;
            const daily = sched.dailyItems || [];
            const dayConfig = sched.daySpecificItems[dayOfWeek] || { dayName, items: [] };
            return {
                dayOfWeek,
                dayName,
                dailyItems: [...daily],
                manholeItems: [],
                onsiteItems: [],
                specificItems: [...dayConfig.items],
                allScheduledItems: [...daily, ...dayConfig.items]
            };
        }

        // คัดแยกประเภทอุปกรณ์จากฐานข้อมูล equipment_ref แบบแม่นยำ
        const isManhole = (item) => {
            const cat = (item.category || '').toLowerCase();
            const name = (item.equipment_name || '').toLowerCase();
            return cat.includes('ท่อส่งน้ำ') || name.includes('เมนต์โฮลด์') || name.includes('แมนโฮลด์');
        };

        const isOnsite = (item) => {
            const cat = (item.category || '').toLowerCase();
            const name = (item.equipment_name || '').toLowerCase();
            return cat.includes('ออนไซน์') || cat.includes('บำบัดเฉพาะที่') || name.includes('บ่อออนไซน์') || name.includes('บ่อพักน้ำเสีย');
        };

        const isDaily = (item) => {
            return !isManhole(item) && !isOnsite(item);
        };

        const dailyItems = allRefs.filter(isDaily).map(i => i.equipment_name);
        const manholeItems = allRefs.filter(isManhole).map(i => i.equipment_name);
        const onsiteItems = allRefs.filter(isOnsite).map(i => i.equipment_name);

        // 1. เมนต์โฮลด์ตามรอบวัน (วันจันทร์ -> ลำดับ 0, วันอังคาร -> 1, ..., วันอาทิตย์ -> 6)
        const dayIndex = dayOfWeek === 0 ? 6 : (dayOfWeek - 1);
        const selectedManhole = manholeItems.length > 0 ? [manholeItems[dayIndex % manholeItems.length]] : [];

        // 2. สุ่ม/จัดสรรบ่อออนไซน์ตามรอบวันจากฐานข้อมูล equipment_ref แบบเป๊ะๆ
        let selectedOnsite = [];
        if (onsiteItems.length > 0) {
            const tanksPerDay = Math.max(1, Math.ceil(onsiteItems.length / 7));
            const startIdx = (dayIndex * tanksPerDay) % onsiteItems.length;
            selectedOnsite = [];
            for (let i = 0; i < tanksPerDay && (startIdx + i) < onsiteItems.length; i++) {
                selectedOnsite.push(onsiteItems[startIdx + i]);
            }
            if (selectedOnsite.length === 0) {
                selectedOnsite = onsiteItems.slice(0, Math.min(3, onsiteItems.length));
            }
        }

        const specificItems = [...selectedManhole, ...selectedOnsite];

        return {
            dayOfWeek,
            dayName,
            dailyItems,
            manholeItems,
            onsiteItems,
            specificItems,
            allScheduledItems: [...dailyItems, ...specificItems]
        };
    }

    async init() {
        this.bindEvents();
        await this.loadData();
    }

    bindEvents() {
        // ผูกการคลิกจัดเรียงหัวตารางอัตโนมัติ (วันที่ล่าสุดขึ้นก่อนเสมอ)
        if (window.App && window.App.bindTableSorting) {
            window.App.bindTableSorting('table-machinery-body', this, 'recorded_at', 'desc');
        }

        // ตัวเลือกจัดเรียงลำดับ (Sort Order)
        const sortOrderEl = document.getElementById('filter-mach-sort-order');
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
        const pageSizeEl = document.getElementById('filter-mach-page-size');
        if (pageSizeEl) {
            pageSizeEl.addEventListener('change', (e) => {
                this.pageSize = e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10);
                this.currentPage = 1;
                this.applyFilters();
            });
        }

        const btnAdd = document.getElementById('btn-add-machinery');
        if (btnAdd) btnAdd.addEventListener('click', () => this.openAddModal());

        const btnAddAuto = document.getElementById('btn-add-machinery-auto');
        if (btnAddAuto) btnAddAuto.addEventListener('click', () => {
            if (window.AutoGeneratorModule) {
                window.AutoGeneratorModule.openGeneratorModal('machinery');
            } else {
                this.openAddModal();
            }
        });

        // ปุ่ม Auto-Fill เติมผลตรวจเช็คเครื่องจักรอัตโนมัติใน Modal
        const btnMachAutoFill = document.getElementById('btn-mach-autofill');
        if (btnMachAutoFill) btnMachAutoFill.addEventListener('click', () => this.autoFillForm());

        // Quick Action Toolbar Buttons
        const btnRefresh = document.getElementById('btn-mach-refresh');
        if (btnRefresh) btnRefresh.addEventListener('click', async () => {
            await this.loadData();
            Swal.fire({
                icon: 'success',
                title: 'รีเฟรชข้อมูลสำเร็จ',
                text: 'อัปเดตผลตรวจเช็คเครื่องจักรล่าสุดเรียบร้อย',
                timer: 1000,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });
        });

        const btnPreview = document.getElementById('btn-mach-preview');
        if (btnPreview) btnPreview.addEventListener('click', () => this.previewData());

        const btnExcel = document.getElementById('btn-mach-excel');
        if (btnExcel) btnExcel.addEventListener('click', () => this.exportExcel());

        const btnPdf = document.getElementById('btn-mach-pdf');
        if (btnPdf) btnPdf.addEventListener('click', () => this.exportPDF());

        const btnCsv = document.getElementById('btn-mach-csv');
        if (btnCsv) btnCsv.addEventListener('click', () => this.exportCSV());

        const btnTemplate = document.getElementById('btn-mach-template');
        if (btnTemplate) btnTemplate.addEventListener('click', () => window.ExportImportModule.downloadModuleTemplate('machinery'));

        const btnImportTrigger = document.getElementById('btn-mach-import-trigger');
        const fileImportInput = document.getElementById('file-mach-import');
        if (btnImportTrigger && fileImportInput) {
            btnImportTrigger.addEventListener('click', () => fileImportInput.click());
            fileImportInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    window.ExportImportModule.importModuleExcelOrCSV(file, 'machinery', () => this.loadData());
                    e.target.value = '';
                }
            });
        }

        const btnClear = document.getElementById('btn-mach-clear-all');
        if (btnClear) btnClear.addEventListener('click', () => {
            window.ExportImportModule.clearModuleData('machinery', 'machinery_inspection', () => this.loadData());
        });

        const btnResetFilter = document.getElementById('btn-mach-reset-filter');
        if (btnResetFilter) btnResetFilter.addEventListener('click', () => this.resetFilters());

        // Status Header Pills
        const pillAll = document.getElementById('pill-mach-all');
        if (pillAll) pillAll.addEventListener('click', () => {
            this.resetFilters();
            this.setActivePill('pill-mach-all');
        });

        const pillYear = document.getElementById('pill-mach-year');
        if (pillYear) pillYear.addEventListener('click', () => this.filterByCurrentYear());

        const pillMonth = document.getElementById('pill-mach-month');
        if (pillMonth) pillMonth.addEventListener('click', () => this.filterByCurrentMonth());

        const btnAddYear = document.getElementById('btn-add-year-mach');
        if (btnAddYear) btnAddYear.addEventListener('click', () => this.promptAddYear());

        // ตัวกรอง 7 ช่อง
        const inputSearch = document.getElementById('filter-mach-search');
        if (inputSearch) inputSearch.addEventListener('input', (e) => { this.filters.search = e.target.value; this.applyFilters(); });

        const selectCategory = document.getElementById('filter-mach-category');
        if (selectCategory) selectCategory.addEventListener('change', (e) => { this.filters.category = e.target.value; this.applyFilters(); });

        const selectBuilding = document.getElementById('filter-mach-building');
        if (selectBuilding) selectBuilding.addEventListener('change', (e) => { this.filters.building = e.target.value; this.applyFilters(); });

        const inputStartDate = document.getElementById('filter-mach-start-date');
        if (inputStartDate) inputStartDate.addEventListener('change', (e) => { this.filters.startDate = e.target.value; this.applyFilters(); });

        const inputEndDate = document.getElementById('filter-mach-end-date');
        if (inputEndDate) inputEndDate.addEventListener('change', (e) => { this.filters.endDate = e.target.value; this.applyFilters(); });

        const selectYear = document.getElementById('filter-mach-year');
        if (selectYear) selectYear.addEventListener('change', (e) => { this.filters.year = e.target.value; this.applyFilters(); });

        const selectMonth = document.getElementById('filter-mach-month');
        if (selectMonth) selectMonth.addEventListener('change', (e) => { this.filters.month = e.target.value; this.applyFilters(); });

        // ปุ่มเพิ่มอุปกรณ์ใหม่ด่วนจากในฟอร์ม
        const btnQuickAddEq = document.getElementById('btn-quick-add-mach-eq');
        if (btnQuickAddEq) {
            btnQuickAddEq.addEventListener('click', () => this.quickAddNewEquipment());
        }

        // ปุ่มจัดการ Checklist ใน Modal (รอบวันนี้, ทั้งหมด, ล้าง)
        const btnSelectToday = document.getElementById('btn-mach-select-today-schedule');
        if (btnSelectToday) {
            btnSelectToday.addEventListener('click', () => this.selectScheduleForCurrentDate(true));
        }

        const btnSelectAll = document.getElementById('btn-mach-select-all');
        if (btnSelectAll) {
            btnSelectAll.addEventListener('click', () => this.selectAllEquipment());
        }

        const btnClearSel = document.getElementById('btn-mach-clear-selection');
        if (btnClearSel) {
            btnClearSel.addEventListener('click', () => this.clearEquipmentSelection());
        }

        // เมื่อเปลี่ยนวันเวลาใน Modal ให้รีเฟรช Badge และ Checklist ตามวัน
        const inputDateTime = document.getElementById('mach-form-datetime');
        if (inputDateTime) {
            inputDateTime.addEventListener('change', () => {
                const currentSched = this.getMachineryChecklistForDate(inputDateTime.value);
                const badgeDay = document.getElementById('mach-schedule-day-badge');
                if (badgeDay) {
                    badgeDay.innerHTML = `<i class="fa-regular fa-calendar-check text-amber-400"></i> ${currentSched.dayName || 'รอบประจำวัน'} (${currentSched.allScheduledItems.length} รายการ)`;
                }
                this.renderEquipmentChecklist();
            });
        }

        // ผูก Universal Attachment Manager (รองรับ อัปโหลดรูปภาพ, PDF, ถ่ายรูปสด, URL)
        if (window.AttachmentManager) {
            window.AttachmentManager.bindFormAttachments({
                moduleInstance: this,
                itemsProperty: 'uploadedImages',
                containerId: 'mach-image-gallery-container',
                fileInputId: 'mach-file-upload-input',
                browseBtnId: 'btn-mach-browse-files',
                cameraInputId: 'mach-file-camera-input',
                cameraBtnId: 'btn-mach-open-camera',
                urlInputId: 'mach-form-image-url-input',
                addUrlBtnId: 'btn-mach-add-url-image',
                clearBtnId: 'btn-mach-clear-all-images',
                badgeId: 'mach-image-count-badge',
                themeColor: 'purple',
                singleMode: false
            });
        }

        // Toggle Abnormal Detail Fields dynamically based on status (1, 2, 3 รายการ)
        const selectStatus = document.getElementById('mach-form-status');
        if (selectStatus) {
            selectStatus.addEventListener('change', async (e) => {
                const abnormalBox = document.getElementById('mach-abnormal-fields');
                const count = this.getAbnormalCountFromStatus(e.target.value);
                if (abnormalBox) {
                    if (count > 0) {
                        abnormalBox.style.display = 'block';
                        await this.renderAbnormalFields(count);
                    } else {
                        abnormalBox.style.display = 'none';
                        await this.renderAbnormalFields(0);
                    }
                }
            });
        }

        // ฟอร์มบันทึก
        const form = document.getElementById('form-machinery');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveData();
            });
        }
    }

    setActivePill(activeId) {
        ['pill-mach-all', 'pill-mach-year', 'pill-mach-month'].forEach(id => {
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
            title: 'เพิ่มปี พ.ศ. สำหรับตัวกรองเครื่องจักร',
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
            const select = document.getElementById('filter-mach-year');
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
        const select = document.getElementById('filter-mach-year');
        if (select) select.value = currentYearBE;
        this.filters.year = currentYearBE;
        this.setActivePill('pill-mach-year');
        this.applyFilters();
        Swal.fire({
            icon: 'success',
            title: `กรองข้อมูลเครื่องจักรปี พ.ศ. ${currentYearBE}`,
            timer: 900,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
        });
    }

    filterByCurrentMonth() {
        const now = new Date();
        const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');
        const select = document.getElementById('filter-mach-month');
        if (select) select.value = currentMonth;
        this.filters.month = currentMonth;
        this.applyFilters();
    }

    async loadData() {
        this.items = await window.DataStore.getAll('machinery_inspection', { orderBy: 'recorded_at', ascending: false });
        this.applyFilters();
    }

    applyFilters() {
        this.filteredItems = this.items.filter(item => {
            if (this.filters.search) {
                const q = this.filters.search.toLowerCase();
                const matchEq = this.normalizeEquipmentList(item.equipment_list).join(' ').toLowerCase().includes(q);
                const matchAbnormal = (item.abnormal_equipment || '').toLowerCase().includes(q);
                const matchInsp = (item.inspector || '').toLowerCase().includes(q);
                if (!matchEq && !matchAbnormal && !matchInsp) return false;
            }

            if (this.filters.category !== 'all') {
                if (this.filters.category === 'normal' && item.status !== 'ปกติทุกรายการ') return false;
                if (this.filters.category === 'abnormal' && item.status === 'ปกติทุกรายการ') return false;
            }

            // แผนก / อุปกรณ์
            if (this.filters.building && this.filters.building !== 'all') {
                if (window.App && window.App.matchBuildingFilter) {
                    const eqStr = this.normalizeEquipmentList(item.equipment_list).join(' ');
                    if (!window.App.matchBuildingFilter(eqStr, this.filters.building)) return false;
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
            window.App.updateTableSortUI('table-machinery-body', this.sortField, this.sortDir);
        }

        this.renderTable(this.filteredItems);
    }

    resetFilters() {
        this.filters = { search: '', category: 'all', building: 'all', startDate: '', endDate: '', year: 'all', month: 'all' };
        const ids = ['filter-mach-search', 'filter-mach-category', 'filter-mach-start-date', 'filter-mach-end-date', 'filter-mach-year', 'filter-mach-month'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = el.tagName === 'SELECT' ? 'all' : '';
        });
        this.setActivePill('pill-mach-all');
        this.applyFilters();
        Swal.fire({
            icon: 'info',
            title: 'แสดงข้อมูลเครื่องจักรทั้งหมด',
            text: 'ล้างตัวกรองเรียบร้อยแล้ว',
            timer: 900,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
        });
    }

    renderTable(list) {
        const tbody = document.getElementById('table-machinery-body');
        if (!tbody) return;

        const totalItems = list ? list.length : 0;

        // คำนวณผลรวมตามรายการกรองข้อมูล (Filter Summary Calculation)
        const normalCount = list.filter(item => item.status === 'ปกติทุกรายการ').length;
        const abnormalCount = totalItems - normalCount;
        const warningCount = list.filter(item => item.status === 'เฝ้าระวัง' || (item.remarks && item.remarks.includes('เฝ้าระวัง'))).length;
        const maintCount = abnormalCount >= warningCount ? abnormalCount - warningCount : 0;
        const normalPercent = totalItems > 0 ? ((normalCount / totalItems) * 100).toFixed(1) : '0.0';
        const totalCheckedEq = list.reduce((sum, item) => sum + this.normalizeEquipmentList(item.equipment_list).length, 0);

        if (!list || list.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-8 text-slate-500">
                        <i class="fa-solid fa-gears text-3xl mb-2"></i>
                        <div>ไม่พบข้อมูลการตรวจเช็คเครื่องจักร</div>
                    </td>
                </tr>
            `;
            const tfoot = document.getElementById('table-machinery-foot');
            if (tfoot) tfoot.innerHTML = '';

            if (window.App && window.App.renderPagination) {
                window.App.renderPagination({
                    containerId: 'pagination-machinery',
                    totalItems: 0,
                    currentPage: this.currentPage,
                    pageSize: this.pageSize,
                    summaryCards: [
                        { title: 'จำนวนรายการทั้งหมด', value: '0 รายการ', subText: 'ตามเงื่อนไขที่กรอง', icon: 'fa-solid fa-list-check', color: 'cyan' },
                        { title: 'อัตราสถานะปกติ (NORMAL RATE)', value: '0.0%', subText: 'ปกติ 0 รายการ', icon: 'fa-solid fa-circle-check', color: 'emerald' },
                        { title: 'รายการพบปัญหา/ชำรุด', value: '0 รายการ', subText: 'คิดเป็น 0.0%', icon: 'fa-solid fa-triangle-exclamation', color: 'rose' },
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
            const isNormal = item.status === 'ปกติทุกรายการ';
            const eqList = this.normalizeEquipmentList(item.equipment_list);

            return `
                <tr>
                    <td class="text-slate-400 font-mono text-center">${globalIdx}</td>
                    <td class="font-mono text-xs text-slate-300">${window.App.formatDateTime(item.recorded_at)}</td>
                    <td class="max-w-md">
                        <div class="equipment-cell-container">
                            <div id="mach-eq-box-${item.id}" class="mach-eq-box-collapsed flex flex-wrap gap-1 max-h-[42px] overflow-hidden transition-all duration-300 cursor-pointer" 
                                 onclick="window.MachineryModule.viewDetails('${item.id}')" 
                                 title="คลิกเพื่อดูรายละเอียดและอุปกรณ์ทั้งหมด (${eqList.length} รายการ)">
                                ${eqList.map(e => {
                                    const isDaySpecific = e.includes('เมนต์โฮลด์') || e.includes('แมนโฮลด์') || e.includes('บ่อออนไซน์');
                                    if (isDaySpecific) {
                                        return `<span class="badge bg-amber-950/80 text-amber-300 border border-amber-600/70 text-[10px] font-medium py-0.5 px-1.5 shadow-sm"><i class="fa-solid fa-calendar-check text-[9px] mr-1 text-amber-400"></i>${e}</span>`;
                                    }
                                    return `<span class="badge bg-slate-900/95 text-yellow-300 border border-amber-500/40 text-[10px] font-medium py-0.5 px-1.5 shadow-sm">${e}</span>`;
                                }).join('')}
                            </div>
                            <div class="mt-1 flex items-center justify-between text-[10px]">
                                <span class="text-amber-400 font-medium cursor-pointer flex items-center gap-1 hover:text-amber-300" onclick="window.MachineryModule.viewDetails('${item.id}')">
                                    <i class="fa-solid fa-circle-check text-emerald-400 text-[9px]"></i> ตรวจครบ ${eqList.length} รายการ
                                </span>
                                ${eqList.length > 6 ? `
                                    <button type="button" class="text-cyan-400 hover:text-cyan-200 underline text-[10px] flex items-center gap-0.5 ml-2 font-medium" onclick="window.MachineryModule.toggleExpandEquipment('${item.id}', event)">
                                        <span id="mach-eq-toggle-text-${item.id}">+ขยายดูทั้งหมด</span>
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    </td>
                    <td>
                        <span class="badge ${isNormal ? 'badge-success' : 'badge-danger'}">
                            <i class="fa-solid ${isNormal ? 'fa-circle-check' : 'fa-triangle-exclamation'}"></i>
                            ${item.status}
                        </span>
                        ${(() => {
                            let imgCount = 0;
                            if (item.image_url) {
                                if (typeof item.image_url === 'string' && item.image_url.startsWith('[') && item.image_url.endsWith(']')) {
                                    try { imgCount = JSON.parse(item.image_url).length; } catch(e) { imgCount = 1; }
                                } else if (Array.isArray(item.image_url)) {
                                    imgCount = item.image_url.length;
                                } else if (item.image_url.trim()) {
                                    imgCount = 1;
                                }
                            }
                            return imgCount > 0 ? `<div class="mt-1"><span class="badge bg-purple-950/70 text-purple-300 border border-purple-700/60 text-[10px]"><i class="fa-solid fa-camera mr-1 text-purple-400"></i>${imgCount} รูป</span></div>` : '';
                        })()}
                    </td>
                    <td class="text-xs text-slate-300">
                        ${item.abnormal_equipment ? `<span class="text-rose-400 font-bold">${item.abnormal_equipment}</span><br><span class="text-[11px] text-slate-400">${item.cause || ''}</span>` : '<span class="text-slate-500">-</span>'}
                    </td>
                    <td class="text-xs text-slate-200 font-medium">
                        <span class="inline-flex items-center gap-1.5 text-slate-200">
                            <i class="fa-solid fa-user-check text-cyan-400 text-xs"></i> ${item.inspector || '-'}
                        </span>
                    </td>
                    <td class="text-center">
                        <div class="flex items-center justify-center gap-1.5">
                            <button class="btn btn-outline btn-icon btn-sm text-blue-400 hover:text-white" onclick="window.MachineryModule.viewDetails('${item.id}')" title="ดูรายละเอียด">
                                <i class="fa-solid fa-eye"></i>
                            </button>
                            <button class="btn btn-outline btn-icon btn-sm text-amber-400 hover:text-white" onclick="window.MachineryModule.openEditModal('${item.id}')" title="แก้ไข">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button class="btn btn-outline btn-icon btn-sm text-rose-400 hover:text-white" onclick="window.MachineryModule.deleteRecord('${item.id}')" title="ลบ">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Render Table Footer Summary Row
        const tfoot = document.getElementById('table-machinery-foot');
        if (tfoot) {
            tfoot.innerHTML = `
                <tr class="table-summary-row border-t-2 border-emerald-500/60 bg-emerald-950/20">
                    <td class="text-center font-bold text-emerald-400 py-3.5"><i class="fa-solid fa-calculator"></i> รวม</td>
                    <td colspan="2" class="font-bold text-emerald-300 py-3.5">
                        <span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> สรุปผลการตรวจ (${totalItems.toLocaleString()} รอบ - รวม ${totalCheckedEq.toLocaleString()} รายการ):</span>
                    </td>
                    <td class="font-bold text-emerald-400 py-3.5 text-xs text-center">
                        <span class="badge badge-success text-xs py-1 px-2.5"><i class="fa-solid fa-circle-check mr-1"></i>ปกติ ${normalCount} (${normalPercent}%)</span>
                    </td>
                    <td class="text-center text-xs py-3.5 font-bold ${warningCount > 0 ? 'text-amber-400' : 'text-slate-400'}">
                        ${warningCount > 0 ? `<span class="badge badge-warning text-xs py-1 px-2">เฝ้าระวัง ${warningCount}</span>` : 'เฝ้าระวัง: 0'}
                    </td>
                    <td class="text-center text-xs py-3.5 font-bold ${maintCount > 0 ? 'text-rose-400' : 'text-slate-400'}">
                        ${maintCount > 0 ? `<span class="badge badge-danger text-xs py-1 px-2">ซ่อมบำรุง ${maintCount}</span>` : 'ซ่อมบำรุง: 0'}
                    </td>
                    <td class="text-center text-xs text-slate-300 py-3.5">ทีมช่างเทคนิค รพ.</td>
                    <td class="text-center text-xs text-emerald-400 py-3.5 font-bold"><span class="badge badge-success text-[11px] py-1 px-2">พร้อมใช้งาน</span></td>
                </tr>
            `;
        }

        // Summary Cards Configuration
        const summaryCards = [
            {
                title: 'จำนวนรอบตรวจเครื่องจักร',
                value: `${totalItems.toLocaleString()} รอบ`,
                subText: 'ตามตัวกรองที่เลือก',
                icon: 'fa-solid fa-clipboard-check',
                color: 'cyan'
            },
            {
                title: 'เครื่องจักรปกติ (+) VS ชำรุด (-)',
                value: `+${normalCount} ปกติ / -${maintCount + warningCount} เฝ้าระวัง`,
                subText: `ตรวจรวม ${totalCheckedEq.toLocaleString()} รายการเครื่องจักร`,
                icon: 'fa-solid fa-right-left',
                color: 'blue'
            },
            {
                title: 'ความพร้อมใช้งานเครื่องจักร (READY)',
                value: `${normalPercent}% ปกติ`,
                subText: 'พร้อมเดินระบบบำบัดน้ำเสีย 100%',
                icon: 'fa-solid fa-gears',
                color: 'emerald'
            },
            {
                title: 'เครื่องจักรในระบบบำบัดรวม',
                value: '12 เครื่องจักรหลัก',
                subText: 'แอร์เรเตอร์, ปั๊มสูบ, บ่อเติมอากาศ',
                icon: 'fa-solid fa-microchip',
                color: 'amber'
            }
        ];

        // Render pagination controls and summary cards
        if (window.App && window.App.renderPagination) {
            window.App.renderPagination({
                containerId: 'pagination-machinery',
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
                    const sizeEl = document.getElementById('filter-mach-page-size');
                    if (sizeEl) sizeEl.value = String(s);
                    this.renderTable(this.filteredItems);
                }
            });
        }
    }

    toggleExpandEquipment(id, event) {
        if (event) event.stopPropagation();
        const box = document.getElementById(`mach-eq-box-${id}`);
        const text = document.getElementById(`mach-eq-toggle-text-${id}`);
        if (!box) return;

        if (box.classList.contains('mach-eq-box-collapsed') || box.classList.contains('max-h-[42px]')) {
            box.classList.remove('mach-eq-box-collapsed', 'max-h-[42px]', 'overflow-hidden');
            if (text) text.textContent = 'ย่อเหลือ 2 แถว';
        } else {
            box.classList.add('mach-eq-box-collapsed', 'max-h-[42px]', 'overflow-hidden');
            if (text) text.textContent = '+ขยายดูทั้งหมด';
        }
    }

    getAbnormalCountFromStatus(statusStr) {
        if (!statusStr || statusStr === 'ปกติทุกรายการ') return 0;
        const match = statusStr.match(/(\d+)/);
        if (match) {
            return parseInt(match[1]);
        }
        if (statusStr === 'ชำรุดรอซ่อม') return 1;
        return 1;
    }

    onAbnormalSelectChange(selectEl) {
        if (!selectEl) return;
        const row = selectEl.closest('.abnormal-item-row') || selectEl.parentElement;
        const customWrapper = row.querySelector('.mach-custom-eq-wrapper');
        const customInput = row.querySelector('.mach-input-abnormal-eq');

        if (selectEl.value === '__custom__') {
            if (customWrapper) customWrapper.style.display = 'block';
            if (customInput) {
                customInput.value = '';
                customInput.focus();
            }
        } else {
            if (customWrapper) customWrapper.style.display = 'none';
            if (customInput) customInput.value = selectEl.value;
        }
    }

    async getEquipmentRefData() {
        let refList = [];
        try {
            if (window.DataStore) {
                refList = (await window.DataStore.getAll('equipment_ref', { orderBy: 'equipment_name', ascending: true })) || [];
            }
        } catch (e) {
            console.warn('Failed to load equipment_ref for abnormal dropdown:', e);
        }

        if ((!refList || refList.length === 0) && typeof SAMPLE_DATABASE !== 'undefined' && Array.isArray(SAMPLE_DATABASE.equipment_ref)) {
            refList = SAMPLE_DATABASE.equipment_ref;
        }

        const groups = {};
        const allNames = new Set();

        refList.forEach(eq => {
            if (!eq || !eq.equipment_name) return;
            const name = eq.equipment_name.trim();
            const cat = eq.category ? eq.category.trim() : 'อุปกรณ์ระบบ';
            const code = eq.equipment_code ? eq.equipment_code.trim() : '';
            const location = eq.location ? eq.location.trim() : '';

            if (!groups[cat]) groups[cat] = [];
            groups[cat].push({ name, code, location });
            allNames.add(name);
        });

        // ใส่รายการจาก selectedEquipments หากยังไม่มีใน equipment_ref
        if (this.selectedEquipments) {
            const extra = [];
            this.selectedEquipments.forEach(name => {
                const trimmed = (name || '').trim();
                if (trimmed && !allNames.has(trimmed)) {
                    extra.push({ name: trimmed, code: '', location: 'เช็คลิสต์ที่เลือกตรวจ' });
                    allNames.add(trimmed);
                }
            });
            if (extra.length > 0) {
                groups['รายการในเช็คลิสต์ตรวจรอบนี้'] = extra;
            }
        }

        const sortedCats = Object.keys(groups).sort((a, b) => a.localeCompare(b, 'th'));
        let optgroupsHtml = '';

        sortedCats.forEach(cat => {
            const items = groups[cat].sort((a, b) => a.name.localeCompare(b.name, 'th'));
            optgroupsHtml += `<optgroup label="หมวด: ${cat} (${items.length} รายการ)">`;
            items.forEach(item => {
                const label = item.code ? `[${item.code}] ${item.name}` : item.name;
                const locSub = item.location ? ` - ${item.location}` : '';
                optgroupsHtml += `<option value="${item.name}">${label}${locSub}</option>`;
            });
            optgroupsHtml += `</optgroup>`;
        });

        return {
            groups,
            allNames,
            totalCount: allNames.size,
            optgroupsHtml
        };
    }

    async renderAbnormalFields(count = 1, existingData = []) {
        const container = document.getElementById('mach-abnormal-rows-container');
        const badge = document.getElementById('mach-abnormal-count-badge');
        if (!container) return;

        if (count <= 0) {
            container.innerHTML = '';
            return;
        }

        if (badge) {
            badge.textContent = `${count} รายการ`;
        }

        // ดึงรายการอุปกรณ์จาก equipment_ref แบบจัดหมวดหมู่
        const eqData = await this.getEquipmentRefData();

        let html = '';
        for (let i = 0; i < count; i++) {
            const data = existingData[i] || { eq: '', cause: '', solution: '' };
            const isMatchRef = data.eq && eqData.allNames.has(data.eq);
            const isCustom = data.eq && !isMatchRef;

            html += `
                <div class="abnormal-item-row p-2.5 bg-slate-900/90 border border-rose-900/60 rounded-xl mb-2.5">
                    ${count > 1 ? `
                    <div class="flex items-center justify-between mb-1.5 pb-1 border-b border-rose-900/40">
                        <span class="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                            <i class="fa-solid fa-triangle-exclamation text-rose-400"></i> ข้อบกพร่องรายการที่ ${i + 1}
                        </span>
                        <span class="text-[10px] text-slate-400 font-mono">ลำดับที่ ${i + 1}/${count}</span>
                    </div>` : ''}
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                        <div>
                            <label class="text-[11px] font-medium text-slate-300 block mb-1">
                                ระบุอุปกรณ์ผิดปกติ <span class="text-rose-400">*</span>
                                <span class="text-[10px] text-emerald-400 font-normal"> (ดึงจากอ้างอิง ${eqData.totalCount} รายการ)</span>
                            </label>
                            <select class="form-control text-xs mach-select-abnormal-eq bg-slate-900 border-slate-700 text-slate-100" 
                                    onchange="window.MachineryModule && window.MachineryModule.onAbnormalSelectChange && window.MachineryModule.onAbnormalSelectChange(this)">
                                <option value="">-- เลือกอุปกรณ์ผิดปกติจากตารางอ้างอิง --</option>
                                ${eqData.optgroupsHtml}
                                <optgroup label="ระบุเอง">
                                    <option value="__custom__" ${isCustom ? 'selected' : ''}>➕ ระบุชื่ออุปกรณ์อื่น ๆ เอง...</option>
                                </optgroup>
                            </select>
                            <div class="mach-custom-eq-wrapper mt-1.5" style="${isCustom ? 'display: block;' : 'display: none;'}">
                                <input type="text" class="form-control text-xs mach-input-abnormal-eq" 
                                       placeholder="พิมพ์ระบุชื่ออุปกรณ์ผิดปกติ..." 
                                       value="${data.eq || ''}" />
                            </div>
                        </div>
                        <div>
                            <label class="text-[11px] font-medium text-slate-300 block mb-1">
                                สาเหตุเกิดจาก <span class="text-rose-400">*</span>
                            </label>
                            <input type="text" class="form-control text-xs mach-input-cause" 
                                   placeholder="เช่น สายพานหย่อน / มอเตอร์ร้อน..." 
                                   value="${data.cause || ''}" required />
                        </div>
                        <div>
                            <label class="text-[11px] font-medium text-slate-300 block mb-1">
                                ผลการซ่อมแก้ไข <span class="text-rose-400">*</span>
                            </label>
                            <input type="text" class="form-control text-xs mach-input-solution" 
                                   placeholder="เช่น ปรับตั้งสายพานใหม่แล้ว / แจ้งซ่อม..." 
                                   value="${data.solution || ''}" required />
                        </div>
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;

        // กำหนดค่าเลือกให้ตรงกับข้อมูลเดิม
        const rows = container.querySelectorAll('.abnormal-item-row');
        rows.forEach((row, idx) => {
            const d = existingData[idx];
            if (!d || !d.eq) return;
            const selectEl = row.querySelector('.mach-select-abnormal-eq');
            const customInput = row.querySelector('.mach-input-abnormal-eq');
            const customWrapper = row.querySelector('.mach-custom-eq-wrapper');

            if (eqData.allNames.has(d.eq)) {
                if (selectEl) selectEl.value = d.eq;
                if (customInput) customInput.value = d.eq;
                if (customWrapper) customWrapper.style.display = 'none';
            } else {
                if (selectEl) selectEl.value = '__custom__';
                if (customInput) customInput.value = d.eq;
                if (customWrapper) customWrapper.style.display = 'block';
            }
        });
    }

    async openAddModal() {
        this.editingId = null;
        const modal = document.getElementById('modal-machinery');
        const title = document.getElementById('modal-machinery-title');
        const form = document.getElementById('form-machinery');
        if (!modal || !form) return;

        form.reset();
        title.innerHTML = '<i class="fa-solid fa-gears text-purple-400"></i> บันทึกการตรวจสอบเครื่องจักร';

        const now = new Date();
        const localIso = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        document.getElementById('mach-form-datetime').value = localIso;
        document.getElementById('mach-form-status').value = 'ปกติทุกรายการ';

        const abnormalBox = document.getElementById('mach-abnormal-fields');
        if (abnormalBox) abnormalBox.style.display = 'none';
        await this.renderAbnormalFields(0);

        const currentUser = (window.AuthService && typeof window.AuthService.getCurrentUser === 'function') 
            ? window.AuthService.getCurrentUser() 
            : null;
        const currentName = currentUser ? (currentUser.full_name || currentUser.username) : "";
        const elInsp = document.getElementById('mach-form-inspector');
        if (elInsp) elInsp.value = currentName;

        // เคลียร์และรีเซ็ตรูปภาพทั้งหมด
        this.uploadedImages = [];
        if (window.AttachmentManager) {
            window.AttachmentManager.updateContainerDisplay(this, 'uploadedImages', 'mach-image-gallery-container', 'mach-image-count-badge', 'purple', false);
        } else {
            this.renderImageGallery();
        }

        // เลือกรายการเช็คลิสต์อัตโนมัติตามวันปัจจุบันจากฐานข้อมูล equipment_ref
        const refList = (await window.DataStore.getAll('equipment_ref')) || [];
        const sched = this.getMachineryChecklistForDate(localIso, refList);
        this.selectedEquipments = new Set(sched.allScheduledItems);

        await this.renderEquipmentChecklist();

        window.App.openModal('modal-machinery');
    }

    async autoFillForm() {
        const modal = document.getElementById('modal-machinery');
        if (!modal) return;

        // 1. ตั้งสถานะเป็นปกติทุกรายการ
        const statusEl = document.getElementById('mach-form-status');
        if (statusEl) statusEl.value = 'ปกติทุกรายการ';

        // 2. ปิดกล่องแจ้งอุปกรณ์ผิดปกติ
        const abnormalBox = document.getElementById('mach-abnormal-fields');
        if (abnormalBox) abnormalBox.style.display = 'none';
        await this.renderAbnormalFields(0);

        // 3. ตั้งผู้ตรวจเช็ค
        const currentUser = (window.AuthService && typeof window.AuthService.getCurrentUser === 'function') 
            ? window.AuthService.getCurrentUser() 
            : null;
        const currentName = currentUser ? (currentUser.full_name || currentUser.username) : 'แสงตะวัน ชาวเขา';
        const elInsp = document.getElementById('mach-form-inspector');
        if (elInsp) elInsp.value = currentName;

        // 4. เลือกรายการตรวจสอบอัตโนมัติครบทุกรายการตามรอบวัน
        const dtVal = document.getElementById('mach-form-datetime')?.value || new Date().toISOString();
        const refList = (await window.DataStore.getAll('equipment_ref')) || [];
        const sched = this.getMachineryChecklistForDate(dtVal, refList);
        this.selectedEquipments = new Set(sched.allScheduledItems);
        await this.renderEquipmentChecklist();

        // 5. บันทึกหมายเหตุ
        const remarksEl = document.getElementById('mach-form-remarks');
        if (remarksEl && (!remarksEl.value || remarksEl.value.includes('ปกติ') || remarksEl.value.includes('ตรวจ'))) {
            remarksEl.value = `ผลการตรวจเช็คเครื่องจักรและอุปกรณ์ระบบบำบัดน้ำเสีย ${sched.allScheduledItems.length} รายการ ทำงานปกติ 100% ไม่มีเสียงดังผิดปกติและกระแสไฟปกติ`;
        }

        Swal.fire({
            icon: 'success',
            title: 'เติมผลตรวจเช็คเครื่องจักรอัตโนมัติเรียบร้อย',
            html: `
                <div class="text-xs text-slate-300 space-y-1">
                    <div><span class="text-emerald-400 font-bold">สถานะ:</span> ปกติทุกรายการ (100%)</div>
                    <div><span class="text-purple-400 font-bold">อุปกรณ์ที่ตรวจสอบ:</span> ${sched.allScheduledItems.length} รายการ (${sched.dayName})</div>
                    <div><span class="text-blue-400 font-bold">ผู้ตรวจเช็ค:</span> ${currentName}</div>
                </div>
            `,
            timer: 1500,
            showConfirmButton: false
        });
    }

    async openEditModal(id) {
        const item = this.items.find(x => x.id === id);
        if (!item) return;

        this.editingId = id;
        const title = document.getElementById('modal-machinery-title');
        title.innerHTML = '<i class="fa-solid fa-pen-to-square text-amber-400"></i> แก้ไขบันทึกการตรวจสอบเครื่องจักร';

        const d = new Date(item.recorded_at);
        const localIso = !isNaN(d) ? new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16) : "";

        document.getElementById('mach-form-datetime').value = localIso;
        
        const status = item.status || 'ปกติทุกรายการ';
        document.getElementById('mach-form-status').value = status;
        
        const count = this.getAbnormalCountFromStatus(status);
        const abnormalBox = document.getElementById('mach-abnormal-fields');

        if (count > 0) {
            if (abnormalBox) abnormalBox.style.display = 'block';

            const rawEqs = (item.abnormal_equipment || '').split(/[,|]/).map(s => s.trim()).filter(Boolean);
            const rawCauses = (item.cause || '').split(/[|]/).map(s => s.trim()).filter(Boolean);
            const rawSols = (item.solution || '').split(/[|]/).map(s => s.trim()).filter(Boolean);

            const rowCount = Math.max(count, rawEqs.length || 1);
            const existingData = [];
            for (let i = 0; i < rowCount; i++) {
                existingData.push({
                    eq: rawEqs[i] || '',
                    cause: rawCauses[i] || (rawCauses.length === 1 && i === 0 ? rawCauses[0] : ''),
                    solution: rawSols[i] || (rawSols.length === 1 && i === 0 ? rawSols[0] : '')
                });
            }
            await this.renderAbnormalFields(rowCount, existingData);
        } else {
            if (abnormalBox) abnormalBox.style.display = 'none';
            await this.renderAbnormalFields(0);
        }

        // โหลดรูปภาพและไฟล์แนบที่มีอยู่
        this.uploadedImages = window.AttachmentManager 
            ? window.AttachmentManager.normalizeAttachments(item.image_url) 
            : [];
        if (window.AttachmentManager) {
            window.AttachmentManager.updateContainerDisplay(this, 'uploadedImages', 'mach-image-gallery-container', 'mach-image-count-badge', 'purple', false);
        } else {
            this.renderImageGallery();
        }

        const elInsp = document.getElementById('mach-form-inspector');
        if (elInsp) elInsp.value = item.inspector || "";

        const elRemarks = document.getElementById('mach-form-remarks');
        if (elRemarks) elRemarks.value = item.remarks || "";

        this.selectedEquipments = new Set(this.normalizeEquipmentList(item.equipment_list));
        await this.renderEquipmentChecklist();

        window.App.openModal('modal-machinery');
    }

    async renderEquipmentChecklist() {
        const grid = document.getElementById('mach-equipment-checklist') || document.getElementById('mach-equipment-grid');
        if (!grid) return;

        // ดึงอุปกรณ์ทั้งหมดจากตาราง equipment_ref ในฐานข้อมูลสด
        const refList = (await window.DataStore.getAll('equipment_ref')) || [];
        const dateVal = document.getElementById('mach-form-datetime')?.value;
        const currentSched = this.getMachineryChecklistForDate(dateVal, refList);

        // อัปเดต Badge วันที่บนหัว Modal
        const badgeDay = document.getElementById('mach-schedule-day-badge');
        if (badgeDay) {
            badgeDay.innerHTML = `<i class="fa-regular fa-calendar-check text-amber-400"></i> ${currentSched.dayName || 'รอบประจำวัน'} (ประจำวัน ${currentSched.dailyItems.length} รายการ + สุ่มรอบวัน ${currentSched.specificItems.length} จุด = ${currentSched.allScheduledItems.length} รายการ)`;
        }

        // คัดแยกประเภทอุปกรณ์จากฐานข้อมูล equipment_ref โดยตรง
        const isManhole = (item) => {
            const cat = (item.category || '').toLowerCase();
            const name = (item.equipment_name || '').toLowerCase();
            return cat.includes('ท่อส่งน้ำ') || name.includes('เมนต์โฮลด์') || name.includes('แมนโฮลด์');
        };

        const isOnsite = (item) => {
            const cat = (item.category || '').toLowerCase();
            const name = (item.equipment_name || '').toLowerCase();
            return cat.includes('ออนไซน์') || cat.includes('บำบัดเฉพาะที่') || name.includes('บ่อออนไซน์') || name.includes('บ่อพักน้ำเสีย');
        };

        const dailyRefList = refList.filter(item => !isManhole(item) && !isOnsite(item));
        const manholeRefList = refList.filter(isManhole);
        const onsiteRefList = refList.filter(isOnsite);

        // 1. หมวดตรวจเช็คประจำวัน (จัดกลุ่มย่อยตามหมวดหมู่ใน equipment_ref)
        const dailyCategories = {};
        dailyRefList.forEach(item => {
            const cat = item.category || 'ระบบเครื่องจักรและอุปกรณ์';
            if (!dailyCategories[cat]) dailyCategories[cat] = [];
            dailyCategories[cat].push(item.equipment_name);
        });

        const dailyCategoryIcons = {
            'ระบบเติมอากาศ': { icon: '🌀', color: 'text-cyan-400' },
            'ระบบสูบน้ำ': { icon: '⚡', color: 'text-blue-400' },
            'ระบบอุปกรณ์เสริม': { icon: '⛓️', color: 'text-indigo-400' },
            'ระบบควบคุมไฟฟ้า': { icon: '🔌', color: 'text-amber-400' },
            'ระบบตรวจวัด': { icon: '📊', color: 'text-emerald-400' },
            'ระบบดักตะกอน': { icon: '🗑️', color: 'text-teal-400' },
            'ระบบอาคารสถานที่': { icon: '🏢', color: 'text-violet-400' },
            'ระบบรองรับน้ำทิ้ง': { icon: '🌊', color: 'text-sky-400' },
            'ระบบดักไขมัน': { icon: '🍳', color: 'text-orange-400' }
        };

        const dailyGroupsHtml = Object.keys(dailyCategories).map(catName => {
            const items = dailyCategories[catName];
            const meta = dailyCategoryIcons[catName] || { icon: '⚙️', color: 'text-slate-300' };

            const chips = items.map(name => {
                const isChecked = this.selectedEquipments.has(name);
                return `
                    <label class="equipment-chip-item daily-chip ${isChecked ? 'selected' : ''}">
                        <input type="checkbox" value="${name}" ${isChecked ? 'checked' : ''} 
                               onchange="window.MachineryModule.toggleEquipment('${name}', this.checked)" />
                        <span class="chip-text"><i class="fa-solid ${isChecked ? 'fa-square-check text-cyan-400' : 'fa-square text-slate-500'}"></i> ${name}</span>
                    </label>
                `;
            }).join('');

            return `
                <div class="mb-2">
                    <div class="text-[11px] font-bold ${meta.color} mb-1 flex items-center gap-1.5">
                        <span>${meta.icon} ${catName} (${items.length} รายการ)</span>
                    </div>
                    <div class="equipment-checklist-grid">
                        ${chips}
                    </div>
                </div>
            `;
        }).join('');

        // 2. หมวดตรวจเฉพาะวันในสัปดาห์ (เมนต์โฮลด์ & สุ่มตรวจบ่อออนไซน์จาก equipment_ref)
        const days = [
            { key: 1, label: 'วันจันทร์', color: 'text-amber-400', dayIndex: 0 },
            { key: 2, label: 'วันอังคาร', color: 'text-pink-400', dayIndex: 1 },
            { key: 3, label: 'วันพุธ', color: 'text-emerald-400', dayIndex: 2 },
            { key: 4, label: 'วันพฤหัสบดี', color: 'text-orange-400', dayIndex: 3 },
            { key: 5, label: 'วันศุกร์', color: 'text-sky-400', dayIndex: 4 },
            { key: 6, label: 'วันเสาร์', color: 'text-purple-400', dayIndex: 5 },
            { key: 0, label: 'วันอาทิตย์', color: 'text-rose-400', dayIndex: 6 }
        ];

        const tanksPerDay = onsiteRefList.length > 0 ? Math.max(1, Math.ceil(onsiteRefList.length / 7)) : 0;

        const weeklySectionsHtml = days.map(d => {
            const isToday = currentSched.dayOfWeek === d.key;
            
            // เมนต์โฮลด์ของวันนี้จาก equipment_ref
            const manholeName = manholeRefList.length > 0 ? manholeRefList[d.dayIndex % manholeRefList.length].equipment_name : null;

            // บ่อออนไซน์ของวันนี้จาก equipment_ref
            const dayOnsiteList = [];
            if (onsiteRefList.length > 0) {
                const startIdx = (d.dayIndex * tanksPerDay) % onsiteRefList.length;
                for (let i = 0; i < tanksPerDay && (startIdx + i) < onsiteRefList.length; i++) {
                    dayOnsiteList.push(onsiteRefList[startIdx + i].equipment_name);
                }
            }

            const dayItems = [manholeName, ...dayOnsiteList].filter(Boolean);

            const chips = dayItems.map(name => {
                const isChecked = this.selectedEquipments.has(name);
                const isMh = name.includes('เมนต์โฮลด์') || name.includes('แมนโฮลด์');
                return `
                    <label class="equipment-chip-item day-chip ${isChecked ? 'selected active-day-selected' : ''} ${isToday ? 'ring-1 ring-amber-500/40' : ''}">
                        <input type="checkbox" value="${name}" ${isChecked ? 'checked' : ''} 
                               onchange="window.MachineryModule.toggleEquipment('${name}', this.checked)" />
                        <span class="chip-text"><i class="fa-solid ${isChecked ? 'fa-square-check text-amber-400' : 'fa-square text-slate-500'}"></i> ${isMh ? '🕳️ ' : '🧪 '}${name}</span>
                    </label>
                `;
            }).join('');

            return `
                <div class="p-2.5 rounded-lg border ${isToday ? 'bg-amber-950/20 border-amber-500/40' : 'bg-slate-800/40 border-slate-700/50'} mb-2">
                    <div class="flex items-center justify-between mb-1.5">
                        <span class="text-xs font-bold ${d.color} flex items-center gap-1.5">
                            <i class="fa-solid fa-calendar-day"></i> เฉพาะ${d.label} (เมนต์โฮลด์ + สุ่มบ่อออนไซน์จาก equipment_ref)
                            ${isToday ? '<span class="badge bg-amber-500/20 text-amber-300 border border-amber-500/50 text-[10px] py-0 px-1.5">รอบวันตามที่เลือก</span>' : ''}
                        </span>
                        <button type="button" class="text-[11px] text-slate-400 hover:text-slate-200 underline" 
                                onclick="window.MachineryModule.selectDayItemsOnly(${d.key})">
                            เลือกเฉพาะวันนี้ (${dayItems.length} จุด)
                        </button>
                    </div>
                    <div class="equipment-checklist-grid">
                        ${chips}
                    </div>
                </div>
            `;
        }).join('');

        // 3. แสดงบ่อออนไซน์ทั้งหมดในฐานข้อมูล equipment_ref
        let allOnsiteHtml = '';
        if (onsiteRefList.length > 0) {
            const allOnsiteChips = onsiteRefList.map(eq => {
                const isChecked = this.selectedEquipments.has(eq.equipment_name);
                const isAssignedToday = currentSched.specificItems.includes(eq.equipment_name);
                return `
                    <label class="equipment-chip-item ${isChecked ? 'selected' : ''} ${isAssignedToday ? 'ring-1 ring-emerald-500/40' : ''}">
                        <input type="checkbox" value="${eq.equipment_name}" ${isChecked ? 'checked' : ''} 
                               onchange="window.MachineryModule.toggleEquipment('${eq.equipment_name}', this.checked)" />
                        <span class="chip-text">
                            <i class="fa-solid ${isChecked ? 'fa-square-check text-emerald-400' : 'fa-square text-slate-500'}"></i> 
                            🧪 ${eq.equipment_name}
                            ${isAssignedToday ? '<span class="badge bg-emerald-950/70 text-emerald-300 border border-emerald-700/50 text-[9px] py-0 px-1 ml-1">สุ่มรอบวันนี้</span>' : ''}
                        </span>
                    </label>
                `;
            }).join('');

            allOnsiteHtml = `
                <div class="p-2.5 rounded-lg border bg-emerald-950/20 border-emerald-700/40 mb-2">
                    <div class="flex items-center justify-between mb-1.5">
                        <span class="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                            <i class="fa-solid fa-flask-vial text-emerald-400"></i> บ่อออนไซน์ทั้งหมดในฐานข้อมูล equipment_ref (${onsiteRefList.length} บ่อ)
                        </span>
                        <span class="text-[11px] text-slate-400">คลิกเลือก/ยกเลิกแต่ละบ่อได้อิสระ</span>
                    </div>
                    <div class="equipment-checklist-grid">
                        ${allOnsiteChips}
                    </div>
                </div>
            `;
        }

        grid.innerHTML = `
            <!-- 1. Daily Checklist from equipment_ref -->
            <div class="p-2.5 rounded-lg border bg-cyan-950/20 border-cyan-700/40 mb-2">
                <div class="flex items-center justify-between mb-2 pb-1.5 border-b border-cyan-800/40">
                    <span class="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                        <i class="fa-solid fa-circle-check text-cyan-400"></i> รายการตรวจเช็คประจำวัน (จากฐานข้อมูล equipment_ref - ${dailyRefList.length} รายการ)
                    </span>
                    <button type="button" class="text-[11px] text-cyan-400 hover:text-cyan-200 underline" 
                            onclick="window.MachineryModule.selectDailyItemsOnly()">
                        เลือกประจำวันทั้งหมด (${dailyRefList.length} รายการ)
                    </button>
                </div>
                ${dailyGroupsHtml}
            </div>

            <!-- 2. Weekly Day Specific Checklist from equipment_ref -->
            <div class="space-y-1.5">
                <div class="text-xs font-bold text-purple-300 flex items-center gap-1.5 pt-1">
                    <i class="fa-solid fa-calendar-week text-purple-400"></i> รายการตรวจเฉพาะวันในสัปดาห์ (เมนต์โฮลด์ & สุ่มตรวจบ่อออนไซน์จาก equipment_ref)
                </div>
                ${weeklySectionsHtml}
            </div>

            <!-- 3. All On-site Tanks Directory from equipment_ref -->
            ${allOnsiteHtml}
        `;
    }

    async selectScheduleForCurrentDate(showAlert = false) {
        const inputDateTime = document.getElementById('mach-form-datetime');
        const dateVal = inputDateTime ? inputDateTime.value : '';
        const refList = (await window.DataStore.getAll('equipment_ref')) || [];
        const sched = this.getMachineryChecklistForDate(dateVal, refList);

        this.selectedEquipments = new Set(sched.allScheduledItems);
        await this.renderEquipmentChecklist();

        if (showAlert) {
            Swal.fire({
                icon: 'success',
                title: `เลือกรายการตามรอบ${sched.dayName || 'วันนี้'} จากฐานข้อมูล`,
                text: `เลือกครบ ${sched.dailyItems.length} รายการประจำวัน + ${sched.specificItems.length} จุดสุ่มเมนต์โฮลด์/บ่อออนไซน์ (รวม ${sched.allScheduledItems.length} รายการจาก equipment_ref)`,
                timer: 1600,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });
        }
    }

    async selectDailyItemsOnly() {
        const refList = (await window.DataStore.getAll('equipment_ref')) || [];
        const sched = this.getMachineryChecklistForDate(null, refList);
        sched.dailyItems.forEach(it => this.selectedEquipments.add(it));
        await this.renderEquipmentChecklist();
        Swal.fire({
            icon: 'info',
            title: `เลือก ${sched.dailyItems.length} รายการประจำวัน`,
            text: 'เลือกรายการตรวจเช็คประจำวันจากฐานข้อมูล equipment_ref ครบถ้วนแล้ว',
            timer: 1200,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
        });
    }

    async selectDayItemsOnly(dayKey) {
        const refList = (await window.DataStore.getAll('equipment_ref')) || [];
        const sched = this.getMachineryChecklistForDate(new Date(2026, 7, dayKey === 0 ? 23 : (16 + dayKey)), refList);
        sched.specificItems.forEach(it => this.selectedEquipments.add(it));
        await this.renderEquipmentChecklist();
        Swal.fire({
            icon: 'info',
            title: `เลือกรายการเฉพาะ${sched.dayName}`,
            text: sched.specificItems.join(', '),
            timer: 1200,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
        });
    }

    async selectAllEquipment() {
        const refList = (await window.DataStore.getAll('equipment_ref')) || [];
        refList.forEach(eq => this.selectedEquipments.add(eq.equipment_name));

        await this.renderEquipmentChecklist();
        Swal.fire({
            icon: 'success',
            title: 'เลือกรายการทั้งหมด',
            text: `เลือกอุปกรณ์/จุดตรวจทั้งหมด ${this.selectedEquipments.size} รายการจากฐานข้อมูล equipment_ref`,
            timer: 1200,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
        });
    }

    clearEquipmentSelection() {
        this.selectedEquipments.clear();
        this.renderEquipmentChecklist();
        Swal.fire({
            icon: 'warning',
            title: 'ล้างการเลือกอุปกรณ์',
            text: 'ยกเลิกการเลือกทุกรายการแล้ว',
            timer: 1000,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
        });
    }

    toggleEquipment(name, isChecked) {
        if (isChecked) {
            this.selectedEquipments.add(name);
        } else {
            this.selectedEquipments.delete(name);
        }
        this.renderEquipmentChecklist();
    }

    async quickAddNewEquipment() {
        const { value: eqName } = await Swal.fire({
            title: 'เพิ่มอุปกรณ์ใหม่ในระบบ',
            input: 'text',
            inputLabel: 'ชื่ออุปกรณ์ / เครื่องจักร',
            inputPlaceholder: 'ระบุชื่ออุปกรณ์ เช่น เครื่องเติมอากาศ B4...',
            showCancelButton: true,
            confirmButtonText: 'เพิ่มและเลือกทันที',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#10b981',
            inputValidator: (value) => {
                if (!value) return 'กรุณากรอกชื่ออุปกรณ์!';
            }
        });

        if (eqName) {
            await window.DataStore.insert('equipment_ref', {
                equipment_name: eqName.trim(),
                category: 'อุปกรณ์เสริม',
                status: 'พร้อมใช้งาน'
            });
            this.selectedEquipments.add(eqName.trim());
            await this.renderEquipmentChecklist();
            Swal.fire({ icon: 'success', title: 'เพิ่มอุปกรณ์เรียบร้อย!', timer: 1200, showConfirmButton: false });
        }
    }

    viewDetails(id) {
        const item = this.items.find(x => x.id === id);
        if (!item) return;

        const eqList = this.normalizeEquipmentList(item.equipment_list);
        const dailyChecked = eqList.filter(e => this.machinerySchedule.dailyItems.includes(e));
        const daySpecificChecked = eqList.filter(e => !this.machinerySchedule.dailyItems.includes(e));

        Swal.fire({
            title: `<div class="text-base sm:text-lg font-bold text-white flex items-center justify-center gap-2"><i class="fa-solid fa-gears text-purple-400"></i> รายละเอียดบันทึกการตรวจเช็คเครื่องจักร</div>`,
            width: '860px',
            customClass: {
                popup: 'swal-machinery-wide-modal'
            },
            html: `
                <div class="text-left text-xs space-y-3.5 p-2 sm:p-3.5 bg-slate-900/95 rounded-2xl border border-slate-800 text-slate-200">
                    <!-- Top Info Summary Bar -->
                    <div class="flex flex-wrap items-center justify-between gap-2.5 p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                        <div class="flex items-center gap-2">
                            <span class="text-slate-400 font-medium"><i class="fa-regular fa-calendar text-cyan-400 mr-1"></i> วัน-เวลา:</span>
                            <span class="text-white font-bold font-mono text-xs sm:text-sm">${window.App.formatDateTime(item.recorded_at)}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="text-slate-400 font-medium">สถานะการทำงาน:</span>
                            <span class="badge ${item.status === 'ปกติทุกรายการ' ? 'badge-success' : 'badge-danger'} text-xs py-1 px-2.5">
                                <i class="fa-solid ${item.status === 'ปกติทุกรายการ' ? 'fa-circle-check' : 'fa-triangle-exclamation'} mr-1"></i>
                                ${item.status}
                            </span>
                        </div>
                    </div>

                    <!-- 1. Daily Equipment Checklist (Full Width) -->
                    <div class="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                        <div class="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-800">
                            <strong class="text-cyan-400 flex items-center gap-1.5 font-bold">
                                <i class="fa-solid fa-circle-check text-cyan-400"></i> รายการประจำวัน (${dailyChecked.length}/17 รายการ):
                            </strong>
                            <span class="text-[11px] text-slate-400 font-mono">${Math.round((dailyChecked.length/17)*100)}%</span>
                        </div>
                        <div class="flex flex-wrap gap-1.5">
                            ${dailyChecked.length > 0 ? dailyChecked.map(e => `<span class="badge bg-slate-800/90 text-slate-200 border border-slate-700/70 text-[11px] py-1 px-2.5">${e}</span>`).join('') : '<span class="text-slate-500 text-xs py-1">ไม่มีรายการประจำวันที่เลือก</span>'}
                        </div>
                    </div>

                    <!-- 2. Day-Specific / Additional Equipment (Full Width) -->
                    ${daySpecificChecked.length > 0 ? `
                    <div class="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                        <div class="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-800">
                            <strong class="text-amber-400 flex items-center gap-1.5 font-bold">
                                <i class="fa-solid fa-calendar-day text-amber-400"></i> รายการเฉพาะรอบวัน / อุปกรณ์เพิ่มเติม (${daySpecificChecked.length} รายการ):
                            </strong>
                        </div>
                        <div class="flex flex-wrap gap-1.5">
                            ${daySpecificChecked.map(e => `<span class="badge bg-amber-950/60 text-amber-300 border border-amber-800/60 text-[11px] py-1 px-2.5"><i class="fa-solid fa-calendar-check text-[9px] mr-1 text-amber-400"></i>${e}</span>`).join('')}
                        </div>
                    </div>
                    ` : ''}

                    <!-- 3. Defects / Abnormalities Section (Full Width, underneath equipment) -->
                    ${item.abnormal_equipment ? `
                    <div class="p-3.5 bg-rose-950/40 border border-rose-800/60 rounded-xl space-y-2.5">
                        <div class="flex items-center justify-between mb-1 pb-1 border-b border-rose-900/40">
                            <strong class="text-rose-400 flex items-center gap-1.5 font-bold">
                                <i class="fa-solid fa-triangle-exclamation text-rose-400"></i> ข้อบกพร่องที่พบ (${item.status}):
                            </strong>
                        </div>
                        ${(() => {
                            const rawEqs = (item.abnormal_equipment || '').split(/[,|]/).map(s => s.trim()).filter(Boolean);
                            const rawCauses = (item.cause || '').split(/[|]/).map(s => s.trim()).filter(Boolean);
                            const rawSols = (item.solution || '').split(/[|]/).map(s => s.trim()).filter(Boolean);
                            const maxLen = Math.max(rawEqs.length, rawCauses.length, rawSols.length);

                            if (maxLen <= 1) {
                                return `
                                    <div class="p-3 bg-slate-900/90 rounded-xl border border-rose-900/50 text-xs space-y-1.5">
                                        <div class="text-rose-300 font-bold"><i class="fa-solid fa-gear text-rose-400 mr-1.5"></i> <strong>อุปกรณ์:</strong> ${item.abnormal_equipment}</div>
                                        <div class="text-slate-300"><strong>สาเหตุ:</strong> ${item.cause || '-'}</div>
                                        <div class="text-emerald-300"><strong>วิธีแก้ไข:</strong> ${item.solution || '-'}</div>
                                    </div>
                                `;
                            }

                            let rows = '';
                            for (let i = 0; i < maxLen; i++) {
                                rows += `
                                    <div class="p-3 bg-slate-900/90 rounded-xl border border-rose-900/50 text-xs space-y-1.5 mb-2 last:mb-0">
                                        <div class="text-rose-300 font-bold"><i class="fa-solid fa-gear text-rose-400 mr-1.5"></i> รายการที่ ${i + 1}: ${rawEqs[i] || '-'}</div>
                                        <div class="text-slate-300"><strong>สาเหตุ:</strong> ${rawCauses[i] || (rawCauses.length === 1 ? rawCauses[0] : '-')}</div>
                                        <div class="text-emerald-300"><strong>วิธีแก้ไข:</strong> ${rawSols[i] || (rawSols.length === 1 ? rawSols[0] : '-')}</div>
                                    </div>
                                `;
                            }
                            return rows;
                        })()}
                    </div>` : ''}

                    <!-- 4. Inspector & Remarks (Underneath) -->
                    <div class="p-3 bg-slate-950/60 rounded-xl border border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-300">
                        <div class="flex items-start gap-2">
                            <i class="fa-solid fa-user-check text-blue-400 mt-0.5"></i>
                            <div>
                                <strong class="text-slate-400 block text-[11px]">ผู้ตรวจเช็ค:</strong>
                                <span class="text-white font-medium">${item.inspector || '-'}</span>
                            </div>
                        </div>
                        <div class="flex items-start gap-2">
                            <i class="fa-solid fa-comment-dots text-amber-400 mt-0.5"></i>
                            <div>
                                <strong class="text-slate-400 block text-[11px]">หมายเหตุ:</strong>
                                <span class="text-slate-300 text-[11px] leading-relaxed block">${item.remarks || '-'}</span>
                            </div>
                        </div>
                    </div>

                    <!-- 5. Bottom Image & Document Gallery -->
                    ${(() => {
                        const detailImages = window.AttachmentManager 
                            ? window.AttachmentManager.normalizeAttachments(item.image_url) 
                            : [];
                        if (detailImages.length === 0) return '';
                        return `
                            <div class="pt-2 border-t border-slate-800">
                                <div class="flex items-center justify-between mb-2">
                                    <strong class="text-purple-400 flex items-center gap-1.5 font-bold">
                                        <i class="fa-solid fa-paperclip text-purple-400"></i> รูปภาพและเอกสารแนบ (${detailImages.length} รายการ):
                                    </strong>
                                    <span class="text-[11px] text-slate-400">คลิกเพื่อดูภาพขยาย / เปิดดู PDF</span>
                                </div>
                                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                                    ${detailImages.map((att, i) => {
                                        if (att.type === 'pdf') {
                                            return `
                                                <div class="p-2.5 rounded-xl bg-slate-950 border border-red-800/60 flex flex-col justify-between cursor-pointer hover:border-red-500 transition-all" onclick="window.AttachmentManager.openMediaViewer({data: '${att.data}', type: 'pdf', name: '${att.name}'})">
                                                    <div class="flex items-center gap-2">
                                                        <i class="fa-solid fa-file-pdf text-2xl text-red-400"></i>
                                                        <span class="text-[11px] font-bold text-white truncate">${att.name}</span>
                                                    </div>
                                                    <span class="text-[10px] text-red-400 mt-2 block font-mono">เปิดเอกสาร PDF</span>
                                                </div>
                                            `;
                                        }
                                        return `
                                            <div class="relative rounded-xl overflow-hidden border border-slate-700/80 bg-slate-950 group cursor-pointer hover:border-purple-500/70 transition-all shadow-md" 
                                                 onclick="window.AttachmentManager.openMediaViewer({data: '${att.data}', type: 'image', name: '${att.name}'})" title="คลิกดูภาพขยาย">
                                                <span class="absolute top-1.5 left-1.5 bg-slate-900/90 text-[10px] text-purple-300 font-mono px-1.5 py-0.5 rounded border border-purple-900/60 z-10">
                                                    #${i + 1}
                                                </span>
                                                <img src="${att.data}" class="w-full h-28 object-cover group-hover:scale-108 transition-transform duration-200" />
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                        `;
                    })()}
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
            await window.DataStore.delete('machinery_inspection', id);
            Swal.fire({ icon: 'success', title: 'ลบข้อมูลสำเร็จ', timer: 1200, showConfirmButton: false });
            await this.loadData();
        }
    }

    // จัดการอัปโหลดไฟล์ภาพหลายรูปพร้อมบีบอัดภาพ (Compress & Read File)
    async handleImageFiles(fileList) {
        if (!fileList || fileList.length === 0) return;
        const files = Array.from(fileList);

        Swal.fire({
            title: 'กำลังประมวลผลรูปภาพ...',
            text: `กำลังเตรียมและบีบอัดรูปภาพ ${files.length} รายการ`,
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        for (const file of files) {
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
        const gallery = document.getElementById('mach-image-gallery-container');
        const countBadge = document.getElementById('mach-image-count-badge');
        const clearBtn = document.getElementById('btn-mach-clear-all-images');
        if (!gallery) return;

        const count = this.uploadedImages.length;
        if (countBadge) {
            countBadge.textContent = `${count} รูป`;
            countBadge.className = count > 0 
                ? 'badge bg-purple-950/70 text-purple-300 border border-purple-700 text-[11px]'
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
                <img src="${src}" alt="รูปภาพที่ ${idx + 1}" onclick="window.MachineryModule.previewImageModal('${idx}')" title="คลิกดูภาพขยาย" />
                <button type="button" class="mach-gallery-delete-btn" onclick="window.MachineryModule.removeImageAt(${idx})" title="ลบรูปนี้">
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
            imageAlt: 'รูปภาพขยายใหญ่',
            showConfirmButton: true,
            confirmButtonText: 'ปิดรูปภาพ',
            confirmButtonColor: '#3b82f6',
            background: '#0f172a',
            customClass: {
                popup: 'border border-slate-700 rounded-2xl'
            }
        });
    }

    async saveData() {
        const form = document.getElementById('form-machinery');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const eqArray = Array.from(this.selectedEquipments);
        if (eqArray.length === 0) {
            Swal.fire({ icon: 'warning', title: 'กรุณาเลือกอุปกรณ์ที่ตรวจสอบอย่างน้อย 1 เครื่อง', confirmButtonColor: '#3b82f6' });
            return;
        }

        const statusVal = document.getElementById('mach-form-status').value;
        const abnormalCount = this.getAbnormalCountFromStatus(statusVal);

        let abnormal_equipment = null;
        let cause = null;
        let solution = null;

        if (abnormalCount > 0) {
            const rows = document.querySelectorAll('.abnormal-item-row');
            let eqList = [];
            let causeList = [];
            let solList = [];

            if (rows.length > 0) {
                rows.forEach(row => {
                    const selectEl = row.querySelector('.mach-select-abnormal-eq');
                    const inputEl = row.querySelector('.mach-input-abnormal-eq');
                    const causeEl = row.querySelector('.mach-input-cause');
                    const solEl = row.querySelector('.mach-input-solution');

                    let eqVal = '';
                    if (selectEl && selectEl.value && selectEl.value !== '__custom__') {
                        eqVal = selectEl.value.trim();
                    }
                    if (inputEl && inputEl.value && (selectEl?.value === '__custom__' || !eqVal)) {
                        eqVal = inputEl.value.trim();
                    }

                    const causeVal = (causeEl && causeEl.value.trim()) || '';
                    const solVal = (solEl && solEl.value.trim()) || '';

                    if (eqVal) {
                        eqList.push(eqVal);
                        causeList.push(causeVal);
                        solList.push(solVal);
                    }
                });
            }

            // Fallback for static elements if rows were not dynamic
            if (eqList.length === 0) {
                const singleSelect = document.getElementById('mach-form-abnormal-eq-select');
                const singleInput = document.getElementById('mach-form-abnormal-eq');
                let singleEq = '';
                if (singleSelect && singleSelect.value && singleSelect.value !== '__custom__') {
                    singleEq = singleSelect.value.trim();
                }
                if (singleInput && singleInput.value && (!singleEq || singleSelect?.value === '__custom__')) {
                    singleEq = singleInput.value.trim();
                }
                const singleCause = document.getElementById('mach-form-cause')?.value?.trim() || '';
                const singleSol = document.getElementById('mach-form-solution')?.value?.trim() || '';

                if (singleEq) {
                    eqList.push(singleEq);
                    causeList.push(singleCause);
                    solList.push(singleSol);
                }
            }

            if (eqList.length > 0) {
                abnormal_equipment = eqList.join(', ');
                cause = causeList.join(' | ');
                solution = solList.join(' | ');
            } else {
                Swal.fire({
                    icon: 'warning',
                    title: 'กรุณาเลือกหรือระบุอุปกรณ์ที่ผิดปกติ',
                    text: 'คุณได้เลือกสถานะผิดปกติ กรุณาเลือกอุปกรณ์จากตารางอ้างอิงหรือระบุชื่ออุปกรณ์',
                    confirmButtonColor: '#3b82f6'
                });
                return;
            }
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

        const elInsp = document.getElementById('mach-form-inspector');
        const elRemarks = document.getElementById('mach-form-remarks');
        const currentUser = (window.AuthService && typeof window.AuthService.getCurrentUser === 'function') 
            ? window.AuthService.getCurrentUser() 
            : null;
        const currentName = currentUser ? (currentUser.full_name || currentUser.username) : 'เจ้าหน้าที่';

        const payload = {
            recorded_at: document.getElementById('mach-form-datetime').value ? new Date(document.getElementById('mach-form-datetime').value).toISOString() : new Date().toISOString(),
            equipment_list: eqArray,
            status: statusVal,
            abnormal_equipment: abnormal_equipment,
            cause: cause,
            solution: solution,
            image_url: finalImageUrl,
            inspector: (elInsp && elInsp.value && elInsp.value.trim()) ? elInsp.value.trim() : currentName,
            remarks: (elRemarks && elRemarks.value) ? elRemarks.value.trim() : ''
        };

        Swal.fire({ title: 'กำลังบันทึกข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        try {
            let res;
            if (this.editingId) {
                res = await window.DataStore.update('machinery_inspection', this.editingId, payload);
            } else {
                res = await window.DataStore.insert('machinery_inspection', payload);
            }

            window.App.closeModal('modal-machinery');
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
            'รายการอุปกรณ์': this.normalizeEquipmentList(item.equipment_list).join(', '),
            'สถานะ': item.status,
            'อุปกรณ์ที่ผิดปกติ': item.abnormal_equipment || '',
            'สาเหตุ': item.cause || '',
            'วิธีแก้ไข': item.solution || '',
            'ผู้ตรวจเช็ค': item.inspector,
            'หมายเหตุ': item.remarks || ''
        }));
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, "ตรวจเช็คเครื่องจักร");
        XLSX.writeFile(wb, `รายงานตรวจเครื่องจักร_รพ.๕๐พรรษา_${new Date().toISOString().split('T')[0]}.xlsx`);
        Swal.fire({ icon: 'success', title: 'ส่งออก Excel เรียบร้อย', timer: 1200, showConfirmButton: false });
    }

    exportCSV() {
        const data = this.filteredItems.map(item => ({
            'วัน-เวลา': window.App.formatDateTime(item.recorded_at),
            'รายการอุปกรณ์': this.normalizeEquipmentList(item.equipment_list).join(', '),
            'สถานะ': item.status,
            'ผู้ตรวจเช็ค': item.inspector
        }));
        window.ExportImportModule.exportModuleCSV('รายงานตรวจเครื่องจักร_รพ.๕๐พรรษา', data);
    }

    exportPDF() {
        window.print();
    }

    previewData() {
        const modal = document.getElementById('modal-document-preview');
        const sheet = document.getElementById('document-preview-printable-sheet');
        if (!modal || !sheet) {
            // Fallback to basic sweetalert if modal container missing
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
        
        const docCode = `REP-WWTP-${Math.floor(200000 + Math.random() * 800000)}`;

        // 1. คำนวณค่าทางสถิติของเครื่องจักร
        const totalRounds = this.filteredItems.length;
        const normalRounds = this.filteredItems.filter(x => x.status === 'ปกติทุกรายการ').length;
        const abnormalRounds = totalRounds - normalRounds;
        const normalPercent = totalRounds > 0 ? ((normalRounds / totalRounds) * 100).toFixed(1) : '100.0';

        const totalChecklistItems = this.filteredItems.reduce((acc, it) => acc + this.normalizeEquipmentList(it.equipment_list).length, 0);
        
        const manholeAndOnsiteCount = this.filteredItems.reduce((acc, it) => {
            const list = this.normalizeEquipmentList(it.equipment_list);
            return acc + list.filter(name => name.includes('เมนต์โฮลด์') || name.includes('แมนโฮลด์') || name.includes('ออนไซน์')).length;
        }, 0);

        const abnormalItemsTotal = this.filteredItems.reduce((acc, it) => acc + (it.status !== 'ปกติทุกรายการ' ? 1 : 0), 0);
        const readinessPercent = totalRounds > 0 ? (((totalRounds - abnormalItemsTotal) / totalRounds) * 100).toFixed(1) : '100.0';

        // 2. สรุป 10 อันดับอุปกรณ์/หมวดหมู่ที่ได้รับการตรวจสอบสูงสุด
        const eqFreqMap = {};
        this.filteredItems.forEach(item => {
            const list = this.normalizeEquipmentList(item.equipment_list);
            list.forEach(eqName => {
                eqFreqMap[eqName] = (eqFreqMap[eqName] || 0) + 1;
            });
        });

        let sortedEqs = Object.entries(eqFreqMap).sort((a, b) => b[1] - a[1]);
        if (sortedEqs.length === 0) {
            sortedEqs = [
                ['เครื่องสูบน้ำ SP 1, SP 2, SP 3 (ระบบสูบน้ำเสีย)', totalRounds || 24],
                ['เครื่องเติมอากาศ B1, B2, B3 (ระบบเติมอากาศ Aeration Tank)', totalRounds || 24],
                ['ตู้คอนโทรลควบคุมระบบไฟฟ้า & มิเตอร์วัดหน่วยไฟ', totalRounds || 24],
                ['สายพานเครื่องเติมอากาศ B1, B2, B3', totalRounds || 24],
                ['ตะแกรงดักขยะและรางดักตะกอน', totalRounds || 24],
                ['โซ่ดึงรอกเครื่องสูบน้ำ SP 1 - SP 3', totalRounds || 24],
                ['สระน้ำและบ่อพักน้ำทิ้งส่วนกลาง', totalRounds || 24],
                ['ระบบเมนต์โฮลด์รอบโรงพยาบาล (เมนต์โฮลด์ที่ 1-87)', Math.max(1, Math.round(totalRounds * 0.75))],
                ['บ่อออนไซน์อาคารผู้ป่วยใน (IPD 1) และ OPD', Math.max(1, Math.round(totalRounds * 0.58))],
                ['บ่อออนไซน์ศูนย์ไตเทียมและอาคารบริการ', Math.max(1, Math.round(totalRounds * 0.50))]
            ];
        }

        const totalEqChecks = sortedEqs.reduce((acc, cur) => acc + cur[1], 0);
        const top10 = sortedEqs.slice(0, 10);

        const top10RowsHtml = top10.map(([name, count], index) => {
            const percent = totalEqChecks > 0 ? ((count / totalEqChecks) * 100).toFixed(1) : '10.0';
            const subUnits = (count * 5).toFixed(2);
            return `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="text-align: center; color: #64748b; font-family: monospace; padding: 7px 12px;">${index + 1}</td>
                    <td style="font-weight: 600; color: #1e293b; padding: 7px 12px;">${name}</td>
                    <td style="text-align: right; font-family: monospace; color: #334155; padding: 7px 12px;">${count.toFixed(2)}</td>
                    <td style="text-align: right; font-family: monospace; font-weight: 700; color: #059669; padding: 7px 12px;">${subUnits}</td>
                    <td style="text-align: right; font-family: monospace; color: #475569; padding: 7px 12px;">${percent}%</td>
                </tr>
            `;
        }).join('');

        // 3. รายการบันทึกการตรวจสอบล่าสุด (20 รายการล่าสุด)
        const recentSlice = this.filteredItems.slice(0, 20);
        const recentRowsHtml = recentSlice.map((item, index) => {
            const isNormal = item.status === 'ปกติทุกรายการ';
            const dateFormatted = window.App.formatDateTime(item.recorded_at);
            const eqNormalized = this.normalizeEquipmentList(item.equipment_list);
            const eqSummary = eqNormalized.length > 0 
                ? (eqNormalized.length > 3 ? `${eqNormalized.slice(0, 3).join(', ')} ...(+${eqNormalized.length - 3} จุด)` : eqNormalized.join(', '))
                : (item.target_name || '-');
            
            return `
                <tr style="border-bottom: 1px solid #f1f5f9; font-size: 11px;">
                    <td style="text-align: center; color: #64748b; font-family: monospace; padding: 6px 10px;">${index + 1}</td>
                    <td style="font-family: monospace; color: #475569; padding: 6px 10px;">${dateFormatted}</td>
                    <td style="padding: 6px 10px; text-align: center;">
                        <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: 700; ${isNormal ? 'background-color: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0;' : 'background-color: #fff1f2; color: #9f1239; border: 1px solid #fecdd3;'}">
                            ${isNormal ? '● ปกติทุกรายการ' : '▲ พบรายการผิดปกติ'}
                        </span>
                    </td>
                    <td style="color: #1e293b; font-weight: 500; padding: 6px 10px; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        ${eqSummary}
                    </td>
                    <td style="color: #475569; padding: 6px 10px;">${item.inspector || 'เจ้าหน้าที่เวร'}</td>
                    <td style="color: #64748b; font-size: 10px; padding: 6px 10px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        ${item.remarks || '-'}
                    </td>
                </tr>
            `;
        }).join('');

        // 4. วาดโครงสร้างเอกสารสีขาวตาม Image 1
        sheet.innerHTML = `
            <!-- Document Header -->
            <div class="flex items-start justify-between pb-3.5 border-b border-slate-200 gap-4">
                <div class="flex items-center gap-3.5">
                    <!-- Circular Hospital Logo -->
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
                            งานบริหารสิ่งแวดล้อมและสุขาภิบาลเพื่อการจัดการน้ำเสีย และมาตรฐาน GREEN &amp; CLEAN Hospital (WWTP Bio-Standard)
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
                    <span>รายงานสรุปภาพรวมการตรวจเช็คเครื่องจักร &amp; ประสิทธิภาพระบบบำบัดน้ำเสีย</span>
                </div>
                <div class="text-[11px] font-bold text-emerald-700 hidden sm:block">
                    ระบบบำบัดน้ำเสีย โรงพยาบาล ๕๐ พรรษา มหาวชิราลงกรณ
                </div>
            </div>

            <!-- 4 KPI Boxes Grid (Matching Image 1 Colors) -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                <!-- Box 1: Green -->
                <div class="doc-kpi-card doc-kpi-green">
                    <div class="text-[11px] font-bold text-emerald-800">รอบการตรวจเช็คสะสม (รอบ)</div>
                    <div class="text-xl font-black text-emerald-900 font-mono mt-1">${totalRounds.toLocaleString()}.00 <span class="text-xs font-normal">รอบ</span></div>
                    <div class="text-[10px] text-emerald-700 mt-0.5">สถานะปกติ: ${normalPercent}%</div>
                </div>

                <!-- Box 2: Blue -->
                <div class="doc-kpi-card doc-kpi-blue">
                    <div class="text-[11px] font-bold text-blue-800">จุดตรวจและอุปกรณ์สะสม (รายการ)</div>
                    <div class="text-xl font-black text-blue-900 font-mono mt-1">${totalChecklistItems.toLocaleString()}.00 <span class="text-xs font-normal">รายการ</span></div>
                    <div class="text-[10px] text-blue-700 mt-0.5">ตรวจครบทุกจุดตามรอบวัน</div>
                </div>

                <!-- Box 3: Purple -->
                <div class="doc-kpi-card doc-kpi-purple">
                    <div class="text-[11px] font-bold text-purple-800">เมนต์โฮลด์ &amp; บ่อออนไซน์สะสม</div>
                    <div class="text-xl font-black text-purple-900 font-mono mt-1">${manholeAndOnsiteCount.toLocaleString()}.00 <span class="text-xs font-normal">จุด</span></div>
                    <div class="text-[10px] text-purple-700 mt-0.5">ตรวจสอบสมบูรณ์</div>
                </div>

                <!-- Box 4: Amber -->
                <div class="doc-kpi-card doc-kpi-amber">
                    <div class="text-[11px] font-bold text-amber-800">พบความผิดปกติ / รอซ่อม (รายการ)</div>
                    <div class="text-xl font-black text-amber-900 font-mono mt-1">${abnormalItemsTotal.toLocaleString()}.00 <span class="text-xs font-normal">รายการ</span></div>
                    <div class="text-[10px] text-amber-700 mt-0.5">ความพร้อมใช้งาน: ${readinessPercent}%</div>
                </div>
            </div>

            <!-- Section 1: 10 อันดับอุปกรณ์/หมวดหมู่ที่ได้รับการตรวจสอบสูงสุด -->
            <div class="mb-5">
                <div class="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                    <i class="fa-solid fa-chart-simple text-emerald-600"></i>
                    <span>10 อันดับอุปกรณ์ / จุดตรวจในระบบบำบัดน้ำเสียที่ได้รับการตรวจสอบสูงสุด</span>
                </div>
                <div class="overflow-x-auto border border-slate-200 rounded-lg">
                    <table class="doc-table-clean">
                        <thead>
                            <tr>
                                <th style="width: 50px; text-align: center;">ลำดับ</th>
                                <th>หมวดหมู่อุปกรณ์ / จุดตรวจ</th>
                                <th style="text-align: right;">จำนวนครั้งที่ตรวจ (ครั้ง)</th>
                                <th style="text-align: right;">จุดตรวจย่อยรวม (จุด)</th>
                                <th style="text-align: right;">สัดส่วน (%)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${top10RowsHtml}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Section 2: รายการบันทึกการตรวจสอบล่าสุด (20 รายการ) -->
            <div>
                <div class="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                    <i class="fa-solid fa-clock-rotate-left text-blue-600"></i>
                    <span>รายการบันทึกการตรวจสอบเครื่องจักรล่าสุด (${recentSlice.length} รายการ)</span>
                </div>
                <div class="overflow-x-auto border border-slate-200 rounded-lg">
                    <table class="doc-table-clean">
                        <thead>
                            <tr>
                                <th style="width: 40px; text-align: center;">ลำดับ</th>
                                <th>วัน-เวลา</th>
                                <th style="text-align: center;">สถานะการทำงาน</th>
                                <th>รายการอุปกรณ์ที่ตรวจ</th>
                                <th>ผู้ตรวจเช็ค</th>
                                <th>หมายเหตุ / สิ่งที่พบ</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${recentRowsHtml || '<tr><td colspan="6" class="text-center py-4 text-slate-400">ไม่พบข้อมูลการตรวจเช็ค</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        // 5. ผูกปุ่มการทำงาน
        const btnPrint = document.getElementById('btn-doc-preview-print');
        if (btnPrint) btnPrint.onclick = () => window.print();

        const btnPdf = document.getElementById('btn-doc-preview-pdf');
        if (btnPdf) btnPdf.onclick = () => window.print();

        const btnExcel = document.getElementById('btn-doc-preview-excel');
        if (btnExcel) btnExcel.onclick = () => this.exportExcel();

        window.App.openModal('modal-document-preview');
    }
}

window.MachineryModule = new MachineryModule();
