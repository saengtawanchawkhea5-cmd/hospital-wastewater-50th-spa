/**
 * ============================================================================
 * ระบบจัดการระบบบำบัดน้ำเสีย โรงพยาบาล ๕๐ พรรษา มหาวชิราลงกรณ (SPA)
 * ATTACHMENT-MANAGER.JS - Universal Media & Attachment Controller
 * รองรับ: อัปโหลดรูปภาพ (JPG, PNG, WEBP), ไฟล์เอกสาร PDF, ถ่ายรูปสดจากกล้อง, ลิงก์ URL
 * ============================================================================
 */

class AttachmentManager {
    constructor() {
        this.activeCameraStream = null;
        this.cameraTargetCallback = null;
    }

    /**
     * บีบอัดรูปภาพและแปลงไฟล์เป็น Base64 Data URL (Images & PDF)
     */
    async processFile(file, maxDimension = 1400, quality = 0.82) {
        if (!file) return null;

        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        const isImage = file.type.startsWith('image/');

        if (isPdf) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    resolve({
                        type: 'pdf',
                        name: file.name,
                        size: this.formatFileSize(file.size),
                        data: reader.result,
                        uploadedAt: new Date().toISOString()
                    });
                };
                reader.onerror = (err) => reject(err);
                reader.readAsDataURL(file);
            });
        }

        if (isImage) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = new Image();
                    img.onload = () => {
                        let width = img.width;
                        let height = img.height;

                        if (width > maxDimension || height > maxDimension) {
                            if (width > height) {
                                height = Math.round((height * maxDimension) / width);
                                width = maxDimension;
                            } else {
                                width = Math.round((width * maxDimension) / height);
                                height = maxDimension;
                            }
                        }

                        const canvas = document.createElement('canvas');
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);

                        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                        resolve({
                            type: 'image',
                            name: file.name,
                            size: this.formatFileSize(Math.round((compressedDataUrl.length * 3) / 4)),
                            data: compressedDataUrl,
                            uploadedAt: new Date().toISOString()
                        });
                    };
                    img.onerror = () => {
                        // Fallback to raw data if image parsing fails
                        resolve({
                            type: 'image',
                            name: file.name,
                            size: this.formatFileSize(file.size),
                            data: e.target.result,
                            uploadedAt: new Date().toISOString()
                        });
                    };
                    img.src = e.target.result;
                };
                reader.onerror = (err) => reject(err);
                reader.readAsDataURL(file);
            });
        }

        // Generic Document (Doc, Excel, etc.)
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                resolve({
                    type: 'doc',
                    name: file.name,
                    size: this.formatFileSize(file.size),
                    data: reader.result,
                    uploadedAt: new Date().toISOString()
                });
            };
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(file);
        });
    }

    /**
     * แปลง URL เป็น Object Attachment
     */
    processUrl(urlStr) {
        if (!urlStr || typeof urlStr !== 'string') return null;
        const cleanUrl = urlStr.trim();
        if (!cleanUrl) return null;

        const isPdf = cleanUrl.toLowerCase().includes('.pdf') || cleanUrl.includes('/pdf');
        let fileName = cleanUrl.split('/').pop().split('?')[0] || (isPdf ? 'เอกสาร_PDF.pdf' : 'รูปภาพแนบ.jpg');
        if (fileName.length > 30) fileName = fileName.substring(0, 27) + '...';

        return {
            type: isPdf ? 'pdf' : 'image',
            name: decodeURIComponent(fileName),
            size: 'ลิงก์ภายนอก',
            data: cleanUrl,
            uploadedAt: new Date().toISOString()
        };
    }

    /**
     * แปลง Raw Data หรือ Array เป็น Normalized Attachment Objects
     */
    normalizeAttachments(raw) {
        if (!raw) return [];
        let list = [];

        if (Array.isArray(raw)) {
            list = raw;
        } else if (typeof raw === 'string') {
            const trimmed = raw.trim();
            if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                try {
                    const parsed = JSON.parse(trimmed);
                    if (Array.isArray(parsed)) list = parsed;
                } catch (e) {
                    list = [trimmed];
                }
            } else if (trimmed) {
                list = [trimmed];
            }
        }

        return list.map(item => {
            if (!item) return null;
            if (typeof item === 'object' && item.data) return item;
            if (typeof item === 'string') {
                const str = item.trim();
                const isPdf = str.startsWith('data:application/pdf') || str.toLowerCase().includes('.pdf');
                return {
                    type: isPdf ? 'pdf' : 'image',
                    name: isPdf ? 'เอกสาร PDF' : 'รูปภาพ',
                    size: str.startsWith('data:') ? this.formatFileSize(Math.round((str.length * 3) / 4)) : 'ลิงก์ภายนอก',
                    data: str,
                    uploadedAt: new Date().toISOString()
                };
            }
            return null;
        }).filter(Boolean);
    }

    /**
     * แปลง Attachment Objects กลับเป็น Format ที่พร้อมบันทึกลง Database
     */
    serializeAttachments(attachmentList, singleMode = false) {
        if (!attachmentList || attachmentList.length === 0) return '';
        if (singleMode) {
            const first = attachmentList[0];
            return typeof first === 'object' ? first.data : first;
        }
        return JSON.stringify(attachmentList);
    }

    /**
     * Render Attachment Widget ในฟอร์ม
     */
    renderWidget({
        containerId,
        items = [],
        badgeId = null,
        singleMode = false,
        themeColor = 'purple'
    }) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (badgeId) {
            const badge = document.getElementById(badgeId);
            if (badge) {
                badge.textContent = `${items.length} รายการ`;
            }
        }

        if (items.length === 0) {
            container.innerHTML = `
                <div class="image-fallback-box col-span-full py-5 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
                    <i class="fa-solid fa-cloud-arrow-up text-3xl mb-2 block text-slate-600"></i>
                    <span class="text-slate-400 font-medium">ยังไม่มีไฟล์แนบ</span>
                    <p class="text-[11px] text-slate-500 mt-0.5">คลิก "เลือกไฟล์", "ถ่ายรูป" หรือ "วางลิงก์ URL" เพื่อแนบรูปภาพหรือเอกสาร PDF</p>
                </div>
            `;
            return;
        }

        const cardsHtml = items.map((item, idx) => {
            const isPdf = item.type === 'pdf' || (typeof item.data === 'string' && (item.data.startsWith('data:application/pdf') || item.data.toLowerCase().includes('.pdf')));
            const isDoc = item.type === 'doc';

            if (isPdf) {
                return `
                    <div class="attachment-card pdf-card group relative p-2.5 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-red-500/70 transition-all shadow-md flex flex-col justify-between">
                        <div class="flex items-start gap-2.5">
                            <div class="w-10 h-10 rounded-lg bg-red-950/80 border border-red-800/80 flex items-center justify-center text-red-400 shrink-0 text-lg">
                                <i class="fa-solid fa-file-pdf"></i>
                            </div>
                            <div class="min-w-0 flex-1">
                                <div class="text-xs font-bold text-white truncate" title="${item.name || 'เอกสาร PDF'}">${item.name || 'เอกสาร PDF'}</div>
                                <div class="text-[10px] text-slate-400 font-mono mt-0.5">${item.size || 'PDF'}</div>
                            </div>
                        </div>
                        <div class="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between gap-1">
                            <button type="button" class="btn btn-outline btn-sm text-[11px] py-0.5 px-2 text-red-400 border-red-500/40 hover:bg-red-500/20" onclick="window.AttachmentManager.viewItem(${idx}, '${containerId}')">
                                <i class="fa-solid fa-eye"></i> เปิดดู PDF
                            </button>
                            <button type="button" class="btn btn-outline btn-icon btn-sm text-rose-400 hover:text-white" onclick="window.AttachmentManager.triggerRemove('${containerId}', ${idx})" title="ลบเอกสารนี้">
                                <i class="fa-solid fa-trash-can text-xs"></i>
                            </button>
                        </div>
                    </div>
                `;
            }

            if (isDoc) {
                return `
                    <div class="attachment-card doc-card group relative p-2.5 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-blue-500/70 transition-all shadow-md flex flex-col justify-between">
                        <div class="flex items-start gap-2.5">
                            <div class="w-10 h-10 rounded-lg bg-blue-950/80 border border-blue-800/80 flex items-center justify-center text-blue-400 shrink-0 text-lg">
                                <i class="fa-solid fa-file-lines"></i>
                            </div>
                            <div class="min-w-0 flex-1">
                                <div class="text-xs font-bold text-white truncate" title="${item.name || 'ไฟล์เอกสาร'}">${item.name || 'ไฟล์เอกสาร'}</div>
                                <div class="text-[10px] text-slate-400 font-mono mt-0.5">${item.size || 'Document'}</div>
                            </div>
                        </div>
                        <div class="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between gap-1">
                            <button type="button" class="btn btn-outline btn-sm text-[11px] py-0.5 px-2 text-blue-400 border-blue-500/40 hover:bg-blue-500/20" onclick="window.AttachmentManager.viewItem(${idx}, '${containerId}')">
                                <i class="fa-solid fa-eye"></i> เปิดดู
                            </button>
                            <button type="button" class="btn btn-outline btn-icon btn-sm text-rose-400 hover:text-white" onclick="window.AttachmentManager.triggerRemove('${containerId}', ${idx})" title="ลบไฟล์นี้">
                                <i class="fa-solid fa-trash-can text-xs"></i>
                            </button>
                        </div>
                    </div>
                `;
            }

            // Image Card
            const imgSrc = item.data || item;
            return `
                <div class="attachment-card image-card group relative rounded-xl overflow-hidden bg-slate-900 border border-slate-700/80 hover:border-${themeColor}-500/70 transition-all shadow-md">
                    <span class="attachment-badge">#${idx + 1}</span>
                    <button type="button" class="attachment-delete-btn" onclick="window.AttachmentManager.triggerRemove('${containerId}', ${idx})" title="ลบรูปภาพนี้">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                    <div class="image-thumb-box cursor-pointer" onclick="window.AttachmentManager.viewItem(${idx}, '${containerId}')">
                        <img src="${imgSrc}" class="w-full h-28 object-cover group-hover:scale-105 transition-transform duration-200" alt="รูปแนบ" />
                    </div>
                    <div class="p-1.5 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span class="truncate max-w-[90px]">${item.name || 'รูปภาพ'}</span>
                        <span>${item.size || ''}</span>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = cardsHtml;
    }

    /**
     * ผูก Attachments Helper สำหรับ Modal ใดๆ ในแอป
     */
    bindFormAttachments({
        moduleInstance,
        itemsProperty = 'uploadedImages',
        containerId,
        fileInputId,
        browseBtnId,
        cameraInputId,
        cameraBtnId,
        urlInputId,
        addUrlBtnId,
        clearBtnId = null,
        badgeId = null,
        themeColor = 'cyan',
        singleMode = false
    }) {
        // 1. Browse Files (Images + PDF)
        const btnBrowse = document.getElementById(browseBtnId);
        const inputFiles = document.getElementById(fileInputId);
        if (btnBrowse && inputFiles) {
            btnBrowse.addEventListener('click', () => inputFiles.click());
            inputFiles.addEventListener('change', async (e) => {
                const files = Array.from(e.target.files || []);
                if (files.length === 0) return;

                Swal.fire({
                    title: 'กำลังประมวลผลไฟล์...',
                    allowOutsideClick: false,
                    didOpen: () => Swal.showLoading()
                });

                for (const file of files) {
                    try {
                        const processed = await this.processFile(file);
                        if (processed) {
                            if (singleMode) {
                                moduleInstance[itemsProperty] = [processed];
                            } else {
                                if (!Array.isArray(moduleInstance[itemsProperty])) moduleInstance[itemsProperty] = [];
                                moduleInstance[itemsProperty].push(processed);
                            }
                        }
                    } catch (err) {
                        console.error("File read error:", err);
                    }
                }

                inputFiles.value = '';
                Swal.close();
                this.updateContainerDisplay(moduleInstance, itemsProperty, containerId, badgeId, themeColor, singleMode);
            });
        }

        // 2. Camera Trigger (Native Phone Camera or Web Live Capture)
        const btnCamera = document.getElementById(cameraBtnId);
        const inputCamera = document.getElementById(cameraInputId);
        if (btnCamera && inputCamera) {
            btnCamera.addEventListener('click', () => {
                // If mobile/tablet touch device, click the native camera file input
                if (window.innerWidth < 1024 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
                    inputCamera.click();
                } else {
                    // On desktop, open Live Camera Snapshot Modal
                    this.openLiveCameraModal((capturedDataUrl) => {
                        const photoObj = {
                            type: 'image',
                            name: `ภาพถ่าย_${new Date().toISOString().slice(11, 19).replace(/:/g, '')}.jpg`,
                            size: this.formatFileSize(Math.round((capturedDataUrl.length * 3) / 4)),
                            data: capturedDataUrl,
                            uploadedAt: new Date().toISOString()
                        };
                        if (singleMode) {
                            moduleInstance[itemsProperty] = [photoObj];
                        } else {
                            if (!Array.isArray(moduleInstance[itemsProperty])) moduleInstance[itemsProperty] = [];
                            moduleInstance[itemsProperty].push(photoObj);
                        }
                        this.updateContainerDisplay(moduleInstance, itemsProperty, containerId, badgeId, themeColor, singleMode);
                    });
                }
            });

            inputCamera.addEventListener('change', async (e) => {
                const files = Array.from(e.target.files || []);
                if (files.length === 0) return;

                Swal.fire({ title: 'กำลังประมวลผลรูปถ่าย...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                for (const file of files) {
                    try {
                        const processed = await this.processFile(file);
                        if (processed) {
                            if (singleMode) {
                                moduleInstance[itemsProperty] = [processed];
                            } else {
                                if (!Array.isArray(moduleInstance[itemsProperty])) moduleInstance[itemsProperty] = [];
                                moduleInstance[itemsProperty].push(processed);
                            }
                        }
                    } catch (err) {
                        console.error("Camera process error:", err);
                    }
                }
                inputCamera.value = '';
                Swal.close();
                this.updateContainerDisplay(moduleInstance, itemsProperty, containerId, badgeId, themeColor, singleMode);
            });
        }

        // 3. Add URL Input
        const btnAddUrl = document.getElementById(addUrlBtnId);
        const inputUrl = document.getElementById(urlInputId);
        if (btnAddUrl && inputUrl) {
            const handleAddUrl = () => {
                const urlVal = inputUrl.value.trim();
                if (!urlVal) return;

                const processed = this.processUrl(urlVal);
                if (processed) {
                    if (singleMode) {
                        moduleInstance[itemsProperty] = [processed];
                    } else {
                        if (!Array.isArray(moduleInstance[itemsProperty])) moduleInstance[itemsProperty] = [];
                        moduleInstance[itemsProperty].push(processed);
                    }
                    inputUrl.value = '';
                    this.updateContainerDisplay(moduleInstance, itemsProperty, containerId, badgeId, themeColor, singleMode);
                }
            };

            btnAddUrl.addEventListener('click', handleAddUrl);
            inputUrl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddUrl();
                }
            });
        }

        // 4. Clear All Button
        if (clearBtnId) {
            const btnClear = document.getElementById(clearBtnId);
            if (btnClear) {
                btnClear.addEventListener('click', () => {
                    moduleInstance[itemsProperty] = [];
                    this.updateContainerDisplay(moduleInstance, itemsProperty, containerId, badgeId, themeColor, singleMode);
                });
            }
        }

        // Registry for triggerRemove & viewItem
        window._activeAttachmentWidgets = window._activeAttachmentWidgets || {};
        window._activeAttachmentWidgets[containerId] = {
            moduleInstance,
            itemsProperty,
            containerId,
            badgeId,
            themeColor,
            singleMode
        };
    }

    updateContainerDisplay(moduleInstance, itemsProperty, containerId, badgeId, themeColor, singleMode) {
        const items = moduleInstance[itemsProperty] || [];
        this.renderWidget({
            containerId,
            items,
            badgeId,
            singleMode,
            themeColor
        });

        // Toggle clear button visibility if present
        const widgetConfig = window._activeAttachmentWidgets && window._activeAttachmentWidgets[containerId];
        if (widgetConfig && widgetConfig.clearBtnId) {
            const btnClear = document.getElementById(widgetConfig.clearBtnId);
            if (btnClear) btnClear.style.display = items.length > 0 ? 'inline-block' : 'none';
        }
    }

    triggerRemove(containerId, index) {
        const config = window._activeAttachmentWidgets && window._activeAttachmentWidgets[containerId];
        if (!config) return;

        const { moduleInstance, itemsProperty, badgeId, themeColor, singleMode } = config;
        if (Array.isArray(moduleInstance[itemsProperty])) {
            moduleInstance[itemsProperty].splice(index, 1);
            this.updateContainerDisplay(moduleInstance, itemsProperty, containerId, badgeId, themeColor, singleMode);
        }
    }

    viewItem(index, containerId) {
        const config = window._activeAttachmentWidgets && window._activeAttachmentWidgets[containerId];
        if (!config) return;

        const items = config.moduleInstance[config.itemsProperty] || [];
        const item = items[index];
        if (!item) return;

        this.openMediaViewer(item);
    }

    /**
     * Modal แสดงผลภาพขยาย / ดูไฟล์ PDF เต็มหน้าจอ
     */
    openMediaViewer(item) {
        const data = typeof item === 'object' ? item.data : item;
        const name = (typeof item === 'object' && item.name) ? item.name : 'เอกสาร/รูปภาพ';
        const isPdf = (typeof item === 'object' && item.type === 'pdf') || (typeof data === 'string' && (data.startsWith('data:application/pdf') || data.toLowerCase().includes('.pdf')));

        if (isPdf) {
            Swal.fire({
                title: `<div class="text-base font-bold text-white flex items-center justify-center gap-2"><i class="fa-solid fa-file-pdf text-red-400"></i> ${name}</div>`,
                html: `
                    <div class="w-full h-[70vh] bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
                        <iframe src="${data}" class="w-full h-full border-0 rounded-xl"></iframe>
                    </div>
                `,
                width: '90vw',
                showCancelButton: true,
                cancelButtonText: 'ปิด',
                confirmButtonText: '<i class="fa-solid fa-arrow-up-right-from-square mr-1"></i> เปิดในแท็บใหม่',
                confirmButtonColor: '#ef4444',
                preConfirm: () => {
                    window.open(data, '_blank');
                }
            });
            return;
        }

        // Image Viewer
        Swal.fire({
            title: `<div class="text-sm font-bold text-white flex items-center justify-center gap-2"><i class="fa-solid fa-image text-cyan-400"></i> ${name}</div>`,
            imageUrl: data,
            imageAlt: name,
            imageWidth: 'auto',
            imageHeight: 'auto',
            customClass: {
                image: 'max-h-[75vh] object-contain rounded-xl border border-slate-700 shadow-2xl'
            },
            showCloseButton: true,
            showConfirmButton: true,
            confirmButtonText: 'ปิดภาพขยาย',
            confirmButtonColor: '#3b82f6'
        });
    }

    /**
     * Live Web Camera Modal for Instant Snapshot
     */
    openLiveCameraModal(onCaptureCallback) {
        this.cameraTargetCallback = onCaptureCallback;

        Swal.fire({
            title: '<div class="text-base font-bold text-white flex items-center justify-center gap-2"><i class="fa-solid fa-camera text-amber-400"></i> ถ่ายรูปภาพสดจากกล้อง (Live Camera)</div>',
            html: `
                <div class="space-y-3 p-1">
                    <div class="relative w-full max-w-[500px] h-[340px] bg-slate-950 rounded-xl overflow-hidden border border-slate-700 mx-auto flex items-center justify-center">
                        <video id="live-camera-video" autoplay playsinline class="w-full h-full object-cover"></video>
                        <canvas id="live-camera-canvas" style="display: none;"></canvas>
                        <div id="camera-loading-spinner" class="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 text-cyan-400 text-xs">
                            <i class="fa-solid fa-circle-notch fa-spin text-2xl mb-2"></i>
                            <span>กำลังเปิดกล้อง...</span>
                        </div>
                    </div>
                    <div class="flex items-center justify-center gap-2 pt-1">
                        <button type="button" id="btn-camera-capture-shutter" class="btn btn-primary px-5 py-2 text-sm font-bold bg-amber-500 hover:bg-amber-600 border-amber-600 text-slate-950 shadow-lg flex items-center gap-2">
                            <i class="fa-solid fa-camera text-base"></i> ถ่ายภาพนี้ (Capture)
                        </button>
                    </div>
                </div>
            `,
            width: '560px',
            showCancelButton: true,
            cancelButtonText: 'ยกเลิก',
            showConfirmButton: false,
            didOpen: async () => {
                const video = document.getElementById('live-camera-video');
                const spinner = document.getElementById('camera-loading-spinner');
                const btnShutter = document.getElementById('btn-camera-capture-shutter');

                try {
                    const stream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
                    });
                    this.activeCameraStream = stream;
                    if (video) {
                        video.srcObject = stream;
                        video.onloadedmetadata = () => {
                            if (spinner) spinner.style.display = 'none';
                        };
                    }
                } catch (err) {
                    console.warn("Camera access failed:", err);
                    if (spinner) {
                        spinner.innerHTML = `
                            <i class="fa-solid fa-triangle-exclamation text-2xl text-rose-400 mb-2"></i>
                            <span class="text-rose-300">ไม่สามารถเข้าถึงกล้องได้ (${err.message})</span>
                            <span class="text-[11px] text-slate-400 mt-1">กรุณาอนุญาตสิทธิ์กล้อง หรือใช้ปุ่มเลือกไฟล์จากเครื่องแทน</span>
                        `;
                    }
                }

                if (btnShutter) {
                    btnShutter.addEventListener('click', () => {
                        const canvas = document.getElementById('live-camera-canvas');
                        if (video && canvas) {
                            canvas.width = video.videoWidth || 640;
                            canvas.height = video.videoHeight || 480;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

                            this.stopCameraStream();
                            Swal.close();

                            if (this.cameraTargetCallback) {
                                this.cameraTargetCallback(dataUrl);
                                Swal.fire({
                                    icon: 'success',
                                    title: 'บันทึกรูปถ่ายสำเร็จ!',
                                    timer: 1000,
                                    showConfirmButton: false,
                                    toast: true,
                                    position: 'top-end'
                                });
                            }
                        }
                    });
                }
            },
            willClose: () => {
                this.stopCameraStream();
            }
        });
    }

    stopCameraStream() {
        if (this.activeCameraStream) {
            this.activeCameraStream.getTracks().forEach(t => t.stop());
            this.activeCameraStream = null;
        }
    }

    formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        if (typeof bytes === 'string') return bytes;
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
}

window.AttachmentManager = new AttachmentManager();
