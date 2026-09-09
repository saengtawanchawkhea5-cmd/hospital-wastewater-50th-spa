/**
 * ============================================================================
 * ระบบจัดการระบบบำบัดน้ำเสีย โรงพยาบาล ๕๐ พรรษา มหาวชิราลงกรณ (SPA)
 * MONTHLY-REPORT.JS - รายงานสรุปประจำเดือน & ประมวลผลอัตโนมัติ
 * ============================================================================
 */

class MonthlyReportModule {
    constructor() {
        this.items = [];
        this.filteredItems = [];
        this.editingId = null;
        this.sortField = 'report_month';
        this.sortDir = 'desc';
    }

    async init() {
        this.bindEvents();
        await this.loadData();
    }

    bindEvents() {
        // ผูกการคลิกจัดเรียงหัวตารางอัตโนมัติ
        if (window.App && window.App.bindTableSorting) {
            window.App.bindTableSorting('table-monthly-body', this, 'report_month', 'desc');
        }

        const btnAdd = document.getElementById('btn-add-monthly-report');
        if (btnAdd) btnAdd.addEventListener('click', () => this.openAddModal());

        const btnAutoCalc = document.getElementById('btn-auto-calc-month');
        if (btnAutoCalc) btnAutoCalc.addEventListener('click', () => this.autoCalculateFromMonth());

        const form = document.getElementById('form-monthly-report');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveData();
            });
        }
    }

    async loadData() {
        this.items = await window.DataStore.getAll('monthly_reports', { orderBy: 'report_month', ascending: false });
        this.applyFilters();
    }

    applyFilters() {
        this.filteredItems = [...this.items];
        if (window.App && window.App.sortData) {
            this.filteredItems = window.App.sortData(this.filteredItems, this.sortField, this.sortDir);
            window.App.updateTableSortUI('table-monthly-body', this.sortField, this.sortDir);
        }
        this.renderTable(this.filteredItems);
    }

    async openAddModal() {
        this.editingId = null;
        const form = document.getElementById('form-monthly-report');
        const title = document.getElementById('modal-monthly-title');
        if (!form) return;

        form.reset();
        title.innerHTML = '<i class="fa-solid fa-file-invoice text-emerald-400"></i> สร้างรายงานสรุปรายเดือน';

        const now = new Date();
        const monthStr = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2,'0')}`;
        document.getElementById('mrep-form-month').value = monthStr;

        await this.autoCalculateFromMonth();
        window.App.openModal('modal-monthly-report');
    }

    async autoCalculateFromMonth() {
        const selectedMonth = document.getElementById('mrep-form-month').value;
        if (!selectedMonth) return;

        Swal.fire({
            title: 'กำลังประมวลผลข้อมูลประจำเดือน...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        // ดึงข้อมูลน้ำและไฟในเดือนที่เลือกมาคำนวณสรุป
        const waterList = await window.DataStore.getAll('influent_wastewater');
        const elecList = await window.DataStore.getAll('electricity_consumption');
        const qualityList = await window.DataStore.getAll('preliminary_water_quality');

        const monthWater = waterList.filter(item => item.recorded_at && item.recorded_at.startsWith(selectedMonth));
        const monthElec = elecList.filter(item => item.recorded_at && item.recorded_at.startsWith(selectedMonth));
        const monthQuality = qualityList.filter(item => item.recorded_at && item.recorded_at.startsWith(selectedMonth));

        const totalWater = monthWater.reduce((acc, cur) => acc + (parseFloat(cur.wastewater_influent) || 0), 0);
        const totalElec = monthElec.reduce((acc, cur) => acc + (parseFloat(cur.total_kwh) || 0), 0);
        const totalCost = monthElec.reduce((acc, cur) => acc + (parseFloat(cur.electricity_cost) || 0), 0);

        let avgPh = 7.30, avgDo = 3.20, avgTds = 340, avgSed = 180, avgCl = 1.50, passRate = 100.00;

        if (monthQuality.length > 0) {
            avgPh = (monthQuality.reduce((acc, c) => acc + (parseFloat(c.ph) || 0), 0) / monthQuality.length).toFixed(2);
            avgDo = (monthQuality.reduce((acc, c) => acc + (parseFloat(c.do_value) || 0), 0) / monthQuality.length).toFixed(2);
            avgTds = (monthQuality.reduce((acc, c) => acc + (parseFloat(c.tds) || 0), 0) / monthQuality.length).toFixed(2);
            avgSed = (monthQuality.reduce((acc, c) => acc + (parseFloat(c.sediment) || 0), 0) / monthQuality.length).toFixed(2);
            avgCl = (monthQuality.reduce((acc, c) => acc + (parseFloat(c.chlorine) || 0), 0) / monthQuality.length).toFixed(2);

            const passed = monthQuality.filter(c => window.DashboardModule.checkQualityPass(c)).length;
            passRate = ((passed / monthQuality.length) * 100).toFixed(1);
        }

        document.getElementById('mrep-form-water').value = totalWater.toFixed(2);
        document.getElementById('mrep-form-kwh').value = totalElec.toFixed(2);
        document.getElementById('mrep-form-ph').value = avgPh;
        document.getElementById('mrep-form-do').value = avgDo;
        document.getElementById('mrep-form-tds').value = avgTds;
        document.getElementById('mrep-form-sediment').value = avgSed;
        document.getElementById('mrep-form-chlorine').value = avgCl;
        document.getElementById('mrep-form-pass-rate').value = passRate;
        document.getElementById('mrep-form-cost').value = totalCost.toFixed(2);

        Swal.close();
    }

    async saveData() {
        const form = document.getElementById('form-monthly-report');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const payload = {
            report_month: document.getElementById('mrep-form-month').value,
            total_wastewater_inflow: parseFloat(document.getElementById('mrep-form-water').value) || 0,
            total_electricity_kwh: parseFloat(document.getElementById('mrep-form-kwh').value) || 0,
            avg_ph: parseFloat(document.getElementById('mrep-form-ph').value) || 7.2,
            avg_do: parseFloat(document.getElementById('mrep-form-do').value) || 3.0,
            avg_tds: parseFloat(document.getElementById('mrep-form-tds').value) || 350,
            avg_sediment: parseFloat(document.getElementById('mrep-form-sediment').value) || 180,
            avg_chlorine: parseFloat(document.getElementById('mrep-form-chlorine').value) || 1.5,
            standard_pass_rate: parseFloat(document.getElementById('mrep-form-pass-rate').value) || 100,
            total_cost: parseFloat(document.getElementById('mrep-form-cost').value) || 0
        };

        Swal.fire({ title: 'กำลังบันทึกรายงานสรุป...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        try {
            if (this.editingId) {
                await window.DataStore.update('monthly_reports', this.editingId, payload);
            } else {
                await window.DataStore.insert('monthly_reports', payload);
            }

            Swal.fire({ icon: 'success', title: 'บันทึกรายงานสำเร็จ!', timer: 1500, showConfirmButton: false });
            window.App.closeModal('modal-monthly-report');
            await this.loadData();
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: err.message });
        }
    }

    async deleteItem(id) {
        const result = await Swal.fire({
            title: 'ยืนยันการลบรายงานรายเดือน?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#334155',
            confirmButtonText: 'ลบรายงาน'
        });

        if (result.isConfirmed) {
            await window.DataStore.delete('monthly_reports', id);
            Swal.fire({ icon: 'success', title: 'ลบสำเร็จ', timer: 1200, showConfirmButton: false });
            await this.loadData();
        }
    }

    renderTable(list) {
        const tbody = document.getElementById('table-monthly-body');
        if (!tbody) return;

        const totalItems = list ? list.length : 0;
        const totalWater = list ? list.reduce((s, c) => s + (parseFloat(c.total_wastewater_inflow) || 0), 0) : 0;
        const totalKwh = list ? list.reduce((s, c) => s + (parseFloat(c.total_electricity_kwh) || 0), 0) : 0;
        const totalCost = list ? list.reduce((s, c) => s + (parseFloat(c.total_cost) || 0), 0) : 0;
        const avgPassRate = totalItems > 0 ? (list.reduce((s, c) => s + (parseFloat(c.standard_pass_rate) || 0), 0) / totalItems).toFixed(1) : '100.0';

        if (!list || list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-slate-500">ไม่พบรายงานสรุปรายเดือน</td></tr>`;
            const tfoot = document.getElementById('table-monthly-foot');
            if (tfoot) tfoot.innerHTML = '';

            if (window.App && window.App.renderPagination) {
                window.App.renderPagination({
                    containerId: 'pagination-monthly',
                    totalItems: 0,
                    currentPage: 1,
                    pageSize: 'all',
                    summaryCards: [
                        { title: 'จำนวนรายงานทั้งหมด', value: '0 เดือน', subText: 'รายงานประจำเดือน', icon: 'fa-solid fa-file-invoice', color: 'cyan' },
                        { title: 'น้ำเสียรวมสะสม (TOTAL FLOW)', value: '0 ลบ.ม.', subText: 'เฉลี่ย 0 ลบ.ม./เดือน', icon: 'fa-solid fa-water', color: 'cyan' },
                        { title: 'ไฟฟ้ารวม & ค่าใช้จ่ายสะสม', value: '0 kWh | ฿0.00', subText: 'รวมทุกเดือนที่จัดทำ', icon: 'fa-solid fa-bolt', color: 'emerald' },
                        { title: 'อัตราผ่านมาตรฐานเฉลี่ย', value: '0.0%', subText: 'เกณฑ์มาตรฐานคุณภาพน้ำ', icon: 'fa-solid fa-circle-check', color: 'purple' }
                    ]
                });
            }
            return;
        }

        const isAdmin = window.AuthService.isAdmin();

        tbody.innerHTML = list.map((item, idx) => `
            <tr>
                <td class="text-slate-400 font-mono text-xs">${idx + 1}</td>
                <td class="font-bold text-white font-mono">${item.report_month}</td>
                <td class="font-mono text-cyan-400">${item.total_wastewater_inflow ? item.total_wastewater_inflow.toLocaleString() : 0} ลบ.ม.</td>
                <td class="font-mono text-amber-400">${item.total_electricity_kwh ? item.total_electricity_kwh.toLocaleString() : 0} kWh</td>
                <td class="font-mono text-xs text-slate-300">
                    pH: ${item.avg_ph || '-'} | DO: ${item.avg_do || '-'} | TDS: ${item.avg_tds || '-'}
                </td>
                <td><span class="badge badge-success">${item.standard_pass_rate || 100}%</span></td>
                <td class="font-mono text-emerald-400 font-bold">฿${item.total_cost ? item.total_cost.toLocaleString() : '0.00'}</td>
                <td>
                    <div class="flex items-center gap-1">
                        <button class="btn btn-secondary btn-icon btn-sm" onclick="window.ExportImportModule.exportSingleMonthlyPDF('${item.id}')" title="พิมพ์รายงาน PDF">
                            <i class="fa-solid fa-print text-blue-400"></i>
                        </button>
                        ${isAdmin ? `
                        <button class="btn btn-danger btn-icon btn-sm" onclick="window.MonthlyReportModule.deleteItem('${item.id}')" title="ลบ">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `).join('');

        // Render Table Footer Summary Row
        const tfoot = document.getElementById('table-monthly-foot');
        if (tfoot) {
            tfoot.innerHTML = `
                <tr class="table-summary-row border-t-2 border-emerald-500/50">
                    <td class="text-center font-bold text-emerald-400 py-3.5"><i class="fa-solid fa-calculator"></i> รวม</td>
                    <td class="font-bold text-emerald-300 py-3.5">
                        <span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> ผลรวมทั้งสิ้น (${totalItems.toLocaleString()} เดือน):</span>
                    </td>
                    <td class="font-mono text-cyan-300 font-bold py-3.5 text-xs">${totalWater.toLocaleString()} ลบ.ม.</td>
                    <td class="font-mono text-amber-400 font-bold py-3.5 text-xs">${totalKwh.toLocaleString()} kWh</td>
                    <td class="text-xs text-slate-400 py-3.5">เฉลี่ย ${(totalWater / totalItems).toFixed(0)} ลบ.ม./ด.</td>
                    <td class="font-bold text-emerald-400 py-3.5 text-xs">${avgPassRate}%</td>
                    <td class="font-mono text-emerald-400 font-bold py-3.5 text-sm bg-emerald-950/40 px-2 rounded">฿${totalCost.toLocaleString()}</td>
                    <td></td>
                </tr>
            `;
        }

        // Summary Cards Configuration
        const summaryCards = [
            {
                title: 'จำนวนรายงานประจำเดือน',
                value: `${totalItems.toLocaleString()} เดือน`,
                subText: 'ตามตัวกรองที่เลือก',
                icon: 'fa-solid fa-file-invoice',
                color: 'cyan'
            },
            {
                title: 'ปริมาณน้ำบำบัด (+) VS ค่าไฟ (-)',
                value: `น้ำ: ${totalWater.toLocaleString()} ลบ.ม. / ไฟ: ฿${totalCost.toLocaleString()}`,
                subText: 'รวมทุกเดือนที่ประมวลผล',
                icon: 'fa-solid fa-right-left',
                color: 'blue'
            },
            {
                title: 'การลดก๊าซเรือนกระจกสะสม',
                value: `${totalGhgs.toFixed(3)} tCO2e`,
                subText: `เทียบเท่าปลูกต้นไม้ ${Math.round(totalGhgs * 105.26).toLocaleString()} ต้น`,
                icon: 'fa-solid fa-leaf',
                color: 'emerald'
            },
            {
                title: 'มูลค่าการเดินระบบรวม (TOTAL VALUE)',
                value: `฿${(totalCost + totalWater * 18.5).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`,
                subText: 'รวมค่าน้ำ + ค่าไฟ + สารเคมี',
                icon: 'fa-solid fa-money-bill-trend-up',
                color: 'amber'
            }
        ];

        if (window.App && window.App.renderPagination) {
            window.App.renderPagination({
                containerId: 'pagination-monthly',
                totalItems: totalItems,
                currentPage: 1,
                pageSize: 'all',
                summaryCards: summaryCards
            });
        }
    }
}

window.MonthlyReportModule = new MonthlyReportModule();
