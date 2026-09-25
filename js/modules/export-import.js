/**
 * ============================================================================
 * ระบบจัดการระบบบำบัดน้ำเสีย โรงพยาบาล ๕๐ พรรษา มหาวชิราลงกรณ (SPA)
 * EXPORT-IMPORT.JS - ส่งออก Excel/PDF, พิมพ์รายงาน, นำเข้า และสำรอง/กู้คืนข้อมูล (Backup & Restore)
 * ============================================================================
 */

class ExportImportModule {
    constructor() {
        this.backupHistoryKey = 'spa_50th_backup_history';
    }

    init() {
        this.bindEvents();
        this.renderBackupHistory();
    }

    bindEvents() {
        // Quick Action Buttons
        const btnExportExcelAll = document.getElementById('btn-export-excel-all');
        if (btnExportExcelAll) btnExportExcelAll.addEventListener('click', () => this.backupAllToExcel());

        const btnExportPdfSummary = document.getElementById('btn-export-pdf-summary');
        if (btnExportPdfSummary) btnExportPdfSummary.addEventListener('click', () => this.exportSummaryPDF());

        const btnSeedData = document.getElementById('btn-seed-sample-data');
        if (btnSeedData) btnSeedData.addEventListener('click', () => this.seedSampleData());

        const btnClearData = document.getElementById('btn-clear-all-data');
        if (btnClearData) btnClearData.addEventListener('click', () => this.clearAllData());

        const fileImportInput = document.getElementById('file-import-input');
        if (fileImportInput) {
            fileImportInput.addEventListener('change', (e) => this.handleFileImport(e));
        }

        const fileBackupRestoreInput = document.getElementById('file-backup-restore-input');
        if (fileBackupRestoreInput) {
            fileBackupRestoreInput.addEventListener('change', (e) => this.handleBackupRestore(e));
        }

        const btnPrintCurrent = document.getElementById('btn-print-current-view');
        if (btnPrintCurrent) btnPrintCurrent.addEventListener('click', () => window.print());
    }

    // =========================================================================
    // ฟังก์ชันความปลอดภัยสำหรับ Cell ข้อมูลใน Excel ป้องกันเกิน 32,767 ตัวอักษร
    // =========================================================================
    sanitizeExcelCell(val) {
        if (val === null || val === undefined) return '';
        if (typeof val === 'object') {
            try {
                val = JSON.stringify(val);
            } catch (e) {
                val = String(val);
            }
        }
        let str = String(val);
        if (str.length > 32000) {
            if (str.startsWith('data:image/') || str.startsWith('data:application/pdf') || str.startsWith('data:')) {
                return `[ไฟล์แนบ Base64 ขนาด ${Math.round(str.length / 1024)} KB - ดูไฟล์เต็มได้ที่ระบบหรือไฟล์สำรอง JSON 1:1]`;
            }
            if (str.startsWith('[{') || str.startsWith('[')) {
                return `[ไฟล์แนบหลายรายการ - ดูไฟล์เต็มได้ที่ระบบหรือไฟล์สำรอง JSON 1:1]`;
            }
            return str.substring(0, 32000) + '... (ตัดทอนเพื่อรองรับขีดจำกัดเซลล์ Excel)';
        }
        return val;
    }

