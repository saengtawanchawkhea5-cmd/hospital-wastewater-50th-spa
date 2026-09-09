/**
 * ============================================================================
 * ระบบจัดการระบบบำบัดน้ำเสีย โรงพยาบาล ๕๐ พรรษา มหาวชิราลงกรณ (SPA)
 * APP.JS - Master Application Controller, SPA Router & Event Orchestrator
 * ============================================================================
 */

class AppController {
    constructor() {
        this.currentRoute = 'dashboard';
        this.isAppInitialized = false;
        window.App = this;
        
        let lastToggleTime = 0;
        window.toggleSidebar = (forceState) => {
            const now = Date.now();
            if (now - lastToggleTime < 220) return;
            lastToggleTime = now;
            this.toggleSidebar(forceState);
        };
    }

    async init() {
        console.log("Initializing Wastewater SPA...");
        
        // 0. รอให้การเชื่อมต่อและดึงข้อมูลจาก Supabase Cloud สมบูรณ์ก่อน
        if (window.DataStore && window.DataStore.initPromise) {
            try {
                await window.DataStore.initPromise;
            } catch (e) {
                console.warn("DataStore init promise error:", e);
            }
        }
        this.updateSupabaseStatusIndicator();

        // ซิงค์ข้อมูลโปรไฟล์ผู้ใช้ล่าสุดจากฐานข้อมูล Supabase Cloud โดยตรง
        if (window.AuthService && window.AuthService.refreshCurrentUserFromDB) {
            try {
                await window.AuthService.refreshCurrentUserFromDB();
            } catch (e) {
                console.warn("Could not sync user profile on startup:", e);
            }
        }

        // ผูก Events ของ Auth Portal Screen เสมอ
        this.bindAuthPortalEvents();

        // 1. ตรวจสอบสถานะการเข้าสู่ระบบ (ต้องล็อกอินก่อนเข้าใช้งานทุกครั้ง)
        if (!window.AuthService || !window.AuthService.isAuthenticated()) {
            console.log("No active user session found. Requiring login before entering system...");
            this.showAuthPortal('login');
            const globalLoader = document.getElementById('global-app-loader');
            if (globalLoader) globalLoader.classList.remove('active');
            return; // หยุดการโหลดส่วนอื่นๆ รอจนกว่าผู้ใช้จะล็อกอินผ่าน
        }

        // 2. หากเข้าสู่ระบบแล้ว ให้เริ่มการทำงานของระบบแอปพลิเคชัน
        await this.launchApp();
    }

    async launchApp() {
        // ซ่อนหน้า Auth Portal และแสดงหน้าจอแอปพลิเคชันหลัก
        this.hideAuthPortal();
        this.updateUserUI();

        // ผูก Event Listeners หลักและโหลดโมดูล (รันเพียงครั้งเดียว)
        if (!this.isAppInitialized) {
            this.bindGlobalEvents();

            const safeInit = async (name, fn) => {
                try {
                    await fn();
                } catch(err) {
                    console.error(`[App] Error initializing ${name}:`, err);
                }
            };

            if (window.DashboardModule) await safeInit('Dashboard', () => window.DashboardModule.init());
            if (window.InfluentModule) await safeInit('Influent', () => window.InfluentModule.init());
            if (window.ElectricityModule) await safeInit('Electricity', () => window.ElectricityModule.init());
            if (window.WaterQualityModule) await safeInit('WaterQuality', () => window.WaterQualityModule.init());
            if (window.MachineryModule) await safeInit('Machinery', () => window.MachineryModule.init());
            if (window.MaintenanceModule) await safeInit('Maintenance', () => window.MaintenanceModule.init());
            if (window.RiskIncidentModule) await safeInit('RiskIncident', () => window.RiskIncidentModule.init());
            if (window.MonthlyReportModule) await safeInit('MonthlyReport', () => window.MonthlyReportModule.init());
            if (window.EquipmentRefModule) await safeInit('EquipmentRef', () => window.EquipmentRefModule.init());
            if (window.DocumentsModule) await safeInit('Documents', () => window.DocumentsModule.init());
            if (window.UsersAdminModule) await safeInit('UsersAdmin', () => window.UsersAdminModule.init());
            if (window.ExportImportModule) await safeInit('ExportImport', () => window.ExportImportModule.init());
            if (window.AutoGeneratorModule) await safeInit('AutoGenerator', () => window.AutoGeneratorModule.init());

            // คืนค่าสถานะย่อ/ขยาย Sidebar บนหน้าจอ Desktop
            if (window.innerWidth >= 1024 && localStorage.getItem('spa_sidebar_collapsed') === 'true') {
                const appContainer = document.getElementById('main-app-container') || document.body;
                appContainer.classList.add('sidebar-collapsed');
            }

            this.isAppInitialized = true;
        }

        // นำไปยังหน้าที่กำลังดูอยู่หรือหน้าเริ่มต้น (Dashboard)
        this.navigateTo(this.currentRoute || 'dashboard');

        // ปิด Loader หลัก
        const globalLoader = document.getElementById('global-app-loader');
        if (globalLoader) globalLoader.classList.remove('active');
    }

    toggleSidebar(forceState) {
        const appContainer = document.getElementById('main-app-container') || document.body;
        const sidebar = document.getElementById('main-sidebar');
        const backdrop = document.getElementById('sidebar-backdrop');
        const isDesktop = window.innerWidth >= 1024;

        if (isDesktop) {
            // บนจอ Desktop (>= 1024px): สลับสถานะยุบแถบ sidebar-collapsed
            const willCollapse = (typeof forceState === 'boolean') 
                ? forceState 
                : !appContainer.classList.contains('sidebar-collapsed');

            if (willCollapse) {
                appContainer.classList.add('sidebar-collapsed');
                localStorage.setItem('spa_sidebar_collapsed', 'true');
            } else {
                appContainer.classList.remove('sidebar-collapsed');
                localStorage.setItem('spa_sidebar_collapsed', 'false');
            }
            if (sidebar) sidebar.classList.remove('open');
            if (backdrop) backdrop.classList.remove('active');
        } else {
            // บนจอมือถือ/แท็บเล็ต (< 1024px): สลับคลาส open และ backdrop active
            appContainer.classList.remove('sidebar-collapsed');

            if (sidebar) {
                const willOpen = (typeof forceState === 'boolean') 
                    ? forceState 
                    : !sidebar.classList.contains('open');

                if (willOpen) {
                    sidebar.classList.add('open');
                    if (backdrop) backdrop.classList.add('active');
                } else {
                    sidebar.classList.remove('open');
                    if (backdrop) backdrop.classList.remove('active');
                }
            }
        }
    }

