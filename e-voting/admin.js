import { auth, db, storage } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
// 🌟 เพิ่ม getCountFromServer เข้ามาเพื่อใช้นับจำนวนคนโหวตได้เร็วขึ้น
import { collection, addDoc, getDocs, onSnapshot, serverTimestamp, query, orderBy, updateDoc, doc, getDoc, deleteDoc, setDoc, writeBatch, limit, getCountFromServer } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

window.liveResultListeners = {};
window.globalStudents = []; 

// ==========================================
// 1. ฟังก์ชันอัปโหลดรูปไปยัง Firebase Storage
// ==========================================
async function uploadToFirebaseStorage(file) {
    try {
        const fileExtension = file.name.split('.').pop();
        const fileName = `candidates/${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExtension}`;
        const imageRef = storageRef(storage, fileName);
        await uploadBytes(imageRef, file);
        const downloadURL = await getDownloadURL(imageRef);
        return downloadURL;
    } catch (error) {
        console.error("Firebase Storage Upload Error:", error);
        return null;
    }
}

// ==========================================
// 2. ฟังก์ชันจัดการเมื่อเลือกรูปตัวเลือก
// ==========================================
window.handleImageUpload = async function(inputElem) {
    const file = inputElem.files[0];
    if (!file) return;

    const wrapper = inputElem.closest('.image-upload-wrapper');
    const statusDiv = wrapper.querySelector('.upload-status');
    const previewDiv = wrapper.querySelector('.image-preview');
    const hiddenInput = wrapper.querySelector('.opt-img');
    const uploadBtn = wrapper.querySelector('.upload-btn');
    const removeBtn = wrapper.querySelector('.remove-img-btn');

    statusDiv.innerHTML = `
        <span class="flex items-center justify-center gap-1.5 text-blue-500 font-bold">
            <svg class="animate-spin h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            กำลังอัปโหลด...
        </span>`;
    uploadBtn.disabled = true;

    const imageUrl = await uploadToFirebaseStorage(file);
    
    if (imageUrl) {
        hiddenInput.value = imageUrl; 
        previewDiv.style.backgroundImage = `url('${imageUrl}')`;
        previewDiv.classList.remove('hidden'); 
        removeBtn.classList.remove('hidden');
        
        statusDiv.innerHTML = `
            <span class="flex items-center justify-center gap-1.5 text-green-500 font-bold">
                <svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
                อัปโหลดสำเร็จ
            </span>`;
    } else {
        statusDiv.innerHTML = `
            <span class="flex items-center justify-center gap-1.5 text-red-500 font-bold">
                <svg class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                อัปโหลดไม่สำเร็จ (เช็คสิทธิ์ Storage)
            </span>`;
    }
    
    uploadBtn.disabled = false;
};

window.removeImage = function(btnElem) {
    const wrapper = btnElem.closest('.image-upload-wrapper');
    const previewDiv = wrapper.querySelector('.image-preview');
    const hiddenInput = wrapper.querySelector('.opt-img');
    const statusDiv = wrapper.querySelector('.upload-status');
    const fileInput = wrapper.querySelector('.opt-img-file');
    
    hiddenInput.value = ''; 
    fileInput.value = ''; 
    previewDiv.style.backgroundImage = ''; 
    previewDiv.classList.add('hidden'); 
    btnElem.classList.add('hidden'); 
    
    statusDiv.innerHTML = `
        <span class="flex items-center justify-center gap-1.5 text-gray-400">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4l16 16M4 20L20 4"></path></svg>
            นำรูปออกแล้ว
        </span>`;
};

// ==========================================
// 3. จัดการ UI ฟอร์มตัวเลือกการลงคะแนน
// ==========================================
const getOptionTemplate = (name = "", imgUrl = "", index = 1) => {
    const hasImage = imgUrl ? true : false;
    const showPreview = hasImage ? "" : "hidden";
    const bgStyle = hasImage ? `background-image: url('${imgUrl}');` : "";
    const isLocked = index <= 2;
    const removeBtnHtml = isLocked ? '' : `
        <button type="button" onclick="this.closest('.option-group').remove(); updateOptionNumbers();" class="text-red-400 bg-red-50 p-1.5 rounded-lg hover:bg-red-100 hover:text-red-600 transition-colors shrink-0">
            <svg class="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
    `;
    
    return `
        <div class="flex items-center justify-between mb-2">
            <div class="bg-purple-600 text-white px-2.5 py-1 rounded-lg flex items-center justify-center font-bold text-[10px] shadow-sm opt-num-badge">
                หมายเลข ${index}
            </div>
            ${removeBtnHtml}
        </div>
        <input type="text" class="opt-name w-full border-b-2 border-gray-100 pb-1 mb-3 focus:outline-none focus:border-purple-600 text-sm font-bold mt-1 px-1" value="${name}" placeholder="เว้นว่างไว้เพื่อใช้ชื่ออัตโนมัติ (เช่น MST 01)">
        <div class="image-upload-wrapper mt-2 bg-gray-50 p-3 rounded-lg border border-gray-200 border-dashed">
            <input type="file" accept="image/*" class="opt-img-file hidden" onchange="handleImageUpload(this)">
            <div class="flex gap-2 relative z-10">
                <button type="button" onclick="this.parentElement.previousElementSibling.click()" class="upload-btn flex-1 bg-white border border-gray-200 hover:border-purple-400 hover:text-purple-600 text-gray-700 text-xs px-3 py-2 rounded-md transition-colors flex items-center justify-center gap-1.5 shadow-sm font-semibold">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg> 
                    เลือกรูปภาพ
                </button>
                <button type="button" onclick="removeImage(this)" title="ลบรูป" class="remove-img-btn bg-red-50 hover:bg-red-100 text-red-500 px-3 py-2 rounded-md transition-colors ${showPreview} flex items-center justify-center">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </div>
            <div class="upload-status text-xs mt-2 text-gray-500 text-center flex items-center justify-center gap-1.5">
                ${hasImage ? '<span class="text-blue-500 font-bold">ใช้รูปเดิม</span>' : '<span>รองรับ JPG, PNG</span>'}
            </div>
            <div class="image-preview w-full h-32 mt-3 ${showPreview} rounded-md border border-gray-200 bg-center bg-no-repeat bg-contain bg-white shadow-inner" style="${bgStyle}"></div>
            <input type="hidden" class="opt-img" value="${imgUrl}">
        </div>
    `;
};

window.updateOptionNumbers = function() {
    document.querySelectorAll('.option-group').forEach((group, idx) => {
        const badge = group.querySelector('.opt-num-badge');
        if (badge) badge.innerText = "หมายเลข " + (idx + 1);
    });
};

