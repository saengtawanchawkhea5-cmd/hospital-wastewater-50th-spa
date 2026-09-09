-- ============================================================================
-- ระบบจัดการระบบบำบัดน้ำเสีย โรงพยาบาล ๕๐ พรรษา มหาวชิราลงกรณ
-- DATABASE SCHEMA & MIGRATION FOR SUPABASE (PostgreSQL)
-- 
-- 1. หากต้องการแก้ไขตารางเดิมใน Supabase ที่มีอยู่แล้ว (แปลง ID จาก UUID เป็น TEXT):
--    ให้คัดลอกส่วน "⚡ MIGRATION SCRIPT" ไปรันใน Supabase SQL Editor ได้ทันที
--
-- 2. หากต้องการสร้างตารางใหม่ทั้งหมด:
--    ให้คัดลอกไฟล์นี้ทั้งหมดไปรันใน Supabase SQL Editor
-- ============================================================================

-- 1. เปิดใช้งาน Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ⚡ MIGRATION SCRIPT (สำหรับแปลงตารางเดิมใน Supabase จาก UUID เป็น TEXT)
-- รันชุดคำสั่งนี้ใน Supabase SQL Editor เพื่อให้สามารถนำเข้าไฟล์ CSV ที่มี ID ตัวเลข (1, 2, 3...) ได้ทันที
-- ============================================================================
ALTER TABLE IF EXISTS users ALTER COLUMN id TYPE TEXT USING id::text, ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE IF EXISTS influent_wastewater ALTER COLUMN id TYPE TEXT USING id::text, ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE IF EXISTS electricity_consumption ALTER COLUMN id TYPE TEXT USING id::text, ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE IF EXISTS preliminary_water_quality ALTER COLUMN id TYPE TEXT USING id::text, ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE IF EXISTS quarterly_water_quality ALTER COLUMN id TYPE TEXT USING id::text, ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE IF EXISTS equipment_ref ALTER COLUMN id TYPE TEXT USING id::text, ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE IF EXISTS machinery_inspection ALTER COLUMN id TYPE TEXT USING id::text, ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE IF EXISTS maintenance_records ALTER COLUMN id TYPE TEXT USING id::text, ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE IF EXISTS risk_management ALTER COLUMN id TYPE TEXT USING id::text, ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE IF EXISTS incident_records ALTER COLUMN id TYPE TEXT USING id::text, ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE IF EXISTS system_logs ALTER COLUMN id TYPE TEXT USING id::text, ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE IF EXISTS monthly_reports ALTER COLUMN id TYPE TEXT USING id::text, ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE IF EXISTS report_storage ALTER COLUMN id TYPE TEXT USING id::text, ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE IF EXISTS treatment_manuals ALTER COLUMN id TYPE TEXT USING id::text, ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

-- เพิ่มคอลัมน์รูปภาพ/ไฟล์แนบสำหรับตารางคุณภาพน้ำเบื้องต้นหากยังไม่มี
ALTER TABLE IF EXISTS preliminary_water_quality ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL;

-- ============================================================================
-- โครงสร้างตารางเต็มรูปแบบ (FULL TABLE SCHEMA CREATION)
-- ============================================================================

