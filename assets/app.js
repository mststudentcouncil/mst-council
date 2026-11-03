(() => {
    'use strict';

    // ตั้งค่า Tailwind Theme
    if (window.tailwind) {
        window.tailwind.config = {
            theme: {
                extend: {
                    fontFamily: {
                        sans: ['Anuphan', 'IBM Plex Sans Thai', '-apple-system', 'system-ui', 'sans-serif'],
                        display: ['Anuphan', 'IBM Plex Sans Thai', '-apple-system', 'system-ui', 'sans-serif']
                    },
                    colors: {
                        mstPurple: '#4C1D95',
                        mstPurpleDeep: '#2E1065',
                        mstYellow: '#FBBF24',
                        mstGold: '#D4AF37',
                        mstChampagne: '#FDE68A',
                        mstCream: '#FAF8F5',
                        mstDark: '#090514'
                    },
                    boxShadow: {
                        soft: '0 2px 6px rgba(9, 5, 20, 0.03), 0 12px 32px -6px rgba(76, 29, 149, 0.06)',
                        float: '0 4px 12px rgba(9, 5, 20, 0.05), 0 24px 48px -12px rgba(76, 29, 149, 0.16)',
                        glam: '0 0 35px -5px rgba(251, 191, 36, 0.25)'
                    }
                }
            }
        };
    }

    // ตัวแปร Private (ไม่สามารถเข้าถึงหรือแก้ไขจาก Console ได้)
    const PORTAL_API_URL = "https://admission-backend-592123078141.asia-southeast1.run.app/api/portal";
    const PORTAL_CACHE_KEY = "mstsc_portal_public_cache_v1";
    let newsDataList = [];
    let allBoardMembers = [];

    // ฟังก์ชันป้องกัน XSS (Cross-Site Scripting)
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // ระบบจัดการลิงก์รูปภาพ Google Drive
    function extractDriveFileId(url) {
        if (!url || typeof url !== 'string') return null;
        if (!url.includes('drive.google.com') && !url.includes('docs.google.com')) return null;
        const match = url.match(/(?:\/d\/|id=|open\?id=|uc\?.*id=)([a-zA-Z0-9_-]{25,})/);
        if (match && match[1]) return match[1];
        const fallback = url.match(/([a-zA-Z0-9_-]{28,35})/);
        return fallback ? fallback[1] : null;
    }

    function resolveImageUrl(url, fallback) {
        if (!url) return fallback || '/logo.webp';
        const str = String(url).trim();
        const fileId = extractDriveFileId(str);
        if (fileId) {
            return `https://lh3.googleusercontent.com/d/${fileId}=w1000`;
        }
        return str;
    }

    function fixAllDriveImages(root) {
        const container = root || document;
        if (!container.querySelectorAll) return;
        const imgs = container.querySelectorAll('img');
        imgs.forEach(img => {
            const rawSrc = img.getAttribute('src');
            const fileId = extractDriveFileId(rawSrc);
            if (fileId) {
                img.setAttribute('referrerpolicy', 'no-referrer');
                const directUrl = `https://lh3.googleusercontent.com/d/${fileId}=w1000`;
                if (rawSrc !== directUrl && !rawSrc.includes('drive.google.com/thumbnail')) {
                    img.dataset.driveId = fileId;
                    img.src = directUrl;
                }
            }
        });
    }

    window.addEventListener('error', (e) => {
        const el = e.target;
        if (el && el.tagName === 'IMG') {
            const fileId = el.dataset.driveId || extractDriveFileId(el.src);
            if (fileId && !el.dataset.triedThumbnail) {
                el.dataset.triedThumbnail = 'true';
                el.src = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
            } else if (!el.dataset.triedFallback && el.dataset.fallback) {
                el.dataset.triedFallback = 'true';
                el.src = el.dataset.fallback;
            }
        }
    }, true);

    // ระบบควบคุม Navbar และเมนูมือถือ
    function updateNavbarAppearance() {
        const nav = document.getElementById('navbar');
        const menu = document.getElementById('mobileMenu');
        const brandText = document.getElementById('navBrandText');
        const navLinks = document.getElementById('navLinks');
        const adminBtn = document.getElementById('navAdminBtn');
        const mobileBtn = document.getElementById('mobileMenuBtn');

        if (!nav || !brandText) return;
        const isScrolledOrOpen = window.scrollY > 20 || (menu && !menu.classList.contains('hidden'));

        if (isScrolledOrOpen) {
            nav.classList.add('glass-header', 'shadow-sm', 'bg-white/85');
            nav.classList.remove('bg-transparent');
            brandText.className = 'text-sm font-bold tracking-tight transition-colors text-zinc-900';
            if (navLinks) navLinks.className = 'hidden lg:flex items-center gap-7 text-sm font-medium text-zinc-700 transition-colors';
            if (adminBtn) adminBtn.className = 'inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all bg-mstDark text-white hover:bg-mstPurple shadow-xs';
            if (mobileBtn) mobileBtn.className = 'lg:hidden flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-800 transition-colors';
        } else {
            nav.classList.remove('glass-header', 'shadow-sm', 'bg-white/85');
            nav.classList.add('bg-transparent');
            brandText.className = 'text-sm font-bold tracking-tight transition-colors text-white nav-text-shadow';
            if (navLinks) navLinks.className = 'hidden lg:flex items-center gap-7 text-sm font-medium text-white/90 transition-colors nav-text-shadow';
            if (adminBtn) adminBtn.className = 'inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all bg-white/95 text-zinc-900 ring-1 ring-white/50 backdrop-blur hover:bg-white shadow-sm';
            if (mobileBtn) mobileBtn.className = 'lg:hidden flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/30 text-white backdrop-blur transition-colors';
        }
    }

    function toggleMobileMenu() {
        const menu = document.getElementById('mobileMenu');
        if (!menu) return;
        menu.classList.toggle('hidden');
        updateNavbarAppearance();
    }

    // ระบบเปิด/ปิด Modal ข่าวสาร
    function openNewsModal(index) {
        const data = newsDataList[index];
        if (!data) return;

        const modalImg = document.getElementById('modalImg');
        modalImg.src = resolveImageUrl(data.image, '/logo.webp');
        modalImg.dataset.fallback = '/logo.webp';

        document.getElementById('modalTitle').textContent = data.title || '';
        document.getElementById('modalContent').innerHTML = data.content || '';

        const dObj = new Date(data.date);
        const dateText = !isNaN(dObj)
            ? dObj.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
            : escapeHtml(data.date);
        document.getElementById('modalDate').innerHTML = `<i class="fa-regular fa-clock mr-1"></i> ${dateText}`;

        const catBadge = document.getElementById('modalCat');
        catBadge.textContent = data.category || 'ข่าวสาร';
        catBadge.className = `absolute top-4 left-4 text-white text-[11px] font-semibold px-3.5 py-1 rounded-full shadow-sm ${
            data.category === 'ประกาศ' ? 'bg-red-600' : (data.category === 'กิจกรรม' ? 'bg-emerald-600' : 'bg-mstPurple')
        }`;

        document.getElementById('newsModal').classList.add('active');
        document.body.style.overflowY = 'hidden';
    }

    function closeNewsModal() {
        const modal = document.getElementById('newsModal');
        if (modal) modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    // ระบบแสดงผลทำเนียบคณะกรรมการ
    function renderBoard(targetYear) {
        const container = document.getElementById('boardContainer');
        const titleEl = document.getElementById('boardTitle');
        if (!container) return;
        if (titleEl) titleEl.textContent = 'ทำเนียบคณะกรรมการ';

        let members = allBoardMembers.filter(m => String(m.year) === String(targetYear));

        if (members.length === 0) {
            container.innerHTML = `<div class="rounded-3xl border border-dashed border-zinc-300 p-12 text-center text-sm text-zinc-500">ไม่พบข้อมูลปีการศึกษา ${escapeHtml(targetYear)}</div>`;
            return;
        }

        members = members.map(m => {
            let dept = m.department || "คณะกรรมการทั่วไป";
            let role = m.role || "";
            if (dept.includes("รองประธาน")) {
                let actualDept = role.replace("ฝ่าย", "").trim();
                return { ...m, department: actualDept, role: dept };
            }
            return m;
        });

        const getWeight = (deptName) => {
            if (!deptName) return 99;
            if (deptName.includes("บริหาร") && !deptName.includes("ทั่วไป")) return 1;
            if (deptName.includes("วิชาการ")) return 2;
            if (deptName.includes("งบประมาณ")) return 3;
            if (deptName.includes("กิจการ")) return 4;
            if (deptName.includes("บริหารทั่วไป")) return 5;
            if (deptName.includes("อำนวยการ")) return 6;
            return 99;
        };

        const presidents = members.filter(m => m.role.includes('ประธาน') && !m.role.includes('รอง'));
        const vicePresidents = members.filter(m => m.role.includes('รองประธาน'));

        vicePresidents.sort((a, b) => {
            const weightA = getWeight(a.department);
            const weightB = getWeight(b.department);
            if (weightA !== weightB) return weightA - weightB;
            return a.name.localeCompare(b.name, 'th');
        });

        let presHtml = '';
        let vicePresHtml = '';

        presidents.forEach(m => {
            const defaultImg = `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}&background=2E1065&color=FDE68A&size=150`;
            const imgSrc = escapeHtml(resolveImageUrl(m.image, defaultImg));
            presHtml += `
            <div class="card-soft p-8 sm:p-10 w-full max-w-md text-center group mx-auto mb-12 relative overflow-hidden border-amber-300/60">
                <div class="pointer-events-none absolute -top-12 inset-x-0 mx-auto h-32 w-32 rounded-full bg-amber-300/20 blur-2xl"></div>
                <div class="relative w-32 h-32 sm:w-36 sm:h-36 mx-auto mb-5">
                    <div class="absolute inset-0 bg-gradient-to-tr from-mstPurple/25 to-mstYellow/35 rounded-full blur-xl group-hover:scale-110 transition"></div>
                    <img src="${imgSrc}" data-fallback="${defaultImg}" alt="${escapeHtml(m.name)}" class="relative w-full h-full object-cover rounded-full border-2 border-amber-300/80 shadow-md group-hover:scale-105 transition duration-300">
                </div>
                <span class="inline-flex items-center rounded-full bg-gradient-to-r from-mstDark to-mstPurpleDeep px-4 py-1 text-xs font-semibold text-mstChampagne shadow-xs mb-2.5">${escapeHtml(m.role)}</span>
                <h4 class="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900">${escapeHtml(m.name)}</h4>
            </div>`;
        });

        if (vicePresidents.length > 0) {
            vicePresHtml = `
            <div class="mb-12">
                <div class="flex items-center gap-3 mb-6">
                    <h4 class="text-sm font-semibold tracking-normal text-mstPurple">รองประธานนักเรียน</h4>
                    <div class="h-px flex-1 bg-gradient-to-r from-amber-300/60 to-transparent"></div>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">`;
            vicePresidents.forEach(m => {
                const defaultImg = `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}&background=4C1D95&color=fff&size=150`;
                const imgSrc = escapeHtml(resolveImageUrl(m.image, defaultImg));
                const displayDept = m.department.includes("ฝ่าย") ? m.department : "ฝ่าย" + m.department;
                vicePresHtml += `
                    <div class="card-soft p-5 text-center group">
                        <img src="${imgSrc}" data-fallback="${defaultImg}" alt="${escapeHtml(m.name)}" class="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-full mx-auto mb-3.5 border border-amber-200/80 shadow-xs group-hover:scale-105 transition duration-300">
                        <h4 class="text-sm sm:text-base font-semibold text-zinc-900 leading-snug">${escapeHtml(m.name)}</h4>
                        <p class="text-xs font-medium text-mstPurple mt-1">${escapeHtml(displayDept)}</p>
                    </div>`;
            });
            vicePresHtml += `</div></div>`;
        }

        const topExecutiveHtml = `<div class="flex flex-col justify-center w-full">${presHtml}${vicePresHtml}</div>`;
        let departmentHtml = '';

        const otherMembers = members.filter(m => !m.role.includes('ประธาน'));
        const grouped = otherMembers.reduce((acc, obj) => {
            const key = obj.department || "คณะกรรมการทั่วไป";
            if (!acc[key]) acc[key] = [];
            acc[key].push(obj);
            return acc;
        }, {});

        const sortedDepts = Object.keys(grouped).sort((a, b) => getWeight(a) - getWeight(b));

        for (const dept of sortedDepts) {
            const mems = grouped[dept];
            const isExecutiveDept = dept.includes("บริหาร") && !dept.includes("ทั่วไป");

            mems.sort((a, b) => {
                if (isExecutiveDept) {
                    const getExecWeight = (role) => {
                        if (role.includes("เลขานุการ") && !role.includes("ผู้ช่วย")) return 1;
                        if (role.includes("ผู้ช่วยเลขานุการ")) return 2;
                        return 3;
                    };
                    const wA = getExecWeight(a.role), wB = getExecWeight(b.role);
                    if (wA !== wB) return wA - wB;
                    return a.role.localeCompare(b.role, 'th');
                } else {
                    const getOtherWeight = (role) => role.startsWith("หัวหน้า") ? 1 : 2;
                    const wA = getOtherWeight(a.role), wB = getOtherWeight(b.role);
                    if (wA !== wB) return wA - wB;
                    return a.role.localeCompare(b.role, 'th');
                }
            });

            let deptHtml = `
            <div class="mb-12">
                <div class="flex items-center gap-3 mb-6">
                    <h4 class="text-sm font-semibold tracking-normal text-zinc-600">${escapeHtml(dept)}</h4>
                    <div class="h-px flex-1 bg-zinc-200/80"></div>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">`;
            mems.forEach(m => {
                const defaultImg = `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}&background=4C1D95&color=fff&size=150`;
                const imgSrc = escapeHtml(resolveImageUrl(m.image, defaultImg));
                deptHtml += `
                    <div class="card-soft p-5 text-center group">
                        <img src="${imgSrc}" data-fallback="${defaultImg}" alt="${escapeHtml(m.name)}" class="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-full mx-auto mb-3.5 border border-zinc-200 shadow-xs group-hover:scale-105 transition duration-300">
                        <h4 class="text-sm sm:text-base font-semibold text-zinc-900 leading-snug">${escapeHtml(m.name)}</h4>
                        <p class="text-xs font-medium text-zinc-500 mt-1">${escapeHtml(m.role)}</p>
                    </div>`;
            });
            deptHtml += `</div></div>`;
            departmentHtml += deptHtml;
        }

        container.innerHTML = topExecutiveHtml + departmentHtml;
    }

    function renderAllPortalSections(bundle) {
        if (!bundle) return;

        // 1. ผู้อำนวยการ & ครูที่ปรึกษา
        const personnelEl = document.getElementById('schoolPersonnelContainer');
        if (personnelEl) {
            const set = bundle.settings || { directorName: "-", advisorName: "-" };
            const advisors = String(set.advisorName || "-").split(/,|\n/).map(n => n.trim()).filter(Boolean);
            const advisorsHtml = advisors.map(adv => `<p class="font-semibold text-lg sm:text-xl text-white whitespace-nowrap">${escapeHtml(adv)}</p>`).join('');
            personnelEl.innerHTML = `
                <div class="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl"></div>
                <div class="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-mstPurple/30 blur-3xl"></div>
                <div class="text-center relative z-10">
                    <p class="text-xs text-mstChampagne font-semibold tracking-normal mb-2">ผู้อำนวยการโรงเรียน</p>
                    <p class="font-semibold text-xl sm:text-2xl text-white whitespace-nowrap">${escapeHtml(set.directorName || "-")}</p>
                </div>
                <div class="hidden md:block w-px h-16 bg-gradient-to-b from-transparent via-amber-300/30 to-transparent relative z-10"></div>
                <div class="text-center relative z-10">
                    <p class="text-xs text-mstChampagne font-semibold tracking-normal mb-2">ครูที่ปรึกษาสภานักเรียน</p>
                    <div class="flex flex-col sm:flex-row flex-wrap justify-center items-center gap-x-6 gap-y-1.5">
                        ${advisorsHtml || '<p class="font-semibold text-xl text-white">-</p>'}
                    </div>
                </div>
            `;
        }

        // 2. ทำเนียบสภานักเรียน
        allBoardMembers = bundle.board || [];
        const boardContainer = document.getElementById('boardContainer');
        const selectorContainer = document.getElementById('yearSelectorContainer');
        const selector = document.getElementById('boardYearSelect');
        if (boardContainer && selector) {
            if (allBoardMembers.length === 0) {
                boardContainer.innerHTML = `<div class="rounded-3xl border border-dashed border-zinc-300 p-12 text-center text-sm text-zinc-500">ยังไม่มีข้อมูลทำเนียบคณะกรรมการ</div>`;
            } else {
                const uniqueYears = [...new Set(allBoardMembers.map(m => m.year))].sort((a, b) => b - a);
                selector.innerHTML = uniqueYears.map(y => `<option value="${escapeHtml(y)}">${escapeHtml(y)}</option>`).join('');
                if (selectorContainer) selectorContainer.classList.remove('hidden');
                renderBoard(uniqueYears[0]);
            }
        }

        // 3. โครงการ PDCA
        const projGrid = document.getElementById('projectGrid');
        const projects = bundle.projects || [];
        if (projGrid) {
            if (projects.length === 0) {
                projGrid.innerHTML = `<div class="col-span-full rounded-3xl border border-dashed border-zinc-300 p-12 text-center text-sm text-zinc-500">ยังไม่มีข้อมูลโครงการ</div>`;
            } else {
                projGrid.innerHTML = projects.map(p => {
                    const badgeStyle = p.step === 'Plan'
                        ? 'bg-zinc-100 text-zinc-600 border-zinc-200'
                        : (p.step === 'Do'
                            ? 'bg-sky-50 text-sky-700 border-sky-200'
                            : (p.step === 'Check'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'));
                    const progressVal = Math.min(100, Math.max(0, Number(p.progress) || 0));
                    return `
                    <div class="card-soft p-6 flex flex-col justify-between">
                        <div class="flex justify-between items-start gap-4 mb-6">
                            <h4 class="font-semibold text-zinc-900 text-base leading-snug">${escapeHtml(p.title)}</h4>
                            <span class="${badgeStyle} border text-[11px] font-semibold px-2.5 py-0.5 rounded-full shrink-0">${escapeHtml(p.step)}</span>
                        </div>
                        <div>
                            <div class="w-full bg-zinc-100 rounded-full h-2 overflow-hidden">
                                <div class="bg-gradient-to-r from-mstPurpleDeep via-mstPurple to-amber-500 h-full rounded-full transition-all duration-500" style="width: ${progressVal}%"></div>
                            </div>
                            <div class="flex justify-between items-center text-xs font-medium text-zinc-500 mt-2.5">
                                <span>ความคืบหน้าการดำเนินงาน</span>
                                <span class="text-mstPurple font-bold tabular-nums">${progressVal}%</span>
                            </div>
                        </div>
                    </div>`;
                }).join('');
            }
        }

        // 4. ข่าวสารและประกาศ
        const newsGrid = document.getElementById('publicNewsGrid');
        newsDataList = (bundle.news || []).slice(0, 6);
        if (newsGrid) {
            if (newsDataList.length === 0) {
                newsGrid.innerHTML = `<div class="col-span-full rounded-3xl border border-dashed border-zinc-300 p-12 text-center text-sm text-zinc-500">ยังไม่มีข่าวประชาสัมพันธ์ในขณะนี้</div>`;
            } else {
                newsGrid.innerHTML = newsDataList.map((n, index) => {
                    const dObj = new Date(n.date);
                    const thDate = !isNaN(dObj) ? dObj.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : escapeHtml(n.date);
                    const badgeBg = n.category === 'ประกาศ' ? 'bg-red-600' : (n.category === 'กิจกรรม' ? 'bg-emerald-600' : 'bg-mstPurpleDeep');
                    const previewText = escapeHtml(String(n.content || '').replace(/<[^>]+>/g, ' '));
                    const imgSrc = escapeHtml(resolveImageUrl(n.image, '/logo.webp'));

                    return `
                    <article data-news-index="${index}" class="card-soft overflow-hidden flex flex-col group cursor-pointer">
                        <div class="relative aspect-[16/10] overflow-hidden bg-zinc-100">
                            <img src="${imgSrc}" data-fallback="/logo.webp" alt="" class="w-full h-full object-cover group-hover:scale-105 transition duration-500">
                            <div class="absolute top-3.5 left-3.5 ${badgeBg} text-white text-[10px] font-semibold tracking-normal px-3 py-1 rounded-full shadow-xs">${escapeHtml(n.category)}</div>
                        </div>
                        <div class="p-6 flex flex-col flex-1">
                            <p class="text-xs font-medium text-zinc-400 mb-2"><i class="fa-regular fa-clock mr-1"></i>${thDate}</p>
                            <h4 class="text-lg font-semibold tracking-tight text-zinc-900 mb-2 line-clamp-2 group-hover:text-mstPurple transition-colors">${escapeHtml(n.title)}</h4>
                            <p class="text-sm text-zinc-500 mb-5 line-clamp-2 leading-relaxed">${previewText}</p>
                            <span class="mt-auto inline-flex items-center gap-1.5 text-xs font-semibold text-mstPurple">
                                อ่านรายละเอียด <i class="fa-solid fa-arrow-right text-[10px] transition-transform group-hover:translate-x-1"></i>
                            </span>
                        </div>
                    </article>`;
                }).join('');
            }
        }

        // 5. เครือข่าย MOU
        const mouGrid = document.getElementById('mouGrid');
        const mouList = bundle.mou || [];
        if (mouGrid) {
            if (mouList.length === 0) {
                mouGrid.innerHTML = `<p class="text-zinc-400 text-center text-sm py-4">ยังไม่มีข้อมูลเครือข่ายโรงเรียน</p>`;
            } else {
                const itemsHtml = mouList.map(m => {
                    const logoSrc = escapeHtml(resolveImageUrl(m.logo, '/logo.webp'));
                    const safeName = escapeHtml(m.name);
                    return `
                    <div class="flex-shrink-0 flex flex-col items-center group cursor-pointer bg-white/80 p-4 rounded-2xl border border-zinc-200/70 hover:bg-white hover:border-amber-400/50 transition w-32 sm:w-36 mx-2.5 sm:mx-4 shadow-xs">
                        <img src="${logoSrc}" data-fallback="/logo.webp" alt="${safeName}" title="${safeName}" class="w-14 h-14 sm:w-16 sm:h-16 object-contain transition duration-300 group-hover:scale-105">
                        <p class="text-[11px] font-medium text-zinc-600 mt-2.5 group-hover:text-mstPurple transition max-w-[120px] text-center truncate">${safeName}</p>
                    </div>`;
                }).join('');
                mouGrid.innerHTML = `<div class="marquee-content">${itemsHtml.repeat(4)}</div>`;
            }
        }
    }

    async function initPortalPage() {
        const cachedRaw = localStorage.getItem(PORTAL_CACHE_KEY);
        if (cachedRaw) {
            try {
                renderAllPortalSections(JSON.parse(cachedRaw));
            } catch (_) {}
        }

        try {
            const res = await fetch(`${PORTAL_API_URL}?t=${Date.now()}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'getPortalPublicData' })
            });
            const json = await res.json();
            if (json.status === 'success' && json.data) {
                renderAllPortalSections(json.data);
                localStorage.setItem(PORTAL_CACHE_KEY, JSON.stringify(json.data));
            }
        } catch (err) {
            console.error("Portal Load Error:", err);
        }
    }

    // ผูก Event Listeners ทั้งหมดแทนการใช้ onclick ใน HTML
    document.addEventListener('DOMContentLoaded', () => {
        const yearEl = document.getElementById('currentYear');
        if (yearEl) yearEl.textContent = new Date().getFullYear();

        const brandLogoLink = document.getElementById('brandLogoLink');
        if (brandLogoLink) {
            brandLogoLink.addEventListener('click', (e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }

        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        if (mobileMenuBtn) {
            mobileMenuBtn.addEventListener('click', toggleMobileMenu);
        }

        document.querySelectorAll('.mobile-nav-link').forEach(link => {
            link.addEventListener('click', toggleMobileMenu);
        });

        const boardYearSelect = document.getElementById('boardYearSelect');
        if (boardYearSelect) {
            boardYearSelect.addEventListener('change', (e) => renderBoard(e.target.value));
        }

        const newsGrid = document.getElementById('publicNewsGrid');
        if (newsGrid) {
            newsGrid.addEventListener('click', (e) => {
                const article = e.target.closest('article[data-news-index]');
                if (article) {
                    openNewsModal(Number(article.dataset.newsIndex));
                }
            });
        }

        const newsModal = document.getElementById('newsModal');
        if (newsModal) {
            newsModal.addEventListener('click', (e) => {
                if (e.target === newsModal) closeNewsModal();
            });
        }

        const closeNewsModalBtn = document.getElementById('closeNewsModalBtn');
        if (closeNewsModalBtn) {
            closeNewsModalBtn.addEventListener('click', closeNewsModal);
        }

        fixAllDriveImages(document);
        const observer = new MutationObserver(mutations => {
            mutations.forEach(m => {
                m.addedNodes.forEach(node => {
                    if (node.nodeType === 1) {
                        if (node.tagName === 'IMG') fixAllDriveImages(node.parentElement);
                        else fixAllDriveImages(node);
                    }
                });
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });

        updateNavbarAppearance();
        initPortalPage();
    });

    window.addEventListener('scroll', updateNavbarAppearance, { passive: true });
})();