function showAuthError(title, desc) {
    const loadingDiv = document.getElementById("auth-loading");
    const contentDiv = document.getElementById("auth-content");
    
    if (loadingDiv) loadingDiv.style.display = 'none';
    
    const errorHtml = `
        <div class="flex flex-col items-center justify-center w-full fade-in mt-2">
            <div class="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-5 border-4 border-red-100 mx-auto shadow-sm">
                <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"></path></svg>
            </div>
            <h2 class="text-2xl font-black text-gray-800 mb-2 text-center tracking-tight">${title}</h2>
            <p class="text-gray-500 mb-8 text-sm text-center leading-relaxed">${desc}</p>
            <button id="authBackBtn" class="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-4 px-6 rounded-2xl transition-all flex items-center justify-center gap-2 border border-gray-200 shadow-sm active:scale-95">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg> กลับไปหน้าแรก
            </button>
        </div>
    `;
    
    if (!document.getElementById("error-wrapper-ui")) {
        const errorWrapper = document.createElement("div");
        errorWrapper.id = "error-wrapper-ui";
        errorWrapper.className = "w-full";
        errorWrapper.innerHTML = errorHtml;
        contentDiv.appendChild(errorWrapper);

        document.getElementById("authBackBtn").addEventListener("click", () => {
            signOut(auth).then(() => window.location.href = "index.html");
        });
    }
}

// ==========================================
// 4. ตรวจสอบสิทธิ์ผู้ดูแลระบบ
// ==========================================
onAuthStateChanged(auth, (user) => {
    const blocker = document.getElementById("auth-blocker");

    if (!user) { 
        window.location.href = "index.html"; 
    } 
    else if (user.email !== "studentcouncil@mst.ac.th") {
        showAuthError("ปฏิเสธการเข้าถึง", "บัญชีนี้ไม่มีสิทธิ์เข้าถึงหน้าระบบจัดการแอดมิน");
    } else { 
        if(blocker) {
            blocker.classList.add("opacity-0");
            setTimeout(() => blocker.classList.add("hidden"), 300);
        }
        if(document.getElementById("adminEmail")) document.getElementById("adminEmail").innerText = `${user.email}`; 
        
        checkStudentCount(); 
        loadCampaigns();
    }
});

const handleLogout = () => {
    Swal.fire({ 
        title: 'ออกจากระบบ?', 
        icon: 'question', 
        showCancelButton: true, 
        confirmButtonColor: '#d33',
        confirmButtonText: 'ยืนยัน', 
        cancelButtonText: 'ยกเลิก' 
    }).then((r) => { 
        if (r.isConfirmed) signOut(auth).then(() => window.location.href = "index.html"); 
    });
};

document.getElementById("logoutBtn")?.addEventListener("click", handleLogout);
document.getElementById("mobileLogoutBtn")?.addEventListener("click", handleLogout);

// ==========================================
// 5. จัดการรายการโหวต (Campaign)
// ==========================================
window.showCreateForm = function() {
    document.getElementById('campaignListView').classList.add('hidden');
    document.getElementById('campaignFormView').classList.remove('hidden');
    document.getElementById("createCampaignForm").reset();
    document.getElementById("editingId").value = "";
    document.getElementById("customLevelContainer").classList.add("hidden"); 
    document.getElementById("customRoomContainer").classList.add("hidden");
    document.getElementById("formTitle").innerHTML = `<div class="p-2 bg-purple-100 text-purple-600 rounded-xl"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg></div> สร้างรายการใหม่`; 
    document.getElementById("submitCampaignBtn").innerHTML = "บันทึกและเปิดระบบ";
    
    document.getElementById("optionsContainer").innerHTML = `
        <div class="option-group bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative group mt-3">
            ${getOptionTemplate('', '', 1)}
        </div>
        <div class="option-group bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative group mt-3">
            ${getOptionTemplate('', '', 2)}
        </div>
    `;
};

window.hideCreateForm = function() {
    document.getElementById('campaignFormView').classList.add('hidden');
    document.getElementById('campaignListView').classList.remove('hidden');
};

document.getElementById("voterTargetType")?.addEventListener("change", (e) => {
    document.getElementById("customLevelContainer").classList.add("hidden");
    document.getElementById("customRoomContainer").classList.add("hidden");
    if(e.target.value === "custom_level") document.getElementById("customLevelContainer").classList.remove("hidden");
    if(e.target.value === "custom_room") document.getElementById("customRoomContainer").classList.remove("hidden");
});

const optionsContainer = document.getElementById("optionsContainer");
document.getElementById("addOptionBtn")?.addEventListener("click", () => {
    const currentCount = document.querySelectorAll(".option-group").length;
    const div = document.createElement("div");
    div.className = "option-group bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative group mt-3 fade-in";
    div.innerHTML = getOptionTemplate('', '', currentCount + 1);
    optionsContainer.appendChild(div);
    
    setTimeout(() => {
        optionsContainer.scrollTop = optionsContainer.scrollHeight;
        div.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
});

optionsContainer?.addEventListener("click", (e) => {
    if (e.target.closest('.remove-btn')) {
        e.target.closest('.option-group').remove();
        updateOptionNumbers();
    }
});

document.getElementById("bulkAddBtn")?.addEventListener("click", () => {
    Swal.fire({
        title: 'นำเข้าข้อมูลจาก Google Sheets',
        html: `<textarea id="bulkPasteArea" class="w-full h-40 p-2 border border-gray-300 rounded-lg text-xs" placeholder="นาย ก [Tab] https://..."></textarea>`,
        showCancelButton: true, confirmButtonText: 'นำเข้าข้อมูล',
        preConfirm: () => document.getElementById("bulkPasteArea").value
    }).then((result) => {
        if (result.isConfirmed && result.value) {
            let addedCount = 0;
            result.value.split('\n').forEach(line => {
                const cols = line.split('\t'); const name = cols[0]?.trim(); const img = cols[1]?.trim() || "";
                if (name) {
                    const currentCount = document.querySelectorAll(".option-group").length;
                    const div = document.createElement("div"); 
                    div.className = "option-group bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative group mt-3";
                    div.innerHTML = getOptionTemplate(name, img, currentCount + 1);
                    optionsContainer.appendChild(div); 
                    addedCount++;
                }
            });
            if (addedCount > 0) {
                optionsContainer.querySelectorAll(".option-group").forEach(g => { if(g.querySelector(".opt-name").value.trim() === "") g.remove(); });
                updateOptionNumbers();
                Swal.fire('สำเร็จ', `นำเข้า ${addedCount} รายการ`, 'success');
            }
        }
    });
});

document.getElementById("createCampaignForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const editingId = document.getElementById("editingId").value;
    const payload = { 
        title: document.getElementById("title").value, 
        description: document.getElementById("desc").value, 
        startTime: document.getElementById("startTime").value || null,
        endTime: document.getElementById("endTime").value || null, 
        allowed_voters: { type: document.getElementById("voterTargetType").value, values: [] } 
    };

    if (payload.allowed_voters.type === "custom_level") {
        payload.allowed_voters.values = Array.from(document.querySelectorAll("input[name='targetLevel']:checked")).map(cb => cb.value);
        if(!payload.allowed_voters.values.length) return Swal.fire('แจ้งเตือน', 'เลือกระดับชั้นอย่างน้อย 1 ระดับ', 'warning');
    } else if (payload.allowed_voters.type === "custom_room") {
        payload.allowed_voters.values = document.getElementById("customRoomInput").value.split(",").map(r => r.trim()).filter(r => r);
        if(!payload.allowed_voters.values.length) return Swal.fire('แจ้งเตือน', 'ระบุห้องเรียนอย่างน้อย 1 ห้อง', 'warning');
    }

    let optionsData = []; let initialVotes = {};
    document.querySelectorAll(".option-group").forEach((group, index) => {
        let name = group.querySelector(".opt-name").value.trim();
        if (!name) {
            name = "MST " + String(index + 1).padStart(2, '0');
        }
        optionsData.push({ name: name, image: group.querySelector(".opt-img").value.trim() }); 
        initialVotes[name] = 0; 
    });

    if (optionsData.length < 2) return Swal.fire('ผิดพลาด', 'ต้องมีอย่างน้อย 2 ตัวเลือก', 'error');
    payload.options = optionsData;

    Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        if (editingId) {
            const campRef = doc(db, "campaigns", editingId);
            // 🌟 แม้ว่าเราจะไม่ใช้ votes_count ในการนับแล้ว แต่ยังเก็บไว้เพื่อป้องกันระบบ Error ตอนอัปเดตแคมเปญเก่า
            const oldVotes = (await getDoc(campRef)).data().votes_count || {};
            optionsData.forEach(opt => { if (oldVotes[opt.name] !== undefined) initialVotes[opt.name] = oldVotes[opt.name]; });
            payload.votes_count = initialVotes;
            await updateDoc(campRef, payload);
        } else {
            payload.votes_count = initialVotes; payload.status = "open"; payload.createdAt = serverTimestamp();
            await addDoc(collection(db, "campaigns"), payload);
        }
        Swal.fire('สำเร็จ', 'บันทึกข้อมูลเรียบร้อยแล้ว', 'success');
        hideCreateForm(); loadCampaigns();
    } catch (error) { 
        console.error("Firebase Error:", error);
        Swal.fire('ผิดพลาดจาก Firebase', error.message, 'error'); 
    }
});

