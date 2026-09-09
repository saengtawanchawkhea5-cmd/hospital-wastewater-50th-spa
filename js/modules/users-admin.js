/**
 * ============================================================================
 * ระบบจัดการระบบบำบัดน้ำเสีย โรงพยาบาล ๕๐ พรรษา มหาวชิราลงกรณ (SPA)
 * USERS-ADMIN.JS - จัดการบัญชีผู้ใช้งานและสิทธิ์เข้าถึง (User & Role Management - Admin Only)
 * ============================================================================
 */

class UsersAdminModule {
    constructor() {
        this.items = [];
        this.filteredItems = [];
        this.editingId = null;
        this.sortField = 'username';
        this.sortDir = 'asc';
        this.searchKeyword = '';
    }

    async init() {
        this.bindEvents();
        await this.loadData();
    }

    bindEvents() {
        // ผูกการคลิกจัดเรียงหัวตารางอัตโนมัติ
        if (window.App && window.App.bindTableSorting) {
            window.App.bindTableSorting('table-users-body', this, 'username', 'asc');
        }

        const btnAdd = document.getElementById('btn-add-user');
        if (btnAdd) btnAdd.addEventListener('click', () => this.openAddModal());

        const searchInput = document.getElementById('search-users');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.filterList(e.target.value));
        }

        const pageSizeSelect = document.getElementById('filter-users-page-size');
        if (pageSizeSelect) {
            pageSizeSelect.addEventListener('change', () => this.applyFilters());
        }

        const form = document.getElementById('form-user-admin');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveData();
            });
        }
    }

    async loadData() {
        let dbUsers = await window.DataStore.getAll('users');
        if (!Array.isArray(dbUsers)) dbUsers = [];

        // ตรวจสอบให้แน่ใจว่ามี Primary Admin (Sangtawan) ในรายการเสมอ
        const primaryAdminUsername = APP_CONFIG.superAdmin.username;
        const hasPrimary = dbUsers.some(u => (u.username || '').toLowerCase() === primaryAdminUsername.toLowerCase());

        if (!hasPrimary) {
            const defaultPrimary = {
                id: 'u-001',
                username: APP_CONFIG.superAdmin.username,
                password_hash: APP_CONFIG.superAdmin.defaultPassword,
                full_name: APP_CONFIG.superAdmin.fullName,
                role: 'admin',
                department: 'หัวหน้ากลุ่มงานบริหารสิ่งแวดล้อม',
                status: 'active',
                created_at: new Date().toISOString()
            };
            this.items = [defaultPrimary, ...dbUsers];
        } else {
            this.items = dbUsers;
        }

        this.applyFilters();
    }

    applyFilters() {
        let list = [...this.items];
        if (this.searchKeyword) {
            const lower = this.searchKeyword.toLowerCase();
            list = list.filter(item => 
                (item.username && item.username.toLowerCase().includes(lower)) ||
                (item.full_name && item.full_name.toLowerCase().includes(lower)) ||
                (item.department && item.department.toLowerCase().includes(lower)) ||
                (item.role && item.role.toLowerCase().includes(lower))
            );
        }

        if (window.App && window.App.sortData) {
            list = window.App.sortData(list, this.sortField, this.sortDir);
            window.App.updateTableSortUI('table-users-body', this.sortField, this.sortDir);
        }

        this.filteredItems = list;
        this.renderTable(this.filteredItems);
    }

    openAddModal() {
        this.editingId = null;
        const form = document.getElementById('form-user-admin');
        const title = document.getElementById('modal-user-title');
        if (!form) return;

        form.reset();
        title.innerHTML = '<i class="fa-solid fa-user-plus text-emerald-400"></i> เพิ่มผู้ใช้งานระบบใหม่';
        
        const usernameInput = document.getElementById('uadm-form-username');
        if (usernameInput) usernameInput.disabled = false;
        
        const roleSelect = document.getElementById('uadm-form-role');
        if (roleSelect) roleSelect.value = 'user';
        
        const statusSelect = document.getElementById('uadm-form-status');
        if (statusSelect) statusSelect.value = 'active';

        window.App.openModal('modal-user-admin');
    }

    openEditModal(id) {
        const item = this.items.find(x => x.id === id);
        if (!item) return;

        this.editingId = id;
        const title = document.getElementById('modal-user-title');
        title.innerHTML = '<i class="fa-solid fa-user-pen text-purple-400"></i> แก้ไขข้อมูลผู้ใช้งาน';

        const usernameInput = document.getElementById('uadm-form-username');
        usernameInput.value = item.username;
        if (item.username === APP_CONFIG.superAdmin.username) {
            usernameInput.disabled = true; // ไม่อนุญาตให้เปลี่ยน username ของ Super Admin
        } else {
            usernameInput.disabled = false;
        }

        document.getElementById('uadm-form-password').value = item.password_hash || '';
        document.getElementById('uadm-form-fullname').value = item.full_name || '';
        document.getElementById('uadm-form-role').value = item.role || 'user';
        document.getElementById('uadm-form-department').value = item.department || 'หน่วยบำบัดน้ำเสีย';
        document.getElementById('uadm-form-status').value = item.status || 'active';

        window.App.openModal('modal-user-admin');
    }

    async saveData() {
        const form = document.getElementById('form-user-admin');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const usernameVal = document.getElementById('uadm-form-username').value.trim();
        const passwordVal = document.getElementById('uadm-form-password').value.trim();
        const fullnameVal = document.getElementById('uadm-form-fullname').value.trim();
        const roleVal = document.getElementById('uadm-form-role').value;
        const deptVal = document.getElementById('uadm-form-department').value.trim();
        const statusVal = document.getElementById('uadm-form-status').value;

        const payload = {
            username: usernameVal,
            password_hash: passwordVal,
            full_name: fullnameVal,
            role: roleVal,
            department: deptVal,
            status: statusVal
        };

        Swal.fire({ title: 'กำลังบันทึกข้อมูลผู้ใช้...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        try {
            if (this.editingId) {
                await window.DataStore.update('users', this.editingId, payload);
            } else {
                // ตรวจสอบ username ซ้ำ
                const exists = this.items.some(u => u.username.toLowerCase() === usernameVal.toLowerCase());
                if (exists) {
                    Swal.fire({ icon: 'warning', title: 'ชื่อผู้ใช้นี้มีในระบบแล้ว', text: 'กรุณาตั้งชื่อผู้ใช้ใหม่' });
                    return;
                }
                payload.created_at = new Date().toISOString();
                await window.DataStore.insert('users', payload);
            }

            // อัปเดตเซสชันหากเป็นผู้ใช้ปัจจุบัน
            if (window.AuthService && window.AuthService.getCurrentUser()) {
                const cur = window.AuthService.getCurrentUser();
                if (cur.username === usernameVal || cur.id === this.editingId) {
                    cur.full_name = fullnameVal;
                    cur.role = roleVal;
                    cur.department = deptVal;
                    window.AuthService.saveSession();
                    if (window.App && window.App.updateUserUI) {
                        window.App.updateUserUI();
                    }
                }
            }

            Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ!', timer: 1500, showConfirmButton: false });
            window.App.closeModal('modal-user-admin');
            await this.loadData();
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: err.message });
        }
    }

    async changeRole(userId, newRole) {
        const item = this.items.find(x => x.id === userId);
        if (!item) return;

        if (item.username === APP_CONFIG.superAdmin.username) {
            Swal.fire({ icon: 'warning', title: 'ไม่สามารถเปลี่ยนสิทธิ์ผู้ดูแลระบบหลักได้', text: 'บัญชี Sangtawan เป็น Primary Admin ของระบบ' });
            this.renderTable(this.filteredItems);
            return;
        }

        const roleName = newRole === 'admin' ? '🛡️ Admin (ผู้ดูแลระบบ)' : '👤 User (ผู้ใช้งานทั่วไป)';

        const confirmRes = await Swal.fire({
            title: `เปลี่ยนสิทธิ์ผู้ใช้ "${item.username}"?`,
            html: `ต้องการเปลี่ยนสิทธิ์ของ <strong>${item.full_name || item.username}</strong> เป็น <strong>${roleName}</strong> หรือไม่?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'ยืนยันเปลี่ยนสิทธิ์',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: newRole === 'admin' ? '#f59e0b' : '#3b82f6',
            cancelButtonColor: '#334155'
        });

        if (!confirmRes.isConfirmed) {
            this.renderTable(this.filteredItems);
            return;
        }

        Swal.fire({ title: 'กำลังปรับปรุงสิทธิ์...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        try {
            await window.DataStore.update('users', userId, { role: newRole });

            // อัปเดตแคชในเครื่อง
            item.role = newRole;

            // ตรวจสอบถ้าแก้ไขผู้ใช้ปัจจุบัน
            const cur = window.AuthService.getCurrentUser();
            if (cur && (cur.id === userId || cur.username === item.username)) {
                cur.role = newRole;
                window.AuthService.saveSession();
                if (window.App && window.App.updateUserUI) {
                    window.App.updateUserUI();
                }
            }

            Swal.fire({
                icon: 'success',
                title: 'ปรับเปลี่ยนสิทธิ์สำเร็จ!',
                text: `ผู้ใช้ ${item.username} ได้รับสิทธิ์ ${roleName} เรียบร้อยแล้ว`,
                timer: 1800,
                showConfirmButton: false
            });

            await this.loadData();
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: err.message });
            this.renderTable(this.filteredItems);
        }
    }

    async deleteItem(id) {
        const item = this.items.find(x => x.id === id);
        if (!item) return;

        if (item.username === APP_CONFIG.superAdmin.username) {
            Swal.fire({ icon: 'error', title: 'ไม่อนุญาตให้ลบบัญชี Super Admin หลัก' });
            return;
        }

        const result = await Swal.fire({
            title: 'ยืนยันการลบบัญชีผู้ใช้?',
            text: `ต้องการลบบัญชีผู้ใช้ "${item.username}" (${item.full_name}) ออกจากระบบหรือไม่?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#334155',
            confirmButtonText: 'ลบบัญชี',
            cancelButtonText: 'ยกเลิก'
        });

        if (result.isConfirmed) {
            await window.DataStore.delete('users', id);
            Swal.fire({ icon: 'success', title: 'ลบบัญชีเรียบร้อย', timer: 1500, showConfirmButton: false });
            await this.loadData();
        }
    }

    filterList(keyword) {
        this.searchKeyword = keyword || '';
        this.applyFilters();
    }

    renderTable(list) {
        const tbody = document.getElementById('table-users-body');
        if (!tbody) return;

        const totalItems = list ? list.length : 0;
        const activeCount = list ? list.filter(item => item.status === 'active').length : 0;
        const adminCount = list ? list.filter(item => item.role === 'admin').length : 0;
        const userCount = totalItems - adminCount;

        if (!list || list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-slate-500">ไม่พบรายชื่อผู้ใช้งาน</td></tr>`;
            const tfoot = document.getElementById('table-users-foot');
            if (tfoot) tfoot.innerHTML = '';
            return;
        }

        const hasNonPrimaryUsers = list.some(u => u.username !== APP_CONFIG.superAdmin.username);

        let rowsHtml = list.map((item, idx) => {
            const isSuper = item.username === APP_CONFIG.superAdmin.username;
            const isAdmin = item.role === 'admin';

            // Role Badge (Matching Image 1)
            const roleBadge = isAdmin ? `
                <span class="badge bg-amber-950/80 text-amber-300 border border-amber-600/60 py-1 px-3 text-xs font-semibold rounded-full inline-flex items-center gap-1.5 shadow-sm">
                    <i class="fa-solid fa-shield-halved text-amber-400"></i> Admin (ผู้ดูแลระบบ)
                </span>
            ` : `
                <span class="badge bg-blue-950/80 text-cyan-300 border border-cyan-700/60 py-1 px-3 text-xs font-semibold rounded-full inline-flex items-center gap-1.5 shadow-sm">
                    <i class="fa-solid fa-user text-cyan-400"></i> User (ผู้ใช้งานทั่วไป)
                </span>
            `;

            // Permission Summary (Matching Image 1)
            const permSummary = isAdmin ? `
                <span class="text-emerald-400 font-medium text-xs leading-relaxed">
                    เต็มสิทธิ์ทุกเมนู: ลงข้อมูล, แก้ไข, ลบ, นำเข้า, ล้างข้อมูล, แบคอัพ, กู้คืน, บันทึกอัตโนมัติ
                </span>
            ` : `
                <span class="text-slate-300 text-xs leading-relaxed">
                    สิทธิ์ทั่วไป: ดูข้อมูล, บันทึกข้อมูลประจำวัน, แก้ไขข้อมูลของตนเอง
                </span>
            `;

            // Change Role Control (Matching Image 1)
            const changeRoleControl = isSuper ? `
                <span class="text-slate-400 text-xs font-medium">ผู้ดูแลระบบหลัก (ค่าเริ่มต้น)</span>
            ` : `
                <select class="bg-slate-950 border border-slate-700 hover:border-slate-500 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:border-amber-400 focus:outline-none cursor-pointer transition shadow-sm font-medium" onchange="window.UsersAdminModule.changeRole('${item.id}', this.value)">
                    <option value="admin" ${isAdmin ? 'selected' : ''}>🛡️ Admin (ผู้ดูแลระบบ)</option>
                    <option value="user" ${!isAdmin ? 'selected' : ''}>👤 User (ผู้ใช้งานทั่วไป)</option>
                </select>
            `;

            // Account Actions (Matching Image 1)
            const actionsControl = isSuper ? `
                <span class="text-slate-500 text-center block">-</span>
            ` : `
                <div class="flex items-center justify-center gap-1.5">
                    <button class="btn btn-secondary btn-icon btn-sm text-purple-400 hover:text-purple-300 hover:bg-purple-950/40" onclick="window.UsersAdminModule.openEditModal('${item.id}')" title="แก้ไขข้อมูลผู้ใช้">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn btn-danger btn-icon btn-sm text-rose-400 hover:text-rose-300 hover:bg-rose-950/40" onclick="window.UsersAdminModule.deleteItem('${item.id}')" title="ลบบัญชีผู้ใช้">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;

            return `
                <tr class="hover:bg-slate-800/40 transition-colors">
                    <td class="text-slate-400 font-mono text-xs text-center font-bold">${idx + 1}</td>
                    <td class="font-bold text-white">
                        <div class="flex items-center gap-2 flex-wrap">
                            ${isSuper ? `
                                <span class="text-amber-400 text-sm">👑</span>
                                <span class="text-emerald-400 font-bold">${item.username}</span>
                                <span class="badge bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 text-[10px] py-0.5 px-2 font-bold rounded-md">Primary Admin</span>
                            ` : `
                                <span class="text-white">${item.username}</span>
                                ${item.full_name ? `<span class="text-xs text-slate-400 font-normal">(${item.full_name})</span>` : ''}
                            `}
                        </div>
                    </td>
                    <td>${roleBadge}</td>
                    <td>${permSummary}</td>
                    <td class="text-center">${changeRoleControl}</td>
                    <td class="text-center">${actionsControl}</td>
                </tr>
            `;
        }).join('');

        // Note row if only primary admin exists (Matching Image 1)
        if (!hasNonPrimaryUsers) {
            rowsHtml += `
                <tr>
                    <td colspan="6" class="text-center py-6 text-slate-400 text-xs italic bg-slate-900/30 border-t border-slate-800/60">
                        <i class="fa-solid fa-circle-info mr-1.5 text-cyan-400"></i> ยังไม่มีสมาชิกลงทะเบียนเพิ่มเติมในระบบ (มีเฉพาะ Admin หลัก Sangtawan)
                    </td>
                </tr>
            `;
        }

        tbody.innerHTML = rowsHtml;

        // Render Table Footer Summary Row
        const tfoot = document.getElementById('table-users-foot');
        if (tfoot) {
            tfoot.innerHTML = `
                <tr class="table-summary-row border-t-2 border-emerald-500/50 bg-slate-950/40">
                    <td class="text-center font-bold text-emerald-400 py-3.5"><i class="fa-solid fa-calculator"></i> รวม</td>
                    <td class="font-bold text-emerald-300 py-3.5">
                        <span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> ทั้งหมด (${totalItems.toLocaleString()} บัญชี)</span>
                    </td>
                    <td colspan="2" class="font-bold text-slate-300 py-3.5 text-xs">
                        <span class="badge bg-amber-950/70 text-amber-300 border border-amber-500/30 text-xs py-1 px-2.5 mr-1">Admin: ${adminCount}</span>
                        <span class="badge bg-blue-950/70 text-cyan-300 border border-cyan-500/30 text-xs py-1 px-2.5">User: ${userCount}</span>
                    </td>
                    <td colspan="2" class="text-right py-3.5 pr-4">
                        <span class="badge badge-success text-xs py-1 px-2.5">พร้อมใช้งาน ${activeCount}</span>
                    </td>
                </tr>
            `;
        }

        // Summary Cards Configuration
        const summaryCards = [
            {
                title: 'ผู้ใช้งานในระบบทั้งหมด',
                value: `${totalItems.toLocaleString()} บัญชี`,
                subText: 'ฐานข้อมูลผู้ใช้ระบบ รพ.',
                icon: 'fa-solid fa-users',
                color: 'cyan'
            },
            {
                title: 'ผู้ดูแลระบบ (Admin) VS ผู้ใช้งาน (User)',
                value: `Admin: ${adminCount} / User: ${userCount}`,
                subText: 'สัดส่วนสิทธิ์การเข้าถึงข้อมูล',
                icon: 'fa-solid fa-right-left',
                color: 'blue'
            },
            {
                title: 'สถานะบัญชีพร้อมใช้งาน (ACTIVE)',
                value: `${activeCount} / ${totalItems} บัญชี`,
                subText: `อัตราใช้งานได้ ${(totalItems > 0 ? ((activeCount / totalItems) * 100) : 100).toFixed(1)}%`,
                icon: 'fa-solid fa-circle-check',
                color: 'emerald'
            },
            {
                title: 'ผู้ใช้งานล่าสุด (RECENT USER)',
                value: 'Super Admin',
                subText: 'เข้าสู่ระบบล่าสุดตามบันทึก',
                icon: 'fa-solid fa-user-shield',
                color: 'amber'
            }
        ];

        if (window.App && window.App.renderPagination) {
            window.App.renderPagination({
                containerId: 'pagination-users',
                totalItems: totalItems,
                currentPage: 1,
                pageSize: 'all',
                summaryCards: summaryCards
            });
        }
    }
}

window.UsersAdminModule = new UsersAdminModule();
