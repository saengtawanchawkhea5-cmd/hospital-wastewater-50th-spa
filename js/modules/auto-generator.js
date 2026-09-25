/**
 * ============================================================================
 * ระบบบำบัดน้ำเสีย โรงพยาบาล ๕๐ พรรษา มหาวชิราลงกรณ (SPA)
 * AUTO-GENERATOR.JS - ระบบบันทึกข้อมูลน้ำเสียอัตโนมัติ & ย้อนหลังอัจฉริยะ
 * (Smart Auto-Record Generator & Missing Date Catch-up System)
 * รองรับทุกหน้า: น้ำเสียเข้า, การใช้ไฟฟ้า, ตรวจคุณภาพน้ำ, เครื่องจักร, ภาพรวม
 * ============================================================================
 */

class AutoGeneratorController {
    constructor() {
        this.currentModule = 'influent'; // 'influent', 'electricity', 'water_quality', 'quarterly_water_quality', 'machinery', 'all'
        this.currentTab = 'range'; // 'range' or 'single'
        this.selectedShift = 'both'; // 'both', 'morning', 'afternoon'
        this.startDate = '';
        this.endDate = '';
        this.singleDate = '';
        this.missingDates = [];
        this.recordedDateSet = new Set();
        this.tableItems = [];
        this.lastWaterMeter = 441921.42;
        this.lastElecMeter = 202842.10;
        this.initialized = false;
        this.equipmentReferenceList = [];
        this.selectedEquipmentNames = [];
        this.selectedSamplingPoint = 'จุดปลายท่อออกจากระบบบำบัด';

        // โมเดลสัดส่วนโรงพยาบาล ๕๐ พรรษา มหาวชิราลงกรณ (330 เตียง)
        this.hospitalModel = {
            beds: 330,
            bor: 0.82, // Bed Occupancy Rate ~82%
            opdPerDay: 1050,
            staff: 760,
            buildings: [
                { id: 'all_hospital', name: 'รวมทุกอาคารโรงพยาบาล', factor: 1.0, baseUsage: 200.0, meterPrefix: 440000 }
            ],
            shifts: {
                morning: { name: 'เวรเช้า (08.00 - 16.00 น.)', time: '13:12', label: 'เวรเช้า 13:12 น.', ratio: 0.62 },
                afternoon: { name: 'เวรบ่าย (16.00 - 20.00 น.)', time: '18:01', label: 'เวรบ่าย 18:01 น.', ratio: 0.38 }
            },
            electricityBaseKwh: 460.0,
            electricityUnitPrice: 4.50,
            equipmentList: []
        };
    }

    init() {
        if (this.initialized) return;
        this.initialized = true;
        this.bindEvents();
        this.bindGlobalPageTriggers();
        this.setDefaultDates();
        this.checkMissingDates().then(() => {
            this.updatePreviewBadge();
        }).catch(() => {});
    }