window.editCampaign = async function(campaignId) {
    Swal.fire({ title: 'กำลังดึงข้อมูล...', didOpen: () => Swal.showLoading() });
    try {
        const data = (await getDoc(doc(db, "campaigns", campaignId))).data();
        showCreateForm();
        document.getElementById("editingId").value = campaignId;
        document.getElementById("title").value = data.title;
        document.getElementById("desc").value = data.description || "";
        document.getElementById("startTime").value = data.startTime || "";
        document.getElementById("endTime").value = data.endTime || "";
        
        if(data.allowed_voters) {
            document.getElementById("voterTargetType").value = data.allowed_voters.type;
            document.getElementById("voterTargetType").dispatchEvent(new Event('change'));
            if(data.allowed_voters.type === 'custom_level') { document.querySelectorAll("input[name='targetLevel']").forEach(cb => cb.checked = data.allowed_voters.values.includes(cb.value)); } 
            else if(data.allowed_voters.type === 'custom_room') { document.getElementById("customRoomInput").value = data.allowed_voters.values.join(", "); }
        }

        optionsContainer.innerHTML = "";
        data.options.forEach((opt, idx) => {
            const div = document.createElement("div"); 
            div.className = "option-group bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative group mt-3";
            div.innerHTML = getOptionTemplate(opt.name, opt.image, idx + 1); 
            optionsContainer.appendChild(div);
        });

        document.getElementById("formTitle").innerHTML = `<div class="p-2 bg-yellow-100 text-yellow-600 rounded-xl"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg></div> แก้ไขรายการ`; 
        Swal.close();
    } catch (error) { Swal.fire('ผิดพลาด', 'ดึงข้อมูลไม่ได้', 'error'); }
}