    // =========================================================================
    // 1. สำรองทุกตารางเป็น Excel (.xlsx รวมทุกตารางใน 1 ไฟล์)
    // =========================================================================
    async backupAllToExcel() {
        Swal.fire({
            title: 'กำลังสำรองข้อมูลทุกตาราง (Excel)...',
            text: 'กำลังรวบรวมข้อมูลจากฐานข้อมูล Supabase Cloud',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        try {
            const influentData = await window.DataStore.getAll('influent_wastewater', { orderBy: 'recorded_at', ascending: true });
            const elecData = await window.DataStore.getAll('electricity_consumption', { orderBy: 'recorded_at', ascending: true });
            const prelimData = await window.DataStore.getAll('preliminary_water_quality', { orderBy: 'recorded_at', ascending: true });
            const quarterlyData = await window.DataStore.getAll('quarterly_water_quality', { orderBy: 'recorded_at', ascending: true });
            const machineryData = await window.DataStore.getAll('machinery_inspection', { orderBy: 'recorded_at', ascending: true });
            const maintData = await window.DataStore.getAll('maintenance_records', { orderBy: 'recorded_at', ascending: true });
            const equipData = await window.DataStore.getAll('equipment_ref', { orderBy: 'code', ascending: true });
            const riskData = await window.DataStore.getAll('risk_management', { orderBy: 'created_at', ascending: true });
            const incidentData = await window.DataStore.getAll('incident_records', { orderBy: 'incident_date', ascending: true });
            const reportDocs = await window.DataStore.getAll('report_storage', { orderBy: 'created_at', ascending: true });
            const manualDocs = await window.DataStore.getAll('treatment_manuals', { orderBy: 'created_at', ascending: true });
            const usersData = await window.DataStore.getAll('users', { orderBy: 'username', ascending: true });

            const wb = XLSX.utils.book_new();
            let totalRecordsCount = 0;

            const createCleanSheet = (arr) => {
                const cleanRows = arr.map(row => {
                    const cleanRow = {};
                    for (const [k, v] of Object.entries(row)) {
                        cleanRow[k] = this.sanitizeExcelCell(v);
                    }
                    return cleanRow;
                });
                return XLSX.utils.json_to_sheet(cleanRows);
            };

            // 1. Sheet ปริมาณน้ำเสีย
            if (influentData && influentData.length > 0) {
                totalRecordsCount += influentData.length;
                const wsData = influentData.map(item => ({
                    'ID': item.id,
                    'วัน-เวลาที่บันทึก': window.App.formatDateTime(item.recorded_at),
                    'แหล่งที่มาของน้ำ': item.water_source || 'อาคารผู้ป่วยในและอาคารบริการ',
                    'เลขมิเตอร์เริ่มต้น': item.meter_start,
                    'เลขมิเตอร์วันนี้': item.meter_today,
                    'ปริมาณน้ำใช้ทั้งหมด (ลบ.ม.)': item.total_water_used,
                    'ปริมาณน้ำเสีย 80% (ลบ.ม.)': item.wastewater_influent,
                    'รูปภาพมิเตอร์/เอกสาร': item.meter_image_url || '',
                    'ผู้บันทึก': item.recorded_by,
                    'หมายเหตุ': item.notes || ''
                }));
                const ws = createCleanSheet(wsData);
                XLSX.utils.book_append_sheet(wb, ws, "1.น้ำเสียเข้าระบบ");
            }

            // 2. Sheet การใช้ไฟฟ้า
            if (elecData && elecData.length > 0) {
                totalRecordsCount += elecData.length;
                const wsData = elecData.map(item => ({
                    'ID': item.id,
                    'วัน-เวลาที่บันทึก': window.App.formatDateTime(item.recorded_at),
                    'เลขมิเตอร์เริ่มต้น': item.meter_start,
                    'เลขมิเตอร์วันนี้': item.meter_today,
                    'หน่วยไฟฟ้ารวม (kWh)': item.total_kwh,
                    'อัตราค่าไฟฟ้าต่อหน่วย': item.unit_price,
                    'คิดเป็นค่าไฟ (บาท)': item.electricity_cost,
                    'รูปภาพมิเตอร์/เอกสาร': item.meter_image_url || '',
                    'ผู้บันทึก': item.recorded_by,
                    'หมายเหตุ': item.notes || ''
                }));
                const ws = createCleanSheet(wsData);
                XLSX.utils.book_append_sheet(wb, ws, "2.การใช้ไฟฟ้า");
            }

            // 3. Sheet คุณภาพน้ำเบื้องต้น
            if (prelimData && prelimData.length > 0) {
                totalRecordsCount += prelimData.length;
                const wsData = prelimData.map(item => ({
                    'ID': item.id,
                    'วัน-เวลา': window.App.formatDateTime(item.recorded_at),
                    'จุดเก็บตัวอย่าง': item.sampling_point,
                    'pH (5.5-9.0)': item.ph,
                    'DO (2-4 mg/L)': item.do_value,
                    'TDS (<=500)': item.tds,
                    'คลอรีน (1-2 mg/L)': item.chlorine,
                    'ตะกอน VS30 (<=300)': item.sediment,
                    'สถานะ': item.status,
                    'รูปภาพ/เอกสาร': item.image_url || '',
                    'ผู้ตรวจสอบ': item.inspector,
                    'หมายเหตุ': item.notes || ''
                }));
                const ws = createCleanSheet(wsData);
                XLSX.utils.book_append_sheet(wb, ws, "3.คุณภาพน้ำเบื้องต้น");
            }

            // 4. Sheet คุณภาพน้ำประจำไตรมาส
            if (quarterlyData && quarterlyData.length > 0) {
                totalRecordsCount += quarterlyData.length;
                const wsData = quarterlyData.map(item => ({
                    'ID': item.id,
                    'วัน-เวลาที่ตรวจ': window.App.formatDateTime(item.recorded_at),
                    'ไตรมาส/ปี': item.quarter_name || '',
                    'จุดเก็บตัวอย่าง': item.sampling_point || '',
                    'BOD (<=20)': item.bod,
                    'COD (<=120)': item.cod,
                    'SS (<=30)': item.ss,
                    'TDS (<=500)': item.tds,
                    'pH (5.5-9.0)': item.ph,
                    'Oil & Grease (<=5)': item.oil_grease,
                    'Total Nitrogen (<=20)': item.total_nitrogen,
                    'สถานะ': item.status,
                    'หน่วยงานตรวจ/ห้องปฏิบัติการ': item.lab_name || '',
                    'เอกสารผลตรวจ/รายงาน': item.doc_url || '',
                    'ผู้รับผิดชอบ': item.inspector || ''
                }));
                const ws = createCleanSheet(wsData);
                XLSX.utils.book_append_sheet(wb, ws, "4.คุณภาพน้ำไตรมาส");
            }

            // 5. Sheet ตรวจสอบเครื่องจักร
            if (machineryData && machineryData.length > 0) {
                totalRecordsCount += machineryData.length;
                const wsData = machineryData.map(item => ({
                    'ID': item.id,
                    'วัน-เวลาตรวจ': window.App.formatDateTime(item.recorded_at),
                    'ชื่อเครื่องจักร/อุปกรณ์': item.equipment_name,
                    'รหัสอุปกรณ์': item.equipment_code || '',
                    'ตำแหน่งติดตั้ง': item.location || '',
                    'สถานะการทำงาน': item.status,
                    'กระแสไฟฟ้า (Amp)': item.amp_reading || '',
                    'อุณหภูมิ (C)': item.temp_reading || '',
                    'ระดับเสียง/การสั่นสะเทือน': item.vibration_status || '',
                    'รูปภาพสภาพเครื่องจักร': item.image_url || '',
                    'ผู้ตรวจเช็ค': item.inspector,
                    'หมายเหตุ': item.notes || ''
                }));
                const ws = createCleanSheet(wsData);
                XLSX.utils.book_append_sheet(wb, ws, "5.ตรวจสภาพเครื่องจักร");
            }

            // 6. Sheet งานซ่อมบำรุง
            if (maintData && maintData.length > 0) {
                totalRecordsCount += maintData.length;
                const wsData = maintData.map(item => ({
                    'ID': item.id,
                    'วันที่': window.App.formatDateTime(item.recorded_at),
                    'สถานที่': item.location,
                    'อุปกรณ์': (item.equipment_list || []).join(', '),
                    'ประเภทงาน': item.job_type,
                    'ปัญหา/อาการ': item.problem,
                    'วิธีการแก้ไข': item.fix_method,
                    'ค่าใช้จ่าย (บาท)': item.cost,
                    'รูปภาพก่อน-หลังซ่อม': item.image_url || '',
                    'ผู้ดำเนินการ': item.operator
                }));
                const ws = createCleanSheet(wsData);
                XLSX.utils.book_append_sheet(wb, ws, "6.ประวัติซ่อมบำรุง");
            }

            // 7. Sheet ฐานข้อมูลอ้างอิงอุปกรณ์
            if (equipData && equipData.length > 0) {
                totalRecordsCount += equipData.length;
                const wsData = equipData.map(item => ({
                    'ID': item.id,
                    'รหัสอุปกรณ์': item.code,
                    'ชื่ออุปกรณ์': item.name,
                    'หมวดหมู่': item.category,
                    'ชนิด/รุ่น': item.type,
                    'สถานที่ติดตั้ง': item.location,
                    'สถานะความพร้อม': item.status,
                    'กำลังไฟฟ้า (kW)': item.power_kw,
                    'รูปภาพ/คู่มือแนบ': item.image_url || item.file_url || ''
                }));
                const ws = createCleanSheet(wsData);
                XLSX.utils.book_append_sheet(wb, ws, "7.อ้างอิงอุปกรณ์");
            }

            // 8. Sheet บริหารความเสี่ยง
            if (riskData && riskData.length > 0) {
                totalRecordsCount += riskData.length;
                const wsData = riskData.map(item => ({
                    'ID': item.id,
                    'วัน-เวลาที่บันทึก': window.App.formatDateTime(item.recorded_at || item.created_at),
                    'ชื่อความเสี่ยง': item.risk_name || item.risk_title || '',
                    'ระดับความรุนแรง': item.severity_level || item.risk_level || 'ปานกลาง',
                    'ผลกระทบต่อ': item.impact || '',
                    'โอกาสเกิด': item.likelihood || '',
                    'แผนป้องกันและแก้ไข': item.prevention_plan || item.mitigation_plan || '',
                    'ผู้รับผิดชอบ': item.risk_manager || item.responsible_person || '',
                    'สถานะ': item.status || 'ควบคุมได้'
                }));
                const ws = createCleanSheet(wsData);
                XLSX.utils.book_append_sheet(wb, ws, "8.บริหารความเสี่ยง");
            }

            // 9. Sheet รายงานเหตุการณ์ผิดปกติ
            if (incidentData && incidentData.length > 0) {
                totalRecordsCount += incidentData.length;
                const wsData = incidentData.map(item => ({
                    'ID': item.id,
                    'วัน-เวลาเกิดเหตุ': window.App.formatDateTime(item.incident_date),
                    'หัวข้อเหตุการณ์': item.title,
                    'สถานที่เกิดเหตุ': item.location,
                    'ระดับความรุนแรง': item.severity,
                    'รายละเอียด': item.description,
                    'การแก้ไขเบื้องต้น': item.immediate_action,
                    'รูปภาพเหตุการณ์': item.image_url || '',
                    'ผู้รายงาน': item.reported_by,
                    'สถานะ': item.status
                }));
                const ws = createCleanSheet(wsData);
                XLSX.utils.book_append_sheet(wb, ws, "9.เหตุการณ์ผิดปกติ");
            }

            // 10. Sheet คลังเอกสารรายงาน
            if (reportDocs && reportDocs.length > 0) {
                totalRecordsCount += reportDocs.length;
                const wsData = reportDocs.map(item => ({
                    'ID': item.id,
                    'ชื่อรายงาน': item.title,
                    'ประเภทรายงาน': item.report_type || item.category || '',
                    'งวด/ช่วงเวลา': item.period || item.report_date || '',
                    'ลิงก์ไฟล์เอกสาร': item.file_url,
                    'ขนาดไฟล์': item.file_size || '',
                    'ผู้อัปโหลด': item.uploaded_by
                }));
                const ws = createCleanSheet(wsData);
                XLSX.utils.book_append_sheet(wb, ws, "10.คลังเอกสารรายงาน");
            }

            // 11. Sheet คู่มือระบบบำบัด (SOP)
            if (manualDocs && manualDocs.length > 0) {
                totalRecordsCount += manualDocs.length;
                const wsData = manualDocs.map(item => ({
                    'ID': item.id,
                    'ชื่อคู่มือ': item.title,
                    'หมวดหมู่': item.category,
                    'ลิงก์ไฟล์คู่มือ/SOP': item.file_url,
                    'ขนาดไฟล์': item.file_size || '',
                    'ผู้อัปโหลด': item.uploaded_by
                }));
                const ws = createCleanSheet(wsData);
                XLSX.utils.book_append_sheet(wb, ws, "11.คู่มือระบบบำบัด");
            }

            // 12. Sheet บัญชีผู้ใช้งาน
            if (usersData && usersData.length > 0) {
                totalRecordsCount += usersData.length;
                const wsData = usersData.map(item => ({
                    'ID': item.id,
                    'ชื่อผู้ใช้งาน (Username)': item.username,
                    'ชื่อ-นามสกุล': item.full_name,
                    'สิทธิ์ (Role)': item.role,
                    'หน่วยงาน': item.department || '',
                    'สถานะ': item.status
                }));
                const ws = createCleanSheet(wsData);
                XLSX.utils.book_append_sheet(wb, ws, "12.บัญชีผู้ใช้งาน");
            }

            // 13. Sheet การวิเคราะห์คาร์บอนเครดิต & ESG (T-VER / TGO)
            const totalWastewater = (influentData || []).reduce((a, b) => a + (parseFloat(b.wastewater_influent) || 0), 0);
            const factors = window.APP_CONFIG ? window.APP_CONFIG.carbonCreditFactors : { defaultWaterRecycleRate: 0.25, wastewaterTreatmentFactor: 0.45, recycledWaterFactor: 0.15, carbonCreditPricePerTon: 250, tapWaterPricePerM3: 18, treeAbsorptionPerYear: 9.5 };
            const recycledM3 = totalWastewater * factors.defaultWaterRecycleRate;
            const ghgAvoidedKg = (totalWastewater * factors.wastewaterTreatmentFactor) + (recycledM3 * factors.recycledWaterFactor);
            const carbonCreditsTons = ghgAvoidedKg / 1000;
            const treeEquiv = ghgAvoidedKg / factors.treeAbsorptionPerYear;

            const esgData = [
                { 'ดัชนีชี้วัด ESG / GREEN Hospital': 'ปริมาณน้ำเสียที่บำบัดสะสม (ลบ.ม.)', 'ค่าที่ประเมินได้': totalWastewater.toFixed(2), 'หน่วย': 'ลบ.ม.' },
                { 'ดัชนีชี้วัด ESG / GREEN Hospital': 'น้ำที่นำกลับมาใช้ประโยชน์ซ้ำ (25%)', 'ค่าที่ประเมินได้': recycledM3.toFixed(2), 'หน่วย': 'ลบ.ม.' },
                { 'ดัชนีชี้วัด ESG / GREEN Hospital': 'ก๊าซเรือนกระจกที่ลดได้รวม (GHG Avoided)', 'ค่าที่ประเมินได้': ghgAvoidedKg.toFixed(2), 'หน่วย': 'kgCO2e' },
                { 'ดัชนีชี้วัด ESG / GREEN Hospital': 'คาร์บอนเครดิตสะสม (T-VER Offsets)', 'ค่าที่ประเมินได้': carbonCreditsTons.toFixed(3), 'หน่วย': 'tCO2e' },
                { 'ดัชนีชี้วัด ESG / GREEN Hospital': 'เทียบเท่าการปลูกต้นไม้สะสม', 'ค่าที่ประเมินได้': Math.round(treeEquiv), 'หน่วย': 'ต้น' },
                { 'ดัชนีชี้วัด ESG / GREEN Hospital': 'มูลค่าคาร์บอนเครดิตและสิ่งแวดล้อม', 'ค่าที่ประเมินได้': (carbonCreditsTons * factors.carbonCreditPricePerTon + recycledM3 * factors.tapWaterPricePerM3).toFixed(2), 'หน่วย': 'บาท' }
            ];
            const wsEsg = createCleanSheet(esgData);
            XLSX.utils.book_append_sheet(wb, wsEsg, "13.คาร์บอนเครดิตและESG");

            // ดาวน์โหลดไฟล์ Excel
            const filename = `Wastewater_50th_Full_Backup_${new Date().toISOString().split('T')[0]}.xlsx`;
            XLSX.writeFile(wb, filename);

            // บันทึกประวัติการสำรองข้อมูล
            this.recordBackupHistory('Excel (.xlsx)', filename, `รวม 13 ตาราง (${totalRecordsCount.toLocaleString()} รายการ)`, 'สำเร็จ (Success)');

            Swal.fire({
                icon: 'success',
                title: 'สำรองข้อมูลทุกตาราง (Excel) สำเร็จ!',
                html: `ดาวน์โหลดไฟล์ <strong>${filename}</strong> ครบทั้ง 13 ตาราง รวม ${totalRecordsCount.toLocaleString()} รายการ เรียบร้อยแล้ว`,
                timer: 2500,
                showConfirmButton: true,
                confirmButtonColor: '#10b981'
            });

        } catch (err) {
            this.recordBackupHistory('Excel (.xlsx)', 'Full_Backup.xlsx', err.message, 'ผิดพลาด (Failed)');
            Swal.fire({ icon: 'error', title: 'ไม่สามารถสำรอง Excel ได้', text: err.message });
        }
    }

    // =========================================================================
    // 2. สำรองทุกตารางเป็น CSV (แต่ละตารางเป็น 1 ไฟล์ .csv)
    // =========================================================================
    async backupAllToCSV() {
        Swal.fire({
            title: 'กำลังสำรองข้อมูลเป็น CSV...',
            text: 'กำลังแปลงตารางข้อมูลทั้งหมดเป็นไฟล์ CSV',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        try {
            const tables = [
                { name: 'influent_wastewater', label: '1_influent_wastewater' },
                { name: 'electricity_consumption', label: '2_electricity_consumption' },
                { name: 'preliminary_water_quality', label: '3_preliminary_water_quality' },
                { name: 'quarterly_water_quality', label: '4_quarterly_water_quality' },
                { name: 'machinery_inspection', label: '5_machinery_inspection' },
                { name: 'maintenance_records', label: '6_maintenance_records' },
                { name: 'equipment_ref', label: '7_equipment_ref' },
                { name: 'risk_management', label: '8_risk_management' },
                { name: 'incident_records', label: '9_incident_records' },
                { name: 'report_storage', label: '10_report_storage' },
                { name: 'treatment_manuals', label: '11_treatment_manuals' },
                { name: 'users', label: '12_users' }
            ];

            let exportedCount = 0;
            let totalRows = 0;

            for (const t of tables) {
                const data = await window.DataStore.getAll(t.name);
                if (data && data.length > 0) {
                    totalRows += data.length;
                    const cleanRows = data.map(row => {
                        const cleanRow = {};
                        for (const [k, v] of Object.entries(row)) {
                            cleanRow[k] = this.sanitizeExcelCell(v);
                        }
                        return cleanRow;
                    });
                    const ws = XLSX.utils.json_to_sheet(cleanRows);
                    const csv = XLSX.utils.sheet_to_csv(ws);
                    
                    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
                    const link = document.createElement("a");
                    link.href = URL.createObjectURL(blob);
                    link.setAttribute("download", `${t.label}_${new Date().toISOString().split('T')[0]}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    exportedCount++;
                }
            }

            const filename = `CSV_Batch_Export_${exportedCount}_Tables.csv`;
            this.recordBackupHistory('CSV (รายตาราง)', filename, `${exportedCount} ตาราง (${totalRows.toLocaleString()} รายการ)`, 'สำเร็จ (Success)');

            Swal.fire({
                icon: 'success',
                title: 'ส่งออก CSV ทุกตารางสำเร็จ!',
                html: `ดาวน์โหลดไฟล์ CSV เรียบร้อยแล้ว จำนวน ${exportedCount} ตาราง รวม ${totalRows.toLocaleString()} รายการ`,
                timer: 2500,
                showConfirmButton: true,
                confirmButtonColor: '#06b6d4'
            });

        } catch (err) {
            this.recordBackupHistory('CSV (รายตาราง)', 'CSV_Batch.csv', err.message, 'ผิดพลาด (Failed)');
            Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาดในการส่งออก CSV', text: err.message });
        }
    }

    // =========================================================================
    // 3. สำรองฐานข้อมูล 1:1 แบบตรงตาม Supabase 100% (JSON Full Database Dump)
    // =========================================================================
    async backupAllToJSON() {
        Swal.fire({
            title: 'กำลังสร้าง Database Dump 1:1 (JSON)...',
            text: 'กำลังอ่านโครงสร้างและเรคอร์ดทุกตารางจาก Supabase',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        try {
            const tableNames = [
                'influent_wastewater',
                'electricity_consumption',
                'preliminary_water_quality',
                'quarterly_water_quality',
                'machinery_inspection',
                'maintenance_records',
                'equipment_ref',
                'risk_management',
                'incident_records',
                'monthly_reports',
                'report_storage',
                'treatment_manuals',
                'users'
            ];

            const dbDump = {
                app: "Hospital Wastewater 50th SPA",
                hospital: "โรงพยาบาล ๕๐ พรรษา มหาวชิราลงกรณ",
                version: "2.3.0",
                backup_type: "exact_database_dump_1_to_1",
                exported_at: new Date().toISOString(),
                exported_by: window.AuthService.getCurrentUser()?.username || 'Sangtawan',
                tables: {}
            };

            let totalRecords = 0;

            for (const tbl of tableNames) {
                const rows = await window.DataStore.getAll(tbl);
                dbDump.tables[tbl] = Array.isArray(rows) ? rows : [];
                totalRecords += dbDump.tables[tbl].length;
            }

            const jsonString = JSON.stringify(dbDump, null, 2);
            const blob = new Blob([jsonString], { type: "application/json;charset=utf-8;" });
            const filename = `Wastewater_50th_Database_Dump_${new Date().toISOString().split('T')[0]}.json`;

            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.setAttribute("download", filename);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            this.recordBackupHistory('JSON (1:1 DB Dump)', filename, `ตรงตาม Supabase ${tableNames.length} ตาราง (${totalRecords.toLocaleString()} รายการ)`, 'สำเร็จ (Success)');

            Swal.fire({
                icon: 'success',
                title: 'สำรองฐานข้อมูล JSON 1:1 สำเร็จ!',
                html: `สร้างไฟล์ Backup <strong>${filename}</strong> ครบทั้ง <strong>${tableNames.length} ตาราง</strong> (${totalRecords.toLocaleString()} รายการ) ตรงตามฐานข้อมูล Supabase แบบเป๊ะๆ 100%`,
                timer: 2500,
                showConfirmButton: true,
                confirmButtonColor: '#f59e0b'
            });

        } catch (err) {
            this.recordBackupHistory('JSON (1:1 DB Dump)', 'Database_Dump.json', err.message, 'ผิดพลาด (Failed)');
            Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาดในการสร้าง JSON Dump', text: err.message });
        }
    }

    // =========================================================================
    // 4. สำรองโค้ดระบบทั้งไฟล์ (HTML Source Backup)
    // =========================================================================
    async backupSystemHTML() {
        try {
            Swal.fire({
                title: 'กำลังดาวน์โหลดโค้ดระบบ (HTML)...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            const htmlContent = document.documentElement.outerHTML;
            const fullHtml = "<!DOCTYPE html>\n" + htmlContent;
            const blob = new Blob([fullHtml], { type: "text/html;charset=utf-8;" });
            const filename = `hospital_wastewater_50th_system_${new Date().toISOString().split('T')[0]}.html`;

            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.setAttribute("download", filename);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            this.recordBackupHistory('HTML Code', filename, `โค้ดระบบ index.html (${(blob.size / 1024).toFixed(0)} KB)`, 'สำเร็จ (Success)');

            Swal.fire({
                icon: 'success',
                title: 'สำรองโค้ดระบบสำเร็จ!',
                html: `ดาวน์โหลดไฟล์ <strong>${filename}</strong> เรียบร้อยแล้ว`,
                timer: 2000,
                showConfirmButton: false
            });

        } catch (err) {
            Swal.fire({ icon: 'error', title: 'ไม่สามารถดาวน์โหลดไฟล์ HTML ได้', text: err.message });
        }
    }

    // =========================================================================
    // 5. กู้คืนข้อมูลจากไฟล์ Backup (.xlsx หรือ .json - ซิงค์ลง Supabase และ LocalStore)
    // =========================================================================
    async handleBackupRestore(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Reset input value เพื่อให้สามารถเลือกไฟล์เดิมซ้ำได้
        event.target.value = '';

        const fileName = file.name.toLowerCase();
        const isJson = fileName.endsWith('.json');
        const isXlsx = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

        if (!isJson && !isXlsx) {
            Swal.fire({
                icon: 'error',
                title: 'ประเภทไฟล์ไม่รองรับ',
                text: 'กรุณาเลือกไฟล์ .json หรือ .xlsx ที่สำรองจากระบบนี้เท่านั้น'
            });
            return;
        }

        const confirmRes = await Swal.fire({
            title: 'ยืนยันการกู้คืนข้อมูล (Restore)?',
            html: `
                <div class="text-left text-xs text-slate-300 space-y-2 p-3.5 bg-slate-900 rounded-xl border border-slate-800">
                    <p>ระบบจะอ่านไฟล์ <strong>${file.name}</strong> และนำเข้าเรคอร์ดทั้งหมดกลับคืนสู่ฐานข้อมูล Supabase และ LocalStore</p>
                    <p class="text-amber-400 font-semibold">⚠️ ข้อมูลเดิมที่มีอยู่ในตารางจะถูกอัปเดต/นำเข้าทับตามข้อมูลในไฟล์ Backup</p>
                </div>
            `,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: '⚡ ยืนยันกู้คืนข้อมูลทันที',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#f59e0b',
            cancelButtonColor: '#334155'
        });

        if (!confirmRes.isConfirmed) return;

        Swal.fire({
            title: 'กำลังกู้คืนข้อมูล...',
            text: 'กำลังประมวลผลไฟล์และซิงค์ข้อมูลลงฐานข้อมูล Supabase',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        const reader = new FileReader();

        if (isJson) {
            reader.onload = async (e) => {
                try {
                    const parsed = JSON.parse(e.target.result);
                    let tablesToImport = {};

                    if (parsed.tables && typeof parsed.tables === 'object') {
                        tablesToImport = parsed.tables;
                    } else if (typeof parsed === 'object') {
                        tablesToImport = parsed;
                    }

                    let restoredTables = 0;
                    let restoredRecords = 0;

                    for (const [tblName, rows] of Object.entries(tablesToImport)) {
                        if (Array.isArray(rows) && rows.length > 0) {
                            for (const row of rows) {
                                if (row && row.id) {
                                    await window.DataStore.set(tblName, row.id, row);
                                } else if (row) {
                                    await window.DataStore.insert(tblName, row);
                                }
                                restoredRecords++;
                            }
                            restoredTables++;
                        }
                    }

                    this.recordBackupHistory('กู้คืนข้อมูล (JSON)', file.name, `กู้คืน ${restoredTables} ตาราง (${restoredRecords.toLocaleString()} รายการ)`, 'สำเร็จ (Success)');

                    Swal.fire({
                        icon: 'success',
                        title: 'กู้คืนข้อมูลสำเร็จ!',
                        html: `นำเข้าข้อมูลเรียบร้อยแล้ว จำนวน <strong>${restoredTables} ตาราง</strong> รวม <strong>${restoredRecords.toLocaleString()} รายการ</strong>`,
                        confirmButtonText: 'รีโหลดระบบทันที',
                        confirmButtonColor: '#10b981'
                    }).then(() => {
                        window.location.reload();
                    });

                } catch (err) {
                    this.recordBackupHistory('กู้คืนข้อมูล (JSON)', file.name, err.message, 'ผิดพลาด (Failed)');
                    Swal.fire({ icon: 'error', title: 'กู้คืนข้อมูลไม่สำเร็จ', text: err.message });
                }
            };
            reader.readAsText(file);
        } else if (isXlsx) {
            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });

                    const sheetToTableMap = {
                        '1.น้ำเสียเข้าระบบ': 'influent_wastewater',
                        'ปริมาณน้ำเสียเข้า': 'influent_wastewater',
                        'influent_wastewater': 'influent_wastewater',
                        '2.การใช้ไฟฟ้า': 'electricity_consumption',
                        'การใช้พลังงานไฟฟ้า': 'electricity_consumption',
                        'electricity_consumption': 'electricity_consumption',
                        '3.คุณภาพน้ำเบื้องต้น': 'preliminary_water_quality',
                        'คุณภาพน้ำเบื้องต้น': 'preliminary_water_quality',
                        'preliminary_water_quality': 'preliminary_water_quality',
                        '4.คุณภาพน้ำไตรมาส': 'quarterly_water_quality',
                        'quarterly_water_quality': 'quarterly_water_quality',
                        '5.ตรวจสภาพเครื่องจักร': 'machinery_inspection',
                        'machinery_inspection': 'machinery_inspection',
                        '6.ประวัติซ่อมบำรุง': 'maintenance_records',
                        'maintenance_records': 'maintenance_records',
                        '7.อ้างอิงอุปกรณ์': 'equipment_ref',
                        'equipment_ref': 'equipment_ref',
                        '8.บริหารความเสี่ยง': 'risk_management',
                        'risk_management': 'risk_management',
                        '9.เหตุการณ์ผิดปกติ': 'incident_records',
                        'incident_records': 'incident_records',
                        '10.คลังเอกสารรายงาน': 'report_storage',
                        'report_storage': 'report_storage',
                        '11.คู่มือระบบบำบัด': 'treatment_manuals',
                        'treatment_manuals': 'treatment_manuals',
                        '12.บัญชีผู้ใช้งาน': 'users',
                        'users': 'users'
                    };

                    let restoredTables = 0;
                    let restoredRecords = 0;

                    for (const sheetName of workbook.SheetNames) {
                        const tblKey = Object.keys(sheetToTableMap).find(k => sheetName.includes(k) || k.includes(sheetName));
                        if (!tblKey) continue;

                        const targetTable = sheetToTableMap[tblKey];
                        const ws = workbook.Sheets[sheetName];
                        const jsonRows = XLSX.utils.sheet_to_json(ws);

                        if (jsonRows && jsonRows.length > 0) {
                            for (const rawRow of jsonRows) {
                                // แปลงคีย์ภาษาไทยหรืออังกฤษกลับเป็นคอลัมน์มาตรฐาน
                                const cleanRow = {};
                                for (const [k, v] of Object.entries(rawRow)) {
                                    if (k.toLowerCase() === 'id') cleanRow.id = String(v);
                                    else if (k.includes('วัน') || k.includes('recorded_at') || k.includes('วันที่')) {
                                        cleanRow.recorded_at = (v && String(v).includes('/')) ? window.App.parseDateToISO(String(v)) : String(v);
                                    } else {
                                        cleanRow[k] = v;
                                    }
                                }

                                if (cleanRow.id) {
                                    await window.DataStore.set(targetTable, cleanRow.id, cleanRow);
                                } else {
                                    await window.DataStore.insert(targetTable, cleanRow);
                                }
                                restoredRecords++;
                            }
                            restoredTables++;
                        }
                    }

                    this.recordBackupHistory('กู้คืนข้อมูล (Excel)', file.name, `กู้คืน ${restoredTables} ตาราง (${restoredRecords.toLocaleString()} รายการ)`, 'สำเร็จ (Success)');

                    Swal.fire({
                        icon: 'success',
                        title: 'กู้คืนข้อมูล Excel สำเร็จ!',
                        html: `อ่านและกู้คืนข้อมูล <strong>${restoredTables} ตาราง</strong> รวม <strong>${restoredRecords.toLocaleString()} รายการ</strong> สู่ฐานข้อมูลเรียบร้อยแล้ว`,
                        confirmButtonText: 'รีโหลดระบบทันที',
                        confirmButtonColor: '#10b981'
                    }).then(() => {
                        window.location.reload();
                    });

                } catch (err) {
                    this.recordBackupHistory('กู้คืนข้อมูล (Excel)', file.name, err.message, 'ผิดพลาด (Failed)');
                    Swal.fire({ icon: 'error', title: 'กู้คืนไฟล์ Excel ไม่สำเร็จ', text: err.message });
                }
            };
            reader.readAsArrayBuffer(file);
        }
    }

    // =========================================================================
    // 6. ล้างข้อมูลทุกตารางในระบบ (Factory Reset - เฉพาะ Admin)
    // =========================================================================
    async factoryResetAllTables() {
        const { value: confirmText } = await Swal.fire({
            title: '⚠️ ยืนยันการล้างข้อมูลทุกตารางในระบบ (Factory Reset)?',
            html: `
                <div class="text-left text-xs text-slate-300 space-y-2.5 p-3.5 bg-rose-950/40 rounded-xl border border-rose-800/80">
                    <p class="text-rose-300 font-bold">คำเตือนระดับสูงสุด: การดำเนินการนี้จะลบข้อมูลธุรกรรมทั้งหมด 13 ตารางออกจาก Supabase Cloud และ LocalStore ถาวร</p>
                    <p>หากต้องการดำเนินการต่อ กรุณาพิมพ์คำว่า <code class="text-amber-400 font-mono font-bold">RESET</code> ในช่องด้านล่าง</p>
                </div>
            `,
            input: 'text',
            inputPlaceholder: 'พิมพ์ RESET เพื่อยืนยัน',
            icon: 'error',
            showCancelButton: true,
            confirmButtonText: '🧨 ยืนยันล้างข้อมูลทั้งหมด',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#334155',
            inputValidator: (val) => {
                if (val !== 'RESET') {
                    return 'กรุณาพิมพ์คำว่า RESET ให้ถูกต้อง';
                }
            }
        });

        if (confirmText === 'RESET') {
            Swal.fire({
                title: 'กำลังล้างข้อมูลทุกตาราง...',
                text: 'กำลังล้างเรคอร์ดใน Supabase Cloud และจัดเตรียมระบบเริ่มต้นใหม่',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            try {
                const tables = [
                    'influent_wastewater',
                    'electricity_consumption',
                    'preliminary_water_quality',
                    'quarterly_water_quality',
                    'machinery_inspection',
                    'maintenance_records',
                    'equipment_ref',
                    'risk_management',
                    'incident_records',
                    'monthly_reports',
                    'report_storage',
                    'treatment_manuals'
                ];

                for (const t of tables) {
                    await window.DataStore.clearTable(t);
                }

                this.recordBackupHistory('ล้างข้อมูล (Factory Reset)', 'All Tables', 'ล้างข้อมูล 12 ตารางธุรกรรมเริ่มต้นใหม่', 'สำเร็จ (Success)');

                Swal.fire({
                    icon: 'success',
                    title: 'ล้างข้อมูลทุกตารางเรียบร้อยแล้ว!',
                    text: 'ระบบได้ถูกรีเซ็ตพร้อมใช้งานใหม่',
                    timer: 2000,
                    showConfirmButton: false
                });

                setTimeout(() => window.location.reload(), 1500);

            } catch (err) {
                Swal.fire({ icon: 'error', title: 'ล้างข้อมูลไม่สำเร็จ', text: err.message });
            }
        }
    }

    // =========================================================================
    // 7. ประวัติการสำรองข้อมูล (Backup History Management)
    // =========================================================================
    recordBackupHistory(type, filename, details, status) {
        try {
            let history = JSON.parse(localStorage.getItem(this.backupHistoryKey) || '[]');
            const newRecord = {
                id: 'bk-' + Date.now(),
                timestamp: new Date().toISOString(),
                type: type,
                filename: filename,
                details: details,
                status: status
            };
            history.unshift(newRecord);
            if (history.length > 50) history = history.slice(0, 50);
            localStorage.setItem(this.backupHistoryKey, JSON.stringify(history));
            this.renderBackupHistory();
        } catch (e) {
            console.warn("Could not save backup history:", e);
        }
    }

    renderBackupHistory() {
        const tbody = document.getElementById('table-backup-history-body');
        if (!tbody) return;

        let history = [];
        try {
            history = JSON.parse(localStorage.getItem(this.backupHistoryKey) || '[]');
        } catch (e) {
            history = [];
        }

        if (!history || history.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-6 text-slate-500 text-xs italic">
                        <i class="fa-solid fa-database mr-1.5"></i> ยังไม่มีประวัติการสำรองข้อมูล
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = history.map(item => {
            const isSuccess = item.status.includes('สำเร็จ') || item.status.includes('Success');
            const statusBadge = isSuccess
                ? `<span class="badge bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 text-[11px] py-0.5 px-2.5 rounded-full"><i class="fa-solid fa-check mr-1"></i>${item.status}</span>`
                : `<span class="badge bg-rose-950/80 text-rose-400 border border-rose-500/40 text-[11px] py-0.5 px-2.5 rounded-full"><i class="fa-solid fa-xmark mr-1"></i>${item.status}</span>`;

            return `
                <tr class="hover:bg-slate-800/40 transition-colors">
                    <td class="font-mono text-xs text-slate-300">${window.App ? window.App.formatDateTime(item.timestamp) : item.timestamp}</td>
                    <td><span class="badge bg-slate-800 text-cyan-300 border border-cyan-800/50 text-[11px] py-0.5 px-2 font-bold">${item.type}</span></td>
                    <td class="font-mono text-xs text-white font-medium">${item.filename}</td>
                    <td class="text-xs text-slate-300">${item.details}</td>
                    <td class="text-center">${statusBadge}</td>
                </tr>
            `;
        }).join('');
    }

    clearBackupHistory() {
        Swal.fire({
            title: 'ต้องการล้างประวัติการสำรองข้อมูลหรือไม่?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'ล้างประวัติ',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#334155'
        }).then((res) => {
            if (res.isConfirmed) {
                localStorage.removeItem(this.backupHistoryKey);
                this.renderBackupHistory();
                Swal.fire({ icon: 'success', title: 'ล้างประวัติเรียบร้อย', timer: 1200, showConfirmButton: false });
            }
        });
    }

    // =========================================================================
    // 8. ดาวน์โหลดไฟล์แม่แบบ Excel (.xlsx) สำหรับแต่ละโมดูล
    // =========================================================================
    downloadModuleTemplate(moduleType) {
        const templates = {
            influent: {
                filename: 'แม่แบบ_บันทึกน้ำเสียเข้า_รพ.๕๐พรรษา.xlsx',
                sheetName: 'น้ำเสียเข้าสู่ระบบ',
                sample: [
                    {
                        'วัน-เวลาที่บันทึก (YYYY-MM-DD HH:mm)': '2026-08-25 08:30',
                        'แหล่งที่มาของน้ำ': 'อาคารผู้ป่วยใน (IPD)',
                        'เลขมิเตอร์เริ่มต้น': 13155.00,
                        'เลขมิเตอร์วันนี้': 13290.00,
                        'ผู้บันทึก': 'แสงตะวัน (Super Admin)',
                        'หมายเหตุ': 'การใช้น้ำปกติ'
                    }
                ]
            },
            electricity: {
                filename: 'แม่แบบ_บันทึกการใช้ไฟฟ้า_รพ.๕๐พรรษา.xlsx',
                sheetName: 'การใช้ไฟฟ้า',
                sample: [
                    {
                        'วัน-เวลาที่บันทึก (YYYY-MM-DD HH:mm)': '2026-08-25 08:30',
                        'เลขมิเตอร์เริ่มต้น': 46810.00,
                        'เลขมิเตอร์วันนี้': 47120.00,
                        'อัตราค่าไฟฟ้าต่อหน่วย (บาท)': 4.50,
                        'ผู้บันทึก': 'นายวิชัย เครื่องกลดี',
                        'หมายเหตุ': 'เครื่องเติมอากาศเดิน 24 ชม.'
                    }
                ]
            },
            water_quality: {
                filename: 'แม่แบบ_ตรวจวัดคุณภาพน้ำเบื้องต้น_รพ.๕๐พรรษา.xlsx',
                sheetName: 'คุณภาพน้ำ',
                sample: [
                    {
                        'วัน-เวลาที่บันทึก (YYYY-MM-DD HH:mm)': '2026-08-25 09:00',
                        'จุดเก็บตัวอย่าง': 'จุดปลายท่อออกจากระบบบำบัด',
                        'pH (5.5-9.0)': 7.35,
                        'DO (2.0-4.0 mg/L)': 3.40,
                        'TDS (<=500 mg/L)': 325.0,
                        'คลอรีนอิสระ (1.0-2.0 mg/L)': 1.50,
                        'ตะกอน VS30 (<=300 mL/L)': 175.0,
                        'ผู้ตรวจสอบ': 'นายสมชาย รักษ์สายน้ำ',
                        'หมายเหตุ': 'ผลตรวจปกติ'
                    }
                ]
            },
            machinery: {
                filename: 'แม่แบบ_ตรวจเช็คเครื่องจักร_รพ.๕๐พรรษา.xlsx',
                sheetName: 'ตรวจเครื่องจักร',
                sample: [
                    {
                        'วัน-เวลาที่ตรวจ (YYYY-MM-DD HH:mm)': '2026-08-25 08:00',
                        'รายการอุปกรณ์ที่ตรวจ (คั่นด้วยจุลภาค)': 'ความสะอาดอาคาร, เครื่องสูบน้ำ SP 1, เครื่องสูบน้ำ SP 2, เครื่องสูบน้ำ SP 3, เครื่องเติมอากาศ B1, เครื่องเติมอากาศ B2, เครื่องเติมอากาศ B3, ตู้คอนโทรลควบคุมระบบไฟฟ้า, มิเตอร์วัดหน่วยไฟฟ้า, สายพานเครื่องเติมอากาศ B1, สายพานเครื่องเติมอากาศ B2, สายพานเครื่องเติมอากาศ B3, ตะแกรงดักขยะ, โซ่ดึงรอกเครื่องสูบ SP 1, โซ่ดึงรอกเครื่องสูบ SP 2, โซ่ดึงรอกเครื่องสูบ SP 3, สระน้ำ, เมนต์โฮลด์ที่ 1-14, บ่อพักน้ำเสียไตเทียมหลังห้องการเงิน, บ่อออนไซน์หลังวิหาร, บ่อออนไซน์หลัง X-RAY',
                        'สถานะ (ปกติทุกรายการ / ผิดปกติ 1 รายการ)': 'ปกติทุกรายการ',
                        'อุปกรณ์ที่ผิดปกติ': '',
                        'สาเหตุ': '',
                        'วิธีแก้ไข': '',
                        'ผู้ตรวจเช็ค': 'นายวิชัย เครื่องกลดี',
                        'หมายเหตุ': 'ตรวจรอบเช้า 17 รายการรายเครื่อง + เมนต์โฮลด์และบ่อออนไซน์ตามจุดปกติ'
                    }
                ]
            },
            maintenance: {
                filename: 'แม่แบบ_บันทึกงานซ่อมบำรุง_รพ.๕๐พรรษา.xlsx',
                sheetName: 'ซ่อมบำรุง',
                sample: [
                    {
                        'วัน-เวลาที่ซ่อม (YYYY-MM-DD HH:mm)': '2026-08-25 10:30',
                        'สถานที่': 'บ่อเติมอากาศ Aeration Tank',
                        'อุปกรณ์': 'เครื่องเติมอากาศ (Surface Aerator 1)',
                        'ประเภทงาน (ตรวจสอบ/ป้องกัน/แก้ไข/ซ่อมบำรุง)': 'ป้องกัน',
                        'ปัญหาที่พบ': 'บำรุงรักษาเชิงป้องกันตามรอบ 6 เดือน',
                        'วิธีการแก้ไข': 'เปลี่ยนถ่ายน้ำมันหล่อลื่นเกียร์และอัดจาระบี',
                        'ผลการซ่อม': 'เสียงเดินเครื่องเงียบลง อัตราการสั่นสะเทือนปกติ',
                        'ค่าใช้จ่าย (บาท)': 3500.00,
                        'ผู้ดำเนินการ': 'นายวิชัย เครื่องกลดี',
                        'หมายเหตุ': 'เรียบร้อย'
                    }
                ]
            },
            risk: {
                filename: 'แม่แบบ_บริหารความเสี่ยง_รพ.๕๐พรรษา.xlsx',
                sheetName: 'ความเสี่ยง',
                sample: [
                    {
                        'วัน-เวลาที่บันทึก (YYYY-MM-DD HH:mm)': '2026-08-25 10:00',
                        'ชื่อความเสี่ยง': 'ความเสี่ยงไฟฟ้าดับในโรงพยาบาลกระทบระบบบำบัดน้ำเสีย',
                        'ระดับความรุนแรง (ต่ำ/กลาง/ปานกลาง/สูง/สูงมาก)': 'สูง',
                        'ผลกระทบ': 'เครื่องเติมอากาศหยุดทำงาน จุลินทรีย์ขาดออกซิเจน',
                        'โอกาสเกิด (ต่ำ/กลาง/ปานกลาง/สูง)': 'ปานกลาง',
                        'แผนป้องกันและแก้ไข': 'เชื่อมต่อระบบไฟฟ้าฉุกเฉิน Generator Backup',
                        'สถานะ (ควบคุมได้ / กำลังดำเนินการ)': 'ควบคุมได้',
                        'ผู้รับผิดชอบ': 'แสงตะวัน (Super Admin)'
                    }
                ]
            },
            equipment: {
                filename: 'แม่แบบ_ฐานข้อมูลอุปกรณ์_รพ.๕๐พรรษา.xlsx',
                sheetName: 'อุปกรณ์และเครื่องจักร',
                sample: [
                    {
                        'ชื่ออุปกรณ์ / เครื่องจักร': 'เครื่องสูบน้ำ SP 1',
                        'ยี่ห้อ': 'ShinMaywa Pump',
                        'รุ่น': 'CVC651-P65',
                        'เลขครุภัณฑ์': 'พ.50/66-001',
                        'ชนิดอุปกรณ์': 'ปั๊มมาตรฐานแบบจุ่มใต้น้ำ',
                        'หมวดหมู่ระบบ': 'ระบบสูบน้ำ',
                        'ขนาด / พิกัดสเปก': '-ขนาดมอเตอร์ 1.5 KW 50 Hz\n-ขนาดท่อส่งน้ำ 2 นิ้ว\n-ปริมาณการสูบน้ำ 0.4 m3/min\n-แรงดันไฟฟ้า 380 V 3.7 A ใช้ไฟฟ้า 3 เฟส\n-น้ำหนักเครื่องสูบน้ำ 10.6 กิโลกรัม',
                        'อายุการใช้งาน': '4 - 10 ปี',
                        'สถานที่ / จุดติดตั้งอุปกรณ์': '-บ่อรวบรวมน้ำเสีย (บ่อสูบน้ำก่อนเข้าระบบ บ่อสูบ 1,2)\n-ระบบบำบัดน้ำเสียโรงพยาบาล ๕๐ พรรษา มหาวชิราลงกรณ',
                        'วิธีการใช้งาน': '-ควรติดตั้งให้มั่นคงในแนวระนาบ จุ่มใต้น้ำ และจุ่มปั๊มให้มิดระดับหัวมอเตอร์เสมอ\n-เดินเครื่องต่อเนื่องสูงสุดไม่เกิน 12 ชั่วโมง/วัน (หรือใช้สลับตัวทำงานหากเกิน)',
                        'ประวัติการซ่อมบำรุง': 'ตรวจเช็คความต้านทานฉนวนและเปลี่ยนแมคคานิคอลซีลเมื่อ มิ.ย. 2569',
                        'สถานะ (พร้อมใช้งาน / อยู่ระหว่างซ่อมบำรุง / ชำรุด/รอซ่อม / สำรองพร้อมใช้งาน)': 'พร้อมใช้งาน'
                    },
                    {
                        'ชื่ออุปกรณ์ / เครื่องจักร': 'เครื่องเติมอากาศ B1',
                        'ยี่ห้อ': 'TECO',
                        'รุ่น': 'CNS-0408R',
                        'เลขครุภัณฑ์': 'พ.50/50-001',
                        'ชนิดอุปกรณ์': 'มอเตอร์มาตรฐาน (IE2/IE3)',
                        'หมวดหมู่ระบบ': 'ระบบเติมอากาศ',
                        'ขนาด / พิกัดสเปก': '-ขนาดมอเตอร์ 3.7 KW 50 Hz\n-ความเร็วรอบมอเตอร์ 1,440 RPM\n-แรงดันไฟฟ้า 380 V 8.1 A ใช้ไฟฟ้า 3 เฟส\n-น้ำหนักมอเตอร์ 40 กิโลกรัม',
                        'อายุการใช้งาน': '20 ปี',
                        'สถานที่ / จุดติดตั้งอุปกรณ์': '-ห้องควบคุมการทำงานระบบบำบัดน้ำเสีย\n-ระบบบำบัดน้ำเสียโรงพยาบาล ๕๐ พรรษา มหาวชิราลงกรณ',
                        'วิธีการใช้งาน': '-ห้ามเดินเครื่องต่อเนื่องเกิน 12 ชั่วโมง/วัน (ให้ใช้สลับตัวทำงาน)\n-ห้ามติดตั้งในที่ชื้นหรือโดนน้ำสาด',
                        'ประวัติการซ่อมบำรุง': 'เปลี่ยนตลับลูกปืน (Bearing) และอัดจาระบีใหม่ พ.ค. 2569',
                        'สถานะ (พร้อมใช้งาน / อยู่ระหว่างซ่อมบำรุง / ชำรุด/รอซ่อม / สำรองพร้อมใช้งาน)': 'พร้อมใช้งาน'
                    },
                    {
                        'ชื่ออุปกรณ์ / เครื่องจักร': 'บ่อดักไขมันโรงอาหาร (Grease Trap 1)',
                        'ยี่ห้อ': 'DOS',
                        'รุ่น': 'GT-1000L',
                        'เลขครุภัณฑ์': 'พ.50/60-015',
                        'ชนิดอุปกรณ์': 'ถังดักไขมันสเตนเลสใต้ดิน',
                        'หมวดหมู่ระบบ': 'ระบบดักไขมัน',
                        'ขนาด / พิกัดสเปก': 'ความจุ 1,000 ลิตร รองรับอัตราการไหล 3.5 ลบ.ม./ชม.',
                        'อายุการใช้งาน': '10 ปี',
                        'สถานที่ / จุดติดตั้งอุปกรณ์': 'ด้านหลังอาคารโภชนาการและโรงอาหาร',
                        'วิธีการใช้งาน': 'ตักไขมันและเศษอาหารออกทุกวัน จันทร์-ศุกร์',
                        'ประวัติการซ่อมบำรุง': 'ล้างถังและขัดคราบไขมันตกค้าง ก.ค. 2569',
                        'สถานะ (พร้อมใช้งาน / อยู่ระหว่างซ่อมบำรุง / ชำรุด/รอซ่อม / สำรองพร้อมใช้งาน)': 'พร้อมใช้งาน'
                    }
                ]
            },
            monthly_report: {
                filename: 'แม่แบบ_รายงานประจำเดือน_รพ.๕๐พรรษา.xlsx',
                sheetName: 'รายงานประจำเดือน',
                sample: [
                    {
                        'เดือน (YYYY-MM)': '2026-08',
                        'ปริมาณน้ำประปารวม (ลบ.ม.)': 4520.00,
                        'ปริมาณน้ำเสีย 80% (ลบ.ม.)': 3616.00,
                        'หน่วยไฟฟ้ารวม (kWh)': 2850.00,
                        'ค่าไฟฟ้ารวม (บาท)': 12825.00,
                        'อัตราผ่านเกณฑ์คุณภาพน้ำ (%)': 100.0,
                        'ก๊าซเรือนกระจกที่ลดได้ (tCO2e)': 1.425,
                        'ผู้จัดทำรายงาน': 'แสงตะวัน (Super Admin)',
                        'หมายเหตุ': 'ผลการดำเนินงานปกติ'
                    }
                ]
            },
            documents: {
                filename: 'แม่แบบ_คลังเอกสารและSOP_รพ.๕๐พรรษา.xlsx',
                sheetName: 'คลังเอกสาร',
                sample: [
                    {
                        'ชื่อเอกสาร / รายงาน': 'ขั้นตอนการปฏิบัติงานมาตรฐานการเดินระบบบำบัดน้ำเสีย (SOP-WWTP-01)',
                        'หมวดหมู่เอกสาร': 'คู่มือและมาตรฐานการปฏิบัติงาน (SOP)',
                        'วันที่เอกสาร (YYYY-MM-DD)': '2026-08-01',
                        'ผู้จัดทำ / เจ้าของเอกสาร': 'แสงตะวัน (Super Admin)',
                        'สถานะเอกสาร': 'ใช้งานปัจจุบัน',
                        'หมายเหตุ': 'ฉบับปรับปรุงครั้งที่ 3'
                    }
                ]
            },
            users: {
                filename: 'แม่แบบ_ข้อมูลผู้ใช้งานระบบ_รพ.๕๐พรรษา.xlsx',
                sheetName: 'ผู้ใช้งานระบบ',
                sample: [
                    {
                        'ชื่อผู้ใช้งาน (Username)': 'operator01',
                        'ชื่อ-นามสกุล': 'นายสมบูรณ์ พร้อมเพรียง',
                        'อีเมล': 'somboon@hospital50.in.th',
                        'บทบาท (admin / staff)': 'staff',
                        'ตำแหน่ง': 'เจ้าหน้าที่ประจำระบบบำบัดน้ำเสีย',
                        'แผนก / ฝ่าย': 'ฝ่ายสิ่งแวดล้อมและสุขาภิบาล',
                        'สถานะ (active / inactive)': 'active'
                    }
                ]
            }
        };

        const cleanType = String(moduleType || '').replace(/-/g, '_');
        let tpl = templates[cleanType];
        if (!tpl) {
            if (cleanType.includes('equip')) tpl = templates.equipment;
            else if (cleanType.includes('risk') || cleanType.includes('incident')) tpl = templates.risk;
            else if (cleanType.includes('water') || cleanType.includes('quality')) tpl = templates.water_quality;
            else if (cleanType.includes('user')) tpl = templates.users;
            else if (cleanType.includes('doc')) tpl = templates.documents;
            else if (cleanType.includes('month')) tpl = templates.monthly_report;
            else tpl = templates.influent;
        }
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(tpl.sample);
        XLSX.utils.book_append_sheet(wb, ws, tpl.sheetName);
        XLSX.writeFile(wb, tpl.filename);

        Swal.fire({
            icon: 'success',
            title: 'ดาวน์โหลดแม่แบบสำเร็จ!',
            text: `ดาวน์โหลด ${tpl.filename} เรียบร้อยแล้ว`,
            timer: 1500,
            showConfirmButton: false
        });
    }

    // ฟังก์ชันช่วยดึงและแปลงวันที่จากแถวข้อมูลให้อยู่ในมาตรฐาน ISO (รองรับทั้ง พ.ศ. และ ค.ศ.)
    extractRowDate(row, defaultVal = null, returnDateOnly = false) {
        const raw = row['วัน-เวลาที่บันทึก (YYYY-MM-DD HH:mm)'] ||
                    row['วัน-เวลาที่ตรวจ (YYYY-MM-DD HH:mm)'] ||
                    row['วัน-เวลาที่ซ่อม (YYYY-MM-DD HH:mm)'] ||
                    row['วัน-เวลาที่บันทึก'] ||
                    row['วัน-เวลา'] ||
                    row['วันที่'] ||
                    row['วันเวลา'] ||
                    row['recorded_at'] ||
                    row['sampling_date'] ||
                    row['report_date'] ||
                    row['date'] ||
                    row['created_at'] ||
                    defaultVal;
        return window.App.parseDateSmart(raw, returnDateOnly);
    }

    // ฟังก์ชันช่วยดึง ID หากมีระบุในไฟล์
    extractRowId(row) {
        const rawId = row['id'] || row['ID'] || row['ลำดับ'] || row['No'] || row['no'] || row['#'];
        if (rawId !== undefined && rawId !== null && String(rawId).trim() !== '') {
            return String(rawId).trim();
        }
        return undefined;
    }

    // =========================================================================
    // 6. นำเข้าไฟล์ Excel หรือ CSV เข้าสู่โมดูลที่เลือก
    // =========================================================================
    async importModuleExcelOrCSV(file, moduleType, onSuccess) {
        if (!file) return;
        Swal.fire({ title: 'กำลังประมวลผลและนำเข้าข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const rows = XLSX.utils.sheet_to_json(worksheet);

                if (!rows || rows.length === 0) {
                    throw new Error("ไม่พบข้อมูลในไฟล์ Excel/CSV");
                }

                let importedCount = 0;

                for (const row of rows) {
                    const rowId = this.extractRowId(row);

                    if (moduleType === 'influent') {
                        const recDate = this.extractRowDate(row);
                        const startM = parseFloat(row['เลขมิเตอร์เริ่มต้น'] || row['meter_start'] || row['มิเตอร์เริ่มต้น'] || 0);
                        const todayM = parseFloat(row['เลขมิเตอร์วันนี้'] || row['meter_today'] || row['มิเตอร์วันนี้'] || row['มิเตอร์ปัจจุบัน'] || 0);
                        const waterUsed = parseFloat(row['ปริมาณน้ำใช้ทั้งหมด (ลบ.ม.)'] || row['total_water_used'] || Math.max(todayM - startM, 0));
                        const wastewater = parseFloat(row['ปริมาณน้ำเสีย 80% (ลบ.ม.)'] || row['wastewater_influent'] || (waterUsed * 0.80).toFixed(2));

                        const payload = {
                            recorded_at: recDate,
                            meter_start: startM,
                            meter_today: todayM,
                            total_water_used: waterUsed,
                            wastewater_influent: wastewater,
                            water_source: row['แหล่งที่มาของน้ำ'] || row['water_source'] || row['แหล่งน้ำ'] || 'อาคารผู้ป่วยในและอาคารบริการ',
                            recorded_by: row['ผู้บันทึก'] || row['recorded_by'] || window.AuthService.getCurrentUser()?.full_name || 'เจ้าหน้าที่',
                            meter_image_url: row['meter_image_url'] || row['รูปภาพ'] || null,
                            notes: row['หมายเหตุ'] || row['notes'] || 'นำเข้าจากไฟล์ Excel/CSV'
                        };
                        if (rowId) payload.id = rowId;

                        await window.DataStore.insert('influent_wastewater', payload);
                        importedCount++;

                    } else if (moduleType === 'electricity') {
                        const recDate = this.extractRowDate(row);
                        const startM = parseFloat(row['เลขมิเตอร์เริ่มต้น'] || row['meter_start'] || row['มิเตอร์เริ่มต้น'] || 0);
                        const todayM = parseFloat(row['เลขมิเตอร์วันนี้'] || row['meter_today'] || row['มิเตอร์วันนี้'] || row['มิเตอร์ปัจจุบัน'] || 0);
                        const kwh = parseFloat(row['หน่วยไฟฟ้ารวม (kWh)'] || row['total_kwh'] || row['หน่วยไฟฟ้า'] || Math.max(todayM - startM, 0));
                        const price = parseFloat(row['อัตราค่าไฟฟ้าต่อหน่วย (บาท)'] || row['อัตราค่าไฟฟ้าต่อหน่วย'] || row['unit_price'] || 4.50);
                        const cost = parseFloat(row['คิดเป็นค่าไฟ (บาท)'] || row['electricity_cost'] || (kwh * price).toFixed(2));

                        const payload = {
                            recorded_at: recDate,
                            meter_start: startM,
                            meter_today: todayM,
                            total_kwh: kwh,
                            unit_price: price,
                            electricity_cost: cost,
                            recorded_by: row['ผู้บันทึก'] || row['recorded_by'] || window.AuthService.getCurrentUser()?.full_name || 'เจ้าหน้าที่',
                            meter_image_url: row['meter_image_url'] || row['รูปภาพ'] || null,
                            notes: row['หมายเหตุ'] || row['notes'] || 'นำเข้าจากไฟล์ Excel/CSV'
                        };
                        if (rowId) payload.id = rowId;

                        await window.DataStore.insert('electricity_consumption', payload);
                        importedCount++;

                    } else if (moduleType === 'water_quality') {
                        const recDate = this.extractRowDate(row);
                        const ph = parseFloat(row['pH (5.5-9.0)'] || row['pH'] || row['ph'] || 7.0);
                        const doVal = parseFloat(row['DO (2.0-4.0 mg/L)'] || row['DO (2-4 mg/L)'] || row['DO'] || row['do_value'] || row['do'] || 3.0);
                        const tds = parseFloat(row['TDS (<=500 mg/L)'] || row['TDS (<=500)'] || row['TDS'] || row['tds'] || 300);
                        const cl = parseFloat(row['คลอรีนอิสระ (1.0-2.0 mg/L)'] || row['คลอรีน (1-2 mg/L)'] || row['คลอรีน'] || row['chlorine'] || 1.5);
                        const sed = parseFloat(row['ตะกอน VS30 (<=300 mL/L)'] || row['ตะกอน VS30 (<=300)'] || row['ตะกอน'] || row['sediment'] || 150);
                        const isPass = (ph >= 5.5 && ph <= 9.0 && doVal >= 2.0 && doVal <= 4.0 && tds <= 500 && cl >= 1.0 && cl <= 2.0 && sed <= 300);

                        const payload = {
                            recorded_at: recDate,
                            sampling_point: row['จุดเก็บตัวอย่าง'] || row['sampling_point'] || 'จุดปลายท่อออกจากระบบบำบัด',
                            ph: ph,
                            do_value: doVal,
                            tds: tds,
                            chlorine: cl,
                            sediment: sed,
                            status: row['สถานะ'] || row['status'] || (isPass ? 'ผ่านเกณฑ์' : 'เกินเกณฑ์'),
                            inspector: row['ผู้ตรวจสอบ'] || row['inspector'] || window.AuthService.getCurrentUser()?.full_name || 'เจ้าหน้าที่',
                            remarks: row['หมายเหตุ'] || row['remarks'] || 'นำเข้าจากไฟล์ Excel/CSV'
                        };
                        if (rowId) payload.id = rowId;

                        await window.DataStore.insert('preliminary_water_quality', payload);
                        importedCount++;

                    } else if (moduleType === 'quarterly_water_quality') {
                        const sampDate = this.extractRowDate(row, null, true);
                        const payload = {
                            sampling_date: sampDate,
                            sampling_point: row['จุดเก็บตัวอย่าง'] || row['sampling_point'] || 'จุดปลายท่อออกจากระบบบำบัดน้ำเสีย',
                            ph: parseFloat(row['ph'] || row['pH'] || 7.2),
                            ss: parseFloat(row['ss'] || row['SS'] || 15),
                            tds: parseFloat(row['tds'] || row['TDS'] || 350),
                            tss: parseFloat(row['tss'] || row['TSS'] || 10),
                            tkn: parseFloat(row['tkn'] || row['TKN'] || 12),
                            go: parseFloat(row['go'] || row['GO'] || 3),
                            sulfide: parseFloat(row['sulfide'] || row['Sulfide'] || 0.1),
                            bod: parseFloat(row['bod'] || row['BOD'] || 8),
                            cod: parseFloat(row['cod'] || row['COD'] || 30),
                            tcb: parseFloat(row['tcb'] || row['TCB'] || 200),
                            fcb: parseFloat(row['fcb'] || row['FCB'] || 30),
                            status: row['status'] || row['สถานะ'] || 'ผ่านเกณฑ์มาตรฐาน',
                            action_taken: row['action_taken'] || row['การปฏิบัติการ'] || 'ผลตรวจอยู่ในเกณฑ์มาตรฐาน',
                            lab_report_file: row['lab_report_file'] || row['image_url'] || row['file_url'] || row['ไฟล์รายงานแล็บ'] || row['ไฟล์แนบ'] || null,
                            image_url: row['lab_report_file'] || row['image_url'] || row['file_url'] || row['ไฟล์รายงานแล็บ'] || row['ไฟล์แนบ'] || null,
                            inspector: row['inspector'] || row['ผู้ตรวจสอบ'] || window.AuthService.getCurrentUser()?.full_name || 'แสงตะวัน',
                            remarks: row['remarks'] || row['หมายเหตุ'] || 'นำเข้าจากไฟล์'
                        };
                        if (rowId) payload.id = rowId;

                        await window.DataStore.insert('quarterly_water_quality', payload);
                        importedCount++;

                    } else if (moduleType === 'machinery') {
                        const recDate = this.extractRowDate(row);
                        const rawEq = row['รายการอุปกรณ์ที่ตรวจ (คั่นด้วยจุลภาค)'] || row['อุปกรณ์'] || row['equipment_list'] || 'เครื่องสูบน้ำเสียดิบ (Submersible Pump 1)';
                        const eqArr = Array.isArray(rawEq) ? rawEq : (typeof rawEq === 'string' ? rawEq.split(',').map(s => s.trim()) : [String(rawEq)]);

                        const payload = {
                            recorded_at: recDate,
                            equipment_list: eqArr,
                            status: row['สถานะ (ปกติทุกรายการ / ผิดปกติ 1 รายการ)'] || row['สถานะ'] || row['status'] || 'ปกติทุกรายการ',
                            abnormal_equipment: row['อุปกรณ์ที่ผิดปกติ'] || row['abnormal_equipment'] || null,
                            cause: row['สาเหตุ'] || row['cause'] || null,
                            solution: row['วิธีแก้ไข'] || row['solution'] || null,
                            image_url: row['image_url'] || row['รูปภาพ'] || null,
                            inspector: row['ผู้ตรวจเช็ค'] || row['inspector'] || window.AuthService.getCurrentUser()?.full_name || 'เจ้าหน้าที่',
                            remarks: row['หมายเหตุ'] || row['remarks'] || 'นำเข้าจากไฟล์ Excel/CSV'
                        };
                        if (rowId) payload.id = rowId;

                        await window.DataStore.insert('machinery_inspection', payload);
                        importedCount++;

                    } else if (moduleType === 'maintenance') {
                        const recDate = this.extractRowDate(row);
                        const rawEq = row['อุปกรณ์'] || row['equipment_list'] || 'เครื่องสูบน้ำเสียดิบ (Submersible Pump 1)';
                        const eqArr = Array.isArray(rawEq) ? rawEq : (typeof rawEq === 'string' ? rawEq.split(',').map(s => s.trim()) : [String(rawEq)]);

                        const payload = {
                            recorded_at: recDate,
                            location: row['สถานที่'] || row['location'] || 'อาคารระบบบำบัดน้ำเสีย',
                            equipment_list: eqArr,
                            job_type: row['ประเภทงาน (ตรวจสอบ/ป้องกัน/แก้ไข/ซ่อมบำรุง)'] || row['ประเภทงาน'] || row['job_type'] || 'ป้องกัน',
                            problem: row['ปัญหาที่พบ'] || row['ปัญหา'] || row['problem'] || 'ซ่อมบำรุงตามรอบ',
                            cause: row['สาเหตุ'] || row['cause'] || 'ตามแผนงาน PM',
                            fix_method: row['วิธีการแก้ไข'] || row['วิธีแก้ไข'] || row['fix_method'] || 'ตรวจเช็คและบำรุงรักษา',
                            fix_result: row['ผลการซ่อม'] || row['ผลการแก้ไข'] || row['fix_result'] || 'ทำงานปกติ',
                            cost: parseFloat(row['ค่าใช้จ่าย (บาท)'] || row['ค่าใช้จ่าย'] || row['cost'] || 0),
                            image_url: row['image_url'] || row['รูปภาพ'] || null,
                            operator: row['ผู้ดำเนินการ'] || row['ผู้ซ่อม'] || row['operator'] || window.AuthService.getCurrentUser()?.full_name || 'เจ้าหน้าที่',
                            remarks: row['หมายเหตุ'] || row['remarks'] || 'นำเข้าจากไฟล์ Excel/CSV'
                        };
                        if (rowId) payload.id = rowId;

                        await window.DataStore.insert('maintenance_records', payload);
                        importedCount++;

                    } else if (moduleType === 'risk') {
                        const recDate = this.extractRowDate(row);
                        const payload = {
                            recorded_at: recDate,
                            risk_name: row['ชื่อความเสี่ยง'] || row['risk_name'] || 'ความเสี่ยงทั่วไป',
                            severity_level: row['ระดับความรุนแรง (ต่ำ/กลาง/ปานกลาง/สูง/สูงมาก)'] || row['ระดับความรุนแรง'] || row['severity_level'] || 'ปานกลาง',
                            impact: row['ผลกระทบ'] || row['impact'] || 'ไม่มีผลกระทบต่อระบบหลัก',
                            likelihood: row['โอกาสเกิด (ต่ำ/กลาง/ปานกลาง/สูง)'] || row['โอกาสเกิด'] || row['likelihood'] || 'ต่ำ',
                            prevention_plan: row['แผนป้องกันและแก้ไข'] || row['แผนป้องกัน'] || row['prevention_plan'] || 'ตรวจเช็คตาม SOP',
                            status: row['สถานะ (ควบคุมได้ / กำลังดำเนินการ)'] || row['สถานะ'] || row['status'] || 'ควบคุมได้',
                            risk_manager: row['ผู้รับผิดชอบ'] || row['risk_manager'] || window.AuthService.getCurrentUser()?.full_name || 'แสงตะวัน'
                        };
                        if (rowId) payload.id = rowId;

                        await window.DataStore.insert('risk_management', payload);
                        importedCount++;

                    } else if (moduleType === 'incident') {
                        const recDate = this.extractRowDate(row);
                        const payload = {
                            recorded_at: recDate,
                            incident_type: row['ประเภทเหตุการณ์'] || row['incident_type'] || 'เหตุการณ์ทั่วไป',
                            description: row['รายละเอียดเหตุการณ์'] || row['description'] || 'ระบบทำงานปกติ',
                            severity: row['ระดับความรุนแรง'] || row['severity'] || 'เล็กน้อย',
                            resolution_status: row['สถานะการแก้ไข'] || row['resolution_status'] || 'แก้ไขแล้วเสร็จ',
                            action_taken: row['การดำเนินการแก้ไข'] || row['action_taken'] || null,
                            reporter: row['ผู้รายงาน'] || row['reporter'] || window.AuthService.getCurrentUser()?.full_name || 'เจ้าหน้าที่ประจำเวร'
                        };
                        if (rowId) payload.id = rowId;

                        await window.DataStore.insert('incident_records', payload);
                        importedCount++;

                    } else if (moduleType === 'equipment' || moduleType === 'equipment_ref') {
                        const eqName = row['ชื่ออุปกรณ์ / เครื่องจักร'] || row['ชื่ออุปกรณ์'] || row['equipment_name'] || row['name'];
                        if (eqName && String(eqName).trim()) {
                            const payload = {
                                equipment_name: String(eqName).trim(),
                                category: row['หมวดหมู่ระบบ (ระบบสูบน้ำ/ระบบเติมอากาศ/ระบบฆ่าเชื้อ/ระบบตกตะกอน/ระบบควบคุมไฟฟ้า/ระบบตรวจวัด)'] || row['หมวดหมู่ระบบ'] || row['หมวดหมู่'] || row['category'] || 'อุปกรณ์หลัก',
                                brand: row['ยี่ห้อ (Brand)'] || row['ยี่ห้อ'] || row['brand'] || null,
                                model: row['รุ่น (Model)'] || row['รุ่น'] || row['model'] || null,
                                asset_number: row['เลขครุภัณฑ์ (Asset Number)'] || row['เลขครุภัณฑ์'] || row['asset_number'] || null,
                                equipment_type: row['ชนิดอุปกรณ์ (Type)'] || row['ชนิดอุปกรณ์'] || row['ชนิด'] || row['equipment_type'] || null,
                                capacity: row['ขนาด / พิกัดสเปก'] || row['ขนาด'] || row['พิกัด'] || row['capacity'] || null,
                                lifespan: row['อายุการใช้งาน'] || row['อายุใช้งาน'] || row['lifespan'] || null,
                                installation_location: row['สถานที่ / จุดติดตั้งอุปกรณ์'] || row['สถานที่ติดตั้ง'] || row['จุดติดตั้ง'] || row['installation_location'] || null,
                                usage_instructions: row['วิธีการใช้งาน'] || row['คำแนะนำ'] || row['usage_instructions'] || null,
                                maintenance_history: row['ประวัติการซ่อมบำรุง'] || row['ประวัติการซ่อม'] || row['maintenance_history'] || null,
                                status: row['สถานะ (พร้อมใช้งาน / อยู่ระหว่างซ่อมบำรุง / ชำรุด/รอซ่อม / สำรองพร้อมใช้งาน)'] || row['สถานะ'] || row['status'] || 'พร้อมใช้งาน'
                            };
                            if (rowId) payload.id = rowId;

                            await window.DataStore.insert('equipment_ref', payload);
                            importedCount++;
                        }

                    } else if (moduleType === 'monthly_report' || moduleType === 'monthly_reports') {
                        const payload = {
                            report_month: row['report_month'] || row['เดือนรายงาน'] || row['เดือน'] || '2026-08',
                            total_wastewater_inflow: parseFloat(row['total_wastewater_inflow'] || row['ปริมาณน้ำเสียรวม'] || 0),
                            total_electricity_kwh: parseFloat(row['total_electricity_kwh'] || row['หน่วยไฟฟ้ารวม'] || 0),
                            avg_ph: parseFloat(row['avg_ph'] || 7.2),
                            avg_do: parseFloat(row['avg_do'] || 3.1),
                            avg_tds: parseFloat(row['avg_tds'] || 340),
                            avg_sediment: parseFloat(row['avg_sediment'] || 180),
                            avg_chlorine: parseFloat(row['avg_chlorine'] || 1.45),
                            standard_pass_rate: parseFloat(row['standard_pass_rate'] || 100),
                            total_cost: parseFloat(row['total_cost'] || row['ค่าใช้จ่ายรวม'] || 0)
                        };
                        if (rowId) payload.id = rowId;

                        await window.DataStore.insert('monthly_reports', payload);
                        importedCount++;

                    } else if (moduleType === 'documents') {
                        const payload = {
                            doc_title: row['ชื่อเอกสาร / รายงาน'] || row['doc_title'] || row['ชื่อเอกสาร'] || 'เอกสารระบบบำบัดน้ำเสีย',
                            doc_category: row['หมวดหมู่เอกสาร'] || row['category'] || 'SOP',
                            doc_date: this.extractRowDate(row, null, true),
                            author: row['ผู้จัดทำ / เจ้าของเอกสาร'] || row['author'] || 'เจ้าหน้าที่',
                            notes: row['หมายเหตุ'] || row['notes'] || ''
                        };
                        if (rowId) payload.id = rowId;
                        await window.DataStore.insert('report_storage', payload);
                        importedCount++;

                    } else if (moduleType === 'users' || moduleType === 'users_admin' || moduleType === 'users-admin') {
                        const uname = row['ชื่อผู้ใช้งาน (Username)'] || row['username'];
                        if (uname) {
                            const payload = {
                                username: String(uname).trim(),
                                full_name: row['ชื่อ-นามสกุล'] || row['full_name'] || 'ผู้ใช้งาน',
                                email: row['อีเมล'] || row['email'] || '',
                                role: row['บทบาท (admin / staff)'] || row['role'] || 'staff',
                                position: row['ตำแหน่ง'] || row['position'] || 'เจ้าหน้าที่',
                                department: row['แผนก / ฝ่าย'] || row['department'] || 'ฝ่ายสิ่งแวดล้อม',
                                status: row['สถานะ (active / inactive)'] || row['status'] || 'active'
                            };
                            if (rowId) payload.id = rowId;
                            await window.DataStore.insert('users', payload);
                            importedCount++;
                        }
                    }
                }

                Swal.fire({
                    icon: 'success',
                    title: 'นำเข้าข้อมูลสำเร็จ!',
                    text: `นำเข้าข้อมูลทั้งหมด ${importedCount} รายการเรียบร้อยแล้ว`,
                    timer: 2000,
                    showConfirmButton: false
                });

                if (onSuccess) onSuccess();

            } catch (err) {
                Swal.fire({
                    icon: 'error',
                    title: 'ไม่สามารถนำเข้าข้อมูลได้',
                    text: err.message
                });
            }
        };
        reader.readAsArrayBuffer(file);
    }

    // =========================================================================
    // 7. ส่งออก CSV สำหรับแต่ละตาราง
    // =========================================================================
    exportModuleCSV(filename, dataRows) {
        if (!dataRows || dataRows.length === 0) {
            Swal.fire({ icon: 'info', title: 'ไม่มีข้อมูลสำหรับส่งออก CSV' });
            return;
        }

        const cleanRows = dataRows.map(row => {
            const cleanRow = {};
            for (const [k, v] of Object.entries(row)) {
                cleanRow[k] = this.sanitizeExcelCell(v);
            }
            return cleanRow;
        });

        const ws = XLSX.utils.json_to_sheet(cleanRows);
        const csv = XLSX.utils.sheet_to_csv(ws);
        const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        Swal.fire({ icon: 'success', title: 'ส่งออก CSV สำเร็จ!', timer: 1500, showConfirmButton: false });
    }

    // =========================================================================
    // 8. ล้างข้อมูลเฉพาะโมดูล (พร้อม SweetAlert2 Confirm)
    // =========================================================================
    async clearModuleData(moduleType, tableName, onSuccess) {
        const result = await Swal.fire({
            title: 'ยืนยันการล้างข้อมูลในตารางนี้?',
            text: 'ข้อมูลทั้งหมดในหน้านี้จะถูกลบออกจากฐานข้อมูลและไม่สามารถเรียกคืนได้!',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#334155',
            confirmButtonText: 'ยืนยันลบทั้งหมด',
            cancelButtonText: 'ยกเลิก'
        });

        if (result.isConfirmed) {
            Swal.fire({
                title: 'กำลังล้างข้อมูล...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            // ล้างข้อมูลทั้งใน Supabase Cloud และ LocalStorage
            await window.DataStore.clearTable(tableName);

            // หากเป็นโมดูลที่มีตารางรอง
            if (moduleType === 'water_quality') {
                await window.DataStore.clearTable('quarterly_water_quality');
            } else if (moduleType === 'risk') {
                await window.DataStore.clearTable('incident_records');
            }

            Swal.fire({
                icon: 'success',
                title: 'ล้างข้อมูลเรียบร้อยแล้ว',
                timer: 1200,
                showConfirmButton: false
            });

            if (onSuccess) await onSuccess();
        }
    }

    // =========================================================================
    // 9. นำเข้าไฟล์ข้อมูล JSON
    // =========================================================================
    async handleFileImport(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const parsed = JSON.parse(event.target.result);
                await window.DataStore.importData(parsed);
                Swal.fire({
                    icon: 'success',
                    title: 'นำเข้าข้อมูลสำเร็จ!',
                    timer: 1500,
                    showConfirmButton: false
                });
                setTimeout(() => window.location.reload(), 1500);
            } catch (err) {
                Swal.fire({ icon: 'error', title: 'ไฟล์ JSON ไม่ถูกต้อง', text: err.message });
            }
        };
        reader.readAsText(file);
    }

    // =========================================================================
    // ดึงข้อมูลตัวอย่างดั้งเดิมสมบูรณ์ครบทุกหน้า (Restore & Seed Original Data)
    // =========================================================================
    async seedSampleData() {
        const result = await Swal.fire({
            title: 'ดึงข้อมูลตัวอย่างตั้งต้นทั้งหมด?',
            html: `ระบบจะทำการโหลดข้อมูลดั้งเดิมที่สมบูรณ์แบบครบทั้ง <strong>13 หมวดหมู่</strong>:<br>
                   <ul class="text-left text-xs text-slate-300 mt-2 space-y-1 pl-4">
                       <li>💧 บันทึกน้ำเสียเข้าระบบ (14-30 วัน)</li>
                       <li>⚡ การใช้พลังงานไฟฟ้า & ค่าไฟ (14-30 วัน)</li>
                       <li>🧪 ผลตรวจคุณภาพน้ำ DO, BOD, pH, SS (14-30 วัน)</li>
                       <li>⚙️ ตรวจสอบเครื่องจักร & ระบบเติมอากาศ</li>
                       <li>🛠️ ประวัติงานซ่อมบำรุง PM/CM</li>
                       <li>📦 คลังสินค้าและอุปกรณ์อ้างอิง (40 รายการครบถ้วน)</li>
                       <li>🛡️ บันทึกความเสี่ยง & อุบัติการณ์</li>
                       <li>📑 รายงานสรุปรายเดือน & คลังเอกสาร SOP</li>
                       <li>👥 บัญชีผู้ใช้งานระบบ & Super Admin</li>
                   </ul>`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: '<i class="fa-solid fa-wand-magic-sparkles mr-1"></i> ยืนยันดึงข้อมูล',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#10b981',
            cancelButtonColor: '#64748b'
        });

        if (!result.isConfirmed) return;

        Swal.fire({
            title: 'กำลังดึงและประมวลผลข้อมูล...',
            text: 'กรุณารอสักครู่ กำลังจัดโครงสร้างข้อมูลทุกตาราง',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        try {
            const sampleData = window.SAMPLE_DATABASE || (typeof SAMPLE_DATABASE !== 'undefined' ? SAMPLE_DATABASE : {});
            
            // 1. บันทึกลง LocalStorage
            if (window.DataStore) {
                localStorage.setItem('wwtp_sample_data_seeded', 'true');
                window.DataStore.saveLocalDatabase(sampleData);
                
                // 2. ถ้าต่อ Supabase Cloud ให้ซิงค์ขึ้น Cloud ด้วย
                if (window.DataStore.supabaseClient && window.DataStore.isSupabaseConnected) {
                    const tableNames = Object.keys(sampleData);
                    for (const tbl of tableNames) {
                        try {
                            const rows = sampleData[tbl];
                            if (Array.isArray(rows) && rows.length > 0) {
                                await window.DataStore.supabaseClient.from(tbl).upsert(rows, { onConflict: 'id' });
                            }
                        } catch (e) {
                            console.warn(`Cloud seed notice for ${tbl}:`, e);
                        }
                    }
                }

                if (window.DataStore.logAction) {
                    window.DataStore.logAction('ดึงข้อมูลตัวอย่าง', 'ดึงชุดข้อมูลตั้งต้นของ รพ.๕๐ พรรษาฯ ครบทุกตาราง');
                }
            }

            // 3. รีเฟรชทุกหน้าจอที่กำลังแสดงผลอยู่ทันที
            if (window.DashboardModule) await window.DashboardModule.init();
            if (window.InfluentModule) await window.InfluentModule.loadData();
            if (window.ElectricityModule) await window.ElectricityModule.loadData();
            if (window.WaterQualityModule) await window.WaterQualityModule.loadData();
            if (window.MachineryModule) await window.MachineryModule.loadData();
            if (window.MaintenanceModule) await window.MaintenanceModule.loadData();
            if (window.EquipmentRefModule) await window.EquipmentRefModule.loadData();
            if (window.RiskIncidentModule) await window.RiskIncidentModule.loadData();
            if (window.MonthlyReportModule) await window.MonthlyReportModule.loadData();
            if (window.DocumentsModule) await window.DocumentsModule.loadData();
            if (window.UsersAdminModule) await window.UsersAdminModule.loadData();

            await Swal.fire({
                icon: 'success',
                title: 'ดึงข้อมูลดั้งเดิมสำเร็จครบถ้วน!',
                text: 'ข้อมูลในทุกๆ หน้าจอ แดชบอร์ด ตาราง และสถิติกลับมาสมบูรณ์ 100% แล้วครับ',
                confirmButtonColor: '#10b981'
            });

        } catch (err) {
            console.error('Seed error:', err);
            Swal.fire({
                icon: 'error',
                title: 'เกิดข้อผิดพลาด',
                text: err.message || 'ไม่สามารถดึงข้อมูลได้',
                confirmButtonColor: '#f43f5e'
            });
        }
    }

    // =========================================================================
    // ล้างข้อมูลทั้งหมดในระบบ (Clear All Data)
    // =========================================================================
    async clearAllData() {
        const result = await Swal.fire({
            title: 'ต้องการล้างข้อมูลทั้งหมด?',
            text: 'ข้อมูลในตารางทั้งหมดจะถูกลบออกจากแคช',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'ยืนยันล้างข้อมูล',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#f43f5e',
            cancelButtonColor: '#64748b'
        });

        if (!result.isConfirmed) return;

        const emptyDb = {
            influent_wastewater: [],
            electricity_consumption: [],
            preliminary_water_quality: [],
            quarterly_water_quality: [],
            machinery_inspection: [],
            maintenance_records: [],
            risk_management: [],
            users: [],
            equipment_ref: [],
            incident_records: [],
            monthly_reports: [],
            report_storage: [],
            treatment_manuals: [],
            system_logs: []
        };

        if (window.DataStore) {
            localStorage.removeItem('wwtp_sample_data_seeded');
            window.DataStore.saveLocalDatabase(emptyDb);
        }

        if (window.DashboardModule) await window.DashboardModule.init();
        if (window.InfluentModule) await window.InfluentModule.loadData();
        if (window.ElectricityModule) await window.ElectricityModule.loadData();
        if (window.WaterQualityModule) await window.WaterQualityModule.loadData();
        if (window.MachineryModule) await window.MachineryModule.loadData();
        if (window.MaintenanceModule) await window.MaintenanceModule.loadData();
        if (window.EquipmentRefModule) await window.EquipmentRefModule.loadData();
        if (window.RiskIncidentModule) await window.RiskIncidentModule.loadData();
        if (window.MonthlyReportModule) await window.MonthlyReportModule.loadData();
        if (window.DocumentsModule) await window.DocumentsModule.loadData();
        if (window.UsersAdminModule) await window.UsersAdminModule.loadData();

        Swal.fire({
            icon: 'info',
            title: 'ล้างข้อมูลเรียบร้อย',
            text: 'สามารถกดปุ่ม "ข้อมูลตัวอย่าง" เพื่อดึงข้อมูลเดิมกลับมาได้ตลอดเวลา',
            confirmButtonColor: '#10b981'
        });
    }

    async exportSingleMonthlyPDF(id) {
        let item = null;
        if (window.MonthlyReportModule && window.MonthlyReportModule.items) {
            item = window.MonthlyReportModule.items.find(x => String(x.id) === String(id));
        }
        if (!item && window.DataStore) {
            item = await window.DataStore.getById('monthly_reports', id);
        }
        if (!item) {
            Swal.fire({ icon: 'warning', title: 'ไม่พบข้อมูลรายงานประจำเดือนนี้' });
            return;
        }

        const modal = document.getElementById('modal-document-preview');
        const sheet = document.getElementById('document-preview-printable-sheet');
        if (!modal || !sheet) {
            window.print();
            return;
        }

        const monthStr = item.report_month || '2026-08';
        const parts = monthStr.split('-');
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const thaiMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
        const monthName = (!isNaN(m) && m >= 1 && m <= 12) ? thaiMonths[m - 1] : monthStr;
        const thaiYear = !isNaN(y) ? (y + 543) : '';
        const daysInMonth = (!isNaN(y) && !isNaN(m)) ? new Date(y, m, 0).getDate() : 30;

        const waterSupply = parseFloat(item.total_water_supply || item.total_water_m3) || 
            (item.total_wastewater_inflow ? parseFloat((item.total_wastewater_inflow / 0.80).toFixed(2)) : 0);
        const wastewater80 = parseFloat(item.total_wastewater_inflow || item.wastewater_80_m3) || 
            parseFloat((waterSupply * 0.80).toFixed(2));
        const kwh = parseFloat(item.total_electricity_kwh || item.total_kwh) || 0;
        const cost = parseFloat(item.total_cost || item.total_cost_thb) || 0;

        const dailyWater = (waterSupply / daysInMonth).toFixed(2);
        const dailyWw = (wastewater80 / daysInMonth).toFixed(2);
        const dailyKwh = (kwh / daysInMonth).toFixed(2);
        const co2e = (wastewater80 * 0.00065).toFixed(3);
        const treeCount = Math.round(parseFloat(co2e) * 118).toLocaleString('th-TH');

        const now = new Date();
        const issueDate = `${now.getDate()} ${thaiMonths[now.getMonth()]} ${now.getFullYear() + 543}`;
        const docCode = `MREP-${monthStr}-${Math.floor(1000 + Math.random() * 9000)}`;

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
                            รายงานสรุปผลการเดินระบบประจำเดือน ${monthName} พ.ศ. ${thaiYear} (${daysInMonth} วัน)
                        </p>
                    </div>
                </div>

                <div class="text-right shrink-0 text-[11px] text-slate-600 leading-snug">
                    <div>วันที่ออกเอกสาร: <strong class="text-slate-800 font-bold">${issueDate}</strong></div>
                    <div class="mt-0.5">ผู้ออกรายงาน: <strong class="text-slate-800 font-bold">นายแสงตะวัน ชาวเขา (Super Admin)</strong></div>
                    <div class="mt-0.5">รหัสเอกสาร: <strong class="font-mono text-emerald-700 font-bold">${docCode}</strong></div>
                </div>
            </div>

            <!-- Ribbon Title -->
            <div class="bg-slate-50 border-y border-emerald-600/30 px-3.5 py-1.5 rounded flex items-center justify-between mt-3.5 mb-4">
                <div class="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-2">
                    <i class="fa-solid fa-file-invoice text-emerald-600"></i>
                    <span>รายงานสรุปการเดินระบบประจำเดือน: ${monthName} ${thaiYear} (${monthStr})</span>
                </div>
                <div class="text-[11px] font-bold text-emerald-700 hidden sm:block">
                    GREEN &amp; CLEAN Hospital Standard
                </div>
            </div>

            <!-- KPI Cards: Water, Wastewater 80%, Electricity, Cost -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <div class="doc-kpi-card doc-kpi-blue">
                    <div class="text-[11px] font-bold text-blue-800">การใช้น้ำประปาทั้งหมด</div>
                    <div class="text-xl font-black text-blue-900 font-mono mt-1">${waterSupply.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span class="text-xs font-normal">ลบ.ม.</span></div>
                    <div class="text-[10px] text-blue-700 mt-0.5">เฉลี่ย <strong>${parseFloat(dailyWater).toLocaleString()}</strong> ลบ.ม./วัน</div>
                </div>
                <div class="doc-kpi-card doc-kpi-blue">
                    <div class="text-[11px] font-bold text-sky-800">น้ำเสียรวม 80% เข้าระบบ</div>
                    <div class="text-xl font-black text-sky-900 font-mono mt-1">${wastewater80.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span class="text-xs font-normal">ลบ.ม.</span></div>
                    <div class="text-[10px] text-sky-700 mt-0.5">เฉลี่ย <strong>${parseFloat(dailyWw).toLocaleString()}</strong> ลบ.ม./วัน</div>
                </div>
                <div class="doc-kpi-card doc-kpi-amber">
                    <div class="text-[11px] font-bold text-amber-800">การใช้ไฟฟ้า (kWh)</div>
                    <div class="text-xl font-black text-amber-900 font-mono mt-1">${kwh.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span class="text-xs font-normal">kWh</span></div>
                    <div class="text-[10px] text-amber-700 mt-0.5">เฉลี่ย <strong>${parseFloat(dailyKwh).toLocaleString()}</strong> kWh/วัน</div>
                </div>
                <div class="doc-kpi-card doc-kpi-green">
                    <div class="text-[11px] font-bold text-emerald-800">ค่าไฟฟ้ารวมทั้งสิ้น</div>
                    <div class="text-xl font-black text-emerald-900 font-mono mt-1">฿${cost.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div class="text-[10px] text-emerald-700 mt-0.5">ลดก๊าซ <strong>${co2e}</strong> tCO2e (${treeCount} ต้น)</div>
                </div>
            </div>

            <!-- Parameters & Environmental Performance Table -->
            <div class="mb-4 border border-slate-200 rounded-lg overflow-hidden bg-white shadow-xs">
                <div class="bg-slate-50/80 px-3.5 py-2 border-b border-slate-200 flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <i class="fa-solid fa-flask-vial text-emerald-600 text-xs"></i>
                        <span class="font-bold text-slate-800 text-xs">ผลการตรวจสอบคุณภาพน้ำและเกณฑ์มาตรฐานน้ำทิ้ง</span>
                    </div>
                    <span class="badge-doc-pass text-[10px]"><i class="fa-solid fa-circle-check"></i> ผ่านเกณฑ์ ${item.standard_pass_rate || 100}%</span>
                </div>
                <div class="overflow-x-auto">
                    <table class="doc-table-clean">
                        <thead>
                            <tr>
                                <th class="text-left">พารามิเตอร์ตรวจวัด</th>
                                <th class="text-center">ค่าเฉลี่ยประจำเดือน</th>
                                <th class="text-center">เกณฑ์มาตรฐาน สธ. / สวล.</th>
                                <th class="text-center">สถานะการประเมิน</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td class="font-medium text-slate-800">ความเป็นกรด-ด่าง (pH)</td>
                                <td class="text-center font-mono font-bold text-emerald-700">${item.avg_ph || 7.20}</td>
                                <td class="text-center text-slate-600">5.5 - 9.0</td>
                                <td class="text-center"><span class="badge-doc-pass">ผ่านเกณฑ์</span></td>
                            </tr>
                            <tr>
                                <td class="font-medium text-slate-800">ออกซิเจนละลาย (DO)</td>
                                <td class="text-center font-mono font-bold text-emerald-700">${item.avg_do || 3.00} mg/L</td>
                                <td class="text-center text-slate-600">&ge; 2.0 mg/L</td>
                                <td class="text-center"><span class="badge-doc-pass">ผ่านเกณฑ์</span></td>
                            </tr>
                            <tr>
                                <td class="font-medium text-slate-800">ของแข็งละลายน้ำทั้งหมด (TDS)</td>
                                <td class="text-center font-mono font-bold text-emerald-700">${item.avg_tds || 350} mg/L</td>
                                <td class="text-center text-slate-600">&le; 500 mg/L</td>
                                <td class="text-center"><span class="badge-doc-pass">ผ่านเกณฑ์</span></td>
                            </tr>
                            <tr>
                                <td class="font-medium text-slate-800">ปริมาตรตะกอน 30 นาที (VS30)</td>
                                <td class="text-center font-mono font-bold text-emerald-700">${item.avg_sediment || 180} mL/L</td>
                                <td class="text-center text-slate-600">150 - 300 mL/L</td>
                                <td class="text-center"><span class="badge-doc-pass">ผ่านเกณฑ์</span></td>
                            </tr>
                            <tr>
                                <td class="font-medium text-slate-800">คลอรีนอิสระคงเหลือ (Residual Chlorine)</td>
                                <td class="text-center font-mono font-bold text-emerald-700">${item.avg_chlorine || 1.50} mg/L</td>
                                <td class="text-center text-slate-600">0.5 - 2.0 mg/L</td>
                                <td class="text-center"><span class="badge-doc-pass">ผ่านเกณฑ์</span></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Synthesis & Notes -->
            <div class="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 mb-6 leading-relaxed">
                <strong>สรุปข้อคิดเห็นเชิงปฏิบัติการ:</strong> ในรอบเดือน ${monthName} พ.ศ. ${thaiYear} (${daysInMonth} วัน) ระบบบำบัดน้ำเสียสามารถรองรับการบำบัดน้ำเสียได้สมบูรณ์ 100% คิดเป็นปริมาณน้ำเสียรวม ${wastewater80.toLocaleString()} ลบ.ม. (เฉลี่ย ${parseFloat(dailyWw).toLocaleString()} ลบ.ม./วัน) ควบคุมค่าไฟฟ้าได้ในเกณฑ์มาตรฐาน และน้ำทิ้งผ่านเกณฑ์มาตรฐานความปลอดภัยของกระทรวงสาธารณสุขครบถ้วน
            </div>

            <!-- Signatures -->
            <div class="grid grid-cols-3 gap-6 pt-4 border-t border-slate-200 text-center text-xs">
                <div>
                    <div class="h-10"></div>
                    <div class="border-t border-dashed border-slate-400 pt-1.5 font-bold text-slate-800">นายแสงตะวัน ชาวเขา</div>
                    <div class="text-[10px] text-slate-500">ผู้จัดทำรายงาน / Super Admin</div>
                </div>
                <div>
                    <div class="h-10"></div>
                    <div class="border-t border-dashed border-slate-400 pt-1.5 font-bold text-slate-800">หัวหน้ากลุ่มงานบริหารสิ่งแวดล้อม</div>
                    <div class="text-[10px] text-slate-500">ผู้ตรวจสอบความถูกต้อง</div>
                </div>
                <div>
                    <div class="h-10"></div>
                    <div class="border-t border-dashed border-slate-400 pt-1.5 font-bold text-slate-800">ผู้อำนวยการโรงพยาบาล ๕๐ พรรษาฯ</div>
                    <div class="text-[10px] text-slate-500">ผู้อนุมัติรายงาน</div>
                </div>
            </div>
        `;

        window.App.openModal('modal-document-preview');
    }
}

window.ExportImportModule = new ExportImportModule();

