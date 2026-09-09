/**
 * ============================================================================
 * ระบบจัดการระบบบำบัดน้ำเสีย โรงพยาบาล ๕๐ พรรษา มหาวชิราลงกรณ (SPA)
 * AUTH.JS - Authentication, Gatekeeper & Role-Based Access Control (RBAC)
 * ============================================================================
 */

class AuthService {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    init() {
        // ตรวจสอบเซสชันผู้ใช้เดิมใน SessionStorage เสมอ เพื่อบังคับให้ล็อกอินทุกครั้งที่เปิดใช้งานใหม่
        let saved = sessionStorage.getItem(APP_CONFIG.storageKeys.currentUser);
        
        // ถ้าผู้ใช้เคยเลือก "จดจำการเข้าสู่ระบบในอุปกรณ์นี้" (remember me)
        if (!saved) {
            const rememberMe = localStorage.getItem("spa_50th_remember_login");
            if (rememberMe === "true") {
                saved = localStorage.getItem(APP_CONFIG.storageKeys.currentUser);
            } else {
                // ล้างค่าเก่าที่อาจตกค้างใน localStorage ออกเพื่อป้องกันการ Auto-Login โดยไม่ตั้งใจ
                localStorage.removeItem(APP_CONFIG.storageKeys.currentUser);
            }
        }

        if (saved) {
            try {
                this.currentUser = JSON.parse(saved);
                if (this.currentUser && this.currentUser.full_name) {
                    this.currentUser.full_name = this.currentUser.full_name.replace(/\s*\(Super Admin\)/gi, '').trim();
                    if (this.currentUser.full_name === 'แสงตะวัน ส่องแสงงาม' || (this.currentUser.username || '').toLowerCase() === 'sangtawan') {
                        this.currentUser.full_name = 'แสงตะวัน ชาวเขา';
                        this.currentUser.department = 'งานสิ่งแวดล้อมและความปลอดภัย';
                    }
                }
            } catch (e) {
                this.currentUser = null;
            }
        } else {
            this.currentUser = null;
        }
        // ไม่มีการ Auto-Login อัตโนมัติ ต้องเข้าสู่ระบบก่อนเสมอ
    }

    // ดึงและอัปเดตข้อมูลผู้ใช้ล่าสุดจากฐานข้อมูล Supabase Cloud โดยตรง
    async refreshCurrentUserFromDB() {
        if (!this.currentUser || !this.currentUser.username) return;
        try {
            if (window.DataStore && window.DataStore.getAll) {
                const users = await window.DataStore.getAll('users');
                if (Array.isArray(users) && users.length > 0) {
                    const found = users.find(u => (u.username || '').toLowerCase() === this.currentUser.username.toLowerCase());
                    if (found && found.full_name) {
                        const cleanName = found.full_name.replace(/\s*\(Super Admin\)/gi, '').trim();
                        this.currentUser.full_name = cleanName;
                        if (found.department) this.currentUser.department = found.department;
                        if (found.role) this.currentUser.role = found.role;
                        if (found.id) this.currentUser.id = found.id;
                        this.saveSession(false);
                        if (window.App && window.App.updateUserUI) {
                            window.App.updateUserUI();
                        }
                    }
                }
            }
        } catch (e) {
            console.warn("Could not refresh current user from DB:", e);
        }
    }

    saveSession(remember = false) {
        if (this.currentUser) {
            const dataStr = JSON.stringify(this.currentUser);
            // บันทึกใน sessionStorage เสมอสำหรับการใช้งานในแท็บ/หน้าต่างปัจจุบัน
            sessionStorage.setItem(APP_CONFIG.storageKeys.currentUser, dataStr);
            if (remember) {
                localStorage.setItem(APP_CONFIG.storageKeys.currentUser, dataStr);
                localStorage.setItem("spa_50th_remember_login", "true");
            } else {
                localStorage.removeItem(APP_CONFIG.storageKeys.currentUser);
                localStorage.removeItem("spa_50th_remember_login");
            }
        } else {
            localStorage.removeItem(APP_CONFIG.storageKeys.currentUser);
            localStorage.removeItem("spa_50th_remember_login");
            sessionStorage.removeItem(APP_CONFIG.storageKeys.currentUser);
        }
    }

    isAuthenticated() {
        return !!this.currentUser;
    }

    getCurrentUser() {
        return this.currentUser;
    }

    isAdmin() {
        return this.currentUser && (this.currentUser.role === 'admin' || (this.currentUser.username || '').toLowerCase() === 'sangtawan');
    }