window.loadCampaigns = async function() {
    const list = document.getElementById("campaignList");
    if(!list) return;
    list.innerHTML = '<div class="flex justify-center p-20"><div class="animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-purple-600"></div></div>';
    
    try {
        const q = query(collection(db, "campaigns"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        let allData = []; let active = 0;
        
        snapshot.forEach(docSnap => {
            let data = docSnap.data(); allData.push({id: docSnap.id, ...data});
            if(data.status === "open") active++;
        });

        if(document.getElementById("statActiveCampaigns")) document.getElementById("statActiveCampaigns").innerHTML = active;
        if(document.getElementById("statTotalCampaigns")) document.getElementById("statTotalCampaigns").innerHTML = allData.length;

        updateDashboardLiveStats(allData);

        const render = (dataList) => {
            list.innerHTML = dataList.length ? "" : '<div class="text-center p-10 text-gray-500">ไม่พบรายการ</div>';
            dataList.forEach(data => {
                let badge = `<span class="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded font-bold">ทุกคน</span>`;
                if(data.allowed_voters && data.allowed_voters.type !== 'all') badge = `<span class="bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded font-bold">เฉพาะกลุ่ม</span>`;
                
                let statusDot = data.status === "open" ? '<span class="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block mr-1"></span>เปิดโหวต' : '<span class="w-2 h-2 rounded-full bg-gray-400 inline-block mr-1"></span>ปิดโหวต';
                
                const formatTime = (timeStr) => {
                    if(!timeStr) return "ไม่ระบุ";
                    return new Date(timeStr).toLocaleString('th-TH', { 
                        day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' 
                    }) + " น.";
                };
                const timeInfo = `
                    <div class="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-gray-500 bg-gray-50 p-2 rounded-lg border border-gray-100 w-fit">
                        <div class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> <b>เริ่ม:</b> ${formatTime(data.startTime)}</div>
                        <div class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-rose-400"></span> <b>สิ้นสุด:</b> ${formatTime(data.endTime)}</div>
                    </div>
                `;

                let avatars = '<div class="flex -space-x-3 mt-3">';
                data.options.forEach((o, i) => { 
                    if(i < 5) {
                        if (o.image) {
                            avatars += `
                            <div class="relative w-10 h-10 rounded-full border-2 border-white shadow-sm z-10 flex items-center justify-center bg-purple-50 text-purple-700 font-black text-sm overflow-hidden" title="${o.name}">
                                <span>${i+1}</span>
                                <img src="${o.image}" class="absolute inset-0 w-full h-full object-cover" onerror="this.style.display='none'">
                            </div>`;
                        } else {
                            avatars += `<div class="relative w-10 h-10 rounded-full border-2 border-white shadow-sm z-10 flex items-center justify-center bg-purple-100 text-purple-700 font-black text-sm" title="${o.name}">${i+1}</div>`;
                        }
                    } 
                });
                if(data.options.length > 5) avatars += `<div class="relative w-10 h-10 rounded-full border-2 border-white bg-gray-100 text-gray-500 flex items-center justify-center text-xs font-bold shadow-sm z-20">+${data.options.length-5}</div>`;
                avatars += '</div>';

                list.innerHTML += `
                    <div class="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:border-purple-300 transition-colors flex flex-col md:flex-row justify-between gap-4">
                        <div class="flex-1">
                            <div class="flex items-center gap-2 mb-1">${badge} <span class="text-xs font-bold text-gray-500">${statusDot}</span></div>
                            <h3 class="font-extrabold text-lg text-gray-900">${data.title}</h3>
                            <p class="text-sm text-gray-500 truncate max-w-md">${data.description || 'ไม่มีคำอธิบาย'}</p>
                            ${timeInfo}
                            ${avatars}
                        </div>
                        <div class="flex md:flex-col gap-2 shrink-0 md:w-32 justify-center mt-0 md:mt-0">
                            <button onclick="viewResults('${data.id}')" class="w-full text-xs font-bold bg-purple-100 text-purple-700 py-2 rounded-lg hover:bg-purple-200">ผลคะแนน</button>
                            <button onclick="editCampaign('${data.id}')" class="w-full text-xs font-bold bg-yellow-50 text-yellow-700 py-2 rounded-lg hover:bg-yellow-100 border border-yellow-200">แก้ไข</button>
                            <button onclick="toggleStatus('${data.id}', '${data.status}')" class="w-full text-xs font-bold bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 border">${data.status==="open"?"ปิดระบบ":"เปิดระบบ"}</button>
                            <button onclick="deleteCampaign('${data.id}')" class="w-full text-xs font-bold text-red-500 py-2 rounded-lg hover:bg-red-50">ลบ</button>
                        </div>
                    </div>
                    <div id="results_${data.id}" class="hidden mt-2 bg-gray-50 p-6 rounded-2xl border border-gray-200 shadow-inner"></div>
                `;
            });
        };

        render(allData);

        const search = document.getElementById("adminSearchInput");
        if(search) search.addEventListener("input", (e) => render(allData.filter(c => c.title.toLowerCase().includes(e.target.value.toLowerCase()))));
    } catch (e) { }
}

function isStudentEligible(campaignRules, studentInfo) {
    if (!campaignRules) return true; 
    const { type, values } = campaignRules;
    const stuLevel = (studentInfo.level || "").replace(/[mM]\./, 'ม.'); 
    const stuRoom = studentInfo.room || ""; 
    if (type === "all") return true;
    if (type === "junior") return ["ม.1", "ม.2", "ม.3"].includes(stuLevel);
    if (type === "senior") return ["ม.4", "ม.5", "ม.6"].includes(stuLevel);
    if (type === "custom_level") return values.includes(stuLevel);
    if (type === "custom_room") return values.some(val => val.replace(/\s/g, '') === stuRoom.replace(/\s/g, ''));
    return false;
}

// 🌟 [อัปเดตใหม่]: นับยอดคนโหวตจาก Subcollection "votes" แบบ Real-time
async function updateDashboardLiveStats(campaigns) {
    const statsContainer = document.getElementById("liveVotingStats");
    if(!statsContainer) return;

    let activeCamps = campaigns.filter(c => c.status === "open");
    if(activeCamps.length === 0) {
        statsContainer.innerHTML = '<div class="text-center p-4 text-gray-400 font-medium">ไม่มีรายการเปิดลงคะแนน</div>';
        return;
    }

    statsContainer.innerHTML = '';
    for(const camp of activeCamps) {
        let totalVoters = 0;
        let eligibleCount = 0;
        
        if(window.globalStudents && window.globalStudents.length > 0) {
            eligibleCount = window.globalStudents.filter(s => isStudentEligible(camp.allowed_voters, s)).length;
        }

        try {
            // ดึงจำนวนคนโหวตจากกล่องบัตรคะแนน
            const votesSnap = await getDocs(collection(db, "campaigns", camp.id, "votes"));
            totalVoters = votesSnap.size;
        } catch (error) {
            console.error("Error fetching live stats:", error);
        }

        let percent = eligibleCount > 0 ? Math.round((totalVoters / eligibleCount) * 100) : 0;
        
        statsContainer.innerHTML += `
            <div class="mb-4 last:mb-0 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div class="flex justify-between items-center mb-2">
                    <span class="font-bold text-gray-800 text-sm truncate pr-2">${camp.title}</span>
                    <span class="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">${totalVoters} / ${eligibleCount} คน</span>
                </div>
                <div class="w-full bg-gray-100 rounded-full h-2.5">
                    <div class="bg-gradient-to-r from-blue-500 to-indigo-500 h-2.5 rounded-full" style="width: ${percent}%"></div>
                </div>
            </div>
        `;
    }
}

window.toggleStatus = async function(id, status) {
    try { await updateDoc(doc(db, "campaigns", id), { status: status === "open" ? "closed" : "open" }); loadCampaigns(); } catch (e) {}
}
window.deleteCampaign = async function(id) {
    Swal.fire({ title: 'ยืนยันการลบ', text: "หากลบแล้ว ข้อมูลคะแนนจะหายไปตลอดกาล", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'ลบทิ้งเลย' })
    .then(async (result) => {
        if (result.isConfirmed) {
            await deleteDoc(doc(db, "campaigns", id)); loadCampaigns(); 
        }
    });
}

// ==========================================
// 6. จัดการฐานข้อมูลรายชื่อนักเรียน (Excel)
// ==========================================

function removeThaiPrefix(name) {
    if (!name) return "";
    return name.replace(/^(ด\.ช\.|ด\.ญ\.|นาย|นางสาว|นาง|เด็กชาย|เด็กหญิง)\s*/, '').trim();
}

function formatStudentData(row, sheetName) {
    if (!row || row.length < 4 || isNaN(parseInt(row[1]))) return null;

    const studentId = String(row[1]).trim();
    if (studentId.length !== 5 || !/^\d+$/.test(studentId)) return null;

    const firstName = row[3] ? String(row[3]).trim() : "";
    const lastName = row[4] ? String(row[4]).trim() : "";
    let fullName = `${firstName} ${lastName}`.trim();
    
    if (!fullName) {
         fullName = row[2] ? String(row[2]).trim() : "";
    }
    if (!fullName) return null;

    let rawRoom = "-";
    for (let j = row.length - 1; j >= 0; j--) {
        const cellValue = String(row[j] || "").trim();
        if (cellValue.includes('/') || cellValue.includes('ม') || cellValue.toLowerCase().includes('m') || /^\d+$/.test(cellValue)) {
            rawRoom = cellValue;
            break;
        }
    }

    let level = "-";
    let room = "-";

    if (rawRoom.includes('/')) {
        const parts = rawRoom.split('/');
        level = parts[0].trim();
        room = parts[1].trim();
        
        if (!level.includes('ม') && !level.toLowerCase().includes('m')) {
            level = "ม." + level.replace(/[^0-9]/g, '');
        } else {
            level = level.replace(/[mMม]\.?\.?\s*/g, 'ม.');
        }
    } else {
        const match = sheetName.match(/[mMม]\.?\s*(\d)/i);
        level = match ? "ม." + match[1] : sheetName.replace(/[mMม]\.?\.?\s*/g, 'ม.').trim();
        if (rawRoom !== "-" && /^\d+$/.test(rawRoom)) room = rawRoom;
    }

    return {
        id: studentId,
        name: removeThaiPrefix(fullName),
        level: level,
        room: room
    };
}

async function checkStudentCount() {
    try { 
        const snapshot = await getDocs(collection(db, "students"));
        window.globalStudents = []; 
        let levels = new Set();
        let roomNums = new Set(); 

        snapshot.forEach(docSnap => { 
            let d = docSnap.data(); 
            let studentLevel = d.level || "-";
            let studentRoom = d.room || "-";
            
            if (studentLevel !== "-" && studentLevel !== "ครู/บุคลากร") {
                if (studentRoom !== "-" && !studentRoom.includes("/")) {
                    studentRoom = `${studentLevel}/${studentRoom}`;
                }
            }
            
            window.globalStudents.push({ 
                id: docSnap.id, 
                name: d.name || "ไม่ระบุชื่อ", 
                level: studentLevel,
                room: studentRoom 
            }); 
            
            if (studentLevel !== "-") levels.add(studentLevel);
            if (studentRoom !== "-") {
                let rNum = studentRoom.includes('/') ? studentRoom.split('/')[1] : studentRoom;
                roomNums.add(rNum);
            }
        });

        if(document.getElementById("statTotalStudents")) document.getElementById("statTotalStudents").innerHTML = window.globalStudents.length;
        if(document.getElementById("lastUpdatedText")) {
            document.getElementById("lastUpdatedText").innerHTML = `ข้อมูลนักเรียนในระบบ:<br><b class="text-indigo-600 text-lg">${window.globalStudents.length}</b> คน`;
        }

        const levelSelect = document.getElementById('studentLevelFilter');
        const roomSelect = document.getElementById('studentRoomFilter');

        if (levelSelect) {
            levelSelect.innerHTML = '<option value="all">ทุกระดับชั้น</option>';
            Array.from(levels).sort().forEach(l => {
                levelSelect.innerHTML += `<option value="${l}">${l}</option>`;
            });
        }

        if (roomSelect) {
            roomSelect.innerHTML = '<option value="all">ทุกห้องเรียน</option>';
            Array.from(roomNums).sort((a,b) => parseInt(a) - parseInt(b)).forEach(r => {
                if(r && !isNaN(parseInt(r))) {
                    roomSelect.innerHTML += `<option value="${r}">ห้อง ${r}</option>`;
                }
            });
        }
        
        loadCampaigns(); 
        checkSystemHealth();
        renderStudentTable(); 
    } catch (e) { 
        console.error("เชื่อมต่อฐานข้อมูลไม่สำเร็จ:", e);
        if(document.getElementById("lastUpdatedText")) document.getElementById("lastUpdatedText").innerText = "โหลดข้อมูลผิดพลาด"; 
    }
}

window.renderStudentTable = function(data = window.globalStudents) {
    const tbody = document.getElementById('studentTableBody');
    if (!tbody) return;
    
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-gray-500">ไม่พบข้อมูลที่ค้นหา</td></tr>';
        return;
    }

    let html = '';
    data.slice(0, 100).forEach(student => {
        const roomDisplay = student.room.includes('/') ? student.room.split('/')[1] : student.room;
        html += `
            <tr class="hover:bg-gray-50 border-b border-gray-50">
                <td class="p-4 font-mono text-gray-600">${student.id}</td>
                <td class="p-4 font-medium text-gray-900">${student.name}</td>
                <td class="p-4 text-center">${student.level}</td>
                <td class="p-4 text-center">${roomDisplay}</td>
                <td class="p-4 text-center">
                    <button onclick="deleteSingleStudent('${student.id}')" class="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

window.filterStudentsTable = function() {
    const searchKw = (document.getElementById("studentSearchInput")?.value || "").toLowerCase();
    const levelKw = document.getElementById("studentLevelFilter")?.value || "all";
    const roomKw = document.getElementById("studentRoomFilter")?.value || "all";

    const filteredData = window.globalStudents.filter(s => {
        const matchSearch = s.id.toLowerCase().includes(searchKw) || s.name.toLowerCase().includes(searchKw);
        const matchLevel = levelKw === "all" || s.level === levelKw;
        const sRoomNum = s.room.includes('/') ? s.room.split('/')[1] : s.room;
        const matchRoom = roomKw === "all" || sRoomNum === roomKw;

        return matchSearch && matchLevel && matchRoom;
    });

    renderStudentTable(filteredData);
};

document.getElementById("studentSearchInput")?.addEventListener("input", filterStudentsTable);
document.getElementById("studentLevelFilter")?.addEventListener("change", filterStudentsTable);
document.getElementById("studentRoomFilter")?.addEventListener("change", filterStudentsTable);

document.getElementById('importStudentsBtn')?.addEventListener('click', () => {
    const fileInput = document.getElementById('excelFileInput');
    if (!fileInput.files.length) {
        Swal.fire('แจ้งเตือน', 'กรุณาเลือกไฟล์ Excel หรือ CSV ก่อน', 'warning');
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, {type: 'array'});
        let studentsToUpload = [];

        workbook.SheetNames.forEach((sheetName, index) => {
            const sheetState = workbook.Workbook && workbook.Workbook.Sheets && workbook.Workbook.Sheets[index] ? workbook.Workbook.Sheets[index].Hidden : 0;
            if (sheetState !== 0 && sheetState !== undefined) return; 

            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(worksheet, {header: 1});

            for (let i = 0; i < json.length; i++) {
                const student = formatStudentData(json[i], sheetName);
                if (student) studentsToUpload.push(student);
            }
        });

        if (studentsToUpload.length === 0) {
            Swal.fire('ข้อผิดพลาด', 'ไฟล์ไม่มีข้อมูลที่ใช้งานได้ หรือรูปแบบไม่ถูกต้อง', 'error');
            return;
        }

        Swal.fire({
            title: 'ยืนยันการนำเข้า',
            text: `พบข้อมูลนักเรียน ${studentsToUpload.length} รายการ ต้องการนำเข้าสู่ระบบหรือไม่?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'นำเข้าข้อมูล',
            cancelButtonText: 'ยกเลิก'
        }).then(async (result) => {
            if (result.isConfirmed) {
                Swal.fire({ title: 'กำลังนำเข้าข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                try {
                    let batch = writeBatch(db);
                    let count = 0;
                    for (const student of studentsToUpload) {
                        const studentRef = doc(db, "students", student.id);
                        batch.set(studentRef, {
                            name: student.name,
                            level: student.level,
                            room: student.room,
                            updatedAt: serverTimestamp()
                        });
                        count++;
                        if (count % 400 === 0) {
                            await batch.commit();
                            batch = writeBatch(db);
                        }
                    }
                    if (count % 400 !== 0) {
                        await batch.commit();
                    }

                    Swal.fire('สำเร็จ', `นำเข้าข้อมูลนักเรียน ${count} รายการเรียบร้อยแล้ว`, 'success');
                    checkStudentCount();
                    fileInput.value = '';
                    
                    const fileNameDisplay = document.getElementById('fileNameDisplay');
                    if(fileNameDisplay) fileNameDisplay.classList.add('hidden');
                    const importBtn = document.getElementById('importStudentsBtn');
                    if(importBtn) {
                        importBtn.classList.add('bg-gray-100', 'text-gray-400', 'pointer-events-none');
                        importBtn.classList.remove('bg-green-600', 'text-white', 'hover:bg-green-700', 'shadow-md');
                    }
                } catch (err) {
                    Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถนำเข้าข้อมูลได้: ' + err.message, 'error');
                }
            }
        });
    };
    reader.readAsArrayBuffer(file);
});