    bindGlobalEvents() {
        // เมนู Navigation
        document.querySelectorAll('.nav-link[data-route]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const route = link.getAttribute('data-route');
                this.navigateTo(route);

                // ปิด Sidebar บนจอมือถือเมื่อกดเลือกเมนู
                if (window.innerWidth < 1024) {
                    window.toggleSidebar(false);
                }
            });
        });

        // Mobile Bottom Navigation Bar (แท็บเมนูด้านล่างบนมือถือ/แท็บเล็ต)
        document.querySelectorAll('.mobile-nav-item[data-route]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const route = item.getAttribute('data-route');
                this.navigateTo(route);
                window.toggleSidebar(false);
            });
        });

        // ปุ่ม Toggle Sidebar ที่ Top Navbar (ปุ่ม 3 ขีด)
        const toggleBtn = document.getElementById('btn-toggle-sidebar');
        if (toggleBtn) {
            const handleToggle = (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.toggleSidebar();
            };
            toggleBtn.addEventListener('click', handleToggle);
            toggleBtn.addEventListener('touchend', handleToggle, { passive: false });
        }

        // ปุ่มซ่อน/ปิดเมนูที่ Sidebar Header
        const collapseBtn = document.getElementById('btn-sidebar-collapse');
        if (collapseBtn) {
            const handleCollapse = (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.toggleSidebar(false);
            };
            collapseBtn.addEventListener('click', handleCollapse);
            collapseBtn.addEventListener('touchend', handleCollapse, { passive: false });
        }

        // ปุ่มเมนูทั้งหมดที่ Bottom Bar บนมือถือ
        const btnMobileMore = document.getElementById('btn-mobile-more-menu');
        if (btnMobileMore) {
            const handleMore = (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.toggleSidebar();
            };
            btnMobileMore.addEventListener('click', handleMore);
            btnMobileMore.addEventListener('touchend', handleMore, { passive: false });
        }

        // ปิด Sidebar เมื่อกดที่ Backdrop บนมือถือ
        const backdrop = document.getElementById('sidebar-backdrop');
        if (backdrop) {
            const handleBackdrop = (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.toggleSidebar(false);
            };
            backdrop.addEventListener('click', handleBackdrop);
            backdrop.addEventListener('touchend', handleBackdrop, { passive: false });
        }

        // Touch Swipe Gestures เพื่อเปิด/ปิด Sidebar บนมือถือ
        let touchStartX = 0;
        let touchStartY = 0;
        document.addEventListener('touchstart', (e) => {
            if (e.touches && e.touches.length === 1) {
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
            }
        }, { passive: true });

        document.addEventListener('touchend', (e) => {
            if (!e.changedTouches || e.changedTouches.length === 0) return;
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            const diffX = touchEndX - touchStartX;
            const diffY = Math.abs(touchEndY - touchStartY);

            // หากเป็นการปัดในแนวนอนมากกว่าแนวตั้ง
            if (diffY < 60 && window.innerWidth < 1024) {
                const sidebar = document.getElementById('main-sidebar');
                const backdrop = document.getElementById('sidebar-backdrop');
                // ปัดขวาจากขอบจอซ้ายสุด (startX < 40px) เพื่อเปิด Sidebar
                if (diffX > 60 && touchStartX < 45) {
                    if (sidebar) sidebar.classList.add('open');
                    if (backdrop) backdrop.classList.add('active');
                }
                // ปัดซ้ายเมื่อเปิด Sidebar เพื่อปิด
                if (diffX < -60 && sidebar && sidebar.classList.contains('open')) {
                    sidebar.classList.remove('open');
                    if (backdrop) backdrop.classList.remove('active');
                }
            }
        }, { passive: true });

        // ปุ่มปิด Modal ทุกตัว (ปุ่ม X และปุ่มยกเลิก) และ Event Delegation สำหรับปิด Modal ทั่วทั้งระบบ
        document.addEventListener('click', (e) => {
            const closeBtn = e.target.closest('.modal-close, [data-modal-close], [data-dismiss="modal"]');
            if (closeBtn) {
                const modal = closeBtn.closest('.modal-overlay');
                if (modal) {
                    this.closeModal(modal.id);
                } else {
                    this.closeModal();
                }
                return;
            }
            if (e.target.classList && e.target.classList.contains('modal-overlay')) {
                this.closeModal(e.target.id);
            }
        });

        // กดปุ่ม ESC (Escape) เพื่อปิด Modal ทุกตัวและปลดล็อกหน้าจอตลอดเวลา
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' || e.key === 'Esc') {
                this.closeModal();
            }
        });

        // ปุ่มตั้งค่าระบบลงข้อมูลอัตโนมัติ (Automation Settings)
        const btnAutoSettings = document.getElementById('btn-open-auto-settings');
        if (btnAutoSettings) {
            btnAutoSettings.addEventListener('click', () => {
                if (window.AutoGeneratorModule) window.AutoGeneratorModule.openSettingsModal();
            });
        }

        // ตัวแสดงสถานะ Supabase บน Top Navbar (คลิกเพื่อดู Live Diagnostics)
        const topIndicator = document.getElementById('top-supabase-indicator');
        if (topIndicator) {
            topIndicator.addEventListener('click', () => this.openSettingsModal());
        }

        // ปุ่มตั้งค่า Supabase
        const btnSettings = document.getElementById('btn-open-settings');
        if (btnSettings) {
            btnSettings.addEventListener('click', () => this.openSettingsModal());
        }

        // ฟอร์มบันทึกการตั้งค่า Supabase
        const formSettings = document.getElementById('form-supabase-settings');
        if (formSettings) {
            formSettings.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveSupabaseSettings();
            });
        }

        // ปุ่มคัดลอกคำสั่ง SQL ปลดล็อก RLS
        const btnCopyRls = document.getElementById('btn-copy-rls-sql');
        if (btnCopyRls) {
            btnCopyRls.addEventListener('click', () => this.copyRlsSql());
        }

        // ปุ่มคัดลอกคำสั่ง SQL Migration (แปลง ID เป็น TEXT)
        const btnCopyMigration = document.getElementById('btn-copy-migration-sql');
        if (btnCopyMigration) {
            btnCopyMigration.addEventListener('click', () => this.copyMigrationSql());
        }

        // ปุ่มคัดลอกคำสั่ง SQL ซ่อมแซมวัน/เดือนที่สลับกัน (MM/DD -> DD/MM)
        const btnCopyRepairDates = document.getElementById('btn-copy-repair-dates-sql');
        if (btnCopyRepairDates) {
            btnCopyRepairDates.addEventListener('click', () => this.copyRepairDatesSql());
        }

        // ปุ่มซ่อมแซมวัน/เดือนที่สลับกันในฐานข้อมูลทันที 1 คลิก
        const btnRepairDates = document.getElementById('btn-repair-swapped-dates');
        if (btnRepairDates) {
            btnRepairDates.addEventListener('click', () => this.repairSwappedDates());
        }

        // ปุ่มทดสอบ Ping
        const btnTestPing = document.getElementById('btn-test-supabase-ping');
        if (btnTestPing) {
            btnTestPing.addEventListener('click', () => this.testSupabasePing());
        }

        // ปุ่มออกจากระบบ (Sidebar & จุดอื่นๆ ในระบบ)
        const btnSidebarLogout = document.getElementById('btn-sidebar-logout');
        if (btnSidebarLogout) {
            btnSidebarLogout.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleLogout();
            });
        }
        const btnLogout = document.getElementById('btn-logout');
        if (btnLogout) {
            btnLogout.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleLogout();
            });
        }

        // ปุ่มเปิด Login Modal
        const btnOpenLogin = document.getElementById('btn-open-login');
        if (btnOpenLogin) {
            btnOpenLogin.addEventListener('click', () => this.openLoginModal());
        }

        // ฟอร์ม Login
        const formLogin = document.getElementById('form-login');
        if (formLogin) {
            formLogin.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        // ฟอร์ม Register
        const formRegister = document.getElementById('form-register');
        if (formRegister) {
            formRegister.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleRegister();
            });
        }

        // สลับไปมาระหว่าง Login กับ Register ภายใน Modal
        const btnGoRegister = document.getElementById('btn-go-register');
        const btnGoLogin = document.getElementById('btn-go-login');
        if (btnGoRegister) {
            btnGoRegister.addEventListener('click', (e) => {
                e.preventDefault();
                document.getElementById('view-login-form').style.display = 'none';
                document.getElementById('view-register-form').style.display = 'block';
            });
        }
        if (btnGoLogin) {
            btnGoLogin.addEventListener('click', (e) => {
                e.preventDefault();
                document.getElementById('view-register-form').style.display = 'none';
                document.getElementById('view-login-form').style.display = 'block';
            });
        }

        // ปุ่มทดสอบใส่ค่า Super Admin อัตโนมัติ (1-Click Fill)
        const btnFillAdmin = document.getElementById('btn-fill-superadmin');
        if (btnFillAdmin) {
            btnFillAdmin.addEventListener('click', () => {
                document.getElementById('login-username').value = APP_CONFIG.superAdmin.username;
                document.getElementById('login-password').value = APP_CONFIG.superAdmin.defaultPassword;
            });
        }
    }

    navigateTo(routeId) {
        // ปิด Modal ทุกตัวและปลดล็อกหน้าจอเสมอเมื่อสลับหน้า
        this.closeModal();

        this.currentRoute = routeId;

        // ซ่อนทุก section
        document.querySelectorAll('.spa-section').forEach(sec => sec.classList.remove('active'));

        // แสดง section ที่เลือก
        const targetSection = document.getElementById(`section-${routeId}`);
        if (targetSection) {
            targetSection.classList.add('active');
        }

        // อัปเดตสถานะ active บน Sidebar Menu
        document.querySelectorAll('.nav-link[data-route]').forEach(link => {
            if (link.getAttribute('data-route') === routeId) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        // อัปเดตสถานะ active บน Mobile Bottom Nav
        document.querySelectorAll('.mobile-nav-item[data-route]').forEach(item => {
            if (item.getAttribute('data-route') === routeId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // อัปเดตชื่อหน้าบน Top Navbar
        const pageTitle = document.getElementById('top-page-title');
        const pageSubtitle = document.getElementById('top-page-subtitle');
        const routeTitles = {
            'dashboard': { title: 'ภาพรวมระบบบำบัดน้ำเสีย', sub: 'แดชบอร์ดสรุปผลการเดินระบบและค่าดัชนีคุณภาพน้ำ' },
            'influent': { title: 'ปริมาณน้ำเสียเข้าสู่ระบบ', sub: 'บันทึกเลขมิเตอร์น้ำและคำนวณปริมาณน้ำเสีย 80%' },
            'electricity': { title: 'การใช้พลังงานไฟฟ้า', sub: 'บันทึกหน่วยไฟฟ้าและคำนวณค่าไฟฟ้าต่อวัน' },
            'water-quality': { title: 'การตรวจสอบคุณภาพน้ำ', sub: 'ตรวจวัดคุณภาพน้ำเบื้องต้นและผลตรวจมาตรฐานประจำไตรมาส' },
            'machinery': { title: 'ตรวจสอบการทำงานของเครื่องจักร', sub: 'เช็คลิสต์ตรวจสภาพเครื่องจักร ปั๊มน้ำ และระบบเติมอากาศ' },
            'maintenance': { title: 'บันทึกการซ่อมบำรุง', sub: 'ประวัติงานบำรุงรักษาเชิงป้องกัน (PM) และงานแก้ไข' },
            'risk-incident': { title: 'บริหารความเสี่ยงและเหตุการณ์', sub: 'แผนจัดการความเสี่ยงและบันทึกเหตุการณ์ฉุกเฉิน' },
            'monthly-report': { title: 'รายงานสรุปรายเดือน', sub: 'สรุปผลการเดินระบบรายเดือนและอัตราผ่านมาตรฐาน' },
            'equipment-ref': { title: 'ฐานข้อมูลอ้างอิงอุปกรณ์', sub: 'จัดการรายชื่ออุปกรณ์และเครื่องจักรในระบบ' },
            'documents': { title: 'คลังรายงานและคู่มือระบบ', sub: 'จัดเก็บรายงานวิเคราะห์คุณภาพน้ำและคู่มือการปฏิบัติงาน (SOP)' },
            'users-admin': { title: 'จัดการสิทธิ์และบัญชีผู้ใช้งาน (User & Role Management)', sub: 'แยกสิทธิ์ผู้ดูแลระบบ Admin และสมาชิกผู้ใช้งานทั่วไป' },
            'backup-restore': { title: 'สำรองข้อมูล / กู้คืนข้อมูล (Backup & Restore)', sub: 'สำรองข้อมูลทั้งหมดจากฐานข้อมูล Supabase และโค้ดระบบทั้งหมด' }
        };

        if (routeTitles[routeId]) {
            if (pageTitle) pageTitle.innerText = routeTitles[routeId].title;
            if (pageSubtitle) pageSubtitle.innerText = routeTitles[routeId].sub;
        }

        // รีเฟรชข้อมูลสดจาก Supabase เมื่อสลับหน้า
        if (routeId === 'dashboard' && window.DashboardModule) {
            window.DashboardModule.render();
        } else if (routeId === 'influent' && window.InfluentModule) {
            window.InfluentModule.loadData();
        } else if (routeId === 'electricity' && window.ElectricityModule) {
            window.ElectricityModule.loadData();
        } else if (routeId === 'water-quality' && window.WaterQualityModule) {
            window.WaterQualityModule.loadData();
        } else if (routeId === 'machinery' && window.MachineryModule) {
            window.MachineryModule.loadData();
        } else if (routeId === 'maintenance' && window.MaintenanceModule) {
            window.MaintenanceModule.loadData();
        } else if (routeId === 'risk-incident' && window.RiskIncidentModule) {
            window.RiskIncidentModule.loadData();
        } else if (routeId === 'monthly-report' && window.MonthlyReportModule) {
            window.MonthlyReportModule.loadData();
        } else if (routeId === 'equipment-ref' && window.EquipmentRefModule) {
            window.EquipmentRefModule.loadData();
        } else if (routeId === 'documents' && window.DocumentsModule) {
            window.DocumentsModule.loadData();
        } else if (routeId === 'users-admin' && window.UsersAdminModule) {
            window.UsersAdminModule.loadData();
        } else if (routeId === 'backup-restore' && window.ExportImportModule) {
            window.ExportImportModule.renderBackupHistory();
        }

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.removeProperty('display');
            modal.style.setProperty('display', 'flex', 'important');
            modal.style.setProperty('z-index', '99999', 'important');
            modal.style.setProperty('opacity', '1', 'important');
            modal.style.setProperty('visibility', 'visible', 'important');
            modal.style.setProperty('pointer-events', 'auto', 'important');
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
            document.body.classList.add('modal-open');
        }
    }

    closeModal(modalId) {
        const hideModalEl = (el) => {
            if (!el) return;
            el.classList.remove('active');
            el.style.setProperty('display', 'none', 'important');
            el.style.removeProperty('z-index');
            el.style.removeProperty('opacity');
            el.style.removeProperty('visibility');
            el.style.removeProperty('pointer-events');
        };

        if (!modalId) {
            // ปิด Modal ทุกตัวในระบบ
            document.querySelectorAll('.modal-overlay').forEach(hideModalEl);
            document.body.style.overflow = '';
            document.body.style.removeProperty('overflow');
            document.body.classList.remove('modal-open');
            return;
        }

        const modal = document.getElementById(modalId);
        if (modal) {
            hideModalEl(modal);
        }

        // ตรวจสอบว่ายังมี Modal อื่นเปิดอยู่หรือไม่ หากไม่มี ให้ปลดล็อก body scroll ทันที
        const anyActive = Array.from(document.querySelectorAll('.modal-overlay')).some(m => {
            return m.classList.contains('active') && m.style.display !== 'none';
        });
        if (!anyActive) {
            document.body.style.overflow = '';
            document.body.style.removeProperty('overflow');
            document.body.classList.remove('modal-open');
        }
    }

    updateUserUI() {
        const user = window.AuthService ? window.AuthService.getCurrentUser() : null;
        const isAdmin = window.AuthService ? window.AuthService.isAdmin() : false;

        const nameEl = document.getElementById('sidebar-display-username') || document.getElementById('sidebar-user-name');
        const roleEl = document.getElementById('sidebar-display-role') || document.getElementById('sidebar-user-role');
        const avatarEl = document.getElementById('sidebar-display-avatar') || document.getElementById('sidebar-user-avatar');
        const adminOnlyMenus = document.querySelectorAll('.admin-only-menu');

        if (user) {
            const displayName = (user.full_name || user.username || 'แสงตะวัน ชาวเขา').replace(/\s*\(Super Admin\)/gi, '').trim();
            if (nameEl) nameEl.textContent = displayName;
            if (avatarEl) {
                const initial = displayName.charAt(0).toUpperCase();
                avatarEl.innerHTML = `<span>${initial}</span>`;
            }
            if (roleEl) {
                if (roleEl.id === 'sidebar-display-role') {
                    roleEl.textContent = isAdmin ? 'Super Admin' : (user.role || 'เจ้าหน้าที่');
                } else {
                    roleEl.innerHTML = isAdmin ? 
                        '<i class="fa-solid fa-circle text-[6px] text-emerald-400"></i> Super Admin' : 
                        '<i class="fa-solid fa-circle text-[6px] text-blue-400"></i> เจ้าหน้าที่/Admin';
                }
            }
        }

        // ซ่อน/แสดง เมนูเฉพาะ Admin
        adminOnlyMenus.forEach(el => {
            el.style.display = isAdmin ? 'block' : 'none';
        });
    }

    // =========================================================================
    // Auth Portal & Gatekeeper Flow (Login, Register, Tabs, Logout)
    // =========================================================================
    bindAuthPortalEvents() {
        // แท็บสลับ เข้าสู่ระบบ / สมัครสมาชิก บนหน้า Auth Portal
        const btnTabLogin = document.getElementById('auth-tab-btn-login');
        const btnTabReg = document.getElementById('auth-tab-btn-register');

        if (btnTabLogin) {
            btnTabLogin.addEventListener('click', () => this.switchAuthTab('login'));
        }
        if (btnTabReg) {
            btnTabReg.addEventListener('click', () => this.switchAuthTab('register'));
        }

        // ฟอร์มเข้าสู่ระบบบนหน้า Portal
        const formLogin = document.getElementById('portal-form-login');
        if (formLogin) {
            formLogin.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handlePortalLogin();
            });
        }

        // ฟอร์มสมัครสมาชิกบนหน้า Portal
        const formReg = document.getElementById('portal-form-register');
        if (formReg) {
            formReg.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handlePortalRegister();
            });
        }

        // ปุ่มกรอกข้อมูล Super Admin อัตโนมัติ (บนหน้า Portal)
        const btnQuickAdmin = document.getElementById('portal-btn-quick-admin');
        if (btnQuickAdmin) {
            btnQuickAdmin.addEventListener('click', () => {
                const uInput = document.getElementById('portal-login-username');
                const pInput = document.getElementById('portal-login-password');
                if (uInput) uInput.value = APP_CONFIG.superAdmin.username;
                if (pInput) pInput.value = APP_CONFIG.superAdmin.defaultPassword;
            });
        }
    }

    showAuthPortal(tab = 'login') {
        const portal = document.getElementById('auth-portal-screen');
        const appContainers = document.querySelectorAll('#main-app-container, .app-layout, .app-container');

        appContainers.forEach(container => {
            container.classList.add('hidden');
            container.style.display = 'none';
        });
        if (portal) {
            portal.classList.remove('hidden');
            portal.style.removeProperty('display');
            portal.style.display = 'flex';
        }

        this.switchAuthTab(tab);
    }

    hideAuthPortal() {
        const portal = document.getElementById('auth-portal-screen');
        const appContainers = document.querySelectorAll('#main-app-container, .app-layout, .app-container');

        if (portal) {
            portal.classList.add('hidden');
            portal.style.display = 'none';
        }
        appContainers.forEach(container => {
            container.classList.remove('hidden');
            container.style.removeProperty('display');
            container.style.display = 'flex';
        });
    }

    switchAuthTab(tab) {
        const btnLogin = document.getElementById('auth-tab-btn-login');
        const btnReg = document.getElementById('auth-tab-btn-register');
        const viewLogin = document.getElementById('auth-view-login');
        const viewReg = document.getElementById('auth-view-register');

        if (tab === 'login') {
            if (btnLogin) btnLogin.classList.add('active');
            if (btnReg) btnReg.classList.remove('active');
            if (viewLogin) viewLogin.style.display = 'block';
            if (viewReg) viewReg.style.display = 'none';
        } else {
            if (btnReg) btnReg.classList.add('active');
            if (btnLogin) btnLogin.classList.remove('active');
            if (viewReg) viewReg.style.display = 'block';
            if (viewLogin) viewLogin.style.display = 'none';
        }
    }

    togglePasswordVisibility(inputId, btnEl) {
        const input = document.getElementById(inputId);
        if (!input) return;
        if (input.type === 'password') {
            input.type = 'text';
            if (btnEl) btnEl.innerHTML = '<i class="fa-regular fa-eye-slash text-emerald-400"></i>';
        } else {
            input.type = 'password';
            if (btnEl) btnEl.innerHTML = '<i class="fa-regular fa-eye"></i>';
        }
    }

    async handlePortalLogin() {
        const uInput = document.getElementById('portal-login-username');
        const pInput = document.getElementById('portal-login-password');
        const u = uInput ? uInput.value.trim() : '';
        const p = pInput ? pInput.value.trim() : '';
        const rememberEl = document.getElementById('portal-login-remember');
        const remember = rememberEl ? rememberEl.checked : false;

        if (!u || !p) {
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'warning',
                    title: 'กรุณากรอกข้อมูลให้ครบ',
                    text: 'กรุณากรอกชื่อผู้ใช้งานและรหัสผ่าน',
                    confirmButtonColor: '#10b981'
                });
            } else {
                alert('กรุณากรอกชื่อผู้ใช้งานและรหัสผ่าน');
            }
            return;
        }

        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'กำลังตรวจสอบข้อมูล...',
                text: 'กำลังตรวจสอบรายชื่อและรหัสผ่านกับฐานข้อมูล',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });
        }

        const res = await window.AuthService.login(u, p, remember);

        if (res.success) {
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'success',
                    title: 'เข้าสู่ระบบสำเร็จ!',
                    text: `ยินดีต้อนรับคุณ ${res.user.full_name}`,
                    timer: 1200,
                    showConfirmButton: false
                });
            }

            // แสดงหน้าจอระบบและเริ่มต้นการทำงานทันทีอย่างราบรื่น
            await this.launchApp();
        } else {
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'error',
                    title: 'เข้าสู่ระบบไม่สำเร็จ',
                    text: res.message,
                    confirmButtonColor: '#ef4444'
                });
            } else {
                alert(res.message);
            }
        }
    }

    async handlePortalRegister() {
        const fn = document.getElementById('portal-reg-fullname').value.trim();
        const u = document.getElementById('portal-reg-username').value.trim();
        const p = document.getElementById('portal-reg-password').value.trim();
        const cp = document.getElementById('portal-reg-confirm-password').value.trim();

        if (!fn || !u || !p || !cp) {
            Swal.fire({
                icon: 'warning',
                title: 'กรุณากรอกข้อมูลให้ครบถ้วน',
                text: 'กรุณาระบุชื่อ-นามสกุล, ชื่อผู้ใช้ และรหัสผ่าน',
                confirmButtonColor: '#3b82f6'
            });
            return;
        }

        if (p !== cp) {
            Swal.fire({
                icon: 'warning',
                title: 'รหัสผ่านไม่ตรงกัน',
                text: 'กรุณากรอกรหัสผ่านและยืนยันรหัสผ่านให้ตรงกัน',
                confirmButtonColor: '#3b82f6'
            });
            return;
        }

        if (p.length < 4) {
            Swal.fire({
                icon: 'warning',
                title: 'รหัสผ่านสั้นเกินไป',
                text: 'กรุณาตั้งรหัสผ่านอย่างน้อย 4 ตัวอักษร',
                confirmButtonColor: '#3b82f6'
            });
            return;
        }

        Swal.fire({
            title: 'กำลังสร้างบัญชีผู้ใช้...',
            text: 'กำลังบันทึกข้อมูลสมาชิกลงฐานข้อมูล',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        const res = await window.AuthService.register({
            username: u,
            password: p,
            full_name: fn,
            role: 'user'
        });

        if (res.success) {
            Swal.fire({
                icon: 'success',
                title: 'สร้างบัญชีผู้ใช้สำเร็จ!',
                text: 'ท่านสามารถเข้าสู่ระบบด้วยบัญชีที่สร้างขึ้นใหม่ได้ทันที',
                timer: 2000,
                showConfirmButton: true,
                confirmButtonText: 'เข้าสู่ระบบทันที',
                confirmButtonColor: '#10b981'
            }).then(() => {
                this.switchAuthTab('login');
                const uInput = document.getElementById('portal-login-username');
                const pInput = document.getElementById('portal-login-password');
                if (uInput) uInput.value = u;
                if (pInput) pInput.value = p;
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'สมัครสมาชิกไม่สำเร็จ',
                text: res.message,
                confirmButtonColor: '#ef4444'
            });
        }
    }

    openLoginModal() {
        this.showAuthPortal('login');
    }

    async handleLogout() {
        let confirmed = false;
        if (typeof Swal !== 'undefined') {
            const res = await Swal.fire({
                title: 'ต้องการออกจากระบบหรือไม่?',
                text: 'คุณจะต้องเข้าสู่ระบบใหม่อีกครั้งเพื่อเข้าใช้งาน',
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#ef4444',
                cancelButtonColor: '#334155',
                confirmButtonText: '<i class="fa-solid fa-arrow-right-from-bracket"></i> ยืนยันออกจากระบบ',
                cancelButtonText: 'ยกเลิก'
            });
            confirmed = res.isConfirmed;
        } else {
            confirmed = window.confirm('ต้องการออกจากระบบหรือไม่? คุณจะต้องเข้าสู่ระบบใหม่อีกครั้งเพื่อเข้าใช้งาน');
        }

        if (confirmed) {
            if (window.AuthService && window.AuthService.logout) {
                window.AuthService.logout();
            } else {
                localStorage.clear();
                sessionStorage.clear();
            }
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'info',
                    title: 'ออกจากระบบเรียบร้อย',
                    timer: 1000,
                    showConfirmButton: false
                });
            }
            setTimeout(() => {
                window.location.reload();
            }, 600);
        }
    }

    // =========================================================================
    // Supabase Settings Modal & Real-time Monitor (Image 1 Matching)
    // =========================================================================
    async openSettingsModal() {
        const urlInput = document.getElementById('settings-supabase-url');
        const keyInput = document.getElementById('settings-supabase-key');
        const statusBadge = document.getElementById('monitor-status-badge');
        const latencyVal = document.getElementById('monitor-latency-value');
        const dbUrlSpan = document.getElementById('monitor-db-url');

        const currentUrl = localStorage.getItem("spa_50th_supabase_url") || 
                           (window.SUPABASE_EMBEDDED_CONFIG && window.SUPABASE_EMBEDDED_CONFIG.url) || 
                           (window.APP_CONFIG && window.APP_CONFIG.supabaseDefault && window.APP_CONFIG.supabaseDefault.url) || "";
                           
        const currentKey = localStorage.getItem("spa_50th_supabase_key") || 
                           (window.SUPABASE_EMBEDDED_CONFIG && window.SUPABASE_EMBEDDED_CONFIG.anonKey) || 
                           (window.APP_CONFIG && window.APP_CONFIG.supabaseDefault && window.APP_CONFIG.supabaseDefault.anonKey) || "";

        if (urlInput) urlInput.value = currentUrl;
        if (keyInput) keyInput.value = currentKey;
        if (dbUrlSpan) dbUrlSpan.innerText = currentUrl || "https://vzamkmomhvgnylvrspec.supabase.co";

        this.openModal('modal-settings');

        // ดึงสถานะ Live Diagnostics
        const diag = await window.DataStore.getSupabaseDiagnostics();

        if (statusBadge) {
            if (diag.isOnline) {
                statusBadge.innerHTML = `
                    <span class="px-3 py-1 bg-emerald-950/80 border border-emerald-500/50 text-emerald-400 rounded-full font-bold text-xs flex items-center gap-1.5 shadow-sm">
                        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span>เชื่อมต่อสำเร็จ (Online)</span>
                    </span>`;
            } else {
                statusBadge.innerHTML = `
                    <span class="px-3 py-1 bg-rose-950/80 border border-rose-500/50 text-rose-400 rounded-full font-bold text-xs flex items-center gap-1.5 shadow-sm">
                        <span class="w-2 h-2 rounded-full bg-rose-400"></span>
                        <span>โหมด Local Store (Offline)</span>
                    </span>`;
            }
        }

        if (latencyVal) {
            latencyVal.innerText = diag.latency;
        }
        if (dbUrlSpan) {
            dbUrlSpan.innerText = diag.url || currentUrl;
        }

        // อัปเดต Live Record Counts ให้ตรงกับ 14 ตารางในฐานข้อมูลจริง
        const tableList = [
            'electricity_consumption',
            'equipment_ref',
            'incident_records',
            'influent_wastewater',
            'machinery_inspection',
            'maintenance_records',
            'monthly_reports',
            'preliminary_water_quality',
            'quarterly_water_quality',
            'report_storage',
            'risk_management',
            'system_logs',
            'treatment_manuals',
            'users'
        ];

        tableList.forEach(t => {
            const el = document.getElementById(`live-count-${t}`);
            if (el) {
                el.innerText = (diag.counts && diag.counts[t] !== undefined) ? diag.counts[t] : 0;
            }
        });
    }

    async testSupabasePing() {
        Swal.fire({
            title: 'กำลังทดสอบ Ping...',
            text: 'กำลังวัดค่า Latency และนับจำนวนรายการข้อมูลใน Supabase Cloud',
            timer: 800,
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        await this.openSettingsModal();

        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'ทดสอบการเชื่อมต่อเรียบร้อย',
            timer: 1500,
            showConfirmButton: false
        });
    }

    async saveSupabaseSettings() {
        const urlInput = document.getElementById('settings-supabase-url');
        const keyInput = document.getElementById('settings-supabase-key');
        const url = urlInput ? urlInput.value.trim() : '';
        const key = keyInput ? keyInput.value.trim() : '';

        Swal.fire({
            title: 'กำลังเชื่อมต่อและบันทึกการตั้งค่า...',
            text: 'กำลังทดสอบการเข้าถึงฐานข้อมูล Supabase Cloud',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        const res = await window.DataStore.setSupabaseConfig(url, key);
        this.updateSupabaseStatusIndicator();

        if (res.success) {
            Swal.fire({
                icon: 'success',
                title: 'เชื่อมต่อ Supabase Cloud สำเร็จ!',
                text: 'บันทึกการเชื่อมต่อและดึงข้อมูลสดเรียบร้อยแล้ว',
                timer: 1800,
                showConfirmButton: false
            }).then(() => {
                this.closeModal('modal-settings');
                window.location.reload();
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'ไม่สามารถเชื่อมต่อ Supabase ได้',
                html: `
                    <div class="text-left text-xs text-rose-300 bg-slate-900 p-3 rounded border border-slate-800">
                        <p class="font-bold text-rose-400 mb-1">สาเหตุ:</p>
                        <p class="font-mono text-[11px]">${res.error || 'ตรวจสอบ URL หรือ Anon Key'}</p>
                    </div>
                `,
                confirmButtonColor: '#3b82f6'
            });
        }
    }

    updateSupabaseStatusIndicator() {
        const indicator = document.getElementById('top-supabase-indicator');
        if (!indicator) return;

        if (window.DataStore && window.DataStore.isSupabaseConnected) {
            indicator.className = 'status-pill-tag tag-emerald-glow font-mono text-[11px] font-bold hidden sm:inline-flex cursor-pointer';
            indicator.innerHTML = '<i class="fa-solid fa-circle text-[7px] text-emerald-400 animate-pulse"></i> Supabase Online';
            indicator.title = 'เชื่อมต่อฐานข้อมูล Supabase Cloud เรียบร้อย (คลิกเพื่อดูสถานะ)';
        } else {
            const err = (window.DataStore && window.DataStore.supabaseConnectionError) ? window.DataStore.supabaseConnectionError : 'Offline (Local)';
            indicator.className = 'status-pill-tag tag-rose-glow font-mono text-[11px] font-bold hidden sm:inline-flex cursor-pointer text-rose-300';
            indicator.innerHTML = '<i class="fa-solid fa-triangle-exclamation text-[9px] text-rose-400"></i> Supabase Offline';
            indicator.title = `ไม่สามารถเชื่อมต่อ Supabase Cloud ได้: ${err} (คลิกเพื่อตั้งค่า)`;
        }
    }

    copyRlsSql() {
        const sqlText = `-- ============================================================================
-- SQL ปลดล็อก Row Level Security (RLS) สำหรับทุกตารางในระบบบำบัดน้ำเสีย รพ.๕๐ พรรษาฯ
-- คัดลอกไปวางและรันใน Supabase SQL Editor เพื่ออนุญาตให้บันทึก/แก้ไข/ลบข้อมูลได้ 100%
-- ============================================================================

ALTER TABLE IF EXISTS users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS influent_wastewater DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS electricity_consumption DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS preliminary_water_quality DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS quarterly_water_quality DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS machinery_inspection DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS maintenance_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS equipment_ref DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS risk_management DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS monthly_summaries DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS manual_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS system_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS automation_configs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS carbon_credit_projects DISABLE ROW LEVEL SECURITY;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;`;

        const fallbackCopy = (text) => {
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            Swal.fire({
                icon: 'success',
                title: 'คัดลอกคำสั่ง SQL เรียบร้อยแล้ว!',
                text: 'นำคำสั่งนี้ไปวางและรันใน Supabase SQL Editor เพื่อปลดล็อกสิทธิ์บันทึก/ลบข้อมูลทุกตาราง',
                timer: 2500,
                showConfirmButton: false
            });
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(sqlText).then(() => {
                Swal.fire({
                    icon: 'success',
                    title: 'คัดลอกคำสั่ง SQL เรียบร้อยแล้ว!',
                    text: 'นำคำสั่งนี้ไปวางและรันใน Supabase SQL Editor เพื่อปลดล็อกสิทธิ์บันทึก/ลบข้อมูลทุกตาราง',
                    timer: 2500,
                    showConfirmButton: false
                });
            }).catch(() => {
                fallbackCopy(sqlText);
            });
        } else {
            fallbackCopy(sqlText);
        }
    }

    copyMigrationSql() {
        const sqlText = `-- ============================================================================
-- ⚡ SQL ปรับแก้ประเภทคอลัมน์ id จาก UUID เป็น TEXT (สำหรับ 14 ตารางใน Supabase)
-- เพื่อให้สามารถนำเข้าไฟล์ CSV/Excel ที่มี ID เป็นตัวเลข (1, 2, 3...) หรือข้อความได้ทันที
-- รันใน Supabase SQL Editor ได้ทันที
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

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;`;

        const fallbackCopy = (text) => {
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            Swal.fire({
                icon: 'success',
                title: 'คัดลอกคำสั่ง Migration SQL แล้ว!',
                text: 'นำคำสั่งนี้ไปวางและรันใน Supabase SQL Editor เพื่อแก้ไข ID ทุกตารางเป็น TEXT',
                timer: 2500,
                showConfirmButton: false
            });
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(sqlText).then(() => {
                Swal.fire({
                    icon: 'success',
                    title: 'คัดลอกคำสั่ง Migration SQL แล้ว!',
                    text: 'นำคำสั่งนี้ไปวางและรันใน Supabase SQL Editor เพื่อแก้ไข ID ทุกตารางเป็น TEXT',
                    timer: 2500,
                    showConfirmButton: false
                });
            }).catch(() => fallbackCopy(sqlText));
        } else {
            fallbackCopy(sqlText);
        }
    }

    copyRepairDatesSql() {
        const sqlText = `-- ============================================================================
-- ⚡ SQL ซ่อมแซมวันและเดือนที่สลับกันจากการนำเข้า CSV ใน Supabase (MM/DD -> DD/MM)
-- สำหรับตาราง electricity_consumption, influent_wastewater, preliminary_water_quality
-- รันใน Supabase SQL Editor
-- ============================================================================

-- 1. ซ่อมแซมตารางการใช้พลังงานไฟฟ้า (electricity_consumption)
UPDATE electricity_consumption
SET recorded_at = (
    make_date(
        EXTRACT(YEAR FROM recorded_at)::int,
        EXTRACT(DAY FROM recorded_at)::int,
        EXTRACT(MONTH FROM recorded_at)::int
    ) + (recorded_at::time)
) AT TIME ZONE 'UTC'
WHERE EXTRACT(DAY FROM recorded_at) = 10 AND EXTRACT(MONTH FROM recorded_at) != 10;

-- 2. ซ่อมแซมตารางปริมาณน้ำเสีย (influent_wastewater)
UPDATE influent_wastewater
SET recorded_at = (
    make_date(
        EXTRACT(YEAR FROM recorded_at)::int,
        EXTRACT(DAY FROM recorded_at)::int,
        EXTRACT(MONTH FROM recorded_at)::int
    ) + (recorded_at::time)
) AT TIME ZONE 'UTC'
WHERE EXTRACT(DAY FROM recorded_at) = 10 AND EXTRACT(MONTH FROM recorded_at) != 10;

-- 3. ซ่อมแซมตารางตรวจคุณภาพน้ำเบื้องต้น (preliminary_water_quality)
UPDATE preliminary_water_quality
SET recorded_at = (
    make_date(
        EXTRACT(YEAR FROM recorded_at)::int,
        EXTRACT(DAY FROM recorded_at)::int,
        EXTRACT(MONTH FROM recorded_at)::int
    ) + (recorded_at::time)
) AT TIME ZONE 'UTC'
WHERE EXTRACT(DAY FROM recorded_at) = 10 AND EXTRACT(MONTH FROM recorded_at) != 10;`;

        const fallbackCopy = (text) => {
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            Swal.fire({
                icon: 'success',
                title: 'คัดลอก SQL ซ่อมแซมวัน/เดือนแล้ว!',
                text: 'นำคำสั่งนี้ไปวางและรันใน Supabase SQL Editor เพื่อสลับวัน-เดือนที่นำเข้าผิดกลับมาให้ถูกต้อง',
                timer: 3000,
                showConfirmButton: false
            });
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(sqlText).then(() => {
                Swal.fire({
                    icon: 'success',
                    title: 'คัดลอก SQL ซ่อมแซมวัน/เดือนแล้ว!',
                    text: 'นำคำสั่งนี้ไปวางและรันใน Supabase SQL Editor เพื่อสลับวัน-เดือนที่นำเข้าผิดกลับมาให้ถูกต้อง',
                    timer: 3000,
                    showConfirmButton: false
                });
            }).catch(() => fallbackCopy(sqlText));
        } else {
            fallbackCopy(sqlText);
        }
    }

    async repairSwappedDates() {
        const confirmRes = await Swal.fire({
            title: 'ยืนยันการซ่อมแซมวัน/เดือนที่สลับกัน?',
            html: `
                <div class="text-left text-xs text-slate-300 space-y-2 p-3 bg-slate-900 rounded border border-slate-800">
                    <p>ระบบจะตรวจสอบข้อมูลในตาราง (เช่น การใช้ไฟฟ้า, น้ำเสีย, คุณภาพน้ำ) หากพบรายการที่วันที่และเดือนสลับกันจากการนำเข้า CSV (เช่น 2023-01-10 ซึ่งจริงๆ คือ 1 ตุลาคม 2023)</p>
                    <p class="text-amber-400 font-semibold">ระบบจะสลับวันและเดือนให้ถูกต้องตรงกับลำดับปฏิทินจริงและอัปเดตลงฐานข้อมูล Supabase และ Local ทันที</p>
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: '⚡ ดำเนินการซ่อมแซมทันที',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#10b981',
            cancelButtonColor: '#334155'
        });

        if (!confirmRes.isConfirmed) return;

        Swal.fire({
            title: 'กำลังตรวจสอบและซ่อมแซมวัน/เดือน...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        let totalRepaired = 0;
        const tablesToFix = ['electricity_consumption', 'influent_wastewater', 'preliminary_water_quality'];

        for (const tbl of tablesToFix) {
            const items = await window.DataStore.getAll(tbl, { orderBy: 'recorded_at', ascending: true });
            for (const item of items) {
                if (!item.recorded_at) continue;
                const d = new Date(item.recorded_at);
                if (isNaN(d.getTime())) continue;

                const day = d.getDate();
                const month = d.getMonth() + 1; // 1-12
                const year = d.getFullYear();

                // ตรวจสอบเงื่อนไขว่า วันที่และเดือนสลับกันหรือไม่
                if (day === 10 && month !== 10) {
                    const pad = (n) => String(n).padStart(2, '0');
                    const newIso = `${year}-10-${pad(month)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
                    
                    item.recorded_at = newIso;
                    await window.DataStore.update(tbl, item.id, item);
                    totalRepaired++;
                }
            }
        }

        Swal.fire({
            icon: 'success',
            title: 'ซ่อมแซมวัน/เดือนสำเร็จ!',
            text: `แก้ไขรายการที่สลับวัน/เดือนเรียบร้อยแล้วทั้งหมด ${totalRepaired} รายการ ข้อมูลจะจัดเรียงตามวันที่จริงอย่างถูกต้อง`,
            timer: 2500,
            showConfirmButton: true,
            confirmButtonColor: '#10b981'
        }).then(() => {
            window.location.reload();
        });
    }

    // =========================================================================
    // ระบบแปลงและตรวจสอบวันเวลาอัจฉริยะ (Universal Smart Date Parser)
    // รองรับ: พ.ศ. 2566/2567/2569, ค.ศ., D/M/Y, M/D/Y, Y-M-D, Excel Serial, และชื่อเดือนไทย
    // =========================================================================
    parseDateSmart(val, returnDateOnly = false) {
        if (val === null || val === undefined || val === '') {
            const now = new Date();
            return returnDateOnly ? now.toISOString().split('T')[0] : now.toISOString();
        }

        // 1. ถ้าเป็น Date Object อยู่แล้ว
        if (val instanceof Date) {
            if (isNaN(val.getTime())) {
                const now = new Date();
                return returnDateOnly ? now.toISOString().split('T')[0] : now.toISOString();
            }
            return returnDateOnly ? val.toISOString().split('T')[0] : val.toISOString();
        }

        // 2. ถ้าเป็น Excel Serial Number (เช่น 45200.36944 หรือตัวเลข 5 หลัก)
        if (typeof val === 'number' || (!isNaN(Number(val)) && Number(val) > 20000 && Number(val) < 80000)) {
            const num = Number(val);
            const excelEpoch = new Date(1899, 11, 30);
            const totalMs = Math.round(num * 86400 * 1000);
            const d = new Date(excelEpoch.getTime() + totalMs);
            if (!isNaN(d.getTime())) {
                const pad = (n) => String(n).padStart(2, '0');
                const isoDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                if (returnDateOnly) return isoDate;
                return `${isoDate}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
            }
        }

        let str = String(val).trim();
        if (!str) {
            const now = new Date();
            return returnDateOnly ? now.toISOString().split('T')[0] : now.toISOString();
        }

        // แปลงชื่อเดือนไทยถ้ามี (ม.ค. -> 1, ต.ค. -> 10, etc.)
        const thaiMonths = {
            'มกราคม': 1, 'ม.ค.': 1, 'กุมภาพันธ์': 2, 'ก.พ.': 2,
            'มีนาคม': 3, 'มี.ค.': 3, 'เมษายน': 4, 'เม.ย.': 4,
            'พฤษภาคม': 5, 'พ.ค.': 5, 'มิถุนายน': 6, 'มิ.ย.': 6,
            'กรกฎาคม': 7, 'ก.ค.': 7, 'สิงหาคม': 8, 'ส.ค.': 8,
            'กันยายน': 9, 'ก.ย.': 9, 'ตุลาคม': 10, 'ต.ค.': 10,
            'พฤศจิกายน': 11, 'พ.ย.': 11, 'ธันวาคม': 12, 'ธ.ค.': 12
        };

        for (const [thM, mNum] of Object.entries(thaiMonths)) {
            if (str.includes(thM)) {
                str = str.replace(thM, `/${mNum}/`).replace(/\s+/g, ' ').replace(/\/\s+/g, '/').replace(/\s+\//g, '/');
                break;
            }
        }

        // กำจัดคำภาษาไทยส่วนเกิน เช่น "เวลา", "น."
        str = str.replace(/เวลา/g, ' ').replace(/น\./g, '').trim();

        // 3. Regex ตรวจจับรูปแบบ วัน/เดือน/ปี (D/M/Y) เช่น "1/10/2566 8:52", "01/10/2566 08:52", "1-10-2566 14:23"
        const dmyRegex = /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})(?:[T\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/;
        const dmyMatch = str.match(dmyRegex);

        if (dmyMatch) {
            let day = parseInt(dmyMatch[1], 10);
            let month = parseInt(dmyMatch[2], 10);
            let year = parseInt(dmyMatch[3], 10);
            let hour = dmyMatch[4] !== undefined ? parseInt(dmyMatch[4], 10) : 8;
            let min = dmyMatch[5] !== undefined ? parseInt(dmyMatch[5], 10) : 0;
            let sec = dmyMatch[6] !== undefined ? parseInt(dmyMatch[6], 10) : 0;

            // ตรวจสอบและแปลงปี พ.ศ. เป็น ค.ศ. (เช่น 2566 -> 2023, 2567 -> 2024, 2569 -> 2026)
            if (year >= 2400) {
                year -= 543;
            } else if (year < 100) {
                if (year >= 50) {
                    year = (2500 + year) - 543;
                } else {
                    year = 2000 + year;
                }
            }

            // ถ้า month > 12 และ day <= 12 ให้สลับกัน
            if (month > 12 && day <= 12) {
                const temp = day;
                day = month;
                month = temp;
            }

            const pad = (n) => String(n).padStart(2, '0');
            const isoDate = `${year}-${pad(month)}-${pad(day)}`;
            if (returnDateOnly) return isoDate;
            return `${isoDate}T${pad(hour)}:${pad(min)}:${pad(sec)}`;
        }

        // 4. Regex ตรวจจับรูปแบบ ปี-เดือน-วัน (ISO Y-M-D) เช่น "2023-10-01 08:52", "2566-10-01"
        const ymdRegex = /^(\d{2,4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})(?:[T\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/;
        const ymdMatch = str.match(ymdRegex);

        if (ymdMatch) {
            let year = parseInt(ymdMatch[1], 10);
            let month = parseInt(ymdMatch[2], 10);
            let day = parseInt(ymdMatch[3], 10);
            let hour = ymdMatch[4] !== undefined ? parseInt(ymdMatch[4], 10) : 8;
            let min = ymdMatch[5] !== undefined ? parseInt(ymdMatch[5], 10) : 0;
            let sec = ymdMatch[6] !== undefined ? parseInt(ymdMatch[6], 10) : 0;

            if (year >= 2400) {
                year -= 543;
            } else if (year < 100) {
                if (year >= 50) {
                    year = (2500 + year) - 543;
                } else {
                    year = 2000 + year;
                }
            }

            const pad = (n) => String(n).padStart(2, '0');
            const isoDate = `${year}-${pad(month)}-${pad(day)}`;
            if (returnDateOnly) return isoDate;
            return `${isoDate}T${pad(hour)}:${pad(min)}:${pad(sec)}`;
        }

        // 5. Fallback ลอง new Date()
        const parsed = new Date(str);
        if (!isNaN(parsed.getTime())) {
            let y = parsed.getFullYear();
            if (y >= 2400) y -= 543;
            const pad = (n) => String(n).padStart(2, '0');
            const isoDate = `${y}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
            if (returnDateOnly) return isoDate;
            return `${isoDate}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}:${pad(parsed.getSeconds())}`;
        }

        const now = new Date();
        return returnDateOnly ? now.toISOString().split('T')[0] : now.toISOString();
    }

    // ฟังก์ชันจัดรูปแบบวันเวลาไทย (DD/MM/BBBB HH:mm)
    formatDateTime(isoStr) {
        if (!isoStr) return '-';
        let d = new Date(isoStr);
        if (isNaN(d.getTime())) {
            const parsed = this.parseDateSmart(isoStr);
            d = new Date(parsed);
        }
        if (isNaN(d.getTime())) return String(isoStr);

        let year = d.getFullYear();
        // ถ้าปียังเป็น ค.ศ. (น้อยกว่า 2400) แปลงเป็น พ.ศ.
        if (year < 2400) {
            year += 543;
        }

        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const hour = d.getHours().toString().padStart(2, '0');
        const min = d.getMinutes().toString().padStart(2, '0');
        return `${day}/${month}/${year} ${hour}:${min}`;
    }

    // ฟังก์ชันจัดรูปแบบวันที่ไทย (DD/MM/BBBB)
    formatDate(isoStr) {
        if (!isoStr) return '-';
        let d = new Date(isoStr);
        if (isNaN(d.getTime())) {
            const parsed = this.parseDateSmart(isoStr, true);
            d = new Date(parsed);
        }
        if (isNaN(d.getTime())) return String(isoStr);

        let year = d.getFullYear();
        if (year < 2400) {
            year += 543;
        }

        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        return `${day}/${month}/${year}`;
    }

    // =========================================================================
    // ระบบจัดเรียงข้อมูลส่วนกลางสำหรับทุกตาราง (Universal Table Sorter)
    // =========================================================================
    /**
     * ฟังก์ชันจัดเรียงข้อมูลอัจฉริยะ รองรับทั้ง วันที่/เวลา, ตัวเลข, เลขมิเตอร์, ข้อความภาษาไทย/อังกฤษ และ Array
     * ค่าเริ่มต้น: จัดเรียงข้อมูลวันที่ล่าสุดขึ้นก่อนเสมอ (DESC)
     */
    sortData(array, sortKey = 'recorded_at', sortDir = 'desc') {
        if (!Array.isArray(array)) return [];
        if (!sortKey) return array;

        const isDesc = String(sortDir).toLowerCase() === 'desc';

        // ฟังก์ชันช่วยสกัด timestamp เป็น epoch millisecond เพื่อเปรียบเทียบเวลาได้อย่างแม่นยำ 100%
        const getTimestamp = (val) => {
            if (val === null || val === undefined || val === '') return null;
            if (val instanceof Date) return isNaN(val.getTime()) ? null : val.getTime();
            if (typeof val === 'number') {
                if (val > 20000 && val < 80000) {
                    // Excel serial date
                    const excelEpoch = new Date(1899, 11, 30);
                    return excelEpoch.getTime() + Math.round(val * 86400 * 1000);
                }
                return null;
            }
            if (typeof val === 'string') {
                const s = val.trim();
                // ถ้าเป็น Month YYYY-MM เช่น '2026-08'
                if (/^\d{4}-\d{2}$/.test(s)) {
                    const d = new Date(s + '-01');
                    return isNaN(d.getTime()) ? null : d.getTime();
                }
                // ถ้าเป็น ISO date, D/M/Y, Y-M-D, หรือมีตัวเลข/เครื่องหมายคั่นวันเวลา
                if (/[\/\-\.]/.test(s) && /\d/.test(s)) {
                    if (this.parseDateSmart) {
                        const parsedIso = this.parseDateSmart(s);
                        const t = new Date(parsedIso).getTime();
                        if (!isNaN(t)) return t;
                    }
                    const t = new Date(s).getTime();
                    if (!isNaN(t)) return t;
                }
            }
            return null;
        };

        const isDateField = ['recorded_at', 'sampling_date', 'report_date', 'date', 'created_at', 'updated_at', 'report_month'].includes(sortKey);

        return [...array].sort((a, b) => {
            let valA = a ? a[sortKey] : undefined;
            let valB = b ? b[sortKey] : undefined;

            // แปลง Array ให้เป็น String เช่น รายชื่ออุปกรณ์
            if (Array.isArray(valA)) valA = valA.join(', ');
            if (Array.isArray(valB)) valB = valB.join(', ');

            // 1. ตรวจสอบและเปรียบเทียบกรณีเป็น วันที่/เวลา
            const timeA = getTimestamp(valA);
            const timeB = getTimestamp(valB);

            if (timeA !== null && timeB !== null) {
                const diff = timeA - timeB;
                return isDesc ? -diff : diff;
            }

            // ถ้าคอลัมน์เป็น Date Field แต่ค่าใดค่าหนึ่งว่าง
            if (isDateField) {
                if (timeA !== null && timeB === null) return isDesc ? -1 : 1;
                if (timeA === null && timeB !== null) return isDesc ? 1 : -1;
            }

            if (valA === undefined || valA === null) valA = '';
            if (valB === undefined || valB === null) valB = '';

            // 2. ตรวจสอบกรณีเป็นตัวเลข (รวมถึงกรณี String ตัวเลขที่มีเครื่องหมายจุลภาค)
            const strA = String(valA).trim().replace(/,/g, '');
            const strB = String(valB).trim().replace(/,/g, '');

            const isNumA = strA !== '' && !isNaN(Number(strA));
            const isNumB = strB !== '' && !isNaN(Number(strB));

            if (isNumA && isNumB) {
                const diff = Number(strA) - Number(strB);
                return isDesc ? -diff : diff;
            }

            // 3. จัดเรียงตามพจนานุกรมภาษาไทยและภาษาอังกฤษ (Natural Thai & English Collation)
            const diff = String(valA).localeCompare(String(valB), 'th', { numeric: true, sensitivity: 'base' });
            return isDesc ? -diff : diff;
        });
    }

    /**
     * อัปเดตไอคอนแสดงสถานะการจัดเรียงบนหัวตาราง (Table Headers UI)
     */
    updateTableSortUI(tableElementOrId, currentField, currentDir) {
        let table = typeof tableElementOrId === 'string' ? document.getElementById(tableElementOrId) : tableElementOrId;
        if (!table) return;

        // หากส่ง tbody มา ให้หา table ตัวแม่
        if (table.tagName === 'TBODY') {
            table = table.closest('table') || table.parentElement;
        }

        const headers = table.querySelectorAll('th[data-sort]');
        headers.forEach(th => {
            const field = th.getAttribute('data-sort');
            let icon = th.querySelector('.sort-icon');
            if (!icon) {
                icon = document.createElement('i');
                icon.className = 'fa-solid fa-sort sort-icon';
                th.appendChild(icon);
            }

            if (field === currentField) {
                th.classList.add('active-sort');
                if (currentDir === 'asc') {
                    icon.className = 'fa-solid fa-arrow-up-short-wide text-cyan-400 sort-icon';
                    th.title = 'จัดเรียง: น้อย → มาก / ก → ฮ (คลิกเพื่อเปลี่ยนเป็น มาก → น้อย)';
                } else {
                    icon.className = 'fa-solid fa-arrow-down-wide-short text-cyan-400 sort-icon';
                    th.title = 'จัดเรียง: มาก → น้อย / ใหม่ → เก่า (คลิกเพื่อเปลี่ยนเป็น น้อย → มาก)';
                }
            } else {
                th.classList.remove('active-sort');
                icon.className = 'fa-solid fa-sort text-slate-500 text-[11px] sort-icon';
                th.title = 'คลิกเพื่อจัดเรียงตามคอลัมน์นี้';
            }
        });
    }

    /**
     * ผูก Event คลิกจัดเรียงข้อมูลให้กับหัวตาราง (th[data-sort]) ของแต่ละตาราง
     */
    bindTableSorting(tableElementOrId, moduleInstance, defaultField = 'recorded_at', defaultDir = 'desc') {
        let table = typeof tableElementOrId === 'string' ? document.getElementById(tableElementOrId) : tableElementOrId;
        if (!table) return;

        if (table.tagName === 'TBODY') {
            table = table.closest('table') || table.parentElement;
        }

        moduleInstance.sortField = moduleInstance.sortField || defaultField;
        moduleInstance.sortDir = moduleInstance.sortDir || defaultDir;

        const headers = table.querySelectorAll('th[data-sort]');
        headers.forEach(th => {
            th.classList.add('sortable-th');
            if (!th.querySelector('.sort-icon')) {
                const icon = document.createElement('i');
                icon.className = 'fa-solid fa-sort text-slate-500 text-[11px] sort-icon';
                th.appendChild(icon);
            }

            th.onclick = (e) => {
                e.preventDefault();
                const field = th.getAttribute('data-sort');
                if (!field) return;

                if (moduleInstance.sortField === field) {
                    moduleInstance.sortDir = moduleInstance.sortDir === 'asc' ? 'desc' : 'asc';
                } else {
                    moduleInstance.sortField = field;
                    // หากเป็นวันที่หรือตัวเลข ให้เริ่มจาก มาก -> น้อย เป็นค่าเริ่มต้น
                    if (field.includes('date') || field.includes('at') || field.includes('meter') || field.includes('used') || field.includes('influent') || field.includes('kwh') || field.includes('cost') || field.includes('total') || field.includes('sediment') || field.includes('tds')) {
                        moduleInstance.sortDir = 'desc';
                    } else {
                        moduleInstance.sortDir = 'asc';
                    }
                }

                // แสดง Toast แจ้งเตือนสั้นๆ
                const rawTitle = th.innerText.replace(/[▲▼↕]/g, '').trim().split('\n')[0];
                const dirText = moduleInstance.sortDir === 'asc' ? 'น้อย → มาก (ก → ฮ)' : 'มาก → น้อย (ใหม่ → เก่า)';
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'info',
                    title: `จัดเรียงตาม: ${rawTitle}`,
                    text: `ลำดับ: ${dirText}`,
                    timer: 900,
                    showConfirmButton: false
                });

                if (typeof moduleInstance.applyFilters === 'function') {
                    moduleInstance.applyFilters();
                } else if (typeof moduleInstance.loadData === 'function') {
                    moduleInstance.applyFilters ? moduleInstance.applyFilters() : moduleInstance.renderTable(moduleInstance.items || []);
                }
            };
        });

        this.updateTableSortUI(table, moduleInstance.sortField, moduleInstance.sortDir);
    }

    // =========================================================================
    // ระบบแบ่งหน้าและเลือกจำนวนแถวที่แสดงส่วนกลาง (Universal Pagination Engine)
    // รองรับ 10, 20, 50, 100, 200, 500, 1000, ทั้งหมด และการ์ดสรุปผลรวมตามเงื่อนไขตัวกรอง
    // =========================================================================
    renderPagination(config) {
        const { containerId, totalItems = 0, currentPage = 1, pageSize = 20, summaryCards = [], onPageChange, onPageSizeChange } = config;
        const container = document.getElementById(containerId);
        if (!container) return;

        let summaryCardsHtml = '';
        if (Array.isArray(summaryCards) && summaryCards.length > 0) {
            summaryCardsHtml = `
                <div class="table-summary-cards-bar">
                    ${summaryCards.map(card => {
                        const colorClass = card.color || 'emerald';
                        const textClass = colorClass === 'amber' ? 'text-amber-400' :
                                          colorClass === 'cyan' ? 'text-cyan-400' :
                                          colorClass === 'emerald' ? 'text-emerald-400' :
                                          colorClass === 'purple' ? 'text-purple-400' :
                                          colorClass === 'rose' ? 'text-rose-400' :
                                          colorClass === 'blue' ? 'text-blue-400' : 'text-emerald-400';
                        return `
                            <div class="summary-metric-card">
                                <div class="summary-card-left">
                                    <span class="summary-card-title">${card.title}</span>
                                    <span class="summary-card-value ${textClass}">${card.value}</span>
                                    <span class="summary-card-sub">${card.subText || ''}</span>
                                </div>
                                <div class="summary-card-icon color-${colorClass}">
                                    <i class="${card.icon || 'fa-solid fa-chart-simple'}"></i>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        if (totalItems === 0) {
            container.innerHTML = `
                ${summaryCardsHtml}
                <div class="table-pagination-bar">
                    <div class="pagination-info">
                        <span>แสดง <strong class="text-white font-mono">0</strong> ถึง <strong class="text-white font-mono">0</strong> จากทั้งหมด <strong class="text-amber-400 font-mono">0</strong> รายการ</span>
                    </div>
                </div>
            `;
            return;
        }

        const isAll = pageSize === 'all' || parseInt(pageSize, 10) >= 99999;
        const actualPageSize = isAll ? totalItems : parseInt(pageSize, 10);
        const totalPages = isAll ? 1 : Math.ceil(totalItems / actualPageSize);
        const validPage = Math.min(Math.max(1, currentPage), Math.max(1, totalPages));

        const startIdx = totalItems === 0 ? 0 : (validPage - 1) * actualPageSize + 1;
        const endIdx = isAll ? totalItems : Math.min(validPage * actualPageSize, totalItems);

        // ตัวเลือกขนาดหน้า
        const sizeOptions = [5, 10, 20, 50, 100, 'all'];

        let pagesHtml = '';
        if (!isAll && totalPages > 1) {
            let startPage = Math.max(1, validPage - 2);
            let endPage = Math.min(totalPages, startPage + 4);
            if (endPage - startPage < 4) {
                startPage = Math.max(1, endPage - 4);
            }

            for (let p = startPage; p <= endPage; p++) {
                pagesHtml += `<button type="button" class="btn-page-number ${p === validPage ? 'active' : ''}" data-page="${p}">${p}</button>`;
            }
        }

        container.innerHTML = `
            ${summaryCardsHtml}
            <div class="table-pagination-bar">
                <div class="pagination-info">
                    <span>แสดง <strong class="text-white font-mono">${startIdx.toLocaleString()}</strong> ถึง <strong class="text-white font-mono">${endIdx.toLocaleString()}</strong> จากทั้งหมด <strong class="text-amber-400 font-mono">${totalItems.toLocaleString()}</strong> รายการ</span>
                </div>

                <div class="flex items-center gap-3 flex-wrap">
                    <div class="pagination-size-selector">
                        <span>แสดง:</span>
                        <select class="pagination-select-control pagination-size-select">
                            ${sizeOptions.map(opt => `
                                <option value="${opt}" ${String(pageSize) === String(opt) ? 'selected' : ''}>
                                    ${opt === 'all' ? 'ทั้งหมด (' + totalItems.toLocaleString() + ')' : opt + ' รายการ'}
                                </option>
                            `).join('')}
                        </select>
                    </div>

                    ${!isAll && totalPages > 1 ? `
                        <div class="pagination-controls">
                            <button type="button" class="btn-page-nav btn-first-page" ${validPage <= 1 ? 'disabled' : ''} title="หน้าแรก">
                                <i class="fa-solid fa-angles-left"></i>
                            </button>
                            <button type="button" class="btn-page-nav btn-prev-page" ${validPage <= 1 ? 'disabled' : ''} title="หน้าก่อนหน้า">
                                <i class="fa-solid fa-chevron-left"></i>
                            </button>
                            ${pagesHtml}
                            <button type="button" class="btn-page-nav btn-next-page" ${validPage >= totalPages ? 'disabled' : ''} title="หน้าถัดไป">
                                <i class="fa-solid fa-chevron-right"></i>
                            </button>
                            <button type="button" class="btn-page-nav btn-last-page" ${validPage >= totalPages ? 'disabled' : ''} title="หน้าสุดท้าย">
                                <i class="fa-solid fa-angles-right"></i>
                            </button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        // Bind events
        const sizeSelect = container.querySelector('.pagination-size-select');
        if (sizeSelect) {
            sizeSelect.onchange = (e) => {
                const val = e.target.value;
                if (onPageSizeChange) onPageSizeChange(val === 'all' ? 'all' : parseInt(val, 10));
            };
        }

        const btnFirst = container.querySelector('.btn-first-page');
        if (btnFirst) btnFirst.onclick = () => onPageChange(1);

        const btnPrev = container.querySelector('.btn-prev-page');
        if (btnPrev) btnPrev.onclick = () => onPageChange(validPage - 1);

        const btnNext = container.querySelector('.btn-next-page');
        if (btnNext) btnNext.onclick = () => onPageChange(validPage + 1);

        const btnLast = container.querySelector('.btn-last-page');
        if (btnLast) btnLast.onclick = () => onPageChange(totalPages);

        const pageBtns = container.querySelectorAll('.btn-page-number');
        pageBtns.forEach(btn => {
            btn.onclick = () => {
                const p = parseInt(btn.getAttribute('data-page'), 10);
                if (p && onPageChange) onPageChange(p);
            };
        });
    }

    // =========================================================================
    // ฟังก์ชันช่วยเหลือการกรองข้อมูลแบบสากลและแม่นยำ (Universal Robust Filters)
    // รองรับการกรองไม่จำกัดจำนวนแถว, ไม่ว่าจะเลือก วันที่, เดือน, ปี หรือ แผนก/อาคาร
    // =========================================================================
    normalizeDateISO(val) {
        if (!val) return null;
        if (val instanceof Date) {
            if (isNaN(val.getTime())) return null;
            const y = val.getFullYear();
            const m = String(val.getMonth() + 1).padStart(2, '0');
            const d = String(val.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
        val = String(val).trim();
        // 1. ISO or SQL datetime: "YYYY-MM-DD..."
        if (/^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/.test(val)) {
            const match = val.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
            if (match) {
                let y = parseInt(match[1], 10);
                if (y > 2400) y -= 543; // แปลง พ.ศ. เป็น ค.ศ.
                const m = String(match[2]).padStart(2, '0');
                const d = String(match[3]).padStart(2, '0');
                return `${y}-${m}-${d}`;
            }
        }
        // 2. Slash format: "DD/MM/YYYY..." or "D/M/YYYY..."
        if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(val)) {
            const match = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
            if (match) {
                let y = parseInt(match[3], 10);
                if (y > 2400) y -= 543;
                const m = String(match[2]).padStart(2, '0');
                const d = String(match[1]).padStart(2, '0');
                return `${y}-${m}-${d}`;
            }
        }
        // 3. Dash format: "DD-MM-YYYY..."
        if (/^\d{1,2}-\d{1,2}-\d{4}/.test(val)) {
            const match = val.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
            if (match) {
                let y = parseInt(match[3], 10);
                if (y > 2400) y -= 543;
                const m = String(match[2]).padStart(2, '0');
                const d = String(match[1]).padStart(2, '0');
                return `${y}-${m}-${d}`;
            }
        }
        // 4. Month string: "YYYY-MM"
        if (/^\d{4}-\d{1,2}$/.test(val)) {
            const [yStr, mStr] = val.split('-');
            let y = parseInt(yStr, 10);
            if (y > 2400) y -= 543;
            return `${y}-${String(mStr).padStart(2, '0')}-01`;
        }
        // Fallback Date parsing
        try {
            const d = new Date(val);
            if (!isNaN(d.getTime())) {
                let y = d.getFullYear();
                if (y > 2400) y -= 543;
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${y}-${m}-${day}`;
            }
        } catch (e) {}
        return null;
    }

    matchDateFilter(recordedAt, filters = {}) {
        if (!recordedAt) return true;
        const itemDateStr = this.normalizeDateISO(recordedAt);
        if (!itemDateStr) return true;

        // 1. ตรวจสอบช่วงวันที่เริ่มต้น (Start Date)
        if (filters.startDate) {
            const startStr = this.normalizeDateISO(filters.startDate);
            if (startStr && itemDateStr < startStr) return false;
        }

        // 2. ตรวจสอบช่วงวันที่สิ้นสุด (End Date)
        if (filters.endDate) {
            const endStr = this.normalizeDateISO(filters.endDate);
            if (endStr && itemDateStr > endStr) return false;
        }

        // 3. ตรวจสอบปี (Year - CE or BE)
        if (filters.year && filters.year !== 'all') {
            const [itemY] = itemDateStr.split('-').map(Number);
            const filterY = parseInt(filters.year, 10);
            const filterYCE = filterY > 2400 ? filterY - 543 : filterY;
            if (itemY !== filterYCE) return false;
        }

        // 4. ตรวจสอบเดือน (Month - 01 ถึง 12)
        if (filters.month && filters.month !== 'all') {
            const [, itemM] = itemDateStr.split('-');
            const filterM = String(parseInt(filters.month, 10)).padStart(2, '0');
            if (itemM !== filterM) return false;
        }

        return true;
    }

    matchBuildingFilter(sourceText, buildingFilter = 'all') {
        if (!buildingFilter || buildingFilter === 'all') return true;
        const src = (sourceText || '').toLowerCase();

        if (buildingFilter === 'all_buildings') {
            return src.includes('รวม') || src.includes('ทุกอาคาร') || src.includes('โรงพยาบาล') || src === '';
        }
        if (buildingFilter === 'ipd') {
            return src.includes('ผู้ป่วยใน') || src.includes('ipd');
        }
        if (buildingFilter === 'opd') {
            return src.includes('ผู้ป่วยนอก') || src.includes('opd');
        }
        if (buildingFilter === 'service') {
            return src.includes('บริการ') || src.includes('โภชนาการ') || src.includes('service');
        }
        if (buildingFilter === 'support') {
            return src.includes('สนับสนุน') || src.includes('ซักฟอก') || src.includes('support');
        }
        if (buildingFilter === 'wwtp') {
            return src.includes('บำบัด') || src.includes('wwtp') || src.includes('ระบบ') || src === '';
        }
        return src.includes(buildingFilter.toLowerCase());
    }
}

window.App = new AppController();

// เมื่อโหลด DOM เสร็จแล้ว
document.addEventListener('DOMContentLoaded', () => {
    window.App.init();
});
