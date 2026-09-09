/**
 * ============================================================================
 * ระบบจัดการระบบบำบัดน้ำเสีย โรงพยาบาล ๕๐ พรรษา มหาวชิราลงกรณ (SPA)
 * CONFIG.JS - Configuration, Thresholds & System Constants
 * ============================================================================
 */

const APP_CONFIG = {
    appName: "ระบบบำบัดน้ำเสีย รพ.๕๐ พรรษา มหาวชิราลงกรณ",
    hospitalName: "โรงพยาบาล ๕๐ พรรษา มหาวชิราลงกรณ",
    version: "2.5.0-Production",
    
    // อัตราค่าไฟฟ้ามาตรฐาน (บาท/kWh)
    defaultElectricityRate: 4.50,
    
    // พารามิเตอร์การคำนวณคาร์บอนเครดิต & ก๊าซเรือนกระจก (T-VER / TGO Standards)
    carbonCreditFactors: {
        wastewaterTreatmentFactor: 0.65,    // kgCO2e ที่ลดได้จากการบำบัดน้ำเสีย 1 ลบ.ม. (หลีกเลี่ยงก๊าซมีเทน)
        gridElectricityFactor: 0.4999,      // kgCO2e ต่อการใช้ไฟฟ้า 1 kWh
        recycledWaterFactor: 0.35,          // kgCO2e ที่ลดได้จากการนำน้ำทิ้งกลับมาใช้ประโยชน์ 1 ลบ.ม.
        treeAbsorptionPerYear: 9.5,         // kgCO2e ที่ต้นไม้ 1 ต้นดูดซับได้ต่อปี
        carbonCreditPricePerTon: 200.00,    // ราคาคาร์บอนเครดิตเฉลี่ยในไทย (บาท / tCO2e)
        tapWaterPricePerM3: 20.00,          // ค่าน้ำประปาเฉลี่ย (บาท / ลบ.ม.)
        defaultWaterRecycleRate: 0.25       // สัดส่วนน้ำที่นำกลับมาใช้รดน้ำต้นไม้/ล้างพื้น (25% ของน้ำที่บำบัดแล้ว)
    },
    
    // เกณฑ์มาตรฐานคุณภาพน้ำทิ้งเบื้องต้น
    waterQualityStandards: {
        do: { min: 2.0, max: 4.0, unit: "mg/L", label: "ออกซิเจนละลาย (DO)" },
        tds: { min: 0, max: 500, unit: "mg/L", label: "สารละลายทั้งหมด (TDS)" },
        ph: { min: 5.5, max: 9.0, unit: "pH", label: "ความเป็นกรด-ด่าง (pH)" },
        sediment: { min: 0, max: 300, unit: "mL/L", label: "ตะกอน (VS30)" },
        chlorine: { min: 1.0, max: 2.0, unit: "mg/L", label: "คลอรีนอิสระ (Chlorine)" }
    },
    
    // เกณฑ์มาตรฐานน้ำทิ้งส่งตรวจไตรมาส (ตามประกาศกระทรวงทรัพยากรธรรมชาติฯ)
    quarterlyStandards: {
        ph: { min: 5.5, max: 9.0, unit: "" },
        ss: { max: 50, unit: "mg/L" },
        tds: { max: 500, unit: "mg/L" },
        tss: { max: 30, unit: "mg/L" },
        tkn: { max: 35, unit: "mg/L" },
        go: { max: 20, unit: "mg/L" },
        sulfide: { max: 1.0, unit: "mg/L" },
        bod: { max: 20, unit: "mg/L" },
        cod: { max: 120, unit: "mg/L" },
        tcb: { max: 1000, unit: "MPN/100ml" },
        fcb: { max: 400, unit: "MPN/100ml" }
    },
    
    // บัญชี Super Admin หลัก
    superAdmin: {
        username: "Sangtawan",
        defaultPassword: "Sangtawan123456789",
        fullName: "แสงตะวัน ชาวเขา",
        role: "admin"
    },
    
    // คีย์สำหรับเก็บข้อมูลใน LocalStorage
    storageKeys: {
        currentUser: "spa_50th_current_user",
        supabaseConfig: "spa_50th_supabase_config",
        theme: "spa_50th_theme_mode",
        localData: "spa_50th_local_database"
    },
    
    // การตั้งค่าเชื่อมต่อ Supabase เริ่มต้น (สามารถเปลี่ยนได้ผ่าน Modal การตั้งค่าในเว็บ)
    supabaseDefault: {
        url: (window.SUPABASE_EMBEDDED_CONFIG && window.SUPABASE_EMBEDDED_CONFIG.url) || localStorage.getItem("spa_50th_supabase_url") || "https://gcvbfhsnyohxudcdvwzg.supabase.co",
        anonKey: (window.SUPABASE_EMBEDDED_CONFIG && window.SUPABASE_EMBEDDED_CONFIG.anonKey) || localStorage.getItem("spa_50th_supabase_key") || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjdmJmaHNueW9oeHVkY2R2d3pnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NDA2NDYsImV4cCI6MjEwMzExNjY0Nn0.Z6Aj-9s3leKHFoFN8q7ywgg4lfdPDHEcLQX4KrsOLOQ"
    }
};

window.APP_CONFIG = APP_CONFIG;