document.getElementById('excelFileInput')?.addEventListener('change', function(e) {
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    const importBtn = document.getElementById('importStudentsBtn');
    
    if (this.files && this.files.length > 0 && fileNameDisplay && importBtn) {
        fileNameDisplay.innerHTML = `<span class="flex items-center justify-center gap-1.5"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> เลือกไฟล์: ${this.files[0].name}</span>`;
        fileNameDisplay.classList.remove('hidden');
        importBtn.classList.remove('bg-gray-100', 'text-gray-400', 'pointer-events-none');
        importBtn.classList.add('bg-green-600', 'text-white', 'hover:bg-green-700', 'shadow-md');
    } else if (fileNameDisplay && importBtn) {
        fileNameDisplay.classList.add('hidden');
        importBtn.classList.add('bg-gray-100', 'text-gray-400', 'pointer-events-none');
        importBtn.classList.remove('bg-green-600', 'text-white', 'hover:bg-green-700', 'shadow-md');
    }
});

document.getElementById('deleteStudentsBtn')?.addEventListener('click', () => {
    Swal.fire({
        title: 'ยืนยันการล้างข้อมูล?',
        text: "ข้อมูลนักเรียนทั้งหมดจะถูกลบ! (ไม่ส่งผลกระทบต่อคะแนนที่โหวตไปแล้ว)",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'ล้างข้อมูลทั้งหมด',
        cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({ title: 'กำลังลบข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            try {
                const snapshot = await getDocs(collection(db, "students"));
                let batch = writeBatch(db);
                let count = 0;
                
                snapshot.forEach((document) => {
                    batch.delete(document.ref);
                    count++;
                    if (count % 400 === 0) {
                        batch.commit();
                        batch = writeBatch(db);
                    }
                });
                
                if(count % 400 !== 0) await batch.commit();
                
                Swal.fire('สำเร็จ', 'ล้างข้อมูลนักเรียนเรียบร้อยแล้ว', 'success');
                checkStudentCount();
            } catch (err) {
                Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
            }
        }
    });
});

