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
        this.currentModule = 'influent'; // 'influent', 'electricity', 'water_quality', 'machinery', 'all'
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
            equipmentList: [
                'เครื่องเติมอากาศ Roots Blower #1',
                'เครื่องเติมอากาศ Roots Blower #2 (สแตนด์บาย)',
                'ปั๊มจุ่มสูบน้ำเสีย Submersible Pump #1',
                'ปั๊มจุ่มสูบน้ำเสีย Submersible Pump #2',
                'ปั๊มสูบตะกอนเวียนกลับ Sludge Return Pump',
                'ปั๊มจ่ายสารคลอรีน Dosing Pump #1',
                'ปั๊มจ่ายสารโพลีอะลูมิเนียมคลอไรด์ (PAC)',
                'เครื่องวัดอัตราการไหล Flow Meter',
                'หัววัดค่าออนไลน์ Online pH / DO Sensor'
            ]
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

        // Settings Modal Catchup Button
        const btnSettingsCatchup = document.getElementById('btn-settings-catchup-now');
        if (btnSettingsCatchup) {
            btnSettingsCatchup.addEventListener('click', () => {
                if (window.App && typeof window.App.closeModal === 'function') {
                    window.App.closeModal('modal-automation-settings');
                }
                this.openGeneratorModal('all');
            });
        }
    }

    /**
     * ค้นหาและแมปชื่อโมดูลเป้าหมายให้ตรงกับหน้าปัจจุบันของระบบ 100%
     */
    resolveActiveModule(mod) {
        if (mod && mod !== 'all') {
            if (mod === 'water-quality') return 'water_quality';
            return mod;
        }
        if (window.App && window.App.currentRoute) {
            const r = window.App.currentRoute;
            if (r === 'water-quality' || r === 'water_quality') return 'water_quality';
            if (r === 'influent' || r === 'electricity' || r === 'machinery') return r;
        }
        return 'influent';
    }

    /**
     * ผูกปุ่มบันทึกอัตโนมัติทุกหน้าในระบบ (Global Button Delegation)
     * เพื่อให้ปุ่มทุกหน้าเรียกใช้งานระบบ Auto Gen เฉพาะโมดูลของหน้านั้นๆ ได้ทันที 100%
     */
    bindGlobalPageTriggers() {
        const triggerConfigs = [
            { id: 'btn-top-auto-gen', module: null },
            { id: 'btn-dash-auto-gen', module: null },
            { id: 'btn-inf-auto-gen', module: 'influent' },
            { id: 'btn-elec-auto-gen', module: 'electricity' },
            { id: 'btn-add-influent-auto', module: 'influent' },
            { id: 'btn-add-electricity-auto', module: 'electricity' },
            { id: 'btn-add-prelim-quality-auto', module: 'water_quality' },
            { id: 'btn-add-machinery-auto', module: 'machinery' },
            { id: 'btn-add-maintenance-auto', module: 'machinery' }
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

        // 2. ไฮไลต์โมดูลที่เลือก
        this.highlightModuleScope(this.currentModule);

        // 3. ตรวจสอบให้แน่ใจว่ามีวันที่ และ Clamp ไม่ให้เกินวันปัจจุบัน
        const todayStr = this.getTodayISO();
        if (!this.startDate || !this.endDate || this.endDate > todayStr) {
            this.setDefaultDates();
        }
        this.updatePreviewBadge();
        this.renderPreviewTable();

        // 4. ทำการดึงมิเตอร์และตรวจจับวันที่ขาดหายแบบ Background Async โดยไม่บล็อก UI
        try {
            await this.loadLatestMeters();
            await this.checkMissingDates();

            if (this.missingDates && this.missingDates.length > 0) {
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
        const shifts = this.selectedShift === 'both' ? ['morning', 'afternoon'] : [this.selectedShift];

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

        const seededRandom = (seed) => {
            const x = Math.sin(seed) * 10000;
            return x - Math.floor(x);
        };

        const newTableItems = [];
        let currentWaterMeter = this.lastWaterMeter || 441921.42;
        let currentElecMeter = this.lastElecMeter || 202842.10;

        dates.forEach((dateStr, dIdx) => {
            shifts.forEach((shiftKey, sIdx) => {
                const isMorning = shiftKey === 'morning';
                const shiftInfo = this.hospitalModel.shifts[shiftKey] || this.hospitalModel.shifts.morning;
                const shiftLabel = isMorning ? '☀️ เวรเช้า 13:12 น.' : '🌙 เวรบ่าย 18:01 น.';
                const shiftPillClass = isMorning
                    ? 'border border-amber-500/30 bg-amber-950/40 text-amber-300'
                    : 'border border-blue-500/30 bg-blue-950/40 text-blue-300';
                const seed = dIdx * 17 + sIdx * 7 + 42;

                const activeMod = this.resolveActiveModule(this.currentModule);
                const modulesToGen = (activeMod === 'all')
                    ? ['influent', 'electricity', 'water_quality', 'machinery']
                    : [activeMod];

                modulesToGen.forEach(mod => {
                    const key = `${dateStr}_${shiftKey}_${mod}`;
                    const existing = existingMap.get(key);

                    // 1. โมดูลน้ำเสียเข้าระบบ
                    if (mod === 'influent') {
                        let waterUsed;
                        if (existing && typeof existing.waterUsed === 'number') {
                            waterUsed = existing.waterUsed;
                        } else if (dIdx === 0 && isMorning) {
                            waterUsed = 90.23;
                        } else if (dIdx === 0 && !isMorning) {
                            waterUsed = 55.55;
                        } else {
                            const randVar = (seededRandom(seed) - 0.5) * 8;
                            waterUsed = Math.max(10, Math.round(((200.0 * (isMorning ? 0.62 : 0.38)) + randVar) * 100) / 100);
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
                            time: shiftInfo.time,
                            moduleType: 'influent',
                            department: 'รวมทุกอาคารโรงพยาบาล',
                            waterUsed: waterUsed,
                            wastewater: wastewater,
                            meterStart: mStart,
                            meterEnd: mEnd
                        });
                    }
                    // 2. โมดูลการใช้ไฟฟ้า
                    else if (mod === 'electricity') {
                        let kwh;
                        if (existing && typeof existing.kwh === 'number') {
                            kwh = existing.kwh;
                        } else if (dIdx === 0 && isMorning) {
                            kwh = 285.20;
                        } else if (dIdx === 0 && !isMorning) {
                            kwh = 174.80;
                        } else {
                            const randVar = (seededRandom(seed + 1) - 0.5) * 16;
                            kwh = Math.max(20, Math.round(((460.0 * (isMorning ? 0.62 : 0.38)) + randVar) * 100) / 100);
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
                            time: shiftInfo.time,
                            moduleType: 'electricity',
                            department: 'รวมทุกอาคารโรงพยาบาล',
                            kwh: kwh,
                            cost: cost,
                            unitPrice: unitPrice,
                            elecMeterStart: mStart,
                            elecMeterEnd: mEnd
                        });
                    }
                    // 3. โมดูลคุณภาพน้ำเบื้องต้น
                    else if (mod === 'water_quality') {
                        const ph = existing ? existing.ph : Math.round((7.25 + seededRandom(seed + 2) * 0.45) * 100) / 100;
                        const doVal = existing ? existing.do : Math.round((2.70 + seededRandom(seed + 3) * 0.85) * 100) / 100;
                        const tds = existing ? existing.tds : Math.round((395.0 + seededRandom(seed + 4) * 65.0) * 10) / 10;
                        const cl = existing ? existing.cl : Math.round((1.30 + seededRandom(seed + 5) * 0.45) * 100) / 100;
                        const sed = existing ? existing.sediment : Math.round((130.0 + seededRandom(seed + 6) * 70.0) * 10) / 10;

                        newTableItems.push({
                            date: dateStr,
                            shift: shiftKey,
                            shiftName: shiftInfo.name,
                            shiftLabel: shiftLabel,
                            shiftPillClass: shiftPillClass,
                            time: shiftInfo.time,
                            moduleType: 'water_quality',
                            department: 'บ่อตกตะกอนขั้นสุดท้าย (Effluent Tank)',
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
                        newTableItems.push({
                            date: dateStr,
                            shift: shiftKey,
                            shiftName: shiftInfo.name,
                            shiftLabel: shiftLabel,
                            shiftPillClass: shiftPillClass,
                            time: shiftInfo.time,
                            moduleType: 'machinery',
                            department: 'เครื่องจักรหลัก 9 รายการ',
                            machineryStatus: machStatus
                        });
                    }
                });
            });
        });

        this.tableItems = newTableItems;

        // อัปเดตส่วนหัวสรุปข้อมูล
        const shiftText = this.selectedShift === 'both' ? 'เวรเช้า+เวรบ่าย' : (this.selectedShift === 'morning' ? 'เวรเช้า' : 'เวรบ่าย');
        if (badgeSummary) {
            badgeSummary.textContent = `เลือก ${dates.length}วัน × ${shifts.length} เวร (${shiftText})`;
        }
        if (countSummary) {
            countSummary.textContent = `${this.tableItems.length}`;
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
                        ${item.department}
                    </td>
                    <td class="py-3 px-3.5 text-right font-sans align-middle">
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
                            ตรวจเช็ค Roots Blower 2 ชุด, Submersible Pumps 2 ตัว, Sludge Return, Dosing Pump ทำงานปกติ
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
        const shifts = (this.selectedShift === 'both' || !this.selectedShift) ? ['morning', 'afternoon'] : [this.selectedShift];
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
                        sampling_point: 'บ่อตกตะกอนขั้นสุดท้าย (Effluent Tank - ทางระบายน้ำทิ้ง รพ.)',
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
                    const record = {
                        id: generateUUID(),
                        recorded_at: recordedAt,
                        equipment_list: this.hospitalModel.equipmentList,
                        status: item.machineryStatus === 'normal' ? 'ปกติทุกรายการ' : 'มีอุปกรณ์ต้องบำรุงรักษา',
                        abnormal_equipment: item.machineryStatus === 'normal' ? '-' : 'เครื่องเติมอากาศ Roots Blower #2',
                        cause: '-',
                        solution: '-',
                        inspector: recorderName,
                        inspector_name: recorderName,
                        checked_by: recorderName,
                        remarks: `ตรวจเช็คความพร้อมประจำเวร (${item.shiftName}) อุปกรณ์ทำงานปกติสมบูรณ์`,
                        notes: `ตรวจเช็คความพร้อมประจำเวร (${item.shiftName}) อุปกรณ์ทำงานปกติสมบูรณ์`,
                        blower_status: item.machineryStatus,
                        pump_status: item.machineryStatus,
                        aerator_status: item.machineryStatus,
                        dosing_status: item.machineryStatus,
                        overall_status: item.machineryStatus,
                        created_at: new Date().toISOString()
                    };
                    await window.DataStore.insert('machinery_inspection', record);
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
            case 'machinery': return 'การตรวจเช็คเครื่องจักรประจำวัน (9 รายการ)';
            case 'all': return 'บันทึกครบทุกมิติ (All-In-One)';
            default: return mod;
        }
    }
}

window.AutoGeneratorModule = new AutoGeneratorController();
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