-- ล้างตารางเดิมหากต้องการสร้างใหม่ (เรียงตามลำดับความสัมพันธ์)
DROP TABLE IF EXISTS treatment_manuals CASCADE;
DROP TABLE IF EXISTS report_storage CASCADE;
DROP TABLE IF EXISTS monthly_reports CASCADE;
DROP TABLE IF EXISTS system_logs CASCADE;
DROP TABLE IF EXISTS incident_records CASCADE;
DROP TABLE IF EXISTS risk_management CASCADE;
DROP TABLE IF EXISTS maintenance_records CASCADE;
DROP TABLE IF EXISTS machinery_inspection CASCADE;
DROP TABLE IF EXISTS equipment_ref CASCADE;
DROP TABLE IF EXISTS quarterly_water_quality CASCADE;
DROP TABLE IF EXISTS preliminary_water_quality CASCADE;
DROP TABLE IF EXISTS electricity_consumption CASCADE;
DROP TABLE IF EXISTS influent_wastewater CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================================================
-- 1. ตาราง: ผู้ใช้งาน (users)
-- ============================================================================
CREATE TABLE users (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user', 'inspector', 'technician')),
    full_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    department VARCHAR(100) DEFAULT 'หน่วยสิ่งแวดล้อมและบำบัดน้ำเสีย',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. ตาราง: ปริมาณน้ำเสียเข้าสู่ระบบ (influent_wastewater)
-- ============================================================================
CREATE TABLE influent_wastewater (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    meter_start NUMERIC(12, 2) DEFAULT NULL,
    meter_today NUMERIC(12, 2) NOT NULL,
    total_water_used NUMERIC(12, 2) DEFAULT 0.00,
    wastewater_influent NUMERIC(12, 2) DEFAULT 0.00,
    meter_image_url TEXT DEFAULT NULL,
    water_source VARCHAR(150) NOT NULL DEFAULT 'อาคารผู้ป่วยในและอาคารบริการ',
    recorded_by VARCHAR(255) NOT NULL,
    notes TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. ตาราง: การใช้พลังงานไฟฟ้า (electricity_consumption)
-- ============================================================================
CREATE TABLE electricity_consumption (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    meter_start NUMERIC(12, 2) DEFAULT NULL,
    meter_today NUMERIC(12, 2) NOT NULL,
    total_kwh NUMERIC(12, 2) DEFAULT 0.00,
    unit_price NUMERIC(8, 2) DEFAULT 4.50,
    electricity_cost NUMERIC(12, 2) DEFAULT 0.00,
    meter_image_url TEXT DEFAULT NULL,
    recorded_by VARCHAR(255) NOT NULL,
    notes TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. ตาราง: ตรวจคุณภาพน้ำเบื้องต้น (preliminary_water_quality)
-- เกณฑ์มาตรฐาน: DO 2-4, TDS <= 500, pH 5.5-9, ตะกอน VS30 <= 300, คลอรีน 1-2
-- ============================================================================
CREATE TABLE preliminary_water_quality (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sampling_point VARCHAR(255) NOT NULL DEFAULT 'จุดระบายน้ำทิ้งส่วนกลาง (Effluent Tank)',
    ph NUMERIC(5, 2) NOT NULL,
    do_value NUMERIC(5, 2) NOT NULL,
    tds NUMERIC(8, 2) NOT NULL,
    chlorine NUMERIC(5, 2) NOT NULL,
    sediment NUMERIC(8, 2) NOT NULL, -- VS30 (mL/L)
    status VARCHAR(50) DEFAULT 'ผ่านเกณฑ์',
    inspector VARCHAR(255) NOT NULL,
    remarks TEXT DEFAULT NULL,
    image_url TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 5. ตาราง: การส่งตัวอย่างน้ำทิ้งตรวจสอบมาตรฐานคุณภาพทุกไตรมาส (quarterly_water_quality)
-- ============================================================================
CREATE TABLE quarterly_water_quality (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    sampling_date DATE NOT NULL DEFAULT CURRENT_DATE,
    sampling_point VARCHAR(255) NOT NULL DEFAULT 'บ่อพักน้ำทิ้งขั้นสุดท้ายก่อนปล่อยสู่สาธารณะ',
    ph NUMERIC(5, 2),
    ss NUMERIC(8, 2),      -- Suspended Solids (มาตรฐาน <= 50 mg/L)
    tds NUMERIC(8, 2),     -- Total Dissolved Solids (มาตรฐาน <= 500 mg/L)
    tss NUMERIC(8, 2),     -- Total Suspended Solids (มาตรฐาน <= 30 mg/L)
    tkn NUMERIC(8, 2),     -- Total Kjeldahl Nitrogen (มาตรฐาน <= 35 mg/L)
    go NUMERIC(8, 2),      -- Grease & Oil (มาตรฐาน <= 20 mg/L)
    sulfide NUMERIC(8, 2), -- Sulfide (มาตรฐาน <= 1.0 mg/L)
    bod NUMERIC(8, 2),     -- BOD (มาตรฐาน <= 20 mg/L)
    cod NUMERIC(8, 2),     -- COD (มาตรฐาน <= 120 mg/L)
    tcb NUMERIC(10, 2),    -- Total Coliform Bacteria (มาตรฐาน <= 1000 MPN/100ml)
    fcb NUMERIC(10, 2),    -- Fecal Coliform Bacteria (มาตรฐาน <= 400 MPN/100ml)
    status VARCHAR(50) NOT NULL DEFAULT 'ผ่านเกณฑ์มาตรฐาน',
    action_taken TEXT DEFAULT 'ผลการทดสอบอยู่ในเกณฑ์มาตรฐาน ไม่ต้องปรับแก้สารเคมี',
    lab_report_file TEXT DEFAULT NULL,
    inspector VARCHAR(255) NOT NULL,
    remarks TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 6. ตาราง: อ้างอิงอุปกรณ์ (equipment_ref)
-- ============================================================================
CREATE TABLE equipment_ref (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    equipment_name VARCHAR(255) UNIQUE NOT NULL,
    category VARCHAR(100) DEFAULT 'อุปกรณ์หลัก',
    brand VARCHAR(255) DEFAULT NULL,               -- ยี่ห้อ เช่น ShinMaywa Pump, TECO
    model VARCHAR(255) DEFAULT NULL,               -- รุ่น เช่น CVC651-P65, CNS-0408R
    asset_number VARCHAR(255) DEFAULT NULL,        -- เลขครุภัณฑ์
    equipment_type VARCHAR(255) DEFAULT NULL,      -- ชนิด เช่น ปั๊มมาตรฐานแบบจุ่มใต้น้ำ, มอเตอร์มาตรฐาน (IE2/IE3)
    capacity TEXT DEFAULT NULL,                    -- ขนาด / พิกัดสเปก เช่น ขนาดมอเตอร์ 1.5 KW 50 Hz, ท่อ 2 นิ้ว...
    lifespan VARCHAR(100) DEFAULT NULL,            -- อายุการใช้งาน เช่น 4 ปี, 10 ปี, 20 ปี
    usage_instructions TEXT DEFAULT NULL,          -- วิธีการใช้งาน / ข้อควรระวัง
    installation_location TEXT DEFAULT NULL,       -- สถานที่/จุดติดตั้งอุปกรณ์ เช่น บ่อรวบรวมน้ำเสีย
    maintenance_history TEXT DEFAULT NULL,         -- ประวัติการซ่อมบำรุง
    status VARCHAR(50) DEFAULT 'พร้อมใช้งาน',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- สคริปต์อัปเกรดคอลัมน์สำหรับฐานข้อมูล Supabase ที่มีตาราง equipment_ref อยู่แล้ว (Migration)
ALTER TABLE IF EXISTS equipment_ref 
  ADD COLUMN IF NOT EXISTS brand VARCHAR(255) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS model VARCHAR(255) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS asset_number VARCHAR(255) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS equipment_type VARCHAR(255) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS capacity TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lifespan VARCHAR(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS usage_instructions TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS installation_location TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS maintenance_history TEXT DEFAULT NULL;

-- ============================================================================
-- 7. ตาราง: ตรวจสอบระบบการทำงานของเครื่องจักร (machinery_inspection)
-- ============================================================================
CREATE TABLE machinery_inspection (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    equipment_list TEXT[] NOT NULL DEFAULT '{}',
    status VARCHAR(100) NOT NULL DEFAULT 'ปกติทุกรายการ',
    abnormal_equipment TEXT DEFAULT NULL,
    cause TEXT DEFAULT NULL,
    solution TEXT DEFAULT NULL,
    image_url TEXT DEFAULT NULL,
    inspector VARCHAR(255) NOT NULL,
    remarks TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 8. ตาราง: ซ่อมบำรุง (maintenance_records)
-- ============================================================================
CREATE TABLE maintenance_records (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    location VARCHAR(255) NOT NULL DEFAULT 'อาคารระบบบำบัดน้ำเสีย',
    equipment_list TEXT[] NOT NULL DEFAULT '{}',
    job_type VARCHAR(100) NOT NULL CHECK (job_type IN ('ตรวจสอบ', 'ป้องกัน', 'แก้ไข', 'ซ่อมบำรุง')),
    problem TEXT NOT NULL,
    cause TEXT DEFAULT NULL,
    fix_method TEXT NOT NULL,
    fix_result TEXT NOT NULL,
    cost NUMERIC(12, 2) DEFAULT 0.00,
    image_url TEXT DEFAULT NULL,
    operator VARCHAR(255) NOT NULL,
    remarks TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 9. ตาราง: การบริหารความเสี่ยง (risk_management)
-- ============================================================================
CREATE TABLE risk_management (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    risk_name VARCHAR(255) NOT NULL,
    severity_level VARCHAR(50) NOT NULL CHECK (severity_level IN ('ต่ำ', 'กลาง', 'ปานกลาง', 'สูง', 'สูงมาก')),
    impact TEXT NOT NULL,
    likelihood VARCHAR(50) NOT NULL CHECK (likelihood IN ('ต่ำ', 'กลาง', 'ปานกลาง', 'สูง')),
    prevention_plan TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'กำลังดำเนินการ',
    risk_manager VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 10. ตาราง: เหตุการณ์ผิดปกติ (incident_records)
-- ============================================================================
CREATE TABLE incident_records (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    incident_type VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    severity VARCHAR(50) NOT NULL CHECK (severity IN ('เล็กน้อย', 'กลาง', 'ปานกลาง', 'รุนแรง', 'วิกฤต')),
    resolution_status VARCHAR(50) NOT NULL DEFAULT 'รอดำเนินการ',
    action_taken TEXT DEFAULT NULL,
    reporter VARCHAR(255) DEFAULT 'เจ้าหน้าที่ประจำเวร',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 11. ตาราง: บันทึกการใช้งานระบบ (system_logs)
-- ============================================================================
CREATE TABLE system_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_name VARCHAR(255) NOT NULL,
    action VARCHAR(150) NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    details TEXT DEFAULT NULL
);

-- ============================================================================
-- 12. ตาราง: รายงานรายเดือน (monthly_reports)
-- ============================================================================
CREATE TABLE monthly_reports (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    report_month VARCHAR(20) NOT NULL,
    total_wastewater_inflow NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_electricity_kwh NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    avg_ph NUMERIC(5, 2) DEFAULT 7.20,
    avg_do NUMERIC(5, 2) DEFAULT 3.10,
    avg_tds NUMERIC(8, 2) DEFAULT 340.00,
    avg_sediment NUMERIC(8, 2) DEFAULT 180.00,
    avg_chlorine NUMERIC(5, 2) DEFAULT 1.45,
    standard_pass_rate NUMERIC(5, 2) DEFAULT 100.00,
    total_cost NUMERIC(12, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 13. ตาราง: ระบบการเก็บข้อมูลรายงาน (report_storage)
-- ============================================================================
CREATE TABLE report_storage (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    report_date DATE NOT NULL DEFAULT CURRENT_DATE,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) DEFAULT 'รายงานสิ่งแวดล้อม',
    file_url TEXT NOT NULL,
    file_size VARCHAR(50) DEFAULT '2.4 MB',
    uploaded_by VARCHAR(255) DEFAULT 'แอดมินระบบ',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 14. ตาราง: คู่มือระบบบำบัด (treatment_manuals)
-- ============================================================================
CREATE TABLE treatment_manuals (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) DEFAULT 'คู่มือการปฏิบัติงาน (SOP)',
    file_url TEXT NOT NULL,
    file_size VARCHAR(50) DEFAULT '5.1 MB',
    uploaded_by VARCHAR(255) DEFAULT 'แอดมินระบบ',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- สร้าง Indexes เพื่อประสิทธิภาพการค้นหา
-- ============================================================================
CREATE INDEX idx_influent_recorded_at ON influent_wastewater (recorded_at DESC);
CREATE INDEX idx_electricity_recorded_at ON electricity_consumption (recorded_at DESC);
CREATE INDEX idx_water_quality_recorded_at ON preliminary_water_quality (recorded_at DESC);
CREATE INDEX idx_machinery_recorded_at ON machinery_inspection (recorded_at DESC);
CREATE INDEX idx_maintenance_recorded_at ON maintenance_records (recorded_at DESC);
CREATE INDEX idx_system_logs_recorded_at ON system_logs (recorded_at DESC);

-- ============================================================================
-- เปิดการใช้งาน Row Level Security (RLS) และเพิ่ม Policies สำหรับ Public / Authenticated
-- ============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE influent_wastewater ENABLE ROW LEVEL SECURITY;
ALTER TABLE electricity_consumption ENABLE ROW LEVEL SECURITY;
ALTER TABLE preliminary_water_quality ENABLE ROW LEVEL SECURITY;
ALTER TABLE quarterly_water_quality ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_ref ENABLE ROW LEVEL SECURITY;
ALTER TABLE machinery_inspection ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_management ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_storage ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_manuals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read All Users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Read All Influent" ON influent_wastewater FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Read All Electricity" ON electricity_consumption FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Read All Prelim" ON preliminary_water_quality FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Read All Quarterly" ON quarterly_water_quality FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Read All Equipment" ON equipment_ref FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Read All Machinery" ON machinery_inspection FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Read All Maintenance" ON maintenance_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Read All Risk" ON risk_management FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Read All Incident" ON incident_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Read All Logs" ON system_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Read All Reports" ON monthly_reports FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Read All Storage" ON report_storage FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Read All Manuals" ON treatment_manuals FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- ข้อมูลตัวอย่างเริ่มต้น (SAMPLE DATA INITIALIZATION)
-- ============================================================================

INSERT INTO users (username, password_hash, role, full_name, status, department) VALUES
('Sangtawan', 'Sangtawan123456789', 'admin', 'แสงตะวัน ส่องแสงงาม (Super Admin)', 'active', 'หัวหน้ากลุ่มงานบริหารสิ่งแวดล้อม'),
('officer01', 'officer123', 'user', 'นายสมชาย รักษ์สายน้ำ', 'active', 'หน่วยบำบัดน้ำเสีย'),
('technician01', 'tech123', 'technician', 'นายวิชัย เครื่องกลดี', 'active', 'หน่วยช่างเทคนิคและซ่อมบำรุง')
ON CONFLICT (username) DO NOTHING;

INSERT INTO equipment_ref (equipment_name, category, status) VALUES
('เครื่องสูบน้ำเสียดิบ (Submersible Pump 1)', 'ระบบสูบน้ำ', 'พร้อมใช้งาน'),
('เครื่องสูบน้ำเสียดิบ (Submersible Pump 2)', 'ระบบสูบน้ำ', 'พร้อมใช้งาน'),
('เครื่องเติมอากาศ (Surface Aerator 1)', 'ระบบเติมอากาศ', 'พร้อมใช้งาน'),
('เครื่องเติมอากาศ (Surface Aerator 2)', 'ระบบเติมอากาศ', 'พร้อมใช้งาน'),
('ปั๊มสูบจ่ายคลอรีน (Chlorine Dosing Pump)', 'ระบบฆ่าเชื้อ', 'พร้อมใช้งาน'),
('ปั๊มสูบตะกอนย้อนกลับ (RAS Pump)', 'ระบบตะกอน', 'พร้อมใช้งาน'),
('ถังตกตะกอน (Clarifier Tank)', 'ระบบตกตะกอน', 'พร้อมใช้งาน'),
('ตู้ควบคุมไฟฟ้าหลัก (Main Control Panel MDB)', 'ระบบควบคุมไฟฟ้า', 'พร้อมใช้งาน'),
('เครื่องวัดค่าออกซิเจนละลายน้ำออนไลน์ (DO Sensor)', 'ระบบตรวจวัด', 'พร้อมใช้งาน')
ON CONFLICT (equipment_name) DO NOTHING;

INSERT INTO influent_wastewater (recorded_at, meter_start, meter_today, total_water_used, wastewater_influent, meter_image_url, water_source, recorded_by, notes) VALUES
(NOW() - INTERVAL '4 days', 12450.00, 12580.00, 130.00, 104.00, 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500', 'อาคารผู้ป่วยใน (IPD)', 'นายสมชาย รักษ์สายน้ำ', 'การใช้น้ำปกติ'),
(NOW() - INTERVAL '3 days', 12580.00, 12725.00, 145.00, 116.00, 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=500', 'อาคารผู้ป่วยนอก (OPD)', 'นายสมชาย รักษ์สายน้ำ', 'ผู้รับบริการหนาแน่นช่วงเช้า'),
(NOW() - INTERVAL '2 days', 12725.00, 12860.00, 135.00, 108.00, 'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?w=500', 'อาคารบริการและโภชนาการ', 'นายสมชาย รักษ์สายน้ำ', 'การระบายน้ำจากห้องครัวและซักฟอก'),
(NOW() - INTERVAL '1 days', 12860.00, 13010.00, 150.00, 120.00, 'https://images.unsplash.com/photo-1581093458791-9f3c3900df4b?w=500', 'อาคารผู้ป่วยในและอาคารบริการ', 'นายสมชาย รักษ์สายน้ำ', 'ระบบทำงานสมบูรณ์'),
(NOW(), 13010.00, 13155.00, 145.00, 116.00, 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=500', 'รวมทุกอาคารโรงพยาบาล', 'แสงตะวัน ส่องแสงงาม (Super Admin)', 'บันทึกประจำวันปัจจุบัน');

INSERT INTO electricity_consumption (recorded_at, meter_start, meter_today, total_kwh, unit_price, electricity_cost, meter_image_url, recorded_by, notes) VALUES
(NOW() - INTERVAL '4 days', 45200.00, 45520.00, 320.00, 4.50, 1440.00, 'https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?w=500', 'นายวิชัย เครื่องกลดี', 'เครื่องเติมอากาศทำงาน 24 ชม.'),
(NOW() - INTERVAL '3 days', 45520.00, 45835.00, 315.00, 4.50, 1417.50, 'https://images.unsplash.com/photo-1558441719-8b389c6a0ca8?w=500', 'นายวิชัย เครื่องกลดี', 'ปั๊มสูบน้ำทำงานสลับอัตโนมัติ'),
(NOW() - INTERVAL '2 days', 45835.00, 46160.00, 325.00, 4.50, 1462.50, 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=500', 'นายวิชัย เครื่องกลดี', 'ทำงานปกติ'),
(NOW() - INTERVAL '1 days', 46160.00, 46490.00, 330.00, 4.50, 1485.00, 'https://images.unsplash.com/photo-1509391365360-2e959784a276?w=500', 'นายวิชัย เครื่องกลดี', 'ทดสอบเปิดปั๊มสำรอง'),
(NOW(), 46490.00, 46810.00, 320.00, 4.50, 1440.00, 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?w=500', 'แสงตะวัน ส่องแสงงาม (Super Admin)', 'บันทึกประจำวันปัจจุบัน');

INSERT INTO preliminary_water_quality (recorded_at, sampling_point, ph, do_value, tds, chlorine, sediment, status, inspector, remarks) VALUES
(NOW() - INTERVAL '4 days', 'จุดระบายน้ำทิ้งส่วนกลาง (Effluent Tank)', 7.30, 3.20, 340.00, 1.50, 180.00, 'ผ่านเกณฑ์', 'นายสมชาย รักษ์สายน้ำ', 'น้ำใส ไร้กลิ่น ค่าปกติทั้งหมด'),
(NOW() - INTERVAL '3 days', 'บ่อเติมอากาศ (Aeration Tank)', 7.15, 2.80, 380.00, 1.40, 210.00, 'ผ่านเกณฑ์', 'นายสมชาย รักษ์สายน้ำ', 'การเจริญเติบโตของจุลินทรีย์ดี'),
(NOW() - INTERVAL '2 days', 'บ่อตกตะกอน (Clarifier Tank)', 7.40, 3.50, 310.00, 1.60, 160.00, 'ผ่านเกณฑ์', 'นายสมชาย รักษ์สายน้ำ', 'ตะกอนตกตัวดีมาก'),
(NOW() - INTERVAL '1 days', 'จุดระบายน้ำทิ้งส่วนกลาง (Effluent Tank)', 7.25, 3.10, 355.00, 1.55, 190.00, 'ผ่านเกณฑ์', 'นายสมชาย รักษ์สายน้ำ', 'ผ่านเกณฑ์มาตรฐานโรงพยาบาล'),
(NOW(), 'จุดระบายน้ำทิ้งส่วนกลาง (Effluent Tank)', 7.35, 3.40, 325.00, 1.50, 175.00, 'ผ่านเกณฑ์', 'แสงตะวัน ส่องแสงงาม (Super Admin)', 'ผลตรวจประจำวันสมบูรณ์');

INSERT INTO quarterly_water_quality (sampling_date, sampling_point, ph, ss, tds, tss, tkn, go, sulfide, bod, cod, tcb, fcb, status, action_taken, lab_report_file, inspector, remarks) VALUES
('2026-03-15', 'บ่อพักน้ำทิ้งขั้นสุดท้ายก่อนปล่อยสู่สาธารณะ', 7.40, 18.50, 380.00, 12.00, 14.50, 4.20, 0.15, 8.50, 35.00, 240.00, 45.00, 'ผ่านเกณฑ์มาตรฐาน', 'ส่งตรวจห้องแล็บภายนอกที่ได้รับการรับรอง ISO/IEC 17025 ผลผ่านทุกดัชนี', 'https://example.com/lab-report-q1-2026.pdf', 'แสงตะวัน ส่องแสงงาม (Super Admin)', 'มาตรฐานน้ำทิ้งโรงพยาบาลประเภท ก'),
('2026-06-20', 'บ่อพักน้ำทิ้งขั้นสุดท้ายก่อนปล่อยสู่สาธารณะ', 7.20, 16.00, 360.00, 10.50, 12.80, 3.80, 0.10, 7.20, 30.00, 180.00, 30.00, 'ผ่านเกณฑ์มาตรฐาน', 'ผลวิเคราะห์คุณภาพน้ำไตรมาส 2 ผ่านเกณฑ์มาตรฐานกรมควบคุมมลพิษ 100%', 'https://example.com/lab-report-q2-2026.pdf', 'แสงตะวัน ส่องแสงงาม (Super Admin)', 'ผ่านเกณฑ์ดีเยี่ยม');

INSERT INTO machinery_inspection (recorded_at, equipment_list, status, abnormal_equipment, cause, solution, image_url, inspector, remarks) VALUES
(NOW() - INTERVAL '2 days', ARRAY['เครื่องสูบน้ำเสียดิบ (Submersible Pump 1)', 'เครื่องเติมอากาศ (Surface Aerator 1)', 'ปั๊มสูบจ่ายคลอรีน (Chlorine Dosing Pump)'], 'ปกติทุกรายการ', NULL, NULL, NULL, 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500', 'นายวิชัย เครื่องกลดี', 'แรงดันและกระแสไฟปกติทุกเครื่อง'),
(NOW() - INTERVAL '1 days', ARRAY['เครื่องเติมอากาศ (Surface Aerator 2)', 'ปั๊มสูบตะกอนย้อนกลับ (RAS Pump)'], 'ผิดปกติ 1 รายการ', 'ปั๊มสูบตะกอนย้อนกลับ (RAS Pump)', 'มีเศษผ้าอุดตันที่ใบพัดปั๊มสูบ', 'ทำการยกปั๊มขึ้นมาล้างทำความสะอาดเศษอุดตันและทดสอบรันใหม่', 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=500', 'นายวิชัย เครื่องกลดี', 'แก้ไขเรียบร้อยใน 1 ชั่วโมง'),
(NOW(), ARRAY['เครื่องสูบน้ำเสียดิบ (Submersible Pump 1)', 'เครื่องสูบน้ำเสียดิบ (Submersible Pump 2)', 'เครื่องเติมอากาศ (Surface Aerator 1)', 'ถังตกตะกอน (Clarifier Tank)'], 'ปกติทุกรายการ', NULL, NULL, NULL, 'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?w=500', 'แสงตะวัน ส่องแสงงาม (Super Admin)', 'ตรวจเช็คประจำรอบเช้า อุปกรณ์ทำงานสมบูรณ์');

INSERT INTO maintenance_records (recorded_at, location, equipment_list, job_type, problem, cause, fix_method, fix_result, cost, image_url, operator, remarks) VALUES
(NOW() - INTERVAL '5 days', 'บ่อเติมอากาศ Aeration Tank', ARRAY['เครื่องเติมอากาศ (Surface Aerator 1)'], 'ป้องกัน', 'บำรุงรักษาเชิงป้องกันตามรอบ 6 เดือน', 'ตามแผนงาน PM', 'เปลี่ยนถ่ายน้ำมันหล่อลื่นเกียร์และอัดจาระบีลูกปืน', 'เสียงเดินเครื่องเงียบลง อัตราการสั่นสะเทือนปกติ', 3500.00, 'https://images.unsplash.com/photo-1581093458791-9f3c3900df4b?w=500', 'นายวิชัย เครื่องกลดี', 'ดำเนินการตามคู่มือมาตรฐาน'),
(NOW() - INTERVAL '1 days', 'ห้องสูบจ่ายสารเคมี', ARRAY['ปั๊มสูบจ่ายคลอรีน (Chlorine Dosing Pump)'], 'แก้ไข', 'ท่อส่งคลอรีนรั่วซึมเล็กน้อย', 'สายยางเกิดการแข็งตัวจากสารเคมี', 'เปลี่ยนสายท่อเทฟลอนใหม่และเปลี่ยนโอริงกันรั่ว', 'ระบบสูบจ่ายคลอรีนทำงานแม่นยำ ไม่พบการรั่วซึม', 1200.00, 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=500', 'นายวิชัย เครื่องกลดี', 'ตรวจเช็คซ้ำแล้วปลอดภัย 100%');

INSERT INTO risk_management (recorded_at, risk_name, severity_level, impact, likelihood, prevention_plan, status, risk_manager) VALUES
(NOW() - INTERVAL '10 days', 'ความเสี่ยงไฟฟ้าดับในโรงพยาบาลกระทบระบบบำบัดน้ำเสีย', 'สูง', 'เครื่องเติมอากาศหยุดทำงาน จุลินทรีย์ขาดออกซิเจน น้ำเสียล้นระบบ', 'ปานกลาง', 'เชื่อมต่อระบบไฟฟ้าฉุกเฉิน (Generator Backup) และติดตั้งระบบแจ้งเตือน SMS/Line Notify ทันทีเมื่อไฟดับ', 'ควบคุมได้', 'แสงตะวัน ส่องแสงงาม (Super Admin)'),
(NOW() - INTERVAL '5 days', 'สารเคมีฆ่าเชื้อคลอรีนตกค้างหมดกะทันหัน', 'ปานกลาง', 'ไม่สามารถฆ่าเชื้อโรคในน้ำทิ้งก่อนระบายออกได้', 'ต่ำ', 'กำหนดระดับสารเคมีขั้นต่ำ (Safety Stock) 15 วัน และตรวจเช็คสต็อกทุกสัปดาห์', 'ควบคุมได้', 'นายสมชาย รักษ์สายน้ำ');

INSERT INTO incident_records (recorded_at, incident_type, description, severity, resolution_status, action_taken, reporter) VALUES
(NOW() - INTERVAL '7 days', 'ฟองลอยบนผิวน้ำบ่อตกตะกอน', 'พบฟองสีน้ำตาลหนาแน่นในบ่อเติมอากาศเนื่องจากโหลดสารอินทรีย์เพิ่มขึ้น', 'ปานกลาง', 'แก้ไขแล้วเสร็จ', 'ปรับเพิ่มอัตราการสูบตะกอนย้อนกลับ (RAS) และลดระยะเวลาเก็บกักตะกอน', 'นายสมชาย รักษ์สายน้ำ'),
(NOW() - INTERVAL '2 days', 'แรงดันน้ำท่อส่งลดลง', 'ตะแกรงดักขยะหน้าทางเข้าบ่อสูบมีใบไม้และเศษขยะติด', 'เล็กน้อย', 'แก้ไขแล้วเสร็จ', 'เก็บขยะและฉีดล้างตะแกรงดักขยะ', 'นายวิชัย เครื่องกลดี');

INSERT INTO system_logs (user_name, action, recorded_at, details) VALUES
('Sangtawan', 'เข้าสู่ระบบ', NOW() - INTERVAL '2 hours', 'เข้าสู่ระบบสำเร็จจาก IP: 192.168.1.105'),
('Sangtawan', 'บันทึกข้อมูลน้ำเสีย', NOW() - INTERVAL '1 hours', 'บันทึกมิเตอร์น้ำประจำวัน 13155 ลบ.ม.'),
('officer01', 'ตรวจวัดคุณภาพน้ำ', NOW() - INTERVAL '30 minutes', 'บันทึกผลตรวจ DO: 3.4, pH: 7.35 ผ่านเกณฑ์');

INSERT INTO monthly_reports (report_month, total_wastewater_inflow, total_electricity_kwh, avg_ph, avg_do, avg_tds, avg_sediment, avg_chlorine, standard_pass_rate, total_cost) VALUES
('2026-06', 4320.50, 9450.00, 7.28, 3.15, 345.00, 185.00, 1.48, 100.00, 42525.00),
('2026-07', 4480.00, 9720.00, 7.32, 3.20, 338.00, 178.00, 1.52, 100.00, 43740.00),
('2026-08', 4150.25, 8950.00, 7.30, 3.30, 329.00, 172.00, 1.50, 100.00, 40275.00);

INSERT INTO report_storage (report_date, title, category, file_url, file_size, uploaded_by) VALUES
('2026-06-30', 'รายงานสรุปผลการเดินระบบบำบัดน้ำเสีย ประจำไตรมาส 2/2569', 'รายงานสิ่งแวดล้อม', 'https://example.com/docs/wastewater_q2_2026.pdf', '3.8 MB', 'แสงตะวัน ส่องแสงงาม (Super Admin)'),
('2026-07-31', 'รายงานการตรวจสอบคุณภาพสิ่งแวดล้อมและน้ำทิ้งโรงพยาบาล กรกฎาคม 2569', 'รายงานวิเคราะห์คุณภาพน้ำ', 'https://example.com/docs/env_report_jul2026.pdf', '2.1 MB', 'แสงตะวัน ส่องแสงงาม (Super Admin)');

INSERT INTO treatment_manuals (title, category, file_url, file_size, uploaded_by) VALUES
('คู่มือมาตรฐานการปฏิบัติงานระบบบำบัดน้ำเสียแบบเติมอากาศ (Activated Sludge SOP)', 'คู่มือการปฏิบัติงาน (SOP)', 'https://example.com/manuals/activated_sludge_sop.pdf', '5.4 MB', 'แสงตะวัน ส่องแสงงาม (Super Admin)'),
('คู่มือการตรวจวัดและควบคุมคุณภาพน้ำทิ้งตามมาตรฐานโรงพยาบาล', 'คู่มือคุณภาพและการตรวจวัด', 'https://example.com/manuals/water_quality_testing_guide.pdf', '4.2 MB', 'แสงตะวัน ส่องแสงงาม (Super Admin)'),
('แนวทางการบำรุงรักษาเครื่องจักรและปั๊มน้ำเสีย (Preventive Maintenance Manual)', 'คู่มือซ่อมบำรุงเครื่องจักร', 'https://example.com/manuals/machinery_pm_guide.pdf', '6.8 MB', 'แสงตะวัน ส่องแสงงาม (Super Admin)');

-- ============================================================================
-- ปลดล็อก ROW LEVEL SECURITY (RLS) เพื่อให้ระบบหน้าเว็บสามารถอ่าน/บันทึก/แก้ไข/ลบ ได้ 100%
-- ============================================================================
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE influent_wastewater DISABLE ROW LEVEL SECURITY;
ALTER TABLE electricity_consumption DISABLE ROW LEVEL SECURITY;
ALTER TABLE preliminary_water_quality DISABLE ROW LEVEL SECURITY;
ALTER TABLE quarterly_water_quality DISABLE ROW LEVEL SECURITY;
ALTER TABLE machinery_inspection DISABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_ref DISABLE ROW LEVEL SECURITY;
ALTER TABLE risk_management DISABLE ROW LEVEL SECURITY;
ALTER TABLE incident_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE report_storage DISABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_manuals DISABLE ROW LEVEL SECURITY;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