document.getElementById('addSingleStudentForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('singleStuId').value.trim();
    const name = removeThaiPrefix(document.getElementById('singleStuName').value);
    const level = document.getElementById('singleStuLevel').value;
    const room = document.getElementById('singleStuRoom').value;

    Swal.fire({ title: 'กำลังเพิ่มข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        await setDoc(doc(db, "students", id), {
            name: name,
            level: level,
            room: room,
            updatedAt: serverTimestamp()
        });
        Swal.fire('สำเร็จ', 'เพิ่มข้อมูลนักเรียนเรียบร้อยแล้ว', 'success');
        document.getElementById('addSingleStudentForm').reset();
        checkStudentCount();
    } catch (err) {
        Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
    }
});

window.deleteSingleStudent = function(id) {
    Swal.fire({
        title: 'ยืนยันการลบ?',
        text: `ต้องการลบนักเรียนรหัส ${id} ใช่หรือไม่?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'ลบ',
        cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
        if (result.isConfirmed) {
            await deleteDoc(doc(db, "students", id));
            checkStudentCount();
        }
    });
}

// ==========================================
// 7. จัดการข้อมูลสรุปผล (Results) & เซิร์ฟเวอร์
// ==========================================

// 🌟 [อัปเดตใหม่]: นับคะแนนรวมจากบัตรโหวตในคอลเล็กชัน votes แทนการพึ่งพา votes_count
window.viewResults = async function(campaignId) {
    const resultDiv = document.getElementById(`results_${campaignId}`);
    if (!resultDiv.classList.contains('hidden')) { resultDiv.classList.add('hidden'); return; }
    resultDiv.classList.remove('hidden');
    resultDiv.innerHTML = '<div class="text-center py-6 text-purple-700 font-bold animate-pulse">กำลังประมวลผลคะแนนและสถิติรายห้อง...</div>';

    const loadData = async () => {
        try {
            const docSnap = await getDoc(doc(db, "campaigns", campaignId));
            if (!docSnap.exists()) { resultDiv.innerHTML = '<div class="text-center text-red-500">ไม่พบข้อมูล</div>'; return; }

            const data = docSnap.data(); 
            const title = data.title;
            
            // อ่านบัตรโหวตทั้งหมดในกล่อง
            const votesSnap = await getDocs(collection(db, "campaigns", campaignId, "votes"));

            // เริ่มต้นเซ็ตคะแนนผู้สมัครทุกคนเป็น 0
            let actualVotes = {};
            data.options.forEach(opt => actualVotes[opt.name] = 0);
            actualVotes["ไม่ประสงค์ลงคะแนน"] = 0;

            let eligibleByRoom = {};
            let levelOfRoomMapping = {};
            
            if(window.globalStudents) {
                window.globalStudents.forEach(s => {
                    if(isStudentEligible(data.allowed_voters, s)) { 
                        let r = s.room || "ไม่ระบุ"; 
                        eligibleByRoom[r] = (eligibleByRoom[r] || 0) + 1; 
                        levelOfRoomMapping[r] = s.level || "อื่นๆ";
                    }
                });
            }

            let votedByRoom = {};
            
            // นำบัตรโหวตแต่ละใบมาแยกนับคะแนนและนับจำนวนคนมาโหวต
            votesSnap.forEach(v => { 
                let vData = v.data();
                let r = vData.room || "ไม่ระบุ"; 
                votedByRoom[r] = (votedByRoom[r] || 0) + 1; 
                if(vData.level) levelOfRoomMapping[r] = vData.level;
                
                let voteValue = vData.voteTo;
                if(voteValue) {
                    actualVotes[voteValue] = (actualVotes[voteValue] || 0) + 1;
                }
            });

            // ใช้ actualVotes เป็นคะแนนของระบบ
            const votes = actualVotes;

            let statsByLevel = {};
            let sortedRooms = Object.keys(eligibleByRoom).sort((a,b) => a.localeCompare(b, 'th', {numeric:true}));
            sortedRooms.forEach(r => {
                let level = levelOfRoomMapping[r] || 'อื่นๆ';
                if(!statsByLevel[level]) statsByLevel[level] = [];
                statsByLevel[level].push(r);
            });

            let resultHtml = `
                <div class="flex items-center justify-between mb-6 border-b border-gray-200 pb-4">
                    <h4 class="font-extrabold text-gray-800 text-lg">สรุปผลคะแนน</h4>
                    <div class="flex gap-2">
                        <button onclick="exportExcel('${campaignId}')" class="text-xs font-bold bg-green-100 hover:bg-green-200 text-green-700 px-4 py-2 rounded-lg hidden sm:block">ออกไฟล์ Excel</button>
                        <button onclick="exportPDF('${campaignId}')" class="text-xs font-bold bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-lg hidden sm:block">บันทึก PDF</button>
                    </div>
                </div>
                
                <div id="pdf-content-${campaignId}" class="bg-white p-4 rounded-xl">
                    <h2 class="text-center font-bold text-xl text-purple-900 mb-6 hidden print-title">${title}</h2>
                    <ul class="space-y-5 mb-8">
            `;
            
            let totalVotes = 0; const validVotes = [];
            Object.entries(votes).forEach(([option, count]) => {
                if (option.trim().length > 0 && typeof count === 'number' && !isNaN(count)) { totalVotes += count; validVotes.push([option, count]); }
            });

            validVotes.sort((a, b) => b[1] - a[1]).forEach(([option, count], index) => {
                const percent = totalVotes === 0 ? 0 : Math.round((count / totalVotes) * 100);
                const barColor = index === 0 && count > 0 ? "bg-gradient-to-r from-purple-500 to-indigo-500" : "bg-gray-400"; 
                resultHtml += `
                    <li>
                        <div class="flex justify-between text-sm mb-2"><span class="font-bold text-gray-800">${option}</span><span class="font-extrabold text-purple-700">${count} คะแนน <span class="text-gray-400 font-normal ml-1">(${percent}%)</span></span></div>
                        <div class="w-full bg-gray-100 rounded-full h-3 overflow-hidden"><div class="${barColor} h-3 rounded-full transition-all duration-1000 ease-out" style="width: ${percent}%"></div></div>
                    </li>
                `;
            });
            resultHtml += `</ul><div class="bg-blue-50 p-4 rounded-xl text-center font-bold text-blue-900">จำนวนผู้ใช้สิทธิ์ทั้งหมด: ${totalVotes} คน</div>`;

            let levels = Object.keys(statsByLevel).sort();
            if (levels.length > 0) {
                levels.forEach((level) => {
                    resultHtml += `
                        <div class="mt-8 pt-6 page-break-section">
                            <h4 class="font-bold text-gray-800 mb-4 bg-gray-50 p-2 rounded-lg text-center">สถิติการใช้สิทธิ์ ${level}</h4>
<div class="rounded-xl border border-gray-200 overflow-hidden">
    <table class="w-full text-sm text-left border-collapse">
        <thead class="bg-gray-100"><tr class="text-gray-600"><th class="p-3 border-b">ห้องเรียน</th><th class="p-3 border-b text-center">มีสิทธิ์ (คน)</th><th class="p-3 border-b text-center">มาโหวต</th><th class="p-3 border-b text-center">%</th></tr></thead>
        <tbody>
                    `;
                    statsByLevel[level].forEach(r => {
                        let eligible = eligibleByRoom[r]; let voted = votedByRoom[r] || 0;
                        let pct = eligible > 0 ? Math.round((voted/eligible)*100) : 0;
                        let pctColor = pct === 100 ? 'text-green-600' : (pct >= 50 ? 'text-blue-600' : 'text-red-500');
                        let cleanRoomForDisplay = r.includes('/') ? "ห้อง " + r.split('/')[1] : r;
                        resultHtml += `<tr class="hover:bg-gray-50"><td class="p-3 border-b font-bold text-gray-700">${cleanRoomForDisplay}</td><td class="p-3 border-b text-center">${eligible}</td><td class="p-3 border-b text-center font-black text-gray-900">${voted}</td><td class="p-3 border-b text-center font-bold ${pctColor}">${pct}%</td></tr>`;
                    });

                    let totalLevelEligible = statsByLevel[level].reduce((sum, r) => sum + eligibleByRoom[r], 0);
                    let totalLevelVoted = statsByLevel[level].reduce((sum, r) => sum + (votedByRoom[r] || 0), 0);
                    let totalLevelPct = totalLevelEligible > 0 ? Math.round((totalLevelVoted/totalLevelEligible)*100) : 0;
                    resultHtml += `
                                    <tr class="bg-indigo-50 font-bold"><td class="p-3 text-indigo-900">รวม ${level}</td><td class="p-3 text-center text-indigo-900">${totalLevelEligible}</td><td class="p-3 text-center text-indigo-900">${totalLevelVoted}</td><td class="p-3 text-center text-indigo-700">${totalLevelPct}%</td></tr>
                                </tbody></table>
                            </div>
                        </div>`;
                });
            }

            resultHtml += `</div>
                <div class="mt-6 text-center">
                    <button onclick="document.getElementById('results_${campaignId}').classList.add('hidden')" class="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-2.5 rounded-xl text-sm font-bold transition-colors inline-block">ปิดหน้าต่างผลคะแนน</button>
                </div>
            `; 
            resultDiv.innerHTML = resultHtml;

        } catch (error) { resultDiv.innerHTML = '<div class="text-center py-4 text-red-500 font-bold">เกิดข้อผิดพลาดในการโหลดผลคะแนน</div>'; }
    };
    loadData(); 
}

// 🌟 [อัปเดตใหม่]: ระบบดึงออก Excel โดยนับบัตรโหวตจริง
window.exportExcel = async function(campaignId) {
    try {
        Swal.fire({ title: 'กำลังสร้างไฟล์...', allowOutsideClick: false, didOpen: () => { Swal.showLoading() } });
        const docSnap = await getDoc(doc(db, "campaigns", campaignId));
        if (docSnap.exists()) {
            const data = docSnap.data(); 
            const safeTitle = data.title.replace(/[/\\?%*:|"<>]/g, '-'); 
            const wb = XLSX.utils.book_new();

            const votesSnap = await getDocs(collection(db, "campaigns", campaignId, "votes"));

            let actualVotes = {};
            data.options.forEach(opt => actualVotes[opt.name] = 0);
            actualVotes["ไม่ประสงค์ลงคะแนน"] = 0;

            let eligibleByRoom = {}; let levelOfRoomMapping = {};
            if(window.globalStudents) { 
                window.globalStudents.forEach(s => { 
                    if(isStudentEligible(data.allowed_voters, s)) { 
                        let r = s.room || "ไม่ระบุ"; eligibleByRoom[r] = (eligibleByRoom[r] || 0) + 1; levelOfRoomMapping[r] = s.level || "อื่นๆ";
                    } 
                }); 
            }

            let votedByRoom = {}; 
            votesSnap.forEach(v => { 
                let vData = v.data();
                let r = vData.room || "ไม่ระบุ"; 
                votedByRoom[r] = (votedByRoom[r] || 0) + 1; 
                if(vData.level) levelOfRoomMapping[r] = vData.level;
                
                let voteValue = vData.voteTo;
                if(voteValue) {
                    actualVotes[voteValue] = (actualVotes[voteValue] || 0) + 1;
                }
            });
            
            const votes = actualVotes;

            let totalVotes = 0; const validVotes = [];
            Object.entries(votes).forEach(([option, count]) => {
                if (option.trim().length > 0 && typeof count === 'number' && !isNaN(count)) { totalVotes += count; validVotes.push([option, count]); }
            });

            let summaryData = [ ["หัวข้อการลงคะแนน:", data.title], [""], ["--- สรุปคะแนนผู้สมัคร ---", "", ""], ["ตัวเลือก / ผู้สมัคร", "คะแนนโหวต (คน)", "เปอร์เซ็นต์ (%)"] ];
            validVotes.sort((a, b) => b[1] - a[1]).forEach(([option, count]) => {
                const percent = totalVotes === 0 ? 0 : ((count / totalVotes) * 100).toFixed(2);
                summaryData.push([option, count, percent + "%"]);
            });
            summaryData.push(["", "", ""]); summaryData.push(["รวมผู้ใช้สิทธิ์ทั้งหมด", totalVotes, "100%"]);
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), "สรุปผลโหวต");
            
            let statsByLevel = {};
            let sortedRooms = Object.keys(eligibleByRoom).sort((a,b) => a.localeCompare(b, 'th', {numeric:true}));
            sortedRooms.forEach(r => { let level = levelOfRoomMapping[r] || 'อื่นๆ'; if(!statsByLevel[level]) statsByLevel[level] = []; statsByLevel[level].push(r); });

            let levels = Object.keys(statsByLevel).sort();
            levels.forEach(level => {
                let titleText = level === 'ครู/บุคลากร' ? `สถิติการใช้สิทธิ์ ${level}` : `สถิติการใช้สิทธิ์ ${level}`;
                let col1Text = level === 'ครู/บุคลากร' ? "หน่วยงาน/กลุ่มสาระ" : "ห้องเรียน";
                let levelData = [ [titleText], [col1Text, "จำนวนผู้มีสิทธิ์ (คน)", "มาใช้สิทธิ์ (คน)", "คิดเป็นเปอร์เซ็นต์ (%)"] ];
                
                let totalLevelEligible = 0; let totalLevelVoted = 0;
                statsByLevel[level].forEach(r => {
                    let eligible = eligibleByRoom[r]; let voted = votedByRoom[r] || 0; let pct = eligible > 0 ? ((voted/eligible)*100).toFixed(2) : 0;
                    totalLevelEligible += eligible; totalLevelVoted += voted; 
                    let cleanRoomForDisplay = r.includes('/') ? "ห้อง " + r.split('/')[1] : r;
                    levelData.push([cleanRoomForDisplay, eligible, voted, pct + "%"]);
                });
                let totalPct = totalLevelEligible > 0 ? ((totalLevelVoted/totalLevelEligible)*100).toFixed(2) : 0;
                levelData.push(["", "", "", ""]); levelData.push([`รวม ${level}`, totalLevelEligible, totalLevelVoted, totalPct + "%"]);
                XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(levelData), `สถิติ_${level}`);
            });
            XLSX.writeFile(wb, `ผลโหวต_${safeTitle}.xlsx`); Swal.close();
        }
    } catch (error) { Swal.fire('ผิดพลาด', 'สร้างไฟล์ Excel ไม่สำเร็จ', 'error'); }
}

window.exportPDF = async function(campaignId) {
    try {
        Swal.fire({ title: 'กำลังสร้างไฟล์ PDF...', allowOutsideClick: false, didOpen: () => { Swal.showLoading() } });
        const docSnap = await getDoc(doc(db, "campaigns", campaignId));
        let title = "รายงานผลคะแนน"; if (docSnap.exists()) title = docSnap.data().title.replace(/[/\\?%*:|"<>]/g, '-');
        const element = document.getElementById(`pdf-content-${campaignId}`);
        element.querySelector('.print-title').classList.remove('hidden');
        const opt = { margin: 10, filename: `ผลโหวต_${title}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: ['css', 'legacy'] } };
        html2pdf().set(opt).from(element).save().then(() => { element.querySelector('.print-title').classList.add('hidden'); Swal.close(); });
    } catch (error) { Swal.fire('ผิดพลาด', 'บันทึก PDF ไม่สำเร็จ', 'error'); }
}

