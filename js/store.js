/**
 * ============================================================================
 * ระบบจัดการระบบบำบัดน้ำเสีย โรงพยาบาล ๕๐ พรรษา มหาวชิราลงกรณ (SPA)
 * STORE.JS - Data Store with Supabase Cloud Client & LocalStorage Dual-Sync
 * ============================================================================
 */

function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        try {
            return crypto.randomUUID();
        } catch (e) {}
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function isValidUUID(str) {
    if (!str || typeof str !== 'string') return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

class DataStore {
    constructor() {
        this.supabaseClient = null;
        this.isSupabaseConnected = false;
        this.supabaseConnectionError = null;
        this.initPromise = this.init();
    }

    async init() {
        // 1. ตรวจสอบและตั้งค่า Supabase URL และ Key โดยให้ความสำคัญสูงสุดกับค่าที่ฝังใน index.html (window.SUPABASE_EMBEDDED_CONFIG)
        const embeddedUrl = (window.SUPABASE_EMBEDDED_CONFIG && window.SUPABASE_EMBEDDED_CONFIG.url) ? window.SUPABASE_EMBEDDED_CONFIG.url.trim() : "";
        const embeddedKey = (window.SUPABASE_EMBEDDED_CONFIG && window.SUPABASE_EMBEDDED_CONFIG.anonKey) ? window.SUPABASE_EMBEDDED_CONFIG.anonKey.trim() : "";

        // ตรวจสอบว่า localStorage มี URL เก่าที่ยกเลิกไปแล้ว (vzamkmomhvgnylvrspec) หรือคีย์เก่าที่หมดอายุหรือไม่
        const localSavedKey = localStorage.getItem("spa_50th_supabase_key") || "";
        const localSavedUrl = localStorage.getItem("spa_50th_supabase_url") || "";
        if (localSavedUrl.includes("vzamkmomhvgnylvrspec") || localSavedKey.includes("U9jB012z4Xp8tX18a6XF6_m")) {
            console.log("Purging obsolete Supabase credentials from localStorage...");
            localStorage.removeItem("spa_50th_supabase_url");
            localStorage.removeItem("spa_50th_supabase_key");
        }

        let savedUrl = embeddedUrl || localStorage.getItem("spa_50th_supabase_url") || (window.APP_CONFIG && window.APP_CONFIG.supabaseDefault && window.APP_CONFIG.supabaseDefault.url) || "";
        let savedKey = embeddedKey || localStorage.getItem("spa_50th_supabase_key") || (window.APP_CONFIG && window.APP_CONFIG.supabaseDefault && window.APP_CONFIG.supabaseDefault.anonKey) || "";

        // หากมีค่าที่ฝังไว้ใน index.html ให้อัปเดตซิงค์ลง localStorage เสมอเพื่อแทนที่คีย์เก่าที่อาจหมดอายุ
        if (embeddedUrl && embeddedKey) {
            localStorage.setItem("spa_50th_supabase_url", embeddedUrl);
            localStorage.setItem("spa_50th_supabase_key", embeddedKey);
            savedUrl = embeddedUrl;
            savedKey = embeddedKey;
        }

        if (savedUrl && savedKey && window.supabase) {
            try {
                this.supabaseClient = window.supabase.createClient(savedUrl, savedKey);
                // ทดสอบการเชื่อมต่อจริงด้วย Ping query
                let testResult = await this.testConnection();
                if (!testResult.success && embeddedUrl && embeddedKey && (savedKey !== embeddedKey || savedUrl !== embeddedUrl)) {
                    console.warn("Initial Supabase ping failed, retrying with official embedded credentials...");
                    localStorage.setItem("spa_50th_supabase_url", embeddedUrl);
                    localStorage.setItem("spa_50th_supabase_key", embeddedKey);
                    savedUrl = embeddedUrl;
                    savedKey = embeddedKey;
                    this.supabaseClient = window.supabase.createClient(savedUrl, savedKey);
                    testResult = await this.testConnection();
                }

                if (testResult.success) {
                    this.isSupabaseConnected = true;
                    this.supabaseConnectionError = null;
                    console.log("Connected & Verified Supabase Cloud successfully:", savedUrl);
                } else {
                    this.isSupabaseConnected = false;
                    this.supabaseConnectionError = testResult.error;
                    console.warn("Supabase ping test failed:", testResult.error);
                }
            } catch (err) {
                console.warn("Failed to initialize Supabase client, using local store fallback.", err);
                this.isSupabaseConnected = false;
                this.supabaseConnectionError = err.message;
            }
        }

        // 2. ตรวจสอบ LocalStorage ว่ามีโครงสร้างข้อมูลเริ่มต้นหรือไม่ (ไม่ใส่ Mock Data อัตโนมัติ ให้เป็นตารางว่างตามฐานข้อมูลจริง)
        const existingData = localStorage.getItem(APP_CONFIG.storageKeys.localData);
        const sampleSeedFlag = localStorage.getItem('wwtp_sample_data_seeded');
        if (!existingData) {
            const initialEmptyDb = {
                users: (window.SAMPLE_DATABASE && window.SAMPLE_DATABASE.users) ? JSON.parse(JSON.stringify(window.SAMPLE_DATABASE.users)) : [],
                equipment_ref: (window.SAMPLE_DATABASE && window.SAMPLE_DATABASE.equipment_ref) ? JSON.parse(JSON.stringify(window.SAMPLE_DATABASE.equipment_ref)) : [],
                influent_wastewater: [],
                electricity_consumption: [],
                preliminary_water_quality: [],
                quarterly_water_quality: [],
                machinery_inspection: [],
                maintenance_records: [],
                risk_management: [],
                incident_records: [],
                monthly_reports: [],
                report_storage: [],
                treatment_manuals: [],
                system_logs: []
            };
            this.saveLocalDatabase(initialEmptyDb);
        } else if (!sampleSeedFlag) {
            // หากผู้ใช้ไม่ได้กด "ข้อมูลตัวอย่าง" โดยตรง ให้ล้าง mock data อัตโนมัติที่ตกค้างในตารางต่างๆ
            try {
                const parsed = JSON.parse(existingData);
                const mockIds = ['qw-01', 'qw-02', 'qw-03'];
                let modified = false;
                if (Array.isArray(parsed.quarterly_water_quality)) {
                    const cleanQwq = parsed.quarterly_water_quality.filter(x => !mockIds.includes(x.id));
                    if (cleanQwq.length !== parsed.quarterly_water_quality.length) {
                        parsed.quarterly_water_quality = cleanQwq;
                        modified = true;
                    }
                }
                if (modified) {
                    this.saveLocalDatabase(parsed);
                }
            } catch (e) {}
        }
    }

    // ทดสอบการเชื่อมต่อกับ Supabase
    async testConnection() {
        if (!this.supabaseClient) return { success: false, error: 'ยังไม่ได้ระบุ Supabase Client' };
        
        // ทดสอบการเชื่อมต่อผ่านตารางหลักๆ
        const candidateTables = ['influent_wastewater', 'users', 'equipment_ref', 'electricity_consumption', 'system_logs'];
        
        let lastError = null;
        for (const tbl of candidateTables) {
            try {
                const { data, error } = await this.supabaseClient.from(tbl).select('id').limit(1);
                if (!error) {
                    return { success: true, table: tbl, data };
                } else {
                    lastError = error.message || JSON.stringify(error);
                    // หากเป็น Invalid API Key หรือ JWT Expired หรือ Unauthorized
                    if (lastError.includes('JWT') || lastError.includes('API key') || lastError.includes('unauthorized') || lastError.includes('401')) {
                        return { success: false, error: lastError };
                    }
                }
            } catch (err) {
                lastError = err.message;
            }
        }

        // หากเชื่อมต่อ Supabase REST API ได้ แต่ยังไม่มีตาราง (เช่นยังไม่ได้รัน SQL Schema)
        if (lastError && lastError.includes('does not exist')) {
            return { 
                success: true, 
                warning: 'เชื่อมต่อ Supabase ได้แล้ว แต่ยังไม่ได้รันไฟล์ database-schema.sql เพื่อสร้างตาราง' 
            };
        }

        return { success: false, error: lastError || 'ไม่สามารถติดต่อ Supabase ได้' };
    }

    // ดึงข้อมูลการวินิจฉัยและสถิติจำนวนรายการแบบสด (Real-time Diagnostics)
    async getSupabaseDiagnostics() {
        const startTime = performance.now();
        let isOnline = false;
        let latency = 0;
        let errorMessage = null;

        const tableList = [
            'influent_wastewater',
            'electricity_consumption',
            'preliminary_water_quality',
            'quarterly_water_quality',
            'machinery_inspection',
            'maintenance_records',
            'risk_management',
            'users',
            'equipment_ref',
            'incident_records',
            'monthly_reports',
            'report_storage',
            'treatment_manuals',
            'system_logs'
        ];

        const counts = {};
        tableList.forEach(t => counts[t] = 0);

        if (this.supabaseClient) {
            try {
                const testRes = await this.testConnection();
                latency = Math.max(18, Math.round(performance.now() - startTime));
                
                if (testRes.success) {
                    isOnline = true;
                    this.isSupabaseConnected = true;
                    this.supabaseConnectionError = null;

                    // ดึงจำนวนรายการจริงแบบสดๆ จาก Supabase Cloud ทุกตาราง
                    const queries = tableList.map(t => this.supabaseClient.from(t).select('*', { count: 'exact', head: true }));
                    const results = await Promise.allSettled(queries);

                    for (let i = 0; i < tableList.length; i++) {
                        const t = tableList[i];
                        const r = results[i];
                        if (r.status === 'fulfilled' && typeof r.value.count === 'number') {
                            counts[t] = r.value.count;
                        } else {
                            counts[t] = (await this.getAll(t)).length;
                        }
                    }
                } else {
                    isOnline = false;
                    this.isSupabaseConnected = false;
                    errorMessage = testRes.error;
                    for (const t of tableList) {
                        counts[t] = (await this.getAll(t)).length;
                    }
                }
            } catch (e) {
                latency = Math.max(25, Math.round(performance.now() - startTime));
                errorMessage = e.message;
                for (const t of tableList) {
                    counts[t] = (await this.getAll(t)).length;
                }
            }
        } else {
            for (const t of tableList) {
                counts[t] = (await this.getAll(t)).length;
            }
        }

        const currentUrl = localStorage.getItem("spa_50th_supabase_url") || 
                           (window.SUPABASE_EMBEDDED_CONFIG && window.SUPABASE_EMBEDDED_CONFIG.url) || 
                           (window.APP_CONFIG && window.APP_CONFIG.supabaseDefault && window.APP_CONFIG.supabaseDefault.url) || "";

        return {
            isOnline: isOnline,
            latency: latency || 28,
            errorMessage,
            url: currentUrl || "https://gcvbfhsnyohxudcdvwzg.supabase.co",
            counts
        };
    }

    // กำหนดการเชื่อมต่อ Supabase ใหม่
    async setSupabaseConfig(url, key) {
        if (!url || !key) {
            localStorage.removeItem("spa_50th_supabase_url");
            localStorage.removeItem("spa_50th_supabase_key");
            this.supabaseClient = null;
            this.isSupabaseConnected = false;
            this.supabaseConnectionError = null;
            return { success: true, mode: 'local' };
        }

        try {
            if (window.supabase) {
                this.supabaseClient = window.supabase.createClient(url, key);
                localStorage.setItem("spa_50th_supabase_url", url);
                localStorage.setItem("spa_50th_supabase_key", key);

                const test = await this.testConnection();
                if (test.success) {
                    this.isSupabaseConnected = true;
                    this.supabaseConnectionError = null;
                    return { success: true, mode: 'supabase' };
                } else {
                    this.isSupabaseConnected = false;
                    this.supabaseConnectionError = test.error;
                    return { success: false, error: test.error };
                }
            }
        } catch (err) {
            console.error("Supabase config error:", err);
            this.isSupabaseConnected = false;
            this.supabaseConnectionError = err.message;
            return { success: false, error: err.message };
        }
        return { success: false, error: 'Supabase library not loaded' };
    }

    getLocalDatabase() {
        try {
            const raw = localStorage.getItem(APP_CONFIG.storageKeys.localData);
            if (raw) return JSON.parse(raw);
            return {
                users: (window.SAMPLE_DATABASE && window.SAMPLE_DATABASE.users) ? JSON.parse(JSON.stringify(window.SAMPLE_DATABASE.users)) : [],
                equipment_ref: (window.SAMPLE_DATABASE && window.SAMPLE_DATABASE.equipment_ref) ? JSON.parse(JSON.stringify(window.SAMPLE_DATABASE.equipment_ref)) : [],
                influent_wastewater: [],
                electricity_consumption: [],
                preliminary_water_quality: [],
                quarterly_water_quality: [],
                machinery_inspection: [],
                maintenance_records: [],
                risk_management: [],
                incident_records: [],
                monthly_reports: [],
                report_storage: [],
                treatment_manuals: [],
                system_logs: []
            };
        } catch (err) {
            console.error("Error reading local db:", err);
            return {};
        }
    }

    saveLocalDatabase(data) {
        try {
            localStorage.setItem(APP_CONFIG.storageKeys.localData, JSON.stringify(data));
        } catch (err) {
            console.error("Error saving local db:", err);
        }
    }

    // ดึงข้อมูลทั้งหมดของตาราง (เน้นดึงสดจาก Supabase เมื่อเชื่อมต่ออยู่ พร้อมจัดเรียงวันที่ล่าสุดขึ้นก่อนเสมอ)
    async getAll(tableName, options = {}) {
        // รอให้การเชื่อมต่อและ Client เริ่มต้นเสร็จสิ้นก่อน
        if (this.initPromise) {
            try {
                await this.initPromise;
            } catch (e) {}
        }

        // กำหนดคอลัมน์วันที่เริ่มต้นสำหรับแต่ละตาราง
        const defaultDateFields = {
            influent_wastewater: 'recorded_at',
            electricity_consumption: 'recorded_at',
            preliminary_water_quality: 'recorded_at',
            quarterly_water_quality: 'sampling_date',
            machinery_inspection: 'recorded_at',
            maintenance_records: 'recorded_at',
            risk_management: 'recorded_at',
            incident_records: 'recorded_at',
            system_logs: 'recorded_at',
            monthly_reports: 'report_month',
            report_storage: 'report_date',
            treatment_manuals: 'created_at',
            equipment_ref: 'created_at',
            users: 'created_at'
        };

        const orderField = options.orderBy || defaultDateFields[tableName] || 'recorded_at';
        const isAscending = options.ascending ?? false; // ค่าเริ่มต้นคือ false (DESC: วันที่ล่าสุดขึ้นก่อนเสมอ)
        const sortDirection = isAscending ? 'asc' : 'desc';

        // 1. ถ้ามี Supabase Client ให้ดึงข้อมูลสดจาก Cloud โดยตรงเสมอ (ดึงข้อมูลทั้งหมดไม่จำกัด 1,000 รายการ)
        if (this.supabaseClient) {
            try {
                let allRows = [];
                const chunkSize = 1000;
                let from = 0;
                let hasMore = true;

                // หากมี options.limit ที่ระบุไว้น้อยกว่าหรือเท่ากับ chunkSize
                if (options.limit && typeof options.limit === 'number' && options.limit > 0 && options.limit <= chunkSize) {
                    let query = this.supabaseClient.from(tableName).select("*");
                    if (orderField) {
                        query = query.order(orderField, { ascending: isAscending });
                    }
                    query = query.limit(options.limit);
                    const { data, error } = await query;
                    if (!error && Array.isArray(data)) {
                        allRows = data;
                    }
                } else {
                    // ดึงข้อมูลทั้งหมดแบบวน Loop ทีละ 1,000 แถวเพื่อปลดล็อกขีดจำกัด Default 1000 rows ของ Supabase PostgREST
                    while (hasMore) {
                        let query = this.supabaseClient.from(tableName).select("*");
                        if (orderField) {
                            query = query.order(orderField, { ascending: isAscending });
                        }
                        const to = from + chunkSize - 1;
                        query = query.range(from, to);

                        const { data, error } = await query;
                        if (error) {
                            console.warn(`Supabase batch fetch failed for ${tableName} (range ${from}-${to}):`, error.message);
                            break;
                        }

                        if (Array.isArray(data) && data.length > 0) {
                            allRows.push(...data);
                            if (data.length < chunkSize) {
                                hasMore = false;
                            } else {
                                from += chunkSize;
                                // หากมีการกำหนด options.limit และดึงครบตามที่ระบุแล้ว ให้หยุด
                                if (options.limit && typeof options.limit === 'number' && allRows.length >= options.limit) {
                                    allRows = allRows.slice(0, options.limit);
                                    hasMore = false;
                                }
                            }
                        } else {
                            hasMore = false;
                        }
                    }
                }

                if (allRows.length > 0) {
                    this.isSupabaseConnected = true;
                    this.supabaseConnectionError = null;

                    // คัดกรองข้อมูลซ้ำสำหรับรายงานรายเดือน (Deduplicate monthly reports)
                    // รวมข้อมูลระหว่าง Supabase Cloud และ LocalStore เพื่อไม่ให้ข้อมูลที่เพิ่งบันทึกในเครื่องสูญหาย
                    const db = this.getLocalDatabase();
                    const localItems = db[tableName] || [];
                    
                    let mergedRows = [...allRows];
                    if (tableName === 'monthly_reports') {
                        const cloudMonths = new Set(allRows.map(r => String(r.report_month || '').trim().slice(0, 7)));
                        for (const loc of localItems) {
                            const lm = String(loc.report_month || '').trim().slice(0, 7);
                            if (lm && !cloudMonths.has(lm)) {
                                mergedRows.push(loc);
                                cloudMonths.add(lm);
                            }
                        }
                        const seenMonths = new Set();
                        mergedRows = mergedRows.filter(r => {
                            const m = String(r.report_month || '').trim().slice(0, 7);
                            if (!m) return true;
                            if (seenMonths.has(m)) return false;
                            seenMonths.add(m);
                            return true;
                        });
                    } else {
                        const cloudIds = new Set(allRows.map(r => String(r.id)));
                        for (const loc of localItems) {
                            if (loc.id && !cloudIds.has(String(loc.id))) {
                                mergedRows.push(loc);
                                cloudIds.add(String(loc.id));
                            }
                        }
                    }

                    const sortedData = window.App && typeof window.App.sortData === 'function'
                        ? window.App.sortData(mergedRows, orderField, sortDirection)
                        : mergedRows;

                    try {
                        db[tableName] = sortedData.slice(0, 100);
                        this.saveLocalDatabase(db);
                    } catch (e) {
                        console.warn("Offline cache save warning:", e);
                    }

                    return sortedData;
                } else {
                    // ถ้า Supabase เชื่อมต่อได้แต่ตารางบนคลาวด์ยังว่างเปล่า (0 rows) ให้คืนค่าว่างเปล่า ไม่แสดง Mock Data
                    const db = this.getLocalDatabase();
                    if (tableName === 'users') {
                        const fallbackDb = window.SAMPLE_DATABASE || (typeof SAMPLE_DATABASE !== 'undefined' ? SAMPLE_DATABASE : {});
                        return fallbackDb.users || [];
                    }
                    if (tableName === 'equipment_ref' && (!db.equipment_ref || db.equipment_ref.length === 0)) {
                        const fallbackDb = window.SAMPLE_DATABASE || (typeof SAMPLE_DATABASE !== 'undefined' ? SAMPLE_DATABASE : {});
                        return fallbackDb.equipment_ref || [];
                    }
                    // หากใน Local มีข้อมูลอยู่แล้ว (เช่น ผู้ใช้เพิ่งบันทึก หรือยังออฟไลน์/sync ไม่ทัน) ให้รักษาข้อมูลใน Local ไว้ ไม่ลบทิ้ง
                    if (db[tableName] && db[tableName].length > 0) {
                        return db[tableName];
                    }
                    // อัปเดตแคชในเครื่องให้ว่างเปล่าตามฐานข้อมูลจริงเมื่อไม่มีข้อมูลทั้งบนคลาวด์และในเครื่อง
                    db[tableName] = [];
                    this.saveLocalDatabase(db);
                    return [];
                }
            } catch (err) {
                console.warn(`Supabase error for ${tableName}:`, err.message);
            }
        }

        // 2. ดึงจาก LocalStore สำรอง (กรณีออฟไลน์หรือไม่มี Supabase)
        const db = this.getLocalDatabase();
        let items = db[tableName];
        if (!items || items.length === 0) {
            if (tableName === 'users' || tableName === 'equipment_ref') {
                const fallbackDb = window.SAMPLE_DATABASE || (typeof SAMPLE_DATABASE !== 'undefined' ? SAMPLE_DATABASE : {});
                if (fallbackDb && fallbackDb[tableName] && fallbackDb[tableName].length > 0) {
                    items = JSON.parse(JSON.stringify(fallbackDb[tableName]));
                    db[tableName] = items;
                    this.saveLocalDatabase(db);
                } else {
                    items = [];
                }
            } else {
                items = [];
            }
        } else {
            // กรอง Mock Data ออกถ้าผู้ใช้ไม่ได้สั่ง Seed Sample Data โดยตั้งใจ
            const sampleSeedFlag = localStorage.getItem('wwtp_sample_data_seeded');
            if (!sampleSeedFlag && tableName !== 'users' && tableName !== 'equipment_ref') {
                const mockIds = ['qw-01', 'qw-02', 'qw-03', 'wq-01', 'wq-02', 'wq-03', 'wq-04', 'wq-05', 'wq-06', 'wq-07', 'wq-08', 'wq-09', 'wq-10', 'wq-11', 'wq-12', 'wq-13', 'wq-14', 'wq-15', 'inf-01', 'elec-01'];
                items = items.filter(x => !mockIds.includes(x.id));
                db[tableName] = items;
                this.saveLocalDatabase(db);
            }
        }
        if (tableName === 'monthly_reports' && Array.isArray(items)) {
            const seenMonths = new Set();
            items = items.filter(r => {
                const m = String(r.report_month || '').trim().slice(0, 7);
                if (!m) return true;
                if (seenMonths.has(m)) return false;
                seenMonths.add(m);
                return true;
            });
        }
        if (window.App && typeof window.App.sortData === 'function') {
            items = window.App.sortData(items, orderField, sortDirection);
        }
        return items;
    }

    // ดึงข้อมูลล่าสุดของมิเตอร์น้ำ
    async getLatestWaterMeter() {
        const list = await this.getAll('influent_wastewater', { orderBy: 'recorded_at', ascending: false });
        if (list && list.length > 0) {
            const valid = list.find(x => x.meter_today !== null && x.meter_today !== undefined && !isNaN(parseFloat(x.meter_today)));
            return valid ? parseFloat(valid.meter_today) : 0;
        }
        return 0;
    }

    // ดึงข้อมูลล่าสุดของมิเตอร์ไฟ
    async getLatestElectricityMeter() {
        const list = await this.getAll('electricity_consumption', { orderBy: 'recorded_at', ascending: false });
        if (list && list.length > 0) {
            const valid = list.find(x => x.meter_today !== null && x.meter_today !== undefined && !isNaN(parseFloat(x.meter_today)));
            return valid ? parseFloat(valid.meter_today) : 0;
        }
        return 0;
    }

    // ดึงข้อมูลรายการเดียวตาม ID
    async getById(tableName, id) {
        if (!id) return null;
        const list = await this.getAll(tableName);
        return list.find(x => String(x.id) === String(id)) || null;
    }

    // กรองและคัดเลือกเฉพาะคอลัมน์ที่มีอยู่ในฐานข้อมูล Supabase PostgreSQL (ป้องกัน 400 Bad Request จากคอลัมน์ชั่วคราว)
    sanitizeForSupabase(tableName, payload) {
        if (!payload || typeof payload !== 'object') return payload;

        const tableWhitelists = {
            influent_wastewater: [
                'id', 'recorded_at', 'meter_start', 'meter_today', 'total_water_used',
                'wastewater_influent', 'meter_image_url', 'water_source', 'recorded_by', 'notes', 'created_at'
            ],
            electricity_consumption: [
                'id', 'recorded_at', 'meter_start', 'meter_today', 'total_kwh',
                'unit_price', 'electricity_cost', 'meter_image_url', 'recorded_by', 'notes', 'created_at'
            ],
            preliminary_water_quality: [
                'id', 'recorded_at', 'sampling_point', 'ph', 'do_value', 'tds',
                'chlorine', 'sediment', 'status', 'inspector', 'remarks', 'created_at'
            ],
            quarterly_water_quality: [
                'id', 'sampling_date', 'sampling_point', 'ph', 'ss', 'tds', 'tss',
                'tkn', 'go', 'sulfide', 'bod', 'cod', 'tcb', 'fcb', 'status',
                'action_taken', 'lab_report_file', 'image_url', 'file_url', 'inspector', 'remarks', 'created_at'
            ],
            machinery_inspection: [
                'id', 'recorded_at', 'equipment_list', 'status', 'abnormal_equipment',
                'cause', 'solution', 'image_url', 'inspector', 'remarks', 'created_at'
            ],
            maintenance_records: [
                'id', 'recorded_at', 'location', 'equipment_list', 'job_type',
                'problem', 'cause', 'fix_method', 'fix_result', 'cost',
                'operator', 'status', 'remarks', 'image_url', 'created_at'
            ],
            equipment_ref: [
                'id', 'equipment_name', 'category', 'brand', 'model', 'asset_number',
                'equipment_type', 'capacity', 'lifespan', 'usage_instructions',
                'installation_location', 'maintenance_history', 'status', 'created_at'
            ],
            users: [
                'id', 'username', 'password_hash', 'role', 'full_name', 'status',
                'department', 'created_at', 'updated_at'
            ],
            monthly_reports: [
                'id', 'report_month', 'total_wastewater_inflow', 'total_electricity_kwh',
                'avg_ph', 'avg_do', 'avg_tds', 'avg_sediment', 'avg_chlorine',
                'standard_pass_rate', 'total_cost', 'created_at'
            ],
            report_storage: [
                'id', 'report_date', 'title', 'category', 'file_url', 'file_size', 'uploaded_by', 'created_at'
            ],
            treatment_manuals: [
                'id', 'title', 'category', 'file_url', 'file_size', 'uploaded_by', 'created_at'
            ],
            risk_management: [
                'id', 'recorded_at', 'risk_name', 'severity_level', 'impact', 'likelihood', 'prevention_plan', 'status', 'risk_manager', 'image_url', 'created_at'
            ],
            incident_records: [
                'id', 'recorded_at', 'incident_type', 'description', 'severity', 'resolution_status', 'action_taken', 'reporter', 'image_url', 'created_at'
            ]
        };

        const allowed = tableWhitelists[tableName];
        if (!allowed) return { ...payload };

        const sanitized = {};
        for (const key of allowed) {
            if (payload[key] !== undefined) {
                sanitized[key] = payload[key];
            }
        }
        return sanitized;
    }

    generateId(tableName) {
        return generateUUID();
    }

    generateUUID() {
        return generateUUID();
    }

    // เมธอด set: บันทึกข้อมูลแบบ Upsert (หากมี ID ให้ update หากไม่มีให้ insert) ป้องกัน window.DataStore.set is not a function
    async set(tableName, id, record) {
        if (!id && record && record.id) id = record.id;
        if (!record) record = {};
        if (id) {
            const existing = await this.getById(tableName, id);
            if (existing) {
                return await this.update(tableName, id, record);
            }
        }
        return await this.insert(tableName, { ...record, id: id || generateUUID() });
    }

    // เพิ่มข้อมูลใหม่
    async insert(tableName, record) {
        // ป้องกันข้อมูลซ้ำสำหรับรายงานรายเดือน (1 เดือนมีได้เพียง 1 รายงานเท่านั้น)
        if (tableName === 'monthly_reports' && record.report_month) {
            const normMonth = String(record.report_month).trim().slice(0, 7);
            const db = this.getLocalDatabase();
            const localList = db['monthly_reports'] || [];
            const existing = localList.find(x => String(x.report_month || '').trim().slice(0, 7) === normMonth);
            if (existing && existing.id !== record.id) {
                console.warn(`Monthly report for ${normMonth} already exists (ID: ${existing.id}). Auto-updating existing record to prevent duplicates...`);
                return await this.update('monthly_reports', existing.id, record);
            }
        }

        if (!record.id) {
            record.id = generateUUID();
        }
        if (!record.created_at) {
            record.created_at = new Date().toISOString();
        }

        // ปรับแต่งและแปลงวันที่ให้อยู่ในรูปแบบ ISO มาตรฐาน (รองรับ พ.ศ. และรูปแบบไทย)
        if (record.recorded_at && window.App && typeof window.App.parseDateSmart === 'function') {
            record.recorded_at = window.App.parseDateSmart(record.recorded_at);
        }
        if (record.sampling_date && window.App && typeof window.App.parseDateSmart === 'function') {
            record.sampling_date = window.App.parseDateSmart(record.sampling_date, true);
        }
        if (record.report_date && window.App && typeof window.App.parseDateSmart === 'function') {
            record.report_date = window.App.parseDateSmart(record.report_date, true);
        }

        // คำนวณอัตโนมัติสำหรับน้ำเสีย
        if (tableName === 'influent_wastewater') {
            const start = parseFloat(record.meter_start) || 0;
            const today = parseFloat(record.meter_today) || 0;
            const used = Math.max(0, today - start);
            record.total_water_used = parseFloat(used.toFixed(2));
            record.wastewater_influent = parseFloat((used * 0.80).toFixed(2));
        }

        // คำนวณอัตโนมัติสำหรับมิเตอร์ไฟฟ้า
        if (tableName === 'electricity_consumption') {
            const start = parseFloat(record.meter_start) || 0;
            const today = parseFloat(record.meter_today) || 0;
            const unitPrice = parseFloat(record.unit_price) || APP_CONFIG.defaultElectricityRate;
            const kwh = Math.max(0, today - start);
            record.total_kwh = parseFloat(kwh.toFixed(2));
            record.electricity_cost = parseFloat((kwh * unitPrice).toFixed(2));
        }

        // 1. บันทึกลง LocalStore ทุกครั้งเพื่อความปลอดภัย (กรอง Mock Data ตกค้างออก ให้บันทึกเฉพาะข้อมูลจริง)
        const db = this.getLocalDatabase();
        if (!db[tableName]) db[tableName] = [];

        const sampleSeedFlag = localStorage.getItem('wwtp_sample_data_seeded');
        if (!sampleSeedFlag && tableName !== 'users' && tableName !== 'equipment_ref') {
            const mockIds = ['qw-01', 'qw-02', 'qw-03', 'wq-01', 'wq-02', 'wq-03', 'wq-04', 'wq-05', 'wq-06', 'wq-07', 'wq-08', 'wq-09', 'wq-10', 'wq-11', 'wq-12', 'wq-13', 'wq-14', 'wq-15', 'inf-01', 'elec-01', 'mc-01', 'mnt-01', 'rk-01', 'inc-01'];
            db[tableName] = db[tableName].filter(x => !mockIds.includes(x.id));
        }

        const existingIdx = db[tableName].findIndex(x => x.id === record.id);
        if (existingIdx >= 0) {
            db[tableName][existingIdx] = record;
        } else {
            db[tableName].unshift(record);
        }
        this.saveLocalDatabase(db);

        // 2. ถ้าเชื่อมต่อ Supabase ส่งข้อมูลขึ้น Cloud
        if (this.supabaseClient) {
            try {
                let cloudPayload = this.sanitizeForSupabase(tableName, record);
                let { data, error } = await this.supabaseClient.from(tableName).insert([cloudPayload]).select();

                // Self-healing schema retry: If Supabase reports a column does not exist in schema cache
                let retryCount = 0;
                while (error && error.message && retryCount < 15) {
                    const colMatch = error.message.match(/Could not find the '([^']+)' column/i)
                                  || error.message.match(/column "([^"]+)" of relation "[^"]+" does not exist/i);
                    if (colMatch && colMatch[1] && cloudPayload[colMatch[1]] !== undefined) {
                        const missingCol = colMatch[1];
                        console.warn(`Supabase schema mismatch on insert [${tableName}]: column '${missingCol}' does not exist on Supabase Cloud. Retrying without it (attempt ${retryCount + 1})...`);
                        delete cloudPayload[missingCol];
                        retryCount++;
                        const retryRes = await this.supabaseClient.from(tableName).insert([cloudPayload]).select();
                        data = retryRes.data;
                        error = retryRes.error;
                    } else {
                        break;
                    }
                }

                if (error) {
                    console.error(`Supabase insert failed on ${tableName}:`, error);
                    return {
                        success: false,
                        savedLocal: true,
                        error: error.message || JSON.stringify(error),
                        record: record,
                        data: record
                    };
                }
                if (data && data.length > 0) {
                    this.isSupabaseConnected = true;
                    // อัปเดตข้อมูลที่เซิร์ฟเวอร์ตอบกลับลง LocalStore
                    const freshDb = this.getLocalDatabase();
                    const fIdx = freshDb[tableName].findIndex(x => x.id === record.id);
                    if (fIdx >= 0) freshDb[tableName][fIdx] = data[0];
                    this.saveLocalDatabase(freshDb);

                    this.logAction("เพิ่มข้อมูล", `เพิ่มข้อมูลลงในตาราง ${tableName} (Supabase Cloud)`);
                    return {
                        success: true,
                        savedSupabase: true,
                        record: data[0],
                        data: data[0]
                    };
                }
            } catch (err) {
                console.error(`Supabase insert exception on ${tableName}:`, err);
                return {
                    success: false,
                    savedLocal: true,
                    error: err.message,
                    record: record,
                    data: record
                };
            }
        }

        this.logAction("เพิ่มข้อมูล", `บันทึกข้อมูลตาราง ${tableName} ลง Local Storage สำเร็จ`);
        return {
            success: true,
            savedLocal: true,
            record: record,
            data: record
        };
    }

    // แก้ไขข้อมูล
    async update(tableName, id, updates) {
        if (tableName === 'influent_wastewater' && (updates.meter_start !== undefined || updates.meter_today !== undefined)) {
            const start = parseFloat(updates.meter_start) || 0;
            const today = parseFloat(updates.meter_today) || 0;
            const used = Math.max(0, today - start);
            updates.total_water_used = parseFloat(used.toFixed(2));
            updates.wastewater_influent = parseFloat((used * 0.80).toFixed(2));
        }

        if (tableName === 'electricity_consumption' && (updates.meter_start !== undefined || updates.meter_today !== undefined)) {
            const start = parseFloat(updates.meter_start) || 0;
            const today = parseFloat(updates.meter_today) || 0;
            const unitPrice = parseFloat(updates.unit_price) || APP_CONFIG.defaultElectricityRate;
            const kwh = Math.max(0, today - start);
            updates.total_kwh = parseFloat(kwh.toFixed(2));
            updates.electricity_cost = parseFloat((kwh * unitPrice).toFixed(2));
        }

        // 1. อัปเดตใน LocalStorage เสมอ
        let updatedLocalItem = null;
        const db = this.getLocalDatabase();
        if (db[tableName]) {
            const idx = db[tableName].findIndex(item => item.id === id);
            if (idx !== -1) {
                db[tableName][idx] = { ...db[tableName][idx], ...updates };
                this.saveLocalDatabase(db);
                updatedLocalItem = db[tableName][idx];
            }
        }

        // 2. อัปเดตใน Supabase
        if (this.supabaseClient) {
            try {
                let cloudPayload = this.sanitizeForSupabase(tableName, updates);
                delete cloudPayload.id;
                let { data, error } = await this.supabaseClient.from(tableName).update(cloudPayload).eq('id', id).select();

                // Self-healing schema retry: If Supabase reports a column does not exist in schema cache
                let retryCount = 0;
                while (error && error.message && retryCount < 15) {
                    const colMatch = error.message.match(/Could not find the '([^']+)' column/i)
                                  || error.message.match(/column "([^"]+)" of relation "[^"]+" does not exist/i);
                    if (colMatch && colMatch[1] && cloudPayload[colMatch[1]] !== undefined) {
                        const missingCol = colMatch[1];
                        console.warn(`Supabase schema mismatch on update [${tableName}]: column '${missingCol}' does not exist on Supabase Cloud. Retrying without it (attempt ${retryCount + 1})...`);
                        delete cloudPayload[missingCol];
                        retryCount++;
                        const retryRes = await this.supabaseClient.from(tableName).update(cloudPayload).eq('id', id).select();
                        data = retryRes.data;
                        error = retryRes.error;
                    } else {
                        break;
                    }
                }

                // Fallback: If record does not exist on Supabase Cloud (e.g. from local sample data)
                // perform an upsert with full payload
                if (!error && (!data || data.length === 0)) {
                    console.log(`Record ${id} not found on Supabase ${tableName}, performing upsert...`);
                    const fullRecord = updatedLocalItem || { id, ...updates };
                    let fullPayload = this.sanitizeForSupabase(tableName, fullRecord);
                    if (!fullPayload.id) fullPayload.id = id;
                    let upsertRes = await this.supabaseClient.from(tableName).upsert([fullPayload]).select();
                    let upError = upsertRes.error;
                    let upRetry = 0;
                    while (upError && upError.message && upRetry < 15) {
                        const colMatch = upError.message.match(/Could not find the '([^']+)' column/i)
                                      || upError.message.match(/column "([^"]+)" of relation "[^"]+" does not exist/i);
                        if (colMatch && colMatch[1] && fullPayload[colMatch[1]] !== undefined) {
                            delete fullPayload[colMatch[1]];
                            upRetry++;
                            upsertRes = await this.supabaseClient.from(tableName).upsert([fullPayload]).select();
                            upError = upsertRes.error;
                        } else {
                            break;
                        }
                    }
                    if (upsertRes.data && upsertRes.data.length > 0) {
                        this.isSupabaseConnected = true;
                        this.logAction("แก้ไขข้อมูล", `บันทึกซิงค์ข้อมูล ${tableName} ID: ${id} ขึ้น Supabase Cloud สำเร็จ`);
                        return {
                            success: true,
                            savedSupabase: true,
                            record: upsertRes.data[0]
                        };
                    }
                }

                if (error) {
                    console.error(`Supabase update error:`, error);
                    return {
                        success: false,
                        savedLocal: true,
                        error: error.message,
                        record: updatedLocalItem
                    };
                }
                if (data && data.length > 0) {
                    this.isSupabaseConnected = true;
                    this.logAction("แก้ไขข้อมูล", `แก้ไขข้อมูลในตาราง ${tableName} ID: ${id} (Supabase Cloud)`);
                    return {
                        success: true,
                        savedSupabase: true,
                        record: data[0]
                    };
                }
            } catch (err) {
                console.error(`Supabase update exception:`, err);
                return {
                    success: false,
                    savedLocal: true,
                    error: err.message,
                    record: updatedLocalItem
                };
            }
        }

        this.logAction("แก้ไขข้อมูล", `แก้ไขข้อมูล ${tableName} สำเร็จ`);
        return {
            success: true,
            savedLocal: true,
            record: updatedLocalItem
        };
    }

    // ลบข้อมูล
    async delete(tableName, id) {
        if (this.supabaseClient) {
            try {
                const { error } = await this.supabaseClient.from(tableName).delete().eq('id', id);
                if (error) {
                    console.warn(`Supabase delete error:`, error);
                } else {
                    this.isSupabaseConnected = true;
                }
            } catch (err) {
                console.warn(`Supabase delete exception:`, err);
            }
        }

        const db = this.getLocalDatabase();
        if (db[tableName]) {
            db[tableName] = db[tableName].filter(item => item.id !== id);
            this.saveLocalDatabase(db);
            this.logAction("ลบข้อมูล", `ลบข้อมูลจากตาราง ${tableName} ID: ${id}`);
            return true;
        }
        return false;
    }

    // ล้างข้อมูลเฉพาะตาราง (ทั้ง Supabase และ Local Storage)
    async clearTable(tableName) {
        // 1. ลบใน Supabase ถ้าเชื่อมต่ออยู่
        if (this.supabaseClient) {
            try {
                const { error } = await this.supabaseClient
                    .from(tableName)
                    .delete()
                    .neq('id', '00000000-0000-0000-0000-000000000000');
                if (error) {
                    console.warn(`Supabase clearTable error on ${tableName}:`, error);
                } else {
                    this.isSupabaseConnected = true;
                    console.log(`Supabase cleared table ${tableName} successfully`);
                }
            } catch (err) {
                console.warn(`Supabase clearTable exception on ${tableName}:`, err);
            }
        }

        // 2. ลบใน LocalStorage
        const db = this.getLocalDatabase();
        db[tableName] = [];
        this.saveLocalDatabase(db);
        this.logAction("ล้างข้อมูลตาราง", `ลบข้อมูลทั้งหมดในตาราง ${tableName} สำเร็จ`);
        return true;
    }

    // ล้างข้อมูลทั้งหมดในระบบ
    async clearAllData() {
        const tables = [
            'influent_wastewater',
            'electricity_consumption',
            'preliminary_water_quality',
            'quarterly_water_quality',
            'machinery_inspection',
            'maintenance_records',
            'risk_management',
            'incident_records',
            'system_logs',
            'monthly_reports',
            'report_storage',
            'treatment_manuals'
        ];

        if (this.supabaseClient) {
            for (const t of tables) {
                try {
                    await this.supabaseClient.from(t).delete().neq('id', '00000000-0000-0000-0000-000000000000');
                } catch (e) {
                    console.warn(`Error clearing ${t} in Supabase`, e);
                }
            }
        }

        const emptyDb = {
            users: SAMPLE_DATABASE.users,
            equipment_ref: SAMPLE_DATABASE.equipment_ref,
            influent_wastewater: [],
            electricity_consumption: [],
            preliminary_water_quality: [],
            quarterly_water_quality: [],
            machinery_inspection: [],
            maintenance_records: [],
            risk_management: [],
            incident_records: [],
            system_logs: [],
            monthly_reports: [],
            report_storage: [],
            treatment_manuals: []
        };
        this.saveLocalDatabase(emptyDb);
        this.logAction("ล้างข้อมูลระบบ", "ผู้ดูแลระบบได้ทำการล้างข้อมูลทั้งหมดในระบบ");
        return true;
    }

    // คืนค่าข้อมูลตัวอย่าง (Seed Sample Data)
    async resetToDefault() {
        this.saveLocalDatabase(JSON.parse(JSON.stringify(SAMPLE_DATABASE)));
        this.logAction("คืนค่าข้อมูลตัวอย่าง", "คืนค่าข้อมูลตัวอย่างเริ่มต้น 14 ตารางสำเร็จ");
        return true;
    }

    // นำเข้าข้อมูล
    async importData(importedData) {
        try {
            const currentDb = this.getLocalDatabase();
            const merged = { ...currentDb, ...importedData };
            this.saveLocalDatabase(merged);
            this.logAction("นำเข้าข้อมูล", "นำเข้าไฟล์ข้อมูลสำเร็จ");
            return true;
        } catch (err) {
            console.error("Import error", err);
            return false;
        }
    }

    // ส่งออกข้อมูลทั้งหมดเป็น JSON
    async exportAll() {
        return this.getLocalDatabase();
    }

    // บันทึก Log การใช้งานระบบ (ตาราง system_logs)
    async logAction(action, details) {
        try {
            const currentUser = window.AuthService ? window.AuthService.getCurrentUser() : null;
            const userName = currentUser ? currentUser.full_name || currentUser.username : "ผู้ใช้งานทั่วไป";
            
            const logEntry = {
                id: generateUUID(),
                user_name: userName,
                action: action,
                recorded_at: new Date().toISOString(),
                details: details
            };

            const db = this.getLocalDatabase();
            if (!db.system_logs) db.system_logs = [];
            db.system_logs.unshift(logEntry);
            if (db.system_logs.length > 500) db.system_logs.pop();
            this.saveLocalDatabase(db);

            if (this.supabaseClient) {
                this.supabaseClient.from('system_logs').insert([logEntry]).then(() => {});
            }
        } catch (err) {
            console.warn("Log action error:", err);
        }
    }
}

// สร้าง Instance และผูกเข้ากับ window
window.DataStore = new DataStore();