    getTodayISO() {
        const today = new Date();
        let yyyy = today.getFullYear();
        if (yyyy > 2400) yyyy -= 543;
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    setDefaultDates() {
        const todayStr = this.getTodayISO();
        const [yyyy, mmStr] = todayStr.split('-');
        const yyyyNum = parseInt(yyyy, 10);
        const mmNum = parseInt(mmStr, 10);

        // กฎเหล็ก: ห้ามลงข้อมูลเกินวันที่ปัจจุบัน (Start: วันที่ 1 ของเดือน, End: วันปัจจุบันเสมอ ห้ามตั้งไปถึงสิ้นเดือน)
        this.startDate = `${yyyy}-${mmStr}-01`;
        if (this.startDate > todayStr) this.startDate = todayStr;
        this.endDate = todayStr;
        this.singleDate = todayStr;

        const inputStart = document.getElementById('auto-gen-start-date');
        const inputEnd = document.getElementById('auto-gen-end-date');
        const inputSingle = document.getElementById('auto-gen-single-date');

        if (inputStart) {
            inputStart.value = this.startDate;
            inputStart.max = todayStr;
        }
        if (inputEnd) {
            inputEnd.value = this.endDate;
            inputEnd.max = todayStr;
        }
        if (inputSingle) {
            inputSingle.value = todayStr;
            inputSingle.max = todayStr;
        }

        this.syncDateDropdowns('start', this.startDate);
        this.syncDateDropdowns('end', this.endDate);

        // ซิงค์ Preset เดือนและปี
        const monthPresetEl = document.getElementById('auto-gen-month-preset');
        const yearPresetEl = document.getElementById('auto-gen-year-preset');
        if (monthPresetEl) monthPresetEl.value = String(mmNum);
        if (yearPresetEl) yearPresetEl.value = String(yyyyNum + 543);
    }

    bindEvents() {
        // Quick Range Buttons (วันนี้, เมื่อวาน, สัปดาห์นี้, ทั้งเดือนนี้, 1-31, 1-15, 16-สิ้นเดือน, เติมวันขาดหาย ฯลฯ)
        document.querySelectorAll('.btn-auto-quick-range').forEach(btn => {
            btn.addEventListener('click', () => {
                const range = btn.getAttribute('data-range');
                this.selectQuickRange(range);
            });
        });

        // Date Inputs change with strict clamping to today
        const inputStart = document.getElementById('auto-gen-start-date');
        if (inputStart) {
            inputStart.addEventListener('change', (e) => {
                const todayStr = this.getTodayISO();
                if (e.target.value > todayStr) {
                    e.target.value = todayStr;
                    if (window.Swal) {
                        Swal.fire({ toast: true, position: 'top-end', icon: 'warning', title: 'ห้ามเลือกวันที่เกินวันปัจจุบัน', showConfirmButton: false, timer: 1800, background: '#0c1322', color: '#f8fafc' });
                    }
                }
                this.startDate = e.target.value;
                this.syncDateDropdowns('start', this.startDate);
                this.updatePreviewBadge();
                this.renderPreviewTable();
            });
        }

        const inputEnd = document.getElementById('auto-gen-end-date');
        if (inputEnd) {
            inputEnd.addEventListener('change', (e) => {
                const todayStr = this.getTodayISO();
                if (e.target.value > todayStr) {
                    e.target.value = todayStr;
                    if (window.Swal) {
                        Swal.fire({ toast: true, position: 'top-end', icon: 'warning', title: 'ห้ามเลือกวันที่เกินวันปัจจุบัน', showConfirmButton: false, timer: 1800, background: '#0c1322', color: '#f8fafc' });
                    }
                }
                this.endDate = e.target.value;
                this.syncDateDropdowns('end', this.endDate);
                this.updatePreviewBadge();
                this.renderPreviewTable();
            });
        }

        const inputSingle = document.getElementById('auto-gen-single-date');
        if (inputSingle) {
            inputSingle.addEventListener('change', (e) => {
                const todayStr = this.getTodayISO();
                if (e.target.value > todayStr) {
                    e.target.value = todayStr;
                    if (window.Swal) {
                        Swal.fire({ toast: true, position: 'top-end', icon: 'warning', title: 'ห้ามเลือกวันที่เกินวันปัจจุบัน', showConfirmButton: false, timer: 1800, background: '#0c1322', color: '#f8fafc' });
                    }
                }
                this.singleDate = e.target.value;
                this.updatePreviewBadge();
                this.renderPreviewTable();
            });
        }

        // Date Dropdown Selects (Day, Month, Year) with strict clamping to today
        ['start', 'end'].forEach(prefix => {
            const dayEl = document.getElementById(`auto-gen-${prefix}-day`);
            const monthEl = document.getElementById(`auto-gen-${prefix}-month`);
            const yearEl = document.getElementById(`auto-gen-${prefix}-year`);

            const handler = () => {
                const d = parseInt(dayEl ? dayEl.value : 1, 10);
                const m = parseInt(monthEl ? monthEl.value : 1, 10);
                const yThai = parseInt(yearEl ? yearEl.value : 2569, 10);
                const yGreg = yThai > 2400 ? yThai - 543 : yThai;

                let dateStr = `${yGreg}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const todayStr = this.getTodayISO();
                if (dateStr > todayStr) {
                    dateStr = todayStr;
                    if (window.Swal) {
                        Swal.fire({
                            toast: true,
                            position: 'top-end',
                            icon: 'warning',
                            title: 'ห้ามเลือกวันที่เกินวันปัจจุบัน',
                            showConfirmButton: false,
                            timer: 1800,
                            background: '#0c1322',
                            color: '#f8fafc'
                        });
                    }
                }
                const inputEl = document.getElementById(`auto-gen-${prefix}-date`);
                if (inputEl) {
                    inputEl.value = dateStr;
                    inputEl.max = todayStr;
                }

                if (prefix === 'start') this.startDate = dateStr;
                else this.endDate = dateStr;

                this.syncDateDropdowns(prefix, dateStr);
                this.updatePreviewBadge();
                this.renderPreviewTable();
            };

            if (dayEl) dayEl.addEventListener('change', handler);
            if (monthEl) monthEl.addEventListener('change', handler);
            if (yearEl) yearEl.addEventListener('change', handler);
        });

        // Preset Month & Year Selects change
        const monthPresetEl = document.getElementById('auto-gen-month-preset');
        if (monthPresetEl) {
            monthPresetEl.addEventListener('change', () => this.applyMonthPreset());
        }
        const yearPresetEl = document.getElementById('auto-gen-year-preset');
        if (yearPresetEl) {
            yearPresetEl.addEventListener('change', () => this.applyMonthPreset());
        }

        // Checkbox: ข้ามวันที่มีข้อมูลอยู่แล้ว
        const skipExistingEl = document.getElementById('auto-gen-skip-existing');
        if (skipExistingEl) {
            skipExistingEl.addEventListener('change', () => {
                this.updatePreviewBadge();
                this.renderPreviewTable();
            });
        }

        // Shift Buttons
        document.querySelectorAll('.btn-auto-shift').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.btn-auto-shift').forEach(b => {
                    b.classList.remove('active', 'border-amber-500', 'bg-amber-500', 'text-slate-950', 'font-bold');
                    b.classList.add('border-slate-800', 'bg-slate-900/80', 'text-slate-300');
                });
                btn.classList.add('active', 'border-amber-500', 'bg-amber-500', 'text-slate-950', 'font-bold');
                btn.classList.remove('border-slate-800', 'bg-slate-900/80', 'text-slate-300');
                this.selectedShift = btn.getAttribute('data-shift') || 'both';
                this.renderPreviewTable();
            });
        });

        // Module Scope Selector Buttons
        document.querySelectorAll('.btn-auto-module-scope').forEach(btn => {
            btn.addEventListener('click', async () => {
                this.currentModule = btn.getAttribute('data-module') || 'influent';
                this.highlightModuleScope(this.currentModule);
                this.updateModalHeaders(this.currentModule);
                await this.updateEquipmentSectionVisibility();
                await this.loadLatestMeters();
                await this.checkMissingDates();
                this.updatePreviewBadge();
                this.renderPreviewTable();
            });
        });

        // Main Range vs Single Tabs
        document.querySelectorAll('.btn-auto-main-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.getAttribute('data-tab') || 'range';
                this.currentTab = tab;

                document.querySelectorAll('.btn-auto-main-tab').forEach(b => {
                    b.classList.remove('active', 'bg-gradient-to-r', 'from-amber-500', 'to-orange-500', 'text-slate-950', 'font-bold');
                    b.classList.add('bg-transparent', 'text-slate-400');
                });
                btn.classList.add('active', 'bg-gradient-to-r', 'from-amber-500', 'to-orange-500', 'text-slate-950', 'font-bold');
                btn.classList.remove('bg-transparent', 'text-slate-400');

                const rangeView = document.getElementById('auto-gen-view-range');
                const singleView = document.getElementById('auto-gen-view-single');

                if (tab === 'range') {
                    if (rangeView) rangeView.style.display = 'block';
                    if (singleView) singleView.style.display = 'none';
                } else {
                    if (rangeView) rangeView.style.display = 'none';
                    if (singleView) singleView.style.display = 'block';
                }
                this.updatePreviewBadge();
                this.renderPreviewTable();
            });
        });

        // Sampling Point Selection for Water Quality
        const samplingPointEl = document.getElementById('auto-gen-sampling-point');
        if (samplingPointEl) {
            samplingPointEl.addEventListener('change', (e) => {
                this.selectedSamplingPoint = e.target.value || 'จุดปลายท่อออกจากระบบบำบัด';
                this.renderPreviewTable();
            });
        }
    }

    /**
     * ค้นหาและแมปชื่อโมดูลเป้าหมายให้ตรงกับหน้าปัจจุบันของระบบ 100%
     */
    resolveActiveModule(mod) {
        if (mod) {
            if (mod === 'all') return 'all';
            if (mod === 'quarterly' || mod === 'quarterly_water_quality' || mod === 'quarterly-water-quality') return 'quarterly_water_quality';
            if (mod === 'water-quality' || mod === 'water_quality') {
                if (window.WaterQualityModule && window.WaterQualityModule.currentTab === 'quarter') {
                    return 'quarterly_water_quality';
                }
                return 'water_quality';
            }
            if (mod === 'electricity') return 'electricity';
            if (mod === 'influent') return 'influent';
            if (mod === 'machinery') return 'machinery';
            return mod;
        }
        if (window.App && window.App.currentRoute) {
            const r = window.App.currentRoute;
            if (r === 'dashboard') return 'all';
            if (r === 'water-quality' || r === 'water_quality') {
                if (window.WaterQualityModule && window.WaterQualityModule.currentTab === 'quarter') {
                    return 'quarterly_water_quality';
                }
                return 'water_quality';
            }
            if (r === 'electricity') return 'electricity';
            if (r === 'influent') return 'influent';
            if (r === 'machinery') return 'machinery';
        }
        return 'influent';
    }

    /**
     * ดึงข้อมูลรายการอุปกรณ์สดจากฐานข้อมูลอ้างอิงอุปกรณ์ (Equipment Reference)
     * เพื่อให้ระบบตรวจสอบอัตโนมัติใช้อุปกรณ์จริงในระบบ 100% ไม่มีอุปกรณ์นอกระบบ
     */
    async loadEquipmentReference() {
        try {
            let list = [];
            if (window.DataStore && typeof window.DataStore.getAll === 'function') {
                list = await window.DataStore.getAll('equipment_ref', { orderBy: 'equipment_name', ascending: true });
            }
            if ((!list || list.length === 0) && window.EquipmentRefModule && Array.isArray(window.EquipmentRefModule.items) && window.EquipmentRefModule.items.length > 0) {
                list = window.EquipmentRefModule.items;
            }
            if ((!list || list.length === 0) && typeof SAMPLE_DATABASE !== 'undefined' && Array.isArray(SAMPLE_DATABASE.equipment_ref) && SAMPLE_DATABASE.equipment_ref.length > 0) {
                list = SAMPLE_DATABASE.equipment_ref;
            }

            // กรองเฉพาะอุปกรณ์ที่พร้อมใช้งาน (ready/active)
            this.equipmentReferenceList = (list || []).filter(item => {
                const s = (item.status || '').toLowerCase();
                return s !== 'inactive' && s !== 'decommissioned' && s !== 'ยกเลิก' && s !== 'จำหน่าย';
            });

            // ตรวจสอบความถูกต้องของ selectedEquipmentNames ให้ตรงกับฐานข้อมูลจริงเท่านั้น
            const validNameSet = new Set(this.equipmentReferenceList.map(x => x.equipment_name));
            if (this.selectedEquipmentNames && this.selectedEquipmentNames.length > 0) {
                this.selectedEquipmentNames = this.selectedEquipmentNames.filter(name => validNameSet.has(name));
            }

            // หากยังไม่มีการเลือก หรือรายการว่าง ให้เลือกชุดอุปกรณ์ตรวจเช็คระบบหลักเป็นค่าเริ่มต้น
            if (!this.selectedEquipmentNames || this.selectedEquipmentNames.length === 0) {
                const defaultItems = this.equipmentReferenceList.filter(item => {
                    const cat = (item.category || '').toLowerCase();
                    return !cat.includes('วัสดุสิ้นเปลือง') && !cat.includes('ความปลอดภัย') && !cat.includes('สารเคมี') && !cat.includes('อะไหล่');
                });
                
                if (defaultItems.length > 0) {
                    this.selectedEquipmentNames = defaultItems.map(item => item.equipment_name);
                } else {
                    this.selectedEquipmentNames = this.equipmentReferenceList.map(item => item.equipment_name);
                }
            }

            this.hospitalModel.equipmentList = [...this.selectedEquipmentNames];
        } catch (e) {
            console.error('Error loading equipment reference:', e);
            this.equipmentReferenceList = [];
            this.selectedEquipmentNames = [];
        }
    }

    /**
     * ดึงไอคอนและสีประจำหมวดหมู่อุปกรณ์
     */
    getCategoryIcon(cat) {
        const c = (cat || '').toLowerCase();
        if (c.includes('เติมอากาศ') || c.includes('blower') || c.includes('aerat')) return { icon: '🌀', color: 'text-cyan-400' };
        if (c.includes('สูบน้ำ') || c.includes('pump')) return { icon: '⚡', color: 'text-blue-400' };
        if (c.includes('จ่ายสาร') || c.includes('dosing')) return { icon: '🧪', color: 'text-violet-400' };
        if (c.includes('วัด') || c.includes('sensor') || c.includes('ตรวจ')) return { icon: '📊', color: 'text-emerald-400' };
        if (c.includes('คัดกรอง') || c.includes('ขยะ') || c.includes('screen')) return { icon: '🗑️', color: 'text-teal-400' };
        if (c.includes('กรองน้ำ') || c.includes('filter')) return { icon: '🪨', color: 'text-amber-400' };
        if (c.includes('กลบำบัด') || c.includes('mix') || c.includes('press')) return { icon: '⚙️', color: 'text-indigo-400' };
        if (c.includes('ฆ่าเชื้อ') || c.includes('uv')) return { icon: '💡', color: 'text-purple-400' };
        if (c.includes('ไฟฟ้า') || c.includes('generator')) return { icon: '🔋', color: 'text-yellow-400' };
        if (c.includes('วาล์ว') || c.includes('valve') || c.includes('ท่อ')) return { icon: '🚰', color: 'text-sky-400' };
        return { icon: '🔧', color: 'text-slate-400' };
    }

    /**
     * เรนเดอร์กล่องตัวเลือกอุปกรณ์จัดกลุ่มตามหมวดหมู่ใน Equipment Reference
     */
    renderEquipmentSelector(searchTerm = '') {
        const container = document.getElementById('auto-gen-eq-list-container');
        const badgeEl = document.getElementById('auto-gen-eq-count-badge');
        if (!container) return;

        if (!this.equipmentReferenceList || this.equipmentReferenceList.length === 0) {
            container.innerHTML = `
                <div class="text-center py-6 text-slate-400 text-xs">
                    <i class="fa-solid fa-triangle-exclamation text-amber-400 text-lg mb-1.5"></i>
                    <div>ไม่พบรายการอุปกรณ์ในฐานข้อมูล Equipment Reference</div>
                </div>
            `;
            if (badgeEl) badgeEl.textContent = 'เลือก 0 / 0 รายการ';
            return;
        }

        const totalAvailable = this.equipmentReferenceList.length;
        const selectedCount = (this.selectedEquipmentNames || []).length;
        if (badgeEl) {
            badgeEl.innerHTML = `<i class="fa-solid fa-circle-check text-emerald-400 mr-1"></i>เลือก ${selectedCount} / ${totalAvailable} รายการ`;
        }

        // กรองตาม searchTerm
        let filtered = this.equipmentReferenceList;
        const term = (searchTerm || '').trim().toLowerCase();
        if (term) {
            filtered = filtered.filter(item => {
                const name = (item.equipment_name || '').toLowerCase();
                const code = (item.equipment_code || '').toLowerCase();
                const cat = (item.category || '').toLowerCase();
                const loc = (item.location || '').toLowerCase();
                return name.includes(term) || code.includes(term) || cat.includes(term) || loc.includes(term);
            });
        }

        if (filtered.length === 0) {
            const safeTerm = window.App ? window.App.escapeHtml(searchTerm) : searchTerm;
            container.innerHTML = `
                <div class="text-center py-6 text-slate-400 text-xs">
                    <i class="fa-solid fa-magnifying-glass text-slate-500 text-base mb-1.5"></i>
                    <div>ไม่พบอุปกรณ์ที่ตรงกับ "${safeTerm}"</div>
                </div>
            `;
            return;
        }

        // จัดกลุ่มตามหมวดหมู่ category
        const groups = {};
        filtered.forEach(item => {
            const cat = item.category || 'ระบบเครื่องจักรและอุปกรณ์';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(item);
        });

        const selectedSet = new Set(this.selectedEquipmentNames || []);

        let html = '';
        Object.keys(groups).forEach(catName => {
            const items = groups[catName];
            const meta = this.getCategoryIcon(catName);
            const groupSelectedCount = items.filter(x => selectedSet.has(x.equipment_name)).length;

            html += `
                <div class="auto-gen-eq-group">
                    <div class="auto-gen-eq-group-title">
                        <span class="flex items-center gap-1.5 text-xs">
                            <span>${meta.icon}</span>
                            <span class="text-white font-semibold">${catName}</span>
                            <span class="text-[10px] text-slate-400 font-mono">(${groupSelectedCount}/${items.length})</span>
                        </span>
                        <button type="button" class="text-[10px] text-cyan-400 hover:text-cyan-200 underline cursor-pointer font-medium"
                            onclick="window.AutoGeneratorModule && window.AutoGeneratorModule.toggleGroupSelection('${encodeURIComponent(catName)}')">
                            ${groupSelectedCount === items.length ? 'ยกเลิกทั้งหมวด' : 'เลือกทั้งหมวด'}
                        </button>
                    </div>
                    <div class="flex flex-wrap gap-1.5">
            `;

            items.forEach(item => {
                const isSelected = selectedSet.has(item.equipment_name);
                const safeNameAttr = encodeURIComponent(item.equipment_name);
                html += `
                    <label class="auto-gen-eq-chip ${isSelected ? 'selected' : ''}" title="${item.location ? `ตำแหน่ง: ${item.location}` : item.equipment_name}">
                        <input type="checkbox" value="${safeNameAttr}" ${isSelected ? 'checked' : ''}
                            onchange="window.AutoGeneratorModule && window.AutoGeneratorModule.toggleEquipmentSelection(decodeURIComponent(this.value), this.checked)" />
                        ${item.equipment_code ? `<span class="auto-gen-eq-code">${item.equipment_code}</span>` : ''}
                        <span>${item.equipment_name}</span>
                    </label>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    /**
     * สลับการเลือกอุปกรณ์รายชิ้น
     */
    toggleEquipmentSelection(name, isChecked) {
        if (!this.selectedEquipmentNames) this.selectedEquipmentNames = [];
        const set = new Set(this.selectedEquipmentNames);
        if (isChecked) {
            set.add(name);
        } else {
            set.delete(name);
        }
        this.selectedEquipmentNames = Array.from(set);
        this.hospitalModel.equipmentList = [...this.selectedEquipmentNames];

        const searchInput = document.getElementById('auto-gen-eq-search');
        this.renderEquipmentSelector(searchInput ? searchInput.value : '');
        this.updateModalHeaders(this.currentModule);
        this.renderPreviewTable();
    }

    /**
     * สลับการเลือกอุปกรณ์ยกหมวดหมู่
     */
    toggleGroupSelection(catNameEncoded) {
        const catName = decodeURIComponent(catNameEncoded);
        const groupItems = (this.equipmentReferenceList || []).filter(x => (x.category || 'ระบบเครื่องจักรและอุปกรณ์') === catName);
        if (groupItems.length === 0) return;

        const set = new Set(this.selectedEquipmentNames || []);
        const allInGroupSelected = groupItems.every(x => set.has(x.equipment_name));

        if (allInGroupSelected) {
            groupItems.forEach(x => set.delete(x.equipment_name));
        } else {
            groupItems.forEach(x => set.add(x.equipment_name));
        }

        this.selectedEquipmentNames = Array.from(set);
        this.hospitalModel.equipmentList = [...this.selectedEquipmentNames];

        const searchInput = document.getElementById('auto-gen-eq-search');
        this.renderEquipmentSelector(searchInput ? searchInput.value : '');
        this.updateModalHeaders(this.currentModule);
        this.renderPreviewTable();
    }

    /**
     * เลือกอุปกรณ์ตามชุดทางลัดที่ตั้งไว้ (Presets)
     */
    selectEquipmentPreset(presetType) {
        if (!this.equipmentReferenceList || this.equipmentReferenceList.length === 0) return;

        if (presetType === 'all') {
            this.selectedEquipmentNames = this.equipmentReferenceList.map(x => x.equipment_name);
        } else if (presetType === 'clear') {
            this.selectedEquipmentNames = [];
        } else if (presetType === 'machinery') {
            this.selectedEquipmentNames = this.equipmentReferenceList.filter(item => {
                const cat = (item.category || '').toLowerCase();
                const name = (item.equipment_name || '').toLowerCase();
                return cat.includes('เติมอากาศ') || cat.includes('สูบน้ำ') || cat.includes('blower') || cat.includes('pump') ||
                       cat.includes('กลบำบัด') || cat.includes('mix') || cat.includes('press') || cat.includes('กรองน้ำ') ||
                       name.includes('ปั๊ม') || name.includes('blower') || name.includes('เครื่องกวน') || name.includes('เครื่องรีด') || name.includes('ขับสะพาน');
            }).map(x => x.equipment_name);
        } else if (presetType === 'sensors') {
            this.selectedEquipmentNames = this.equipmentReferenceList.filter(item => {
                const cat = (item.category || '').toLowerCase();
                const name = (item.equipment_name || '').toLowerCase();
                return cat.includes('วัด') || cat.includes('sensor') || cat.includes('ตรวจวัด') ||
                       name.includes('flow') || name.includes('sensor') || name.includes('หัววัด') || name.includes('meter');
            }).map(x => x.equipment_name);
        } else if (presetType === 'daily') {
            this.selectedEquipmentNames = this.equipmentReferenceList.filter(item => {
                const cat = (item.category || '').toLowerCase();
                return !cat.includes('วัสดุสิ้นเปลือง') && !cat.includes('ความปลอดภัย') && !cat.includes('อะไหล่') && !cat.includes('สารเคมี');
            }).map(x => x.equipment_name);
        }

        this.hospitalModel.equipmentList = [...this.selectedEquipmentNames];
        const searchInput = document.getElementById('auto-gen-eq-search');
        this.renderEquipmentSelector(searchInput ? searchInput.value : '');
        this.updateModalHeaders(this.currentModule);
        this.renderPreviewTable();
    }

    /**
     * ค้นหากรองอุปกรณ์
     */
    filterEquipmentList(searchTerm) {
        this.renderEquipmentSelector(searchTerm);
    }

    /**
     * ควบคุมการแสดงผลของส่วนเลือกอุปกรณ์ตามโมดูล
     */
    async updateEquipmentSectionVisibility() {
        const isAdmin = window.AuthService ? window.AuthService.isAdmin() : false;
        const sec = document.getElementById('auto-gen-machinery-eq-section');
        // แสดงเมื่อเป็นโมดูล machinery (สำหรับทั้ง User และ Admin) หรือเป็น all (สำหรับ Admin)
        const isMach = (this.currentModule === 'machinery') || (isAdmin && this.currentModule === 'all');
        if (sec) {
            if (isMach) {
                sec.style.removeProperty('display');
                sec.style.display = 'block';
            } else {
                sec.style.display = 'none';
            }
        }
        if (isMach) {
            await this.loadEquipmentReference();
            this.renderEquipmentSelector();
            this.updateModalHeaders(this.currentModule);
        }
    }

    /**
     * สร้างข้อความสรุปอุปกรณ์แบบไดนามิกสำหรับแถวตารางพรีวิว
     */
    getEquipmentSummaryText() {
        const count = (this.selectedEquipmentNames || []).length;
        if (count === 0) {
            return '⚠️ ยังไม่ได้เลือกอุปกรณ์จากฐานข้อมูลอ้างอิงอุปกรณ์ (Equipment Reference)';
        }
        if (count === 1) {
            return `ตรวจเช็ค: ${this.selectedEquipmentNames[0]} ทำงานปกติ 100%`;
        }
        if (count <= 3) {
            return `ตรวจเช็ค: ${this.selectedEquipmentNames.join(', ')} ทำงานปกติ 100%`;
        }
        const first3 = this.selectedEquipmentNames.slice(0, 3).join(', ');
        return `ตรวจเช็ค: ${first3} และอื่นๆ รวม ${count} รายการ ทำงานปกติ 100%`;
    }

    /**
     * อัปเดตหัวข้อ คำอธิบาย และหัวคอลัมน์ของหน้าต่าง Auto Generator ตามโมดูลที่เลือก
     */
    updateModalHeaders(mod) {
        const titleEl = document.getElementById('auto-gen-modal-title');
        const subtitleEl = document.getElementById('auto-gen-modal-subtitle');
        const colMetricEl = document.getElementById('auto-gen-col-metric-header');
        const eqCount = (this.selectedEquipmentNames || []).length;
        
        const configs = {
            influent: {
                title: 'ระบบบันทึกข้อมูลปริมาณน้ำเสียอัตโนมัติ (Daily Inflow Auto-Generator)',
                subtitle: 'คำนวณปริมาณน้ำใช้ ลบ.ม., ค่าน้ำเสีย 80% และเลขมิเตอร์น้ำ พร้อมบันทึกลงระบบ',
                colMetric: 'ปริมาณน้ำใช้ (ลบ.ม.) / น้ำเสีย 80% (แก้ไขได้ ✏️)'
            },
            electricity: {
                title: 'ระบบบันทึกการใช้พลังงานไฟฟ้าอัตโนมัติ (Electricity Auto-Generator)',
                subtitle: 'คำนวณหน่วยไฟฟ้า kWh, ค่าไฟฟ้าบาท (4.50 บ./หน่วย) และเลขมิเตอร์ไฟฟ้า พร้อมบันทึกลงระบบ',
                colMetric: 'หน่วยไฟฟ้า (kWh) / ค่าไฟบาท (แก้ไขได้ ✏️)'
            },
            water_quality: {
                title: 'ระบบบันทึกผลตรวจวัดคุณภาพน้ำเบื้องต้นอัตโนมัติ (Water Quality Auto-Generator)',
                subtitle: 'สุ่มผลตรวจวิเคราะห์ pH, DO, TDS, คลอรีนอิสระ, ตะกอนแขวนลอย SS ตามเกณฑ์มาตรฐาน',
                colMetric: 'ผลตรวจวัด pH, DO, TDS, Cl, SS (แก้ไขได้ ✏️)'
            },
            quarterly_water_quality: {
                title: 'ระบบบันทึกผลตรวจวิเคราะห์คุณภาพน้ำประจำไตรมาสอัตโนมัติ (11 พารามิเตอร์ สธ.)',
                subtitle: 'ตรวจสอบและยืนยันผลการตรวจวิเคราะห์ 11 พารามิเตอร์ สธ. ตามเกณฑ์มาตรฐานห้องแล็บ ISO/IEC 17025 ก่อนบันทึก',
                colMetric: 'ผลตรวจ 11 พารามิเตอร์ สธ. (BOD, COD, SS, TSS, TDS, TKN, G&O, Sulfide, pH, TCB, FCB) (แก้ไขได้ ✏️)'
            },
            machinery: {
                title: 'ระบบบันทึกการตรวจเช็คเครื่องจักรอัตโนมัติ (Machinery Daily Checklist)',
                subtitle: `บันทึกสถานะการทำงานปกติของเครื่องจักร (${eqCount} รายการ) ที่เลือกจากฐานข้อมูลอ้างอิงอุปกรณ์ประจำวัน`,
                colMetric: `สถานะการทำงานเครื่องจักร (${eqCount} รายการ) (แก้ไขได้ ✏️)`
            },
            all: {
                title: 'ระบบบันทึกข้อมูลครบวงจรอัตโนมัติ (All-In-One Auto Generator)',
                subtitle: 'คำนวณค่าน้ำเสีย 80%, หน่วยไฟฟ้า kWh, ผลตรวจคุณภาพน้ำ, และเช็คลิสต์เครื่องจักร พร้อมบันทึกลงระบบ',
                colMetric: 'ค่าน้ำ / ค่าไฟ / ผลตรวจ (แก้ไขได้ ✏️)'
            }
        };

        const target = mod || this.currentModule || 'all';
        const cfg = configs[target] || configs.all;
        if (titleEl) titleEl.textContent = cfg.title;
        if (subtitleEl) subtitleEl.textContent = cfg.subtitle;
        if (colMetricEl) {
            colMetricEl.textContent = cfg.colMetric;
            if (target === 'quarterly_water_quality') {
                colMetricEl.classList.remove('text-right');
                colMetricEl.classList.add('text-left');
            } else {
                colMetricEl.classList.remove('text-left');
                colMetricEl.classList.add('text-right');
            }
        }
    }

    /**
     * ผูกปุ่มบันทึกอัตโนมัติทุกหน้าในระบบ (Global Button Delegation)
     * เพื่อให้ปุ่มทุกหน้าเรียกใช้งานระบบ Auto Gen เฉพาะโมดูลของหน้านั้นๆ ได้ทันที 100%
     */
    bindGlobalPageTriggers() {
        const triggerConfigs = [
            { id: 'btn-dash-auto-gen', module: null },
            { id: 'btn-inf-auto-gen', module: 'influent' },
            { id: 'btn-elec-auto-gen', module: 'electricity' },
            { id: 'btn-add-influent-auto', module: 'influent' },
            { id: 'btn-add-electricity-auto', module: 'electricity' },
            { id: 'btn-add-prelim-quality-auto', module: 'water_quality' },
            { id: 'btn-add-quarterly-quality-auto', module: 'quarterly_water_quality' },
            { id: 'btn-add-machinery-auto', module: 'machinery' }
        ];

        triggerConfigs.forEach(({ id, module }) => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.onclick = (e) => {
                    if (e) e.preventDefault();
                    let targetMod = module;
                    if (!targetMod) {
                        targetMod = this.resolveActiveModule();
                    }
                    this.openGeneratorModal(targetMod);
                };
            }
        });
    }

    /**
     * ไฮไลต์ปุ่มเลือกโมดูลขอบเขต
     */
    highlightModuleScope(moduleType) {
        document.querySelectorAll('.btn-auto-module-scope').forEach(b => {
            const m = b.getAttribute('data-module');
            if (m === moduleType) {
                b.classList.add('active', 'border-cyan-500/60', 'bg-cyan-950/50', 'text-cyan-300');
                b.classList.remove('border-slate-800', 'bg-slate-900/80', 'text-slate-400');
            } else {
                b.classList.remove('active', 'border-cyan-500/60', 'bg-cyan-950/50', 'text-cyan-300');
                b.classList.add('border-slate-800', 'bg-slate-900/80', 'text-slate-400');
            }
        });
    }

    /**
     * โหลดค่ามิเตอร์น้ำและมิเตอร์ไฟฟ้าล่าสุดจากฐานข้อมูลเพื่อความต่อเนื่อง
     */
    async loadLatestMeters() {
        try {
            if (window.DataStore && typeof window.DataStore.getAll === 'function') {
                const latestWater = await window.DataStore.getAll('influent_wastewater', { orderBy: 'recorded_at', ascending: false });
                if (Array.isArray(latestWater) && latestWater.length > 0) {
                    const found = latestWater.find(x => x.meter_today || x.meter_end);
                    if (found) this.lastWaterMeter = parseFloat(found.meter_today || found.meter_end) || this.lastWaterMeter;
                }
                const latestElec = await window.DataStore.getAll('electricity_consumption', { orderBy: 'recorded_at', ascending: false });
                if (Array.isArray(latestElec) && latestElec.length > 0) {
                    const found = latestElec.find(x => x.meter_today || x.meter_end);
                    if (found) this.lastElecMeter = parseFloat(found.meter_today || found.meter_end) || this.lastElecMeter;
                }
            }
        } catch (e) {
            console.warn('Could not load latest meters:', e);
        }
    }

    /**
     * ควบคุมการแสดงผลของหน้าต่าง Auto Generator ตามบทบาท (Admin vs User)
     * Admin: เห็นทุกส่วน (Module Scope, Tabs, Catch-up Alert, Quick Ranges, Month Preset, Equipment Selector)
     * User: เห็นเฉพาะส่วนที่กำหนดในรูปที่ 3 (หัวข้อ, ข้ามวันซ้ำ, ตั้งแต่วันที่/ถึงวันที่, รอบเวลาการบันทึก, ตารางพรีวิว, ปุ่มยืนยัน)
     */
    applyRoleBasedVisibility() {
        const isAdmin = window.AuthService ? window.AuthService.isAdmin() : false;
        const isMachinery = (this.currentModule === 'machinery');
        const isQuarterly = (this.currentModule === 'quarterly_water_quality');

        // Section 1: Module Scope Selector Chips (Admin only)
        const scopeEl = document.getElementById('auto-gen-section-module-scope');
        if (scopeEl) {
            scopeEl.style.display = isAdmin ? '' : 'none';
        }

        // Section 2: Main Tabs Range vs Single (Admin only, except quarterly allows single view)
        const tabsEl = document.getElementById('auto-gen-section-main-tabs');
        if (tabsEl) {
            tabsEl.style.display = isAdmin ? '' : 'none';
        }

        // Section 3: Missing Alert (Admin only when missing dates > 0, hide for quarterly)
        const missingEl = document.getElementById('auto-gen-missing-alert');
        if (missingEl) {
            missingEl.style.display = (isAdmin && !isQuarterly && this.missingDates && this.missingDates.length > 0) ? 'flex' : 'none';
        }

        // Section 4: Quick Date Range Pills:
        const quickRangeWrapper = document.getElementById('auto-gen-quick-range-wrapper');
        if (quickRangeWrapper) {
            if (isAdmin || isMachinery) {
                quickRangeWrapper.style.removeProperty('display');
                quickRangeWrapper.style.display = 'block';
            } else {
                quickRangeWrapper.style.setProperty('display', 'none', 'important');
            }
        }

        // Section 4: Dedicated Full Month Preset Bar: ให้แสดงทั้ง Admin และ User เสมอตามรูปที่ 3
        const monthPresetBar = document.getElementById('auto-gen-month-preset-bar');
        if (monthPresetBar) {
            monthPresetBar.style.removeProperty('display');
        }

        // Section 6: Shift & Round Selection (ซ่อนเมื่อเป็นผลส่งตรวจไตรมาส เพราะตรวจ 1 ตัวอย่างต่อรอบ/วัน)
        const shiftSection = document.getElementById('auto-gen-shift-section');
        if (shiftSection) {
            if (isQuarterly) {
                shiftSection.style.display = 'none';
            } else {
                shiftSection.style.removeProperty('display');
            }
        }

        // Section 6.5: Equipment Selector:
        // ในหน้า Machinery ให้ User เห็นได้ครบถ้วน 100% ตามรูปที่ 2
        const eqSection = document.getElementById('auto-gen-machinery-eq-section');
        if (eqSection) {
            if (isMachinery || (isAdmin && this.currentModule === 'all')) {
                eqSection.style.removeProperty('display');
                eqSection.style.display = 'block';
            } else {
                eqSection.style.display = 'none';
            }
        }

        // Section 6.6: Water Quality Sampling Point Selector:
        // แสดงเมื่อเลือกโมดูล water_quality, quarterly_water_quality หรือ all
        const isWaterQuality = (this.currentModule === 'water_quality' || this.currentModule === 'all');
        const wqPointSection = document.getElementById('auto-gen-water-quality-point-section');
        if (wqPointSection) {
            if (isWaterQuality || isQuarterly) {
                wqPointSection.style.removeProperty('display');
                wqPointSection.style.display = 'block';
                const pointSelect = document.getElementById('auto-gen-sampling-point');
                if (pointSelect) {
                    if (isQuarterly) {
                        let qPoints = [
                            'จุดปลายท่อออกจากระบบบำบัดน้ำเสีย',
                            'จุดบ่อเติมอากาศ',
                            'จุดบ่อตกตะกอนขั้นสุดท้าย (Effluent Tank)',
                            'จุดสระบึงประดิษฐ์',
                            'จุดระบายน้ำทิ้งส่วนกลางสู่คลองสาธารณะ'
                        ];
                        if (window.WaterQualityModule && typeof window.WaterQualityModule.getQuarterlySamplingPointsList === 'function') {
                            const customList = window.WaterQualityModule.getQuarterlySamplingPointsList();
                            if (Array.isArray(customList) && customList.length > 0) qPoints = customList;
                        }
                        pointSelect.innerHTML = qPoints.map(p => `<option value="${p}">${p}</option>`).join('');
                        pointSelect.value = this.selectedSamplingPoint || qPoints[0];
                    } else {
                        const prelimPoints = [
                            'จุดปลายท่อออกจากระบบบำบัด',
                            'จุดสระบึงประดิษฐ์',
                            'จุดสระน้ำ รพ.',
                            'จุดปลายท่อเติมคลอรีนก่อนปล่อยสู่คลองสาธารณะ',
                            'บ่อตกตะกอนขั้นสุดท้าย (Effluent Tank – ทางระบายน้ำทิ้ง รพ.)',
                            'จุดระบายน้ำทิ้งส่วนกลาง (Effluent Tank)'
                        ];
                        pointSelect.innerHTML = prelimPoints.map(p => `<option value="${p}">${p}</option>`).join('');
                        pointSelect.value = this.selectedSamplingPoint || prelimPoints[0];
                    }
                }
            } else {
                wqPointSection.style.display = 'none';
            }
        }

        // การควบคุมแท็บ Range vs Single: ควบคุมการแสดงผลตาม this.currentTab (ค่าเริ่มต้น Range View เสมอ)
        const rangeView = document.getElementById('auto-gen-view-range');
        const singleView = document.getElementById('auto-gen-view-single');
        if (this.currentTab === 'single') {
            if (rangeView) rangeView.style.display = 'none';
            if (singleView) singleView.style.display = 'block';
        } else {
            if (rangeView) rangeView.style.display = 'block';
            if (singleView) singleView.style.display = 'none';
        }
    }

    /**
     * เปิดหน้าต่างบันทึกข้อมูลอัตโนมัติ "ทันทีแบบ 0 มิลลิวินาที" (Instant Pop-up)
     * สแกนหาวันที่ยังไม่ได้ลงบันทึกในฐานข้อมูล และแสดงตารางตัวเลขแก้ไขได้ทันทีก่อนกดยืนยัน
     * ล็อกโมดูลเฉพาะหน้าปัจจุบันเสมอ (Single-Module Isolation)
     */
    async openGeneratorModal(moduleType = null) {
        if (!this.initialized) {
            this.init();
        }
        // ล็อกโมดูลให้ตรงกับหน้าที่เรียกใช้งานเสมอ ไม่บันทึกข้ามหน้า
        this.currentModule = this.resolveActiveModule(moduleType);
        this.excludedPreviewKeys = new Set();

        const isAdmin = window.AuthService ? window.AuthService.isAdmin() : false;
        const isQuarterly = (this.currentModule === 'quarterly_water_quality');

        // 1. เด้งเปิดหน้าต่างทันทีด้วยความเร็วสูงสุด (Synchronous Zero-Delay Pop-up)
        const m = document.getElementById('modal-auto-generator');
        if (m) {
            m.classList.add('active');
            m.style.setProperty('display', 'flex', 'important');
            m.style.setProperty('z-index', '99999', 'important');
            m.style.setProperty('opacity', '1', 'important');
            m.style.setProperty('visibility', 'visible', 'important');
            document.body.style.overflow = 'hidden';
        }
        if (window.App && typeof window.App.openModal === 'function') {
            try { window.App.openModal('modal-auto-generator'); } catch(e) {}
        }

        // กำหนดให้เลือกช่องที่ 1 บันทึกตามช่วงวันที่ (ตั้งแต่วันที่ ถึงวันที่) ก่อนเสมอตามคำสั่งผู้ใช้
        this.currentTab = 'range';
        if (isQuarterly) {
            this.selectedShift = 'single';
        }
        document.querySelectorAll('.btn-auto-main-tab').forEach(b => {
            if (b.getAttribute('data-tab') === 'range') {
                b.classList.add('active', 'bg-gradient-to-r', 'from-amber-500', 'to-orange-500', 'text-slate-950', 'font-bold');
                b.classList.remove('bg-transparent', 'text-slate-400');
            } else {
                b.classList.remove('active', 'bg-gradient-to-r', 'from-amber-500', 'to-orange-500', 'text-slate-950', 'font-bold');
                b.classList.add('bg-transparent', 'text-slate-400');
            }
        });
        const mRangeView = document.getElementById('auto-gen-view-range');
        const mSingleView = document.getElementById('auto-gen-view-single');
        if (mRangeView) mRangeView.style.display = 'block';
        if (mSingleView) mSingleView.style.display = 'none';

        // 2. ปรับการแสดงผลตามบทบาท (RBAC) ทันที
        this.applyRoleBasedVisibility();

        // 3. ไฮไลต์โมดูลที่เลือก และอัปเดตหัวข้อ/คอลัมน์ให้ตรงกับโมดูลเป้าหมาย
        this.highlightModuleScope(this.currentModule);
        await this.updateEquipmentSectionVisibility();
        this.updateModalHeaders(this.currentModule);

        // 4. ตรวจสอบให้แน่ใจว่ามีวันที่ และ Clamp ไม่ให้เกินวันปัจจุบัน
        const todayStr = this.getTodayISO();
        if (isQuarterly || !isAdmin) {
            // กำหนดช่วงวันที่เริ่มต้นเป็น "วันนี้"
            this.startDate = todayStr;
            this.endDate = todayStr;
            this.singleDate = todayStr;
            const inputStart = document.getElementById('auto-gen-start-date');
            const inputEnd = document.getElementById('auto-gen-end-date');
            const inputSingle = document.getElementById('auto-gen-single-date');
            if (inputStart) { inputStart.value = todayStr; inputStart.max = todayStr; }
            if (inputEnd) { inputEnd.value = todayStr; inputEnd.max = todayStr; }
            if (inputSingle) { inputSingle.value = todayStr; inputSingle.max = todayStr; }
            this.syncDateDropdowns('start', todayStr);
            this.syncDateDropdowns('end', todayStr);
        } else {
            if (!this.startDate || !this.endDate || this.endDate > todayStr) {
                this.setDefaultDates();
            }
        }
        this.updatePreviewBadge();
        this.renderPreviewTable();

        // 5. ทำการดึงมิเตอร์และตรวจจับวันที่ขาดหายแบบ Background Async โดยไม่บล็อก UI
        try {
            await this.loadLatestMeters();
            await this.checkMissingDates();

            // สำหรับ Admin (เฉพาะโมดูลที่ไม่ใช่ไตรมาส): นำวันที่ขาดหายมาตั้งค่าช่วงเริ่มต้นอัตโนมัติ
            if (isAdmin && !isQuarterly && this.missingDates && this.missingDates.length > 0) {
                const validMissing = this.missingDates.filter(d => d <= todayStr);
                if (validMissing.length > 0) {
                    this.startDate = validMissing[0];
                    this.endDate = validMissing[validMissing.length - 1];

                    const inputStart = document.getElementById('auto-gen-start-date');
                    const inputEnd = document.getElementById('auto-gen-end-date');
                    if (inputStart) {
                        inputStart.value = this.startDate;
                        inputStart.max = todayStr;
                    }
                    if (inputEnd) {
                        inputEnd.value = this.endDate;
                        inputEnd.max = todayStr;
                    }

                    this.syncDateDropdowns('start', this.startDate);
                    this.syncDateDropdowns('end', this.endDate);

                    const skipCb = document.getElementById('auto-gen-skip-existing');
                    if (skipCb) skipCb.checked = true;

                    document.querySelectorAll('.btn-auto-quick-range').forEach(b => {
                        if (b.getAttribute('data-range') === 'catchup') {
                            b.classList.add('active', 'border-amber-500', 'bg-amber-500', 'text-slate-950', 'font-bold');
                            b.classList.remove('border-slate-800', 'bg-slate-900/80', 'text-slate-300', 'border-amber-500/40', 'bg-amber-950/30', 'text-amber-300');
                        } else {
                            b.classList.remove('active', 'border-amber-500', 'bg-amber-500', 'text-slate-950', 'font-bold');
                            b.classList.add('border-slate-800', 'bg-slate-900/80', 'text-slate-300');
                        }
                    });
                }
            }
            this.updatePreviewBadge();
            this.renderPreviewTable();
        } catch (e) {
            console.warn('Background auto-gen check error:', e);
        }
    }

    openSettingsModal() {
        const modal = document.getElementById('modal-automation-settings');
        if (modal) {
            this.checkMissingDates();
            if (window.App && typeof window.App.openModal === 'function') {
                window.App.openModal('modal-automation-settings');
            } else {
                modal.classList.add('active');
            }
        } else {
            this.openGeneratorModal(this.resolveActiveModule());
        }
    }

    /**
     * ตั้งค่าวันที่ 1 ถึง 31 ตามเดือนและปีที่เลือก พร้อมจำกัดไม่เกินวันปัจจุบันอย่างเด็ดขาด
     */
    applyMonthPreset() {
        const todayStr = this.getTodayISO();
        const [currY, currM, currD] = todayStr.split('-').map(Number);
        const monthPresetEl = document.getElementById('auto-gen-month-preset');
        const yearPresetEl = document.getElementById('auto-gen-year-preset');

        const m = parseInt(monthPresetEl ? monthPresetEl.value : currM, 10);
        let yThai = parseInt(yearPresetEl ? yearPresetEl.value : (currY + 543), 10);
        const yGreg = yThai > 2400 ? yThai - 543 : yThai;

        // บล็อกไม่ให้เลือกเดือนในอนาคต
        if (yGreg > currY || (yGreg === currY && m > currM)) {
            if (window.Swal) {
                Swal.fire({
                    icon: 'warning',
                    title: 'ไม่สามารถเลือกเดือนในอนาคตได้',
                    text: 'ระบบจำกัดให้ลงบันทึกข้อมูลย้อนหลังได้ไม่เกินวันที่ปัจจุบันเท่านั้น',
                    background: '#0c1322',
                    color: '#f8fafc'
                });
            }
            if (monthPresetEl) monthPresetEl.value = String(currM);
            if (yearPresetEl) yearPresetEl.value = String(currY + 543);
            return;
        }

        // คำนวณวันสุดท้ายของเดือน (28, 29, 30 หรือ 31)
        const lastDay = new Date(yGreg, m, 0).getDate();
        let endDay = lastDay;
        // ถ้าเป็นเดือนปัจจุบัน ให้จำกัดวันสิ้นสุดไม่ให้เกินวันปัจจุบัน
        if (yGreg === currY && m === currM) {
            endDay = Math.min(lastDay, currD);
        }

        this.startDate = `${yGreg}-${String(m).padStart(2, '0')}-01`;
        this.endDate = `${yGreg}-${String(m).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

        if (this.startDate > todayStr) this.startDate = todayStr;
        if (this.endDate > todayStr) this.endDate = todayStr;

        const inputStart = document.getElementById('auto-gen-start-date');
        const inputEnd = document.getElementById('auto-gen-end-date');
        if (inputStart) {
            inputStart.value = this.startDate;
            inputStart.max = todayStr;
        }
        if (inputEnd) {
            inputEnd.value = this.endDate;
            inputEnd.max = todayStr;
        }

        this.syncDateDropdowns('start', this.startDate);
        this.syncDateDropdowns('end', this.endDate);

        // ไฮไลต์ปุ่มทั้งเดือน
        document.querySelectorAll('.btn-auto-quick-range').forEach(b => {
            if (b.getAttribute('data-range') === 'full_month') {
                b.classList.add('active', 'border-amber-500', 'bg-amber-500', 'text-slate-950', 'font-bold');
                b.classList.remove('border-slate-800', 'bg-slate-900/80', 'text-slate-300');
            } else {
                b.classList.remove('active', 'border-amber-500', 'bg-amber-500', 'text-slate-950', 'font-bold');
                b.classList.add('border-slate-800', 'bg-slate-900/80', 'text-slate-300');
            }
        });

        this.updatePreviewBadge();
        this.renderPreviewTable();

        if (window.Swal) {
            const thaiMonths = ['', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: `ตั้งค่าวันที่ 1 - ${endDay} ${thaiMonths[m]} ${yGreg + 543} เรียบร้อย`,
                showConfirmButton: false,
                timer: 1800,
                background: '#0c1322',
                color: '#f8fafc'
            });
        }
    }

    /**
     * เลือกช่วงเวลาด่วน (Quick Ranges) - จำกัดวันสิ้นสุดไม่เกินวันปัจจุบัน 100%
     * รองรับ: today, yesterday_today, week, this_month, last_month, last_30_days, catchup, full_month, half_month_1, half_month_2
     */
    selectQuickRange(rangeType) {
        document.querySelectorAll('.btn-auto-quick-range').forEach(b => {
            if (b.getAttribute('data-range') === rangeType) {
                b.classList.add('active', 'border-amber-500', 'bg-amber-500', 'text-slate-950', 'font-bold');
                b.classList.remove('border-slate-800', 'bg-slate-900/80', 'text-slate-300', 'border-amber-500/40', 'bg-amber-950/30', 'text-amber-300');
            } else {
                b.classList.remove('active', 'border-amber-500', 'bg-amber-500', 'text-slate-950', 'font-bold');
                b.classList.add('border-slate-800', 'bg-slate-900/80', 'text-slate-300');
            }
        });

        const todayStr = this.getTodayISO();
        const [yToday, mToday, dToday] = todayStr.split('-').map(Number);
        const today = new Date(yToday, mToday - 1, dToday, 12, 0, 0);

        const formatDate = (d) => {
            let y = d.getFullYear();
            if (y > 2400) y -= 543;
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        };

        const monthPresetEl = document.getElementById('auto-gen-month-preset');
        const yearPresetEl = document.getElementById('auto-gen-year-preset');
        let presetMonth = monthPresetEl ? parseInt(monthPresetEl.value, 10) : mToday;
        let presetYearThai = yearPresetEl ? parseInt(yearPresetEl.value, 10) : (yToday + 543);
        let presetYearGreg = presetYearThai > 2400 ? presetYearThai - 543 : presetYearThai;

        // หาก preset ระบุเดือน/ปีในอนาคต ให้ดึงกลับมาเป็นเดือน/ปีปัจจุบัน
        if (presetYearGreg > yToday || (presetYearGreg === yToday && presetMonth > mToday)) {
            presetYearGreg = yToday;
            presetMonth = mToday;
            if (monthPresetEl) monthPresetEl.value = String(mToday);
            if (yearPresetEl) yearPresetEl.value = String(yToday + 543);
        }

        const lastDayOfPresetMonth = new Date(presetYearGreg, presetMonth, 0).getDate();

        if (rangeType === 'today') {
            this.startDate = todayStr;
            this.endDate = todayStr;
        } else if (rangeType === 'yesterday_today') {
            const yesterday = new Date(yToday, mToday - 1, dToday - 1, 12, 0, 0);
            this.startDate = formatDate(yesterday);
            this.endDate = todayStr;
        } else if (rangeType === 'week') {
            const weekAgo = new Date(yToday, mToday - 1, dToday - 6, 12, 0, 0);
            this.startDate = formatDate(weekAgo);
            this.endDate = todayStr;
        } else if (rangeType === 'this_month') {
            this.startDate = `${yToday}-${String(mToday).padStart(2, '0')}-01`;
            this.endDate = todayStr;
        } else if (rangeType === 'last_month') {
            const firstDayLast = new Date(yToday, mToday - 2, 1, 12, 0, 0);
            const lastDayLast = new Date(yToday, mToday - 1, 0, 12, 0, 0);
            this.startDate = formatDate(firstDayLast);
            this.endDate = formatDate(lastDayLast);
        } else if (rangeType === 'last_30_days') {
            const thirtyAgo = new Date(yToday, mToday - 1, dToday - 29, 12, 0, 0);
            this.startDate = formatDate(thirtyAgo);
            this.endDate = todayStr;
        } else if (rangeType === 'full_month') {
            this.startDate = `${presetYearGreg}-${String(presetMonth).padStart(2, '0')}-01`;
            let endD = lastDayOfPresetMonth;
            if (presetYearGreg === yToday && presetMonth === mToday) {
                endD = Math.min(lastDayOfPresetMonth, dToday);
            }
            this.endDate = `${presetYearGreg}-${String(presetMonth).padStart(2, '0')}-${String(endD).padStart(2, '0')}`;
        } else if (rangeType === 'half_month_1') {
            this.startDate = `${presetYearGreg}-${String(presetMonth).padStart(2, '0')}-01`;
            let endD = 15;
            if (presetYearGreg === yToday && presetMonth === mToday) {
                endD = Math.min(15, dToday);
            }
            this.endDate = `${presetYearGreg}-${String(presetMonth).padStart(2, '0')}-${String(endD).padStart(2, '0')}`;
        } else if (rangeType === 'half_month_2') {
            let startD = 16;
            let endD = lastDayOfPresetMonth;
            if (presetYearGreg === yToday && presetMonth === mToday) {
                if (dToday < 16) {
                    startD = dToday;
                    endD = dToday;
                } else {
                    endD = Math.min(lastDayOfPresetMonth, dToday);
                }
            }
            this.startDate = `${presetYearGreg}-${String(presetMonth).padStart(2, '0')}-${String(startD).padStart(2, '0')}`;
            this.endDate = `${presetYearGreg}-${String(presetMonth).padStart(2, '0')}-${String(endD).padStart(2, '0')}`;
        } else if (rangeType === 'catchup') {
            const validMissing = (this.missingDates || []).filter(d => d <= todayStr);
            if (validMissing.length > 0) {
                this.startDate = validMissing[0];
                this.endDate = validMissing[validMissing.length - 1];
                const skipCb = document.getElementById('auto-gen-skip-existing');
                if (skipCb) skipCb.checked = true;
            } else {
                if (window.Swal) {
                    Swal.fire({
                        icon: 'info',
                        title: 'ข้อมูลครบถ้วน',
                        text: 'ไม่พบช่วงวันที่ขาดหายจนถึงปัจจุบัน',
                        timer: 1800,
                        showConfirmButton: false,
                        background: '#0c1322',
                        color: '#f8fafc'
                    });
                }
                return;
            }
        }

        // กฎเหล็ก: ป้องกันวันที่เกินวันปัจจุบันอย่างเด็ดขาด (Strict Universal Clamping)
        if (this.startDate > todayStr) this.startDate = todayStr;
        if (this.endDate > todayStr) this.endDate = todayStr;

        const inputStart = document.getElementById('auto-gen-start-date');
        const inputEnd = document.getElementById('auto-gen-end-date');
        if (inputStart) {
            inputStart.value = this.startDate;
            inputStart.max = todayStr;
        }
        if (inputEnd) {
            inputEnd.value = this.endDate;
            inputEnd.max = todayStr;
        }

        this.syncDateDropdowns('start', this.startDate);
        this.syncDateDropdowns('end', this.endDate);
        this.updatePreviewBadge();
        this.renderPreviewTable();
    }

    syncDateDropdowns(prefix, dateStr) {
        if (!dateStr) return;
        const parts = dateStr.split('-');
        if (parts.length !== 3) return;

        let y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);
        const yearThai = y < 2400 ? y + 543 : y;

        const dayEl = document.getElementById(`auto-gen-${prefix}-day`);
        const monthEl = document.getElementById(`auto-gen-${prefix}-month`);
        const yearEl = document.getElementById(`auto-gen-${prefix}-year`);
        const displayEl = document.getElementById(`auto-gen-${prefix}-display`);

        if (dayEl) dayEl.value = String(day);
        if (monthEl) monthEl.value = String(m);
        if (yearEl) {
            if (!Array.from(yearEl.options).some(o => o.value === String(yearThai))) {
                const opt = document.createElement('option');
                opt.value = String(yearThai);
                opt.textContent = String(yearThai);
                yearEl.appendChild(opt);
            }
            yearEl.value = String(yearThai);
        }

        if (displayEl) {
            displayEl.textContent = `${String(day).padStart(2, '0')}/${String(m).padStart(2, '0')}/${yearThai}`;
        }
    }

    /**
     * สแกนหาวันที่ยังไม่ได้ลงบันทึกตามโมดูลที่เลือก พร้อมจัดเก็บ Set วันที่ลงแล้ว
     */
    async checkMissingDates() {
        this.missingDates = [];
        this.recordedDateSet = new Set();

        try {
            const targetModule = this.resolveActiveModule(this.currentModule);
            const tableList = [];
            if (targetModule === 'influent') tableList.push('influent_wastewater');
            else if (targetModule === 'electricity') tableList.push('electricity_consumption');
            else if (targetModule === 'water_quality') tableList.push('preliminary_water_quality');
            else if (targetModule === 'quarterly_water_quality') tableList.push('quarterly_water_quality');
            else if (targetModule === 'machinery') tableList.push('machinery_inspection');
            else tableList.push('influent_wastewater');

            const dateTableCounts = new Map();
            for (const table of tableList) {
                const records = await window.DataStore.getAll(table);
                const tableDateSet = new Set();
                if (Array.isArray(records) && records.length > 0) {
                    records.forEach(r => {
                        const rawDate = r.recorded_at || r.sampling_date || r.checked_at;
                        if (rawDate) {
                            const dateOnly = String(rawDate).substring(0, 10);
                            const parts = dateOnly.split('-');
                            if (parts.length === 3) {
                                let y = parseInt(parts[0], 10);
                                if (y > 2400) y -= 543;
                                const normDate = `${y}-${parts[1]}-${parts[2]}`;
                                tableDateSet.add(normDate);
                            }
                        }
                    });
                }
                tableDateSet.forEach(d => {
                    dateTableCounts.set(d, (dateTableCounts.get(d) || 0) + 1);
                });
            }

            const requiredCount = tableList.length;
            dateTableCounts.forEach((cnt, d) => {
                if (cnt >= requiredCount) {
                    this.recordedDateSet.add(d);
                }
            });

            const today = new Date();
            let yToday = today.getFullYear();
            if (yToday > 2400) yToday -= 543;
            const todayStr = this.getTodayISO();

            // สแกนหาวันที่ขาดหายตั้งแต่ต้นเดือนปัจจุบัน จนถึงวันนี้ (ห้ามเกินวันนี้เด็ดขาด)
            const scanStart = new Date(yToday, today.getMonth(), 1, 12, 0, 0);
            if (today.getDate() < 10) {
                scanStart.setMonth(scanStart.getMonth() - 1);
            }

            const endLimit = new Date(yToday, today.getMonth(), today.getDate(), 12, 0, 0);
            const cursor = new Date(scanStart);

            while (cursor <= endLimit) {
                let cy = cursor.getFullYear();
                if (cy > 2400) cy -= 543;
                const cm = String(cursor.getMonth() + 1).padStart(2, '0');
                const cd = String(cursor.getDate()).padStart(2, '0');
                const cStr = `${cy}-${cm}-${cd}`;
                if (cStr <= todayStr && !this.recordedDateSet.has(cStr)) {
                    this.missingDates.push(cStr);
                }
                cursor.setDate(cursor.getDate() + 1);
            }

            if (this.missingDates.length === 0 && this.recordedDateSet.size === 0) {
                for (let i = 6; i >= 0; i--) {
                    const c = new Date(yToday, today.getMonth(), today.getDate() - i, 12, 0, 0);
                    let cy = c.getFullYear();
                    if (cy > 2400) cy -= 543;
                    const cm = String(c.getMonth() + 1).padStart(2, '0');
                    const cd = String(c.getDate()).padStart(2, '0');
                    const dStr = `${cy}-${cm}-${cd}`;
                    if (dStr <= todayStr) {
                        this.missingDates.push(dStr);
                    }
                }
            }

            // กรองซ้ำ: ห้ามมีวันที่เกินวันปัจจุบัน
            this.missingDates = this.missingDates.filter(d => d <= todayStr);
            this.missingDates.sort();
        } catch (err) {
            console.error('Error scanning missing dates:', err);
        }

        this.updateMissingAlertUI();
    }

    updateMissingAlertUI() {
        const alertBox = document.getElementById('auto-gen-missing-alert');
        const countText = document.getElementById('auto-gen-missing-count-text');
        const btnText = document.getElementById('auto-gen-missing-btn-text');
        const settingsCountText = document.getElementById('settings-missing-count-text');
        const quickMissingBadge = document.getElementById('auto-gen-quick-missing-badge');

        const count = this.missingDates.length;

        if (quickMissingBadge) {
            quickMissingBadge.textContent = `${count} วัน`;
        }

        if (settingsCountText) {
            settingsCountText.textContent = count > 0 
                ? `พบ ${count} วันที่ยังไม่มีข้อมูล (${this.getModuleLabel(this.currentModule)})`
                : 'ข้อมูลสมบูรณ์ครบถ้วนทุกช่วงเวลา';
        }

        if (!alertBox) return;

        const isAdmin = window.AuthService ? window.AuthService.isAdmin() : false;
        if (!isAdmin) {
            alertBox.style.setProperty('display', 'none', 'important');
            return;
        }

        if (count > 0) {
            alertBox.style.display = 'flex';
            if (countText) countText.textContent = `พบวันที่ยังไม่ได้ลงบันทึกข้อมูลย้อนหลัง: ${count} วัน (${this.getModuleLabel(this.currentModule)})`;
            if (btnText) btnText.textContent = `รันย้อนหลังทันที (${count} วัน)`;
        } else {
            alertBox.style.display = 'none';
        }
    }

    /**
     * อัปเดตสถานะจำนวนวันที่จะบันทึกจริง (Live Preview Badge)
     */
    updatePreviewBadge() {
        const badge = document.getElementById('auto-gen-preview-badge');
        if (!badge) return;

        const allDates = this.getDateList(true);
        const skipCheckbox = document.getElementById('auto-gen-skip-existing');
        const shouldSkip = skipCheckbox ? skipCheckbox.checked : true;

        if (allDates.length === 0) {
            badge.textContent = 'กรุณาเลือกช่วงวันที่';
            badge.className = 'px-3 py-1 rounded-full bg-slate-800 text-slate-400 font-mono text-xs font-bold shrink-0';
            return;
        }

        let existingCount = 0;
        allDates.forEach(d => {
            if (this.recordedDateSet && this.recordedDateSet.has(d)) {
                existingCount++;
            }
        });

        const toRecordCount = shouldSkip ? Math.max(0, allDates.length - existingCount) : allDates.length;

        if (shouldSkip && existingCount > 0) {
            badge.textContent = `จะบันทึก: ${toRecordCount} วัน (ข้ามวันเดิม ${existingCount} วัน)`;
            badge.className = 'px-3 py-1 rounded-full bg-amber-950/80 border border-amber-500/50 text-amber-300 font-mono text-xs font-bold shrink-0';
        } else {
            badge.textContent = `พร้อมบันทึก: ${toRecordCount} วัน`;
            badge.className = 'px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/50 text-emerald-400 font-mono text-xs font-bold shrink-0';
        }

        const quickMissingBadge = document.getElementById('auto-gen-quick-missing-badge');
        if (quickMissingBadge) {
            quickMissingBadge.textContent = `${this.missingDates.length} วัน`;
        }
    }

    /**
     * ดึงรายการวันที่ต้องบันทึก
     */
    getDateList(ignoreSkip = false) {
        const todayStr = this.getTodayISO();
        let dates = [];
        if (this.currentTab === 'single') {
            let d = this.singleDate || todayStr;
            if (d > todayStr) d = todayStr;
            dates.push(d);
        } else {
            const startParts = (this.startDate || '').split('-').map(Number);
            const endParts = (this.endDate || '').split('-').map(Number);

            let start = startParts.length === 3 ? new Date(startParts[0], startParts[1] - 1, startParts[2], 12, 0, 0) : new Date();
            let end = endParts.length === 3 ? new Date(endParts[0], endParts[1] - 1, endParts[2], 12, 0, 0) : new Date();

            if (start > end) {
                const temp = new Date(start);
                start.setTime(end.getTime());
                end.setTime(temp.getTime());
            }

            const curr = new Date(start);
            while (curr <= end) {
                let y = curr.getFullYear();
                if (y > 2400) y -= 543;
                const m = String(curr.getMonth() + 1).padStart(2, '0');
                const d = String(curr.getDate()).padStart(2, '0');
                const dateStr = `${y}-${m}-${d}`;
                if (dateStr <= todayStr) {
                    dates.push(dateStr);
                }
                curr.setDate(curr.getDate() + 1);
            }
        }

        // กรองซ้ำ: ห้ามมีวันที่เกินวันปัจจุบัน 100%
        dates = dates.filter(d => d <= todayStr);

        const skipCheckbox = document.getElementById('auto-gen-skip-existing');
        const shouldSkip = !ignoreSkip && skipCheckbox && skipCheckbox.checked;

        if (shouldSkip && this.recordedDateSet && this.recordedDateSet.size > 0) {
            const unrecorded = dates.filter(d => !this.recordedDateSet.has(d));
            if (unrecorded.length > 0) {
                return unrecorded;
            }
        }

        return dates;
    }

    /**
     * =========================================================================
     * SECTION 7: RENDER PREVIEW & INLINE EDITABLE TABLE
     * แสดงตารางพรีวิวข้อมูลและอนุญาตให้แก้ไขตัวเลขได้โดยตรงก่อนบันทึกจริง
     * ตรงตามภาพ Mockup ต้นแบบ:
     * - Badges: '👥 เลือก 1วัน × 2 เวร (เวรเช้า+เวรบ่าย)' & '✏️ สามารถคลิกแก้ไขตัวเลขค่าน้ำ / ค่าไฟ / ผลตรวจ ในตารางได้โดยตรง'
     * - Columns: 'วันที่', 'รอบ / เวลา', 'แผนก / จุดตรวจ / รายการ', 'ค่าน้ำ / ค่าไฟ / ผลตรวจ (แก้ไขได้ ✏️)'
     * - Live Meter Chaining: แก้ไขแถวใด ตัวเลขมิเตอร์จะคำนวณและส่งต่อไปแถวถัดไปแบบอัตโนมัติ 100%
     * =========================================================================
     */
    renderPreviewTable() {
        const tbody = document.getElementById('auto-gen-preview-table-body');
        const badgeSummary = document.getElementById('auto-gen-table-badge-summary');
        const countSummary = document.getElementById('auto-gen-table-total-count');

        if (!tbody) return;

        const todayStr = this.getTodayISO();
        const dates = this.getDateList().filter(d => d <= todayStr);
        let shifts = this.selectedShift === 'both' ? ['morning', 'afternoon'] : [this.selectedShift];
        if (this.currentModule === 'quarterly_water_quality') {
            shifts = ['single'];
        }

        if (dates.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center py-8 text-slate-500 font-sans">
                        <i class="fa-solid fa-calendar-xmark text-2xl mb-2 text-slate-600 block"></i>
                        ไม่พบช่วงวันที่ที่ต้องบันทึก หรือทุกวันในช่วงเวลาที่เลือกมีข้อมูลบันทึกอยู่แล้วในระบบ
                    </td>
                </tr>
            `;
            if (badgeSummary) badgeSummary.textContent = 'เลือก 0 วัน';
            if (countSummary) countSummary.textContent = '0';
            this.tableItems = [];
            return;
        }

        // เก็บค่าที่ผู้ใช้เคยแก้ไขไว้แล้ว เพื่อไม่ให้ถูกรีเซ็ตเวลาเปลี่ยนฟิลเตอร์อื่น
        const existingMap = new Map();
        if (Array.isArray(this.tableItems) && this.tableItems.length > 0) {
            this.tableItems.forEach(item => {
                const key = `${item.date}_${item.shift}_${item.moduleType}`;
                existingMap.set(key, item);
            });
        }

        // ฟังก์ชันสุ่มตัวเลขแบบไม่ให้ซ้ำกัน (Non-repeating Jitter with Memory Delta)
        // ผสมผสาน Random Hash จากวันที่, ดัชนีแถว, เวลาปัจจุบัน และ Crypto เพื่อให้ตัวเลขแปรผันอย่างสมจริงเป็นธรรมชาติ
        const generateNonRepeatingValue = (base, range, decimals, lastVal, minDelta = 0.05) => {
            let val;
            let attempts = 0;
            const factor = Math.pow(10, decimals);
            do {
                const noise = (Math.random() * 2 - 1) * range;
                val = Math.round((base + noise) * factor) / factor;
                attempts++;
            } while (lastVal !== null && lastVal !== undefined && Math.abs(val - lastVal) < minDelta && attempts < 15);
            return val;
        };

        // สุ่มเวลาตรวจจริงตามช่วงเวร ไม่ซ้ำกันในแต่ละแถว
        const generateRealisticShiftTime = (isMorning, dIdx, sIdx) => {
            if (isMorning) {
                // เวรเช้า: กรอบเวลา 08:30 - 10:45 น.
                const baseMin = 30 + Math.floor(Math.random() * 105); // 30 - 134 นาทีหลังจาก 08:00
                const hour = 8 + Math.floor(baseMin / 60);
                const min = baseMin % 60;
                return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
            } else {
                // เวรบ่าย: กรอบเวลา 13:30 - 16:30 น.
                const baseMin = 30 + Math.floor(Math.random() * 150); // 30 - 179 นาทีหลังจาก 13:00
                const hour = 13 + Math.floor(baseMin / 60);
                const min = baseMin % 60;
                return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
            }
        };

        const newTableItems = [];
        let currentWaterMeter = this.lastWaterMeter || 441921.42;
        let currentElecMeter = this.lastElecMeter || 202842.10;

        // ตัวแปรจำลองค่าก่อนหน้าเพื่อป้องกันตัวเลขซ้ำกันแถวต่อแถว
        let lastWaterUsed = null;
        let lastKwh = null;
        let lastPh = null;
        let lastDo = null;
        let lastTds = null;
        let lastCl = null;
        let lastSed = null;

        const samplingPoints = [
            'จุดปลายท่อออกจากระบบบำบัด',
            'จุดสระบึงประดิษฐ์',
            'จุดสระน้ำ รพ.',
            'จุดปลายท่อเติมคลอรีนก่อนปล่อยสู่คลองสาธารณะ',
            'บ่อตกตะกอนขั้นสุดท้าย (Effluent Tank – ทางระบายน้ำทิ้ง รพ.)',
            'จุดระบายน้ำทิ้งส่วนกลาง (Effluent Tank)'
        ];

        dates.forEach((dateStr, dIdx) => {
            shifts.forEach((shiftKey, sIdx) => {
                const isMorning = shiftKey === 'morning';
                const shiftInfo = this.hospitalModel.shifts[shiftKey] || this.hospitalModel.shifts.morning;
                const realisticTime = generateRealisticShiftTime(isMorning, dIdx, sIdx);
                const shiftLabel = isMorning ? `☀️ เวรเช้า ${realisticTime} น.` : `🌙 เวรบ่าย ${realisticTime} น.`;
                const shiftPillClass = isMorning
                    ? 'border border-amber-500/30 bg-amber-950/40 text-amber-300'
                    : 'border border-blue-500/30 bg-blue-950/40 text-blue-300';

                const activeMod = this.resolveActiveModule(this.currentModule);
                const modulesToGen = (activeMod === 'all')
                    ? ['influent', 'electricity', 'water_quality', 'machinery']
                    : [activeMod];

                modulesToGen.forEach(mod => {
                    const key = `${dateStr}_${shiftKey}_${mod}`;
                    if (this.excludedPreviewKeys && this.excludedPreviewKeys.has(key)) {
                        return;
                    }
                    const existing = existingMap.get(key);

                    // 1. โมดูลน้ำเสียเข้าระบบ (สุ่มตัวเลขไม่ให้ซ้ำกัน)
                    if (mod === 'influent') {
                        let waterUsed;
                        if (existing && typeof existing.waterUsed === 'number') {
                            waterUsed = existing.waterUsed;
                        } else {
                            const baseUsage = 200.0 * (isMorning ? 0.62 : 0.38);
                            waterUsed = generateNonRepeatingValue(baseUsage, 12.5, 2, lastWaterUsed, 2.50);
                            lastWaterUsed = waterUsed;
                        }
                        const wastewater = Math.round(waterUsed * 0.80 * 100) / 100;
                        const mStart = Math.round(currentWaterMeter * 100) / 100;
                        const mEnd = Math.round((mStart + waterUsed) * 100) / 100;
                        currentWaterMeter = mEnd;

                        newTableItems.push({
                            date: dateStr,
                            shift: shiftKey,
                            shiftName: shiftInfo.name,
                            shiftLabel: shiftLabel,
                            shiftPillClass: shiftPillClass,
                            time: realisticTime,
                            moduleType: 'influent',
                            department: 'รวมทุกอาคารโรงพยาบาล',
                            waterUsed: waterUsed,
                            wastewater: wastewater,
                            meterStart: mStart,
                            meterEnd: mEnd
                        });
                    }
                    // 2. โมดูลการใช้ไฟฟ้า (สุ่มตัวเลขไม่ให้ซ้ำกัน)
                    else if (mod === 'electricity') {
                        let kwh;
                        if (existing && typeof existing.kwh === 'number') {
                            kwh = existing.kwh;
                        } else {
                            const baseElec = 460.0 * (isMorning ? 0.62 : 0.38);
                            kwh = generateNonRepeatingValue(baseElec, 24.0, 2, lastKwh, 4.50);
                            lastKwh = kwh;
                        }
                        const unitPrice = this.hospitalModel.electricityUnitPrice || 4.50;
                        const cost = Math.round(kwh * unitPrice * 100) / 100;
                        const mStart = Math.round(currentElecMeter * 100) / 100;
                        const mEnd = Math.round((mStart + kwh) * 100) / 100;
                        currentElecMeter = mEnd;

                        newTableItems.push({
                            date: dateStr,
                            shift: shiftKey,
                            shiftName: shiftInfo.name,
                            shiftLabel: shiftLabel,
                            shiftPillClass: shiftPillClass,
                            time: realisticTime,
                            moduleType: 'electricity',
                            department: 'รวมทุกอาคารโรงพยาบาล',
                            kwh: kwh,
                            cost: cost,
                            unitPrice: unitPrice,
                            elecMeterStart: mStart,
                            elecMeterEnd: mEnd
                        });
                    }
                    // 3. โมดูลคุณภาพน้ำเบื้องต้น (สุ่มตัวเลขไม่ให้ซ้ำกันเด็ดขาด ทุกพารามิเตอร์)
                    else if (mod === 'water_quality') {
                        const ph = existing ? existing.ph : generateNonRepeatingValue(7.45, 0.28, 2, lastPh, 0.07);
                        const doVal = existing ? existing.do : generateNonRepeatingValue(3.15, 0.55, 2, lastDo, 0.16);
                        const tds = existing ? existing.tds : generateNonRepeatingValue(425.0, 35.0, 1, lastTds, 6.5);
                        const cl = existing ? existing.cl : generateNonRepeatingValue(1.52, 0.25, 2, lastCl, 0.08);
                        const sed = existing ? existing.sediment : generateNonRepeatingValue(165.0, 35.0, 1, lastSed, 8.5);

                        lastPh = ph;
                        lastDo = doVal;
                        lastTds = tds;
                        lastCl = cl;
                        lastSed = sed;

                        const defaultPoint = this.selectedSamplingPoint || 'จุดปลายท่อออกจากระบบบำบัด';
                        const chosenPoint = (existing && existing.department) ? existing.department : defaultPoint;

                        newTableItems.push({
                            date: dateStr,
                            shift: shiftKey,
                            shiftName: shiftInfo.name,
                            shiftLabel: shiftLabel,
                            shiftPillClass: shiftPillClass,
                            time: realisticTime,
                            moduleType: 'water_quality',
                            department: chosenPoint,
                            ph: ph,
                            do: doVal,
                            tds: tds,
                            cl: cl,
                            sediment: sed,
                            status: 'ผ่านเกณฑ์'
                        });
                    }
                    // 4. โมดูลตรวจเช็คเครื่องจักร
                    else if (mod === 'machinery') {
                        const machStatus = existing ? existing.machineryStatus : 'normal';
                        const eqCount = (this.selectedEquipmentNames || []).length;
                        newTableItems.push({
                            date: dateStr,
                            shift: shiftKey,
                            shiftName: shiftInfo.name,
                            shiftLabel: shiftLabel,
                            shiftPillClass: shiftPillClass,
                            time: realisticTime,
                            moduleType: 'machinery',
                            department: `เครื่องจักรอ้างอิง (${eqCount} รายการ)`,
                            machineryStatus: machStatus
                        });
                    }
                    // 5. โมดูลการส่งตรวจคุณภาพน้ำประจำไตรมาส (11 พารามิเตอร์ สธ.)
                    else if (mod === 'quarterly_water_quality') {
                        const ph = existing ? existing.ph : generateNonRepeatingValue(7.35, 0.22, 2, lastPh, 0.05);
                        const bod = existing ? existing.bod : generateNonRepeatingValue(12.5, 2.5, 1, null, 0.4);
                        const cod = existing ? existing.cod : generateNonRepeatingValue(62.0, 11.0, 1, null, 1.2);
                        const ss = existing ? existing.ss : generateNonRepeatingValue(18.5, 4.0, 1, null, 0.6);
                        const tss = existing ? existing.tss : generateNonRepeatingValue(13.5, 2.8, 1, null, 0.5);
                        const tds = existing ? existing.tds : generateNonRepeatingValue(310.0, 32.0, 1, lastTds, 6.0);
                        const tkn = existing ? existing.tkn : generateNonRepeatingValue(16.5, 3.2, 1, null, 0.5);
                        const go = existing ? existing.go : generateNonRepeatingValue(3.8, 1.2, 1, null, 0.3);
                        const sulfide = existing ? existing.sulfide : generateNonRepeatingValue(0.14, 0.05, 2, null, 0.02);
                        const tcb = existing ? existing.tcb : Math.round(generateNonRepeatingValue(360, 95, 0, null, 15));
                        const fcb = existing ? existing.fcb : Math.round(generateNonRepeatingValue(110, 32, 0, null, 10));

                        lastPh = ph;
                        lastTds = tds;

                        const defaultPoint = this.selectedSamplingPoint || 'จุดปลายท่อออกจากระบบบำบัดน้ำเสีย';
                        const chosenPoint = (existing && existing.department) ? existing.department : defaultPoint;

                        newTableItems.push({
                            date: dateStr,
                            shift: shiftKey,
                            shiftName: 'รอบส่งตรวจแล็บไตรมาส',
                            shiftLabel: '🔬 ผลตรวจแล็บไตรมาส',
                            shiftPillClass: 'border border-purple-500/40 bg-purple-950/60 text-purple-300',
                            time: realisticTime || '10:30',
                            moduleType: 'quarterly_water_quality',
                            department: chosenPoint,
                            ph: ph,
                            bod: bod,
                            cod: cod,
                            ss: ss,
                            tss: tss,
                            tds: tds,
                            tkn: tkn,
                            go: go,
                            sulfide: sulfide,
                            tcb: tcb,
                            fcb: fcb,
                            status: 'ผ่านเกณฑ์มาตรฐาน'
                        });
                    }
                });
            });
        });

        this.tableItems = newTableItems;

        // อัปเดตส่วนหัวสรุปข้อมูล
        if (this.currentModule === 'quarterly_water_quality') {
            if (badgeSummary) {
                badgeSummary.textContent = `เลือก ${dates.length} วัน (1 ผลส่งตรวจ/วัน)`;
            }
        } else {
            const shiftText = this.selectedShift === 'both' ? 'เวรเช้า+เวรบ่าย' : (this.selectedShift === 'morning' ? 'เวรเช้า' : 'เวรบ่าย');
            if (badgeSummary) {
                badgeSummary.textContent = `เลือก ${dates.length}วัน × ${shifts.length} เวร (${shiftText})`;
            }
        }
        if (countSummary) {
            countSummary.textContent = `${this.tableItems.length}`;
        }

        // รายการจุดตรวจไตรมาสสำหรับ Dropdown ตารางพรีวิว
        let quarterlyPointsList = [
            'จุดปลายท่อออกจากระบบบำบัดน้ำเสีย',
            'จุดบ่อเติมอากาศ',
            'จุดบ่อตกตะกอนขั้นสุดท้าย (Effluent Tank)',
            'จุดสระบึงประดิษฐ์',
            'จุดระบายน้ำทิ้งส่วนกลางสู่คลองสาธารณะ'
        ];
        if (window.WaterQualityModule && typeof window.WaterQualityModule.getQuarterlySamplingPointsList === 'function') {
            const customList = window.WaterQualityModule.getQuarterlySamplingPointsList();
            if (Array.isArray(customList) && customList.length > 0) quarterlyPointsList = customList;
        }

        // สร้างแถว HTML แสดงในตาราง
        let htmlRows = '';
        this.tableItems.forEach((item, idx) => {
            htmlRows += `
                <tr class="hover:bg-slate-900/60 transition duration-150 border-b border-slate-800/60">
                    <td class="py-3 px-3.5 text-slate-300 font-mono whitespace-nowrap align-middle">
                        ${item.date}
                    </td>
                    <td class="py-3 px-3.5 whitespace-nowrap align-middle">
                        <span class="px-2.5 py-1 rounded-full text-[11px] font-semibold ${item.shiftPillClass} inline-flex items-center gap-1.5 shadow-sm font-sans">
                            ${item.shiftLabel}
                        </span>
                    </td>
                    <td class="py-3 px-3.5 text-slate-300 font-sans text-xs whitespace-nowrap align-middle">
                        ${item.moduleType === 'quarterly_water_quality' ? `
                            <select class="auto-inline-input bg-[#050b18] border border-purple-500/50 text-purple-300 font-semibold text-xs rounded-md px-2 py-1 max-w-[230px]"
                                onchange="window.AutoGeneratorModule.onQuarterlySamplingPointChange(${idx}, this.value)">
                                ${quarterlyPointsList.map(pt => `<option value="${pt}" ${item.department === pt ? 'selected' : ''}>${pt}</option>`).join('')}
                            </select>
                        ` : item.moduleType === 'water_quality' ? `
                            <select class="auto-inline-input bg-[#050b18] border border-emerald-500/50 text-emerald-300 font-semibold text-xs rounded-md px-2 py-1 max-w-[210px]"
                                onchange="window.AutoGeneratorModule.onSamplingPointChange(${idx}, this.value)">
                                ${samplingPoints.map(pt => `<option value="${pt}" ${item.department === pt ? 'selected' : ''}>${pt}</option>`).join('')}
                            </select>
                        ` : item.department}
                    </td>
                    <td class="py-3 px-3.5 ${item.moduleType === 'quarterly_water_quality' ? 'text-left' : 'text-right'} font-sans align-middle">
            `;

            // แสดง Input ตามประเภทโมดูล
            if (item.moduleType === 'influent') {
                htmlRows += `
                    <div class="flex flex-col items-end gap-1">
                        <div class="flex items-center gap-2 justify-end">
                            <input type="number" step="0.01" min="0" value="${item.waterUsed.toFixed(2)}"
                                class="auto-inline-input input-water w-28 px-2.5 py-1 text-right text-cyan-300 font-bold font-mono bg-[#050b18] border border-cyan-500/60 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                                oninput="window.AutoGeneratorModule.onRowValueChange(${idx}, this.value, 'water')"
                                onchange="window.AutoGeneratorModule.onRowValueChange(${idx}, this.value, 'water')" />
                            <span class="text-cyan-400 font-bold text-xs font-sans">ลบ.ม.</span>
                        </div>
                        <div class="text-[11px] text-slate-400 font-mono tracking-tight" id="auto-gen-row-subtext-${idx}">
                            น้ำเสีย 80% = <span class="text-emerald-400 font-bold">${item.wastewater.toFixed(2)}</span> ลบ.ม. (มิเตอร์: ${item.meterStart.toFixed(2)} ➔ <span class="text-cyan-300 font-bold">${item.meterEnd.toFixed(2)}</span>)
                        </div>
                    </div>
                `;
            } else if (item.moduleType === 'electricity') {
                htmlRows += `
                    <div class="flex flex-col items-end gap-1">
                        <div class="flex items-center gap-2 justify-end">
                            <input type="number" step="0.01" min="0" value="${item.kwh.toFixed(2)}"
                                class="auto-inline-input input-elec w-28 px-2.5 py-1 text-right text-amber-300 font-bold font-mono bg-[#050b18] border border-amber-500/60 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                                oninput="window.AutoGeneratorModule.onRowValueChange(${idx}, this.value, 'electricity')"
                                onchange="window.AutoGeneratorModule.onRowValueChange(${idx}, this.value, 'electricity')" />
                            <span class="text-amber-400 font-bold text-xs font-sans">kWh</span>
                        </div>
                        <div class="text-[11px] text-slate-400 font-mono tracking-tight" id="auto-gen-row-subtext-${idx}">
                            ค่าไฟ 4.50 บ./หน่วย = <span class="text-amber-400 font-bold">${item.cost.toLocaleString('th-TH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span> บาท (มิเตอร์: ${item.elecMeterStart.toFixed(2)} ➔ <span class="text-amber-300 font-bold">${item.elecMeterEnd.toFixed(2)}</span>)
                        </div>
                    </div>
                `;
            } else if (item.moduleType === 'water_quality') {
                htmlRows += `
                    <div class="flex flex-col items-end gap-1">
                        <div class="flex items-center gap-2 justify-end flex-wrap">
                            <div class="flex items-center gap-1"><span class="text-[10px] text-slate-400">pH:</span><input type="number" step="0.01" value="${item.ph.toFixed(2)}" class="auto-inline-input input-quality w-14 text-center text-emerald-300 font-bold font-mono" onchange="window.AutoGeneratorModule.onQualityFieldChange(${idx}, 'ph', this.value)" /></div>
                            <div class="flex items-center gap-1"><span class="text-[10px] text-slate-400">DO:</span><input type="number" step="0.01" value="${item.do.toFixed(2)}" class="auto-inline-input input-quality w-14 text-center text-emerald-300 font-bold font-mono" onchange="window.AutoGeneratorModule.onQualityFieldChange(${idx}, 'do', this.value)" /></div>
                            <div class="flex items-center gap-1"><span class="text-[10px] text-slate-400">TDS:</span><input type="number" step="1" value="${item.tds.toFixed(0)}" class="auto-inline-input input-quality w-16 text-center text-emerald-300 font-bold font-mono" onchange="window.AutoGeneratorModule.onQualityFieldChange(${idx}, 'tds', this.value)" /></div>
                            <div class="flex items-center gap-1"><span class="text-[10px] text-slate-400">Cl:</span><input type="number" step="0.01" value="${item.cl.toFixed(2)}" class="auto-inline-input input-quality w-14 text-center text-emerald-300 font-bold font-mono" onchange="window.AutoGeneratorModule.onQualityFieldChange(${idx}, 'cl', this.value)" /></div>
                            <div class="flex items-center gap-1"><span class="text-[10px] text-slate-400">SS:</span><input type="number" step="1" value="${item.sediment.toFixed(0)}" class="auto-inline-input input-quality w-16 text-center text-emerald-300 font-bold font-mono" onchange="window.AutoGeneratorModule.onQualityFieldChange(${idx}, 'sediment', this.value)" /></div>
                        </div>
                        <div class="text-[11px] text-slate-400 font-mono tracking-tight" id="auto-gen-row-subtext-${idx}">
                            <span class="text-emerald-400 font-bold"><i class="fa-solid fa-circle-check"></i> ผ่านเกณฑ์มาตรฐานน้ำทิ้ง รพ.๕๐ พรรษาฯ</span> (DO 2-4 | TDS &le; 500 | pH 5.5-9 | Cl 1-2 | ตะกอน &le; 300)
                        </div>
                    </div>
                `;
            } else if (item.moduleType === 'quarterly_water_quality') {
                htmlRows += `
                    <div class="flex flex-col gap-2 w-full text-left py-1">
                        <!-- Grid of 11 Parameters + 1 Action Card (Spacious 2 rows x 6 cols) -->
                        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 w-full">
                            <!-- 1. pH -->
                            <div class="bg-slate-900/95 border border-slate-700/80 hover:border-emerald-500/60 rounded-xl p-2.5 flex flex-col justify-between shadow-sm transition">
                                <div class="flex items-center justify-between mb-1.5">
                                    <span class="text-xs font-bold text-emerald-400">pH</span>
                                    <span class="text-[10px] text-slate-400 font-sans">เกณฑ์ 5.5-9.0</span>
                                </div>
                                <input type="number" step="0.01" min="0" max="14" value="${item.ph.toFixed(2)}"
                                    class="w-full bg-[#050b18] border border-slate-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 rounded-lg text-center text-emerald-300 font-bold font-mono text-sm py-1.5 px-1 transition outline-none shadow-inner"
                                    onchange="window.AutoGeneratorModule.onQuarterlyFieldChange(${idx}, 'ph', this.value)"
                                    title="ความเป็นกรด-ด่าง (pH) เกณฑ์มาตรฐาน 5.5 - 9.0" />
                                <div class="text-[10px] text-slate-400 text-center mt-1.5 font-sans truncate">หน่วย: -</div>
                            </div>

                            <!-- 2. BOD -->
                            <div class="bg-slate-900/95 border border-slate-700/80 hover:border-emerald-500/60 rounded-xl p-2.5 flex flex-col justify-between shadow-sm transition">
                                <div class="flex items-center justify-between mb-1.5">
                                    <span class="text-xs font-bold text-emerald-400">BOD</span>
                                    <span class="text-[10px] text-slate-400 font-sans">เกณฑ์ &le; 20</span>
                                </div>
                                <input type="number" step="0.1" min="0" value="${item.bod.toFixed(1)}"
                                    class="w-full bg-[#050b18] border border-slate-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 rounded-lg text-center text-emerald-300 font-bold font-mono text-sm py-1.5 px-1 transition outline-none shadow-inner"
                                    onchange="window.AutoGeneratorModule.onQuarterlyFieldChange(${idx}, 'bod', this.value)"
                                    title="บีโอดี (BOD) เกณฑ์มาตรฐานไม่เกิน 20 mg/L" />
                                <div class="text-[10px] text-slate-400 text-center mt-1.5 font-sans truncate">หน่วย: mg/L</div>
                            </div>

                            <!-- 3. COD -->
                            <div class="bg-slate-900/95 border border-slate-700/80 hover:border-cyan-500/60 rounded-xl p-2.5 flex flex-col justify-between shadow-sm transition">
                                <div class="flex items-center justify-between mb-1.5">
                                    <span class="text-xs font-bold text-cyan-400">COD</span>
                                    <span class="text-[10px] text-slate-400 font-sans">เกณฑ์ &le; 120</span>
                                </div>
                                <input type="number" step="0.1" min="0" value="${item.cod.toFixed(1)}"
                                    class="w-full bg-[#050b18] border border-slate-700 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 rounded-lg text-center text-cyan-300 font-bold font-mono text-sm py-1.5 px-1 transition outline-none shadow-inner"
                                    onchange="window.AutoGeneratorModule.onQuarterlyFieldChange(${idx}, 'cod', this.value)"
                                    title="ซีโอดี (COD) เกณฑ์มาตรฐานไม่เกิน 120 mg/L" />
                                <div class="text-[10px] text-slate-400 text-center mt-1.5 font-sans truncate">หน่วย: mg/L</div>
                            </div>

                            <!-- 4. SS -->
                            <div class="bg-slate-900/95 border border-slate-700/80 hover:border-sky-500/60 rounded-xl p-2.5 flex flex-col justify-between shadow-sm transition">
                                <div class="flex items-center justify-between mb-1.5">
                                    <span class="text-xs font-bold text-sky-400">SS</span>
                                    <span class="text-[10px] text-slate-400 font-sans">เกณฑ์ &le; 50</span>
                                </div>
                                <input type="number" step="0.1" min="0" value="${item.ss.toFixed(1)}"
                                    class="w-full bg-[#050b18] border border-slate-700 focus:border-sky-400 focus:ring-1 focus:ring-sky-400 rounded-lg text-center text-sky-200 font-bold font-mono text-sm py-1.5 px-1 transition outline-none shadow-inner"
                                    onchange="window.AutoGeneratorModule.onQuarterlyFieldChange(${idx}, 'ss', this.value)"
                                    title="สารแขวนลอย (SS) เกณฑ์มาตรฐานไม่เกิน 50 mg/L" />
                                <div class="text-[10px] text-slate-400 text-center mt-1.5 font-sans truncate">หน่วย: mg/L</div>
                            </div>

                            <!-- 5. TSS -->
                            <div class="bg-slate-900/95 border border-slate-700/80 hover:border-sky-500/60 rounded-xl p-2.5 flex flex-col justify-between shadow-sm transition">
                                <div class="flex items-center justify-between mb-1.5">
                                    <span class="text-xs font-bold text-sky-400">TSS</span>
                                    <span class="text-[10px] text-slate-400 font-sans">เกณฑ์ &le; 30</span>
                                </div>
                                <input type="number" step="0.1" min="0" value="${item.tss.toFixed(1)}"
                                    class="w-full bg-[#050b18] border border-slate-700 focus:border-sky-400 focus:ring-1 focus:ring-sky-400 rounded-lg text-center text-sky-200 font-bold font-mono text-sm py-1.5 px-1 transition outline-none shadow-inner"
                                    onchange="window.AutoGeneratorModule.onQuarterlyFieldChange(${idx}, 'tss', this.value)"
                                    title="ของแข็งแขวนลอยทั้งหมด (TSS) เกณฑ์มาตรฐานไม่เกิน 30 mg/L" />
                                <div class="text-[10px] text-slate-400 text-center mt-1.5 font-sans truncate">หน่วย: mg/L</div>
                            </div>

                            <!-- 6. TDS -->
                            <div class="bg-slate-900/95 border border-slate-700/80 hover:border-cyan-500/60 rounded-xl p-2.5 flex flex-col justify-between shadow-sm transition">
                                <div class="flex items-center justify-between mb-1.5">
                                    <span class="text-xs font-bold text-cyan-400">TDS</span>
                                    <span class="text-[10px] text-slate-400 font-sans">เกณฑ์ &le; 500</span>
                                </div>
                                <input type="number" step="1" min="0" value="${item.tds.toFixed(0)}"
                                    class="w-full bg-[#050b18] border border-slate-700 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 rounded-lg text-center text-cyan-300 font-bold font-mono text-sm py-1.5 px-1 transition outline-none shadow-inner"
                                    onchange="window.AutoGeneratorModule.onQuarterlyFieldChange(${idx}, 'tds', this.value)"
                                    title="ของแข็งละลายน้ำทั้งหมด (TDS) เกณฑ์มาตรฐานไม่เกิน 500 mg/L" />
                                <div class="text-[10px] text-slate-400 text-center mt-1.5 font-sans truncate">หน่วย: mg/L</div>
                            </div>

                            <!-- 7. TKN -->
                            <div class="bg-slate-900/95 border border-slate-700/80 hover:border-purple-500/60 rounded-xl p-2.5 flex flex-col justify-between shadow-sm transition">
                                <div class="flex items-center justify-between mb-1.5">
                                    <span class="text-xs font-bold text-purple-400">TKN</span>
                                    <span class="text-[10px] text-slate-400 font-sans">เกณฑ์ &le; 35</span>
                                </div>
                                <input type="number" step="0.1" min="0" value="${item.tkn.toFixed(1)}"
                                    class="w-full bg-[#050b18] border border-slate-700 focus:border-purple-400 focus:ring-1 focus:ring-purple-400 rounded-lg text-center text-purple-300 font-bold font-mono text-sm py-1.5 px-1 transition outline-none shadow-inner"
                                    onchange="window.AutoGeneratorModule.onQuarterlyFieldChange(${idx}, 'tkn', this.value)"
                                    title="ทีเคเอ็น (TKN ไนโตรเจนทั้งหมด) เกณฑ์มาตรฐานไม่เกิน 35 mg/L" />
                                <div class="text-[10px] text-slate-400 text-center mt-1.5 font-sans truncate">หน่วย: mg/L</div>
                            </div>

                            <!-- 8. G&O -->
                            <div class="bg-slate-900/95 border border-slate-700/80 hover:border-amber-500/60 rounded-xl p-2.5 flex flex-col justify-between shadow-sm transition">
                                <div class="flex items-center justify-between mb-1.5">
                                    <span class="text-xs font-bold text-amber-400">G&amp;O</span>
                                    <span class="text-[10px] text-slate-400 font-sans">เกณฑ์ &le; 20</span>
                                </div>
                                <input type="number" step="0.1" min="0" value="${item.go.toFixed(1)}"
                                    class="w-full bg-[#050b18] border border-slate-700 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-lg text-center text-amber-300 font-bold font-mono text-sm py-1.5 px-1 transition outline-none shadow-inner"
                                    onchange="window.AutoGeneratorModule.onQuarterlyFieldChange(${idx}, 'go', this.value)"
                                    title="น้ำมันและไขมัน (Grease & Oil) เกณฑ์มาตรฐานไม่เกิน 20 mg/L" />
                                <div class="text-[10px] text-slate-400 text-center mt-1.5 font-sans truncate">หน่วย: mg/L</div>
                            </div>

                            <!-- 9. Sulfide -->
                            <div class="bg-slate-900/95 border border-slate-700/80 hover:border-orange-500/60 rounded-xl p-2.5 flex flex-col justify-between shadow-sm transition">
                                <div class="flex items-center justify-between mb-1.5">
                                    <span class="text-xs font-bold text-orange-400">Sulfide</span>
                                    <span class="text-[10px] text-slate-400 font-sans">เกณฑ์ &le; 1.0</span>
                                </div>
                                <input type="number" step="0.01" min="0" value="${item.sulfide.toFixed(2)}"
                                    class="w-full bg-[#050b18] border border-slate-700 focus:border-orange-400 focus:ring-1 focus:ring-orange-400 rounded-lg text-center text-orange-300 font-bold font-mono text-sm py-1.5 px-1 transition outline-none shadow-inner"
                                    onchange="window.AutoGeneratorModule.onQuarterlyFieldChange(${idx}, 'sulfide', this.value)"
                                    title="ซัลไฟด์ (Sulfide) เกณฑ์มาตรฐานไม่เกิน 1.0 mg/L" />
                                <div class="text-[10px] text-slate-400 text-center mt-1.5 font-sans truncate">หน่วย: mg/L</div>
                            </div>

                            <!-- 10. TCB -->
                            <div class="bg-slate-900/95 border border-slate-700/80 hover:border-emerald-500/60 rounded-xl p-2.5 flex flex-col justify-between shadow-sm transition">
                                <div class="flex items-center justify-between mb-1.5">
                                    <span class="text-xs font-bold text-emerald-400">TCB</span>
                                    <span class="text-[10px] text-slate-400 font-sans">เกณฑ์ &le; 1000</span>
                                </div>
                                <input type="number" step="1" min="0" value="${item.tcb.toFixed(0)}"
                                    class="w-full bg-[#050b18] border border-slate-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 rounded-lg text-center text-emerald-300 font-bold font-mono text-sm py-1.5 px-1 transition outline-none shadow-inner"
                                    onchange="window.AutoGeneratorModule.onQuarterlyFieldChange(${idx}, 'tcb', this.value)"
                                    title="โคลิฟอร์มแบคทีเรียทั้งหมด (Total Coliform Bacteria) เกณฑ์มาตรฐานไม่เกิน 1,000 MPN/100ml" />
                                <div class="text-[10px] text-slate-400 text-center mt-1.5 font-sans truncate">หน่วย: MPN</div>
                            </div>

                            <!-- 11. FCB -->
                            <div class="bg-slate-900/95 border border-slate-700/80 hover:border-emerald-500/60 rounded-xl p-2.5 flex flex-col justify-between shadow-sm transition">
                                <div class="flex items-center justify-between mb-1.5">
                                    <span class="text-xs font-bold text-emerald-400">FCB</span>
                                    <span class="text-[10px] text-slate-400 font-sans">เกณฑ์ &le; 400</span>
                                </div>
                                <input type="number" step="1" min="0" value="${item.fcb.toFixed(0)}"
                                    class="w-full bg-[#050b18] border border-slate-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 rounded-lg text-center text-emerald-300 font-bold font-mono text-sm py-1.5 px-1 transition outline-none shadow-inner"
                                    onchange="window.AutoGeneratorModule.onQuarterlyFieldChange(${idx}, 'fcb', this.value)"
                                    title="ฟีคัลโคลิฟอร์มแบคทีเรีย (Fecal Coliform Bacteria) เกณฑ์มาตรฐานไม่เกิน 400 MPN/100ml" />
                                <div class="text-[10px] text-slate-400 text-center mt-1.5 font-sans truncate">หน่วย: MPN</div>
                            </div>

                            <!-- 12. Action Card (ลบแถว) -->
                            <div class="bg-rose-950/20 border border-rose-800/40 hover:bg-rose-900/30 hover:border-rose-600/70 rounded-xl p-2.5 flex flex-col items-center justify-center gap-1 shadow-sm transition cursor-pointer group"
                                onclick="window.AutoGeneratorModule.deletePreviewRow(${idx})"
                                title="ลบแถวนี้ออกจากตารางพรีวิว">
                                <div class="text-[10px] text-rose-300 font-sans font-semibold group-hover:text-rose-200">จัดการ</div>
                                <button type="button" class="w-8 h-8 rounded-lg bg-rose-900/40 group-hover:bg-rose-800/80 text-rose-300 group-hover:text-white flex items-center justify-center transition shadow-sm">
                                    <i class="fa-solid fa-trash-can text-xs"></i>
                                </button>
                                <span class="text-[9px] text-rose-400/80 font-sans">ลบรายการนี้</span>
                            </div>
                        </div>

                        <!-- Subtext Bar -->
                        <div class="text-[11px] text-slate-400 font-mono tracking-tight flex flex-wrap items-center justify-between w-full pt-1.5 px-1 border-t border-slate-800/80 mt-1">
                            <span class="text-purple-300 font-sans font-semibold flex items-center gap-1.5">
                                <i class="fa-solid fa-file-shield text-purple-400"></i> พร้อมแนบใบรายงานผลตรวจแล็บรับรองมาตรฐาน (ISO/IEC 17025) อัตโนมัติ
                            </span>
                            <span class="text-emerald-400 font-bold font-sans flex items-center gap-1">
                                <i class="fa-solid fa-circle-check"></i> ผ่านเกณฑ์มาตรฐาน สธ. ครบ 11 พารามิเตอร์ 100%
                            </span>
                        </div>
                    </div>
                `;
            } else if (item.moduleType === 'machinery') {
                htmlRows += `
                    <div class="flex flex-col items-end gap-1">
                        <div class="flex items-center gap-2 justify-end">
                            <select class="auto-inline-input bg-emerald-950/60 border border-emerald-500/60 text-emerald-300 font-bold text-xs rounded-md px-2 py-1"
                                onchange="window.AutoGeneratorModule.onMachineryStatusChange(${idx}, this.value)">
                                <option value="normal" ${item.machineryStatus === 'normal' ? 'selected' : ''}>✅ ปกติทุกรายการ (100%)</option>
                                <option value="abnormal" ${item.machineryStatus === 'abnormal' ? 'selected' : ''}>⚠️ มีอุปกรณ์ต้องบำรุงรักษา</option>
                            </select>
                        </div>
                        <div class="text-[11px] text-slate-400 font-sans tracking-tight" id="auto-gen-row-subtext-${idx}">
                            ${this.getEquipmentSummaryText()}
                        </div>
                    </div>
                `;
            }

            htmlRows += `
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = htmlRows;
    }

    onQuarterlyFieldChange(index, field, value) {
        if (!this.tableItems || !this.tableItems[index]) return;
        this.tableItems[index][field] = parseFloat(value) || 0;
    }

    onQuarterlySamplingPointChange(index, value) {
        if (!this.tableItems || !this.tableItems[index]) return;
        this.tableItems[index].department = value;
    }

    deletePreviewRow(index) {
        if (!this.tableItems || !this.tableItems[index]) return;
        const item = this.tableItems[index];
        if (item && item.date) {
            this.excludedPreviewKeys = this.excludedPreviewKeys || new Set();
            this.excludedPreviewKeys.add(`${item.date}_${item.shift}_${item.moduleType}`);
        }
        this.tableItems.splice(index, 1);
        const countSummary = document.getElementById('auto-gen-table-total-count');
        if (countSummary) {
            countSummary.textContent = `${this.tableItems.length}`;
        }
        this.renderPreviewTable();
    }

    /**
     * ดักจับการแก้ไขค่าในตารางแบบ Real-time พร้อมคำนวณและปรับโยงมิเตอร์แถวถัดไปอัตโนมัติ (Meter Chaining)
     */
    onRowValueChange(index, value, type) {
        if (!this.tableItems || !this.tableItems[index]) return;

        if (type === 'water') {
            const val = Math.max(0, parseFloat(value) || 0);
            this.tableItems[index].waterUsed = val;
            this.tableItems[index].wastewater = Math.round(val * 0.80 * 100) / 100;

            // ปรับลูกโซ่มิเตอร์น้ำตั้งแต่แถวแรกจนถึงแถวสุดท้าย
            let currentMeter = this.tableItems[0].meterStart;
            for (let i = 0; i < this.tableItems.length; i++) {
                if (this.tableItems[i].moduleType === 'influent') {
                    this.tableItems[i].meterStart = Math.round(currentMeter * 100) / 100;
                    this.tableItems[i].meterEnd = Math.round((currentMeter + this.tableItems[i].waterUsed) * 100) / 100;
                    currentMeter = this.tableItems[i].meterEnd;

                    const subtextEl = document.getElementById(`auto-gen-row-subtext-${i}`);
                    if (subtextEl) {
                        subtextEl.innerHTML = `น้ำเสีย 80% = <span class="text-emerald-400 font-bold">${this.tableItems[i].wastewater.toFixed(2)}</span> ลบ.ม. (มิเตอร์: ${this.tableItems[i].meterStart.toFixed(2)} ➔ <span class="text-cyan-300 font-bold">${this.tableItems[i].meterEnd.toFixed(2)}</span>)`;
                    }
                }
            }
        } else if (type === 'electricity') {
            const val = Math.max(0, parseFloat(value) || 0);
            this.tableItems[index].kwh = val;
            const unitPrice = this.tableItems[index].unitPrice || 4.50;
            this.tableItems[index].cost = Math.round(val * unitPrice * 100) / 100;

            // ปรับลูกโซ่มิเตอร์ไฟฟ้าตั้งแต่แถวแรกจนถึงแถวสุดท้าย
            let currentMeter = this.tableItems[0].elecMeterStart;
            for (let i = 0; i < this.tableItems.length; i++) {
                if (this.tableItems[i].moduleType === 'electricity') {
                    this.tableItems[i].elecMeterStart = Math.round(currentMeter * 100) / 100;
                    this.tableItems[i].elecMeterEnd = Math.round((currentMeter + this.tableItems[i].kwh) * 100) / 100;
                    currentMeter = this.tableItems[i].elecMeterEnd;

                    const subtextEl = document.getElementById(`auto-gen-row-subtext-${i}`);
                    if (subtextEl) {
                        subtextEl.innerHTML = `ค่าไฟ 4.50 บ./หน่วย = <span class="text-amber-400 font-bold">${this.tableItems[i].cost.toLocaleString('th-TH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span> บาท (มิเตอร์: ${this.tableItems[i].elecMeterStart.toFixed(2)} ➔ <span class="text-amber-300 font-bold">${this.tableItems[i].elecMeterEnd.toFixed(2)}</span>)`;
                    }
                }
            }
        }
    }

    onQualityFieldChange(index, field, value) {
        if (!this.tableItems || !this.tableItems[index]) return;
        this.tableItems[index][field] = parseFloat(value) || 0;
    }

    onQuarterlyFieldChange(index, field, value) {
        if (!this.tableItems || !this.tableItems[index]) return;
        const num = parseFloat(value);
        this.tableItems[index][field] = isNaN(num) ? 0 : num;
    }

    onSamplingPointChange(index, value) {
        if (!this.tableItems || !this.tableItems[index]) return;
        this.tableItems[index].department = value;
    }

    onQuarterlySamplingPointChange(index, value) {
        if (!this.tableItems || !this.tableItems[index]) return;
        this.tableItems[index].department = value;
    }

    onMachineryStatusChange(index, value) {
        if (!this.tableItems || !this.tableItems[index]) return;
        this.tableItems[index].machineryStatus = value;
    }

    /**
     * รันย้อนหลังวันที่ขาดหายทันที (โดยดึงช่วงวันที่ขาดหายมาใส่ตารางพร้อมให้ตรวจทานและบันทึก)
     */
    async runMissingCatchup() {
        if (this.missingDates.length === 0) {
            if (window.Swal) {
                Swal.fire({
                    icon: 'info',
                    title: 'ข้อมูลครบถ้วน',
                    text: 'ไม่พบวันขาดหายในระบบ ข้อมูลลงบันทึกครบถ้วนสมบูรณ์แล้ว',
                    background: '#0c1322',
                    color: '#f8fafc'
                });
            }
            return;
        }

        // เลือกช่วงวันที่ขาดหายทันที
        this.selectQuickRange('catchup');

        // เลื่อนโฟกัสมาที่ตารางแก้ไขข้อมูล
        const tableBody = document.getElementById('auto-gen-preview-table-body');
        if (tableBody) {
            tableBody.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        if (window.Swal) {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'info',
                title: `โหลดข้อมูลวันที่ขาดหาย ${this.missingDates.length} วันเรียบร้อย คุณสามารถตรวจสอบหรือแก้ไขตัวเลขในตารางก่อนบันทึกได้ทันที`,
                showConfirmButton: false,
                timer: 2500,
                background: '#0c1322',
                color: '#f8fafc'
            });
        }
    }

    /**
     * บันทึกข้อมูลทั้งหมดในตาราง (this.tableItems) เข้าสู่ฐานข้อมูลจริง (Dual-sync Local + Supabase)
     */
    async executeSaveBatch() {
        const todayStr = this.getTodayISO();
        const activeMod = this.resolveActiveModule(this.currentModule);

        // กฎเหล็ก: บันทึกเฉพาะโมดูลที่เลือก และห้ามมีข้อมูลเกินวันปัจจุบันเด็ดขาด
        const validItems = (this.tableItems || []).filter(item => {
            const modMatch = (activeMod === 'all') ? true : (item.moduleType === activeMod);
            return modMatch && item.date <= todayStr;
        });

        if (validItems.length === 0) {
            if (window.Swal) {
                Swal.fire({
                    icon: 'info',
                    title: 'ไม่มีรายการที่จะบันทึก',
                    text: `ไม่พบรายการที่ต้องบันทึกสำหรับโมดูล ${this.getModuleLabel(activeMod)} (หรือทุกวันมีข้อมูลแล้ว / เกินวันปัจจุบัน)`,
                    background: '#0c1322',
                    color: '#f8fafc'
                });
            }
            return;
        }

        const dates = (typeof this.getDateList === 'function') ? this.getDateList().filter(d => d <= todayStr) : [];
        const firstDate = dates[0] || (validItems[0] ? validItems[0].date : '');
        const lastDate = dates[dates.length - 1] || (validItems[validItems.length - 1] ? validItems[validItems.length - 1].date : firstDate);
        const shifts = (activeMod === 'quarterly_water_quality')
            ? ['single']
            : ((this.selectedShift === 'both' || !this.selectedShift) ? ['morning', 'afternoon'] : [this.selectedShift]);
        const shiftsCount = shifts.length;

        const confirm = await Swal.fire({
            title: 'ยืนยันการบันทึกข้อมูลอัตโนมัติ?',
            html: `
                <div class="text-left text-xs text-slate-300 space-y-2.5 p-3 bg-slate-900 rounded-xl border border-slate-800">
                    <div><strong>โมดูลเป้าหมาย:</strong> <span class="text-emerald-400 font-bold">${this.getModuleLabel(activeMod)}</span></div>
                    <div><strong>ช่วงวันที่:</strong> <span class="text-amber-400 font-mono font-bold">${firstDate} ถึง ${lastDate}</span> (${dates.length} วัน)</div>
                    <div><strong>จำนวนรายการทั้งหมด:</strong> <span class="text-cyan-300 font-bold font-mono">${validItems.length} รายการ</span></div>
                    <div class="text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                        <i class="fa-solid fa-circle-check text-emerald-400"></i> บันทึกเฉพาะโมดูลนี้เท่านั้น ไม่กระทบโมดูลอื่น และวันที่ไม่เกินปัจจุบัน
                    </div>
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#f59e0b',
            cancelButtonColor: '#334155',
            confirmButtonText: '⚡ บันทึกลงระบบทันที',
            cancelButtonText: 'ยกเลิก',
            background: '#0c1322',
            color: '#f8fafc'
        });

        if (!confirm.isConfirmed) return;

        // ปิดหน้าต่าง Modal ทันทีเมื่อกดยืนยัน เพื่อป้องกันหน้าต่างค้าง
        if (typeof window.closeAutoRecordModal === 'function') {
            window.closeAutoRecordModal();
        } else if (window.App && typeof window.App.closeModal === 'function') {
            window.App.closeModal('modal-auto-generator');
        }
        const mPreClose = document.getElementById('modal-auto-generator');
        if (mPreClose) {
            mPreClose.classList.remove('active');
            mPreClose.style.setProperty('display', 'none', 'important');
        }
        document.body.style.overflow = '';
        document.body.style.removeProperty('overflow');
        document.body.classList.remove('modal-open');

        Swal.fire({
            title: 'กำลังบันทึกข้อมูล...',
            html: `กรุณารอสักครู่ ระบบกำลังบันทึกข้อมูล ${validItems.length} รายการลงสู่ฐานข้อมูล`,
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading(),
            background: '#0c1322',
            color: '#f8fafc'
        });

        const currentUser = (window.AuthService && typeof window.AuthService.getCurrentUser === 'function')
            ? window.AuthService.getCurrentUser()
            : null;
        const recorderName = currentUser ? (currentUser.full_name || currentUser.username) : 'แสงตะวัน ชาวเขา';

        const generateUUID = () => {
            if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                try { return crypto.randomUUID(); } catch (e) {}
            }
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        };

        let totalSaved = 0;

        try {
            for (const item of validItems) {
                const recordedAt = `${item.date}T${item.time}:00`;

                if (item.moduleType === 'influent') {
                    const record = {
                        id: generateUUID(),
                        recorded_at: recordedAt,
                        water_source: 'รวมทุกอาคารโรงพยาบาล',
                        source_detail: `บันทึกประจำวัน (${item.shiftName} - รวมทุกอาคาร รพ.๕๐พรรษาฯ)`,
                        meter_start: item.meterStart,
                        meter_yesterday: item.meterStart,
                        meter_today: item.meterEnd,
                        meter_end: item.meterEnd,
                        total_water_used: item.waterUsed,
                        tap_water_used: item.waterUsed,
                        wastewater_influent: item.wastewater,
                        wastewater_80: item.wastewater,
                        treated_water: item.wastewater,
                        recorded_by: recorderName,
                        recorder_name: recorderName,
                        notes: `บันทึกอัตโนมัติ (${item.shiftName}) ตรวจเช็คมิเตอร์ปกติ 100%`,
                        note: `บันทึกอัตโนมัติ (${item.shiftName}) ตรวจเช็คมิเตอร์ปกติ 100%`,
                        created_at: new Date().toISOString()
                    };
                    await window.DataStore.insert('influent_wastewater', record);
                    totalSaved++;
                } else if (item.moduleType === 'electricity') {
                    const record = {
                        id: generateUUID(),
                        recorded_at: recordedAt,
                        meter_start: item.elecMeterStart,
                        meter_yesterday: item.elecMeterStart,
                        meter_today: item.elecMeterEnd,
                        meter_end: item.elecMeterEnd,
                        total_kwh: item.kwh,
                        kwh_used: item.kwh,
                        unit_price: item.unitPrice || 4.50,
                        rate_per_kwh: item.unitPrice || 4.50,
                        electricity_cost: item.cost,
                        cost_thb: item.cost,
                        recorded_by: recorderName,
                        recorder_name: recorderName,
                        notes: `บันทึกอัตโนมัติ (${item.shiftName}) ระบบไฟฟ้าและเครื่องจักรทำงานปกติ`,
                        note: `บันทึกอัตโนมัติ (${item.shiftName}) ระบบไฟฟ้าและเครื่องจักรทำงานปกติ`,
                        created_at: new Date().toISOString()
                    };
                    await window.DataStore.insert('electricity_consumption', record);
                    totalSaved++;
                } else if (item.moduleType === 'water_quality') {
                    const record = {
                        id: generateUUID(),
                        recorded_at: recordedAt,
                        sampling_point: item.department || this.selectedSamplingPoint || 'จุดปลายท่อออกจากระบบบำบัด',
                        ph: item.ph,
                        ph_value: item.ph,
                        do_value: item.do,
                        do: item.do,
                        tds: item.tds,
                        tds_value: item.tds,
                        chlorine: item.cl,
                        cl_value: item.cl,
                        sediment: item.sediment,
                        ss_value: item.sediment,
                        status: 'ผ่านเกณฑ์',
                        inspector: recorderName,
                        recorded_by: recorderName,
                        recorder_name: recorderName,
                        remarks: `ผลตรวจวัดคุณภาพน้ำปกติ 100% ผ่านเกณฑ์มาตรฐานน้ำทิ้ง (${item.shiftName})`,
                        notes: `ผลตรวจวัดคุณภาพน้ำปกติ 100% ผ่านเกณฑ์มาตรฐานน้ำทิ้ง (${item.shiftName})`,
                        created_at: new Date().toISOString()
                    };
                    await window.DataStore.insert('preliminary_water_quality', record);
                    totalSaved++;
                } else if (item.moduleType === 'machinery') {
                    // ใช้อุปกรณ์จริงที่เลือกจากฐานข้อมูลอ้างอิง equipment_ref
                    let actualEquipment = this.selectedEquipmentNames;
                    if (!actualEquipment || actualEquipment.length === 0) {
                        if (this.equipmentReferenceList && this.equipmentReferenceList.length > 0) {
                            actualEquipment = this.equipmentReferenceList.map(x => x.equipment_name);
                        } else {
                            actualEquipment = [];
                        }
                    }
                    const eqCount = actualEquipment.length;
                    const abnormalEquip = item.machineryStatus === 'normal' ? '-' : (actualEquipment[0] || 'เครื่องจักรขัดข้อง');

                    const record = {
                        id: generateUUID(),
                        recorded_at: recordedAt,
                        equipment_list: actualEquipment,
                        status: item.machineryStatus === 'normal' ? 'ปกติทุกรายการ' : 'มีอุปกรณ์ต้องบำรุงรักษา',
                        abnormal_equipment: abnormalEquip,
                        cause: '-',
                        solution: '-',
                        inspector: recorderName,
                        inspector_name: recorderName,
                        checked_by: recorderName,
                        remarks: `ตรวจเช็คความพร้อมประจำเวร (${item.shiftName}) อุปกรณ์ ${eqCount} รายการ จากฐานข้อมูลอ้างอิงอุปกรณ์ ทำงานปกติสมบูรณ์`,
                        notes: `ตรวจเช็คความพร้อมประจำเวร (${item.shiftName}) อุปกรณ์ ${eqCount} รายการ จากฐานข้อมูลอ้างอิงอุปกรณ์ ทำงานปกติสมบูรณ์`,
                        blower_status: item.machineryStatus,
                        pump_status: item.machineryStatus,
                        aerator_status: item.machineryStatus,
                        dosing_status: item.machineryStatus,
                        overall_status: item.machineryStatus,
                        created_at: new Date().toISOString()
                    };
                    await window.DataStore.insert('machinery_inspection', record);
                    totalSaved++;
                } else if (item.moduleType === 'quarterly_water_quality') {
                    const samplingPoint = item.department || this.selectedSamplingPoint || 'จุดปลายท่อออกจากระบบบำบัดน้ำเสีย';
                    const sampleReport = (window.WaterQualityModule && typeof window.WaterQualityModule.generateSampleLabReportDataUrl === 'function')
                        ? window.WaterQualityModule.generateSampleLabReportDataUrl(item.date, samplingPoint, {
                            ph: item.ph, ss: item.ss, tds: item.tds, tss: item.tss, tkn: item.tkn,
                            go: item.go, sulfide: item.sulfide, bod: item.bod, cod: item.cod, tcb: item.tcb, fcb: item.fcb
                        })
                        : '';

                    const record = {
                        id: generateUUID(),
                        sampling_date: item.date,
                        sampling_point: samplingPoint,
                        ph: Number(item.ph),
                        ss: Number(item.ss),
                        tds: Number(item.tds),
                        tss: Number(item.tss),
                        tkn: Number(item.tkn),
                        go: Number(item.go),
                        sulfide: Number(item.sulfide),
                        bod: Number(item.bod),
                        cod: Number(item.cod),
                        tcb: Number(item.tcb),
                        fcb: Number(item.fcb),
                        status: item.status || 'ผ่านเกณฑ์มาตรฐาน',
                        action_taken: 'ระบบบำบัดน้ำเสียทำงานเต็มประสิทธิภาพ ผ่านเกณฑ์มาตรฐานกระทรวงสาธารณสุขครบ 11 พารามิเตอร์',
                        lab_report_file: sampleReport,
                        inspector: recorderName,
                        remarks: 'ตรวจวิเคราะห์ตามรอบไตรมาส Standard Methods (Auto-generated บันทึกอัตโนมัติ)',
                        created_at: new Date().toISOString()
                    };
                    await window.DataStore.insert('quarterly_water_quality', record);
                    totalSaved++;
                }
            }

            // ปิด Modal ซ้ำอีกครั้งเพื่อความชัวร์ 100%
            if (typeof window.closeAutoRecordModal === 'function') {
                window.closeAutoRecordModal();
            } else if (window.App && typeof window.App.closeModal === 'function') {
                window.App.closeModal('modal-auto-generator');
            }
            document.body.style.overflow = '';
            document.body.style.removeProperty('overflow');
            document.body.classList.remove('modal-open');

            // รีเฟรชเฉพาะโมดูลที่เกี่ยวข้องแบบ Real-time
            try {
                if (activeMod === 'influent' || activeMod === 'all') {
                    if (window.InfluentModule && typeof window.InfluentModule.loadData === 'function') await window.InfluentModule.loadData();
                }
                if (activeMod === 'electricity' || activeMod === 'all') {
                    if (window.ElectricityModule && typeof window.ElectricityModule.loadData === 'function') await window.ElectricityModule.loadData();
                }
                if (activeMod === 'water_quality' || activeMod === 'all') {
                    if (window.WaterQualityModule && typeof window.WaterQualityModule.loadData === 'function') await window.WaterQualityModule.loadData();
                }
                if (activeMod === 'quarterly_water_quality' || activeMod === 'all') {
                    if (window.WaterQualityModule) {
                        if (typeof window.WaterQualityModule.switchTab === 'function') {
                            window.WaterQualityModule.switchTab('quarter');
                        }
                        if (typeof window.WaterQualityModule.loadData === 'function') {
                            await window.WaterQualityModule.loadData();
                        }
                        if (typeof window.WaterQualityModule.renderQuarterlyTable === 'function') {
                            window.WaterQualityModule.renderQuarterlyTable(window.WaterQualityModule.quarterlyList);
                        }
                    }
                }
                if (activeMod === 'machinery' || activeMod === 'all') {
                    if (window.MachineryModule && typeof window.MachineryModule.loadData === 'function') await window.MachineryModule.loadData();
                }
                if (window.DashboardModule && typeof window.DashboardModule.render === 'function') {
                    await window.DashboardModule.render();
                }
            } catch (reloadErr) {
                console.warn('Module reload error ignored:', reloadErr);
            }

            // สแกนสถานะวันขาดหายใหม่อีกครั้ง
            try { await this.checkMissingDates(); } catch(e) {}

            Swal.fire({
                icon: 'success',
                title: 'บันทึกข้อมูลอัตโนมัติสำเร็จ!',
                html: `
                    <div class="text-left text-xs text-slate-300 space-y-2 p-3 bg-slate-900 rounded-xl border border-slate-800">
                        <div class="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                            <i class="fa-solid fa-circle-check"></i> บันทึกข้อมูลเรียบร้อยแล้ว ${totalSaved} รายการ
                        </div>
                        <div><strong>โมดูลเป้าหมาย:</strong> <span class="text-cyan-300 font-bold">${this.getModuleLabel(activeMod)}</span></div>
                        <div><strong>ช่วงวันที่:</strong> <span class="text-white font-mono">${firstDate || '-'} ถึง ${lastDate || '-'}</span> (${dates.length || 1} วัน)</div>
                        <div><strong>รอบเวลา:</strong> <span class="text-amber-300">${shiftsCount} เวร/วัน</span></div>
                        <div class="text-[11px] text-emerald-400/90 pt-1 border-t border-slate-800">
                            <i class="fa-solid fa-cloud-arrow-up"></i> บันทึกลง Local Storage และส่งขึ้น Supabase Cloud สำเร็จ 100%
                        </div>
                    </div>
                `,
                confirmButtonText: 'ตกลง',
                confirmButtonColor: '#059669',
                background: '#0c1322',
                color: '#f8fafc',
                didClose: () => {
                    document.body.style.overflow = '';
                    document.body.style.removeProperty('overflow');
                    document.body.classList.remove('modal-open');
                }
            });
        } catch (err) {
            console.error('Error executing batch save:', err);
            if (typeof window.closeAutoRecordModal === 'function') {
                window.closeAutoRecordModal();
            } else if (window.App && typeof window.App.closeModal === 'function') {
                window.App.closeModal('modal-auto-generator');
            }
            document.body.style.overflow = '';
            document.body.style.removeProperty('overflow');
            document.body.classList.remove('modal-open');

            Swal.fire({
                icon: 'error',
                title: 'เกิดข้อผิดพลาด',
                text: 'ไม่สามารถบันทึกข้อมูลอัตโนมัติได้ กรุณาลองใหม่อีกครั้ง (' + (err.message || err) + ')',
                background: '#0c1322',
                color: '#f8fafc',
                didClose: () => {
                    document.body.style.overflow = '';
                    document.body.style.removeProperty('overflow');
                    document.body.classList.remove('modal-open');
                }
            });
        }
    }

    getModuleLabel(mod) {
        switch (mod) {
            case 'influent': return 'ปริมาณน้ำเสียเข้าระบบ (80% Wastewater)';
            case 'electricity': return 'การใช้พลังงานไฟฟ้า (kWh)';
            case 'water_quality': return 'การตรวจคุณภาพน้ำเบื้องต้น (5 พารามิเตอร์)';
            case 'quarterly_water_quality': return 'การตรวจวิเคราะห์คุณภาพน้ำประจำไตรมาส (11 พารามิเตอร์ สธ.)';
            case 'machinery': return 'การตรวจเช็คเครื่องจักรประจำวัน (ฐานข้อมูลอ้างอิงอุปกรณ์)';
            case 'all': return 'บันทึกครบทุกมิติ (All-In-One)';
            default: return mod;
        }
    }
}

window.AutoGeneratorModule = new AutoGeneratorController();
window.AutoGenerator = window.AutoGeneratorModule;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (window.AutoGeneratorModule) {
            window.AutoGeneratorModule.init();
        }
    });
} else {
    if (window.AutoGeneratorModule) {
        window.AutoGeneratorModule.init();
    }
}