window.viewImage = function(e, imageUrl, title) {
    e.preventDefault(); e.stopPropagation();
    Swal.fire({ title: title, imageUrl: imageUrl, imageAlt: title, showCloseButton: true, showConfirmButton: false, customClass: { image: 'rounded-xl object-contain max-h-[70vh]' } });
}

async function checkSystemHealth() {
    const statusEl = document.getElementById("systemHealthStatus");
    const msgEl = document.getElementById("systemHealthMsg");
    const iconEl = document.getElementById("systemHealthIcon");
    
    if (!statusEl || !msgEl) return;

    if (!navigator.onLine) {
        statusEl.innerHTML = `<span class="w-3 h-3 rounded-full bg-red-500"></span><span class="font-bold text-red-600">ออฟไลน์</span>`;
        msgEl.innerText = "คุณไม่ได้เชื่อมต่ออินเทอร์เน็ต";
        msgEl.className = "text-[11px] font-bold text-red-500 mt-2";
        return;
    }

    try {
        const startTime = Date.now();
        const testQuery = query(collection(db, "campaigns"), limit(1));
        await getDocs(testQuery);
        const latency = Date.now() - startTime;

        const totalStudents = window.globalStudents ? window.globalStudents.length : 0;
        let healthColor, healthText, healthMsg, iconClass;

        if (totalStudents > 4000) {
            healthColor = "text-orange-600";
            healthMsg = `ผู้ใช้ ${totalStudents} คน อาจทำให้ทะลุลิมิตอ่าน 50k ครั้ง/วัน หากเข้าพร้อมกัน`;
            iconClass = "bg-orange-50 border-orange-100";
            statusEl.innerHTML = `<span class="w-3 h-3 rounded-full bg-orange-500 animate-pulse"></span><span class="font-bold text-orange-600 text-sm">เสี่ยง (Load)</span>`;
        } else if (latency > 2000) {
            healthColor = "text-yellow-600";
            healthMsg = `ความหน่วง ${latency}ms (อาจเกิดจากเน็ตหรือเครื่องแอดมิน)`;
            iconClass = "bg-yellow-50 border-yellow-100";
            statusEl.innerHTML = `<span class="w-3 h-3 rounded-full bg-yellow-500"></span><span class="font-bold text-yellow-600">ล่าช้า (${latency}ms)</span>`;
        } else {
            healthColor = "text-green-600";
            healthMsg = `ความหน่วง ${latency}ms | รองรับผู้ใช้ปัจจุบันได้สบาย`;
            iconClass = "bg-green-50 border-green-100";
            statusEl.innerHTML = `<span class="w-3 h-3 rounded-full bg-green-500 animate-pulse"></span><span class="font-bold text-green-600">ปกติ (เสถียร)</span>`;
        }

        msgEl.innerText = healthMsg;
        msgEl.className = `text-[11px] font-medium ${healthColor} mt-2`;
        iconEl.className = `p-2 rounded-lg border ${iconClass}`;
        iconEl.innerHTML = `<svg class="w-6 h-6 ${healthColor}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"></path></svg>`;
    } catch (e) {
        statusEl.innerHTML = `<span class="w-3 h-3 rounded-full bg-red-500"></span><span class="font-bold text-red-600">เชื่อมต่อล้มเหลว</span>`;
        msgEl.innerText = "ไม่สามารถเชื่อมต่อฐานข้อมูล Firebase ได้";
        msgEl.className = "text-[11px] font-bold text-red-500 mt-2";
    }
}

setInterval(checkSystemHealth, 300000);