    async login(username, password, remember = true) {
        const uTrim = (username || '').trim();
        const pTrim = (password || '').trim();

        if (!uTrim || !pTrim) {
            return { success: false, message: "กรุณากรอกชื่อผู้ใช้งานและรหัสผ่านให้ครบถ้วน" };
        }

        // 1. ดึงและตรวจสอบข้อมูลโดยตรงจากฐานข้อมูล Users ใน DataStore / Supabase Cloud เสมอ
        let users = [];
        try {
            if (window.DataStore && window.DataStore.getAll) {
                users = await window.DataStore.getAll('users');
            }
        } catch (e) {
            console.warn("DataStore.getAll('users') error during login:", e);
        }

        const found = users.find(u => (u.username || '').toLowerCase() === uTrim.toLowerCase());

        if (found) {
            // ตรวจสอบรหัสผ่าน (ตรงกับ hash ในตาราง หรือ Super Admin default password)
            const isMatch = (found.password_hash === pTrim) || 
                            (uTrim.toLowerCase() === APP_CONFIG.superAdmin.username.toLowerCase() && pTrim === APP_CONFIG.superAdmin.defaultPassword);
            
            if (!isMatch) {
                return { success: false, message: "รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบรหัสผ่านอีกครั้ง" };
            }

            if (found.status === 'inactive') {
                return { success: false, message: "บัญชีผู้ใช้นี้ถูกระงับการใช้งานชั่วคราว กรุณาติดต่อผู้ดูแลระบบ" };
            }

            // นำข้อมูลชื่อและตำแหน่งมาจากฐานข้อมูลโดยตรง!
            this.currentUser = {
                id: found.id,
                username: found.username,
                full_name: (found.full_name || found.username).replace(/\s*\(Super Admin\)/gi, '').trim(),
                role: found.role || (found.username.toLowerCase() === APP_CONFIG.superAdmin.username.toLowerCase() ? 'admin' : 'user'),
                status: found.status || 'active',
                department: found.department || (found.username.toLowerCase() === APP_CONFIG.superAdmin.username.toLowerCase() ? 'งานสิ่งแวดล้อมและความปลอดภัย' : 'หน่วยบำบัดน้ำเสีย')
            };

            this.saveSession(remember);
            if (window.App && window.App.updateUserUI) {
                window.App.updateUserUI();
            }
            if (window.DataStore && window.DataStore.logAction) {
                window.DataStore.logAction("เข้าสู่ระบบ", `ผู้ใช้ ${this.currentUser.full_name} (${this.currentUser.username}) เข้าสู่ระบบสำเร็จ`);
            }
            return { success: true, user: this.currentUser };
        }

        // 2. Fallback กรณีพิเศษหากยังเชื่อมต่อ DB ไม่ได้ (เช่น โหมดออฟไลน์)
        if (uTrim === APP_CONFIG.superAdmin.username && pTrim === APP_CONFIG.superAdmin.defaultPassword) {
            this.currentUser = {
                id: "e4b6e792-fa82-478e-817c-bb3d29a4bd0d",
                username: APP_CONFIG.superAdmin.username,
                full_name: APP_CONFIG.superAdmin.fullName || "แสงตะวัน ชาวเขา",
                role: "admin",
                status: "active",
                department: "งานสิ่งแวดล้อมและความปลอดภัย"
            };
            this.saveSession(remember);
            if (window.App && window.App.updateUserUI) {
                window.App.updateUserUI();
            }
            if (window.DataStore && window.DataStore.logAction) {
                window.DataStore.logAction("เข้าสู่ระบบ", `Super Admin ${this.currentUser.username} เข้าสู่ระบบ`);
            }
            return { success: true, user: this.currentUser };
        }

        return { success: false, message: "ไม่พบชื่อผู้ใช้งานนี้ในระบบ กรุณาตรวจสอบหรือสมัครสมาชิกใหม่" };
    }

    async register(formData) {
        const uTrim = (formData.username || '').trim();
        const pTrim = (formData.password || '').trim();
        const fnTrim = (formData.full_name || '').trim();

        if (!uTrim || !pTrim || !fnTrim) {
            return { success: false, message: "กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน" };
        }

        if (uTrim.toLowerCase() === APP_CONFIG.superAdmin.username.toLowerCase()) {
            return { success: false, message: "ชื่อผู้ใช้นี้ถูกสงวนไว้สำหรับผู้ดูแลระบบหลัก" };
        }

        const users = await window.DataStore.getAll('users');
        const exists = users.some(u => (u.username || '').toLowerCase() === uTrim.toLowerCase());

        if (exists) {
            return { success: false, message: "ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น" };
        }

        const newUser = {
            id: 'u-' + Date.now(),
            username: uTrim,
            password_hash: pTrim,
            full_name: fnTrim,
            role: 'user', // สมาชิกใหม่ได้รับสิทธิ์ User เสมอ
            status: 'active',
            department: formData.department ? formData.department.trim() : 'หน่วยบำบัดน้ำเสีย',
            created_at: new Date().toISOString()
        };

        await window.DataStore.insert('users', newUser);
        if (window.DataStore && window.DataStore.logAction) {
            window.DataStore.logAction("สมัครสมาชิก", `สร้างบัญชีผู้ใช้ใหม่: ${newUser.username} (${newUser.full_name})`);
        }
        return { success: true, user: newUser };
    }

    logout() {
        if (this.currentUser && window.DataStore && window.DataStore.logAction) {
            try {
                window.DataStore.logAction("ออกจากระบบ", `ผู้ใช้ ${this.currentUser.username} ออกจากระบบ`);
            } catch (e) {}
        }
        this.currentUser = null;
        try {
            localStorage.removeItem(APP_CONFIG.storageKeys.currentUser);
            localStorage.removeItem("spa_50th_remember_login");
            sessionStorage.removeItem(APP_CONFIG.storageKeys.currentUser);
        } catch (e) {}
    }
}

window.AuthService = new AuthService();

