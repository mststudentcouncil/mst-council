// auth.js
import { auth, db } from "./firebase-config.js"; 
import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
// 🌟 เปลี่ยนจาก firebase-database เป็น firebase-firestore
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js"; 

// ==========================================
// 1. ฟังก์ชันจัดการหน้าจอโหลดและหน้าจอ Error แบบเต็มจอ
// ==========================================
const overlay = document.getElementById('auth-overlay');
const overlayContent = document.getElementById('auth-overlay-content');

function showFullScreenLoading(text) {
    if (overlay) {
        overlay.classList.remove('hidden');
        overlay.classList.add('flex');
        overlayContent.innerHTML = `
            <div class="animate-spin rounded-full h-12 w-12 border-4 border-gray-100 border-t-purple-600 mb-6 mx-auto"></div>
            <h2 class="text-xl font-black text-gray-800 tracking-tight">${text}</h2>
        `;
    }
}

function showFullScreenError(title, desc) {
    if (overlay) {
        overlay.classList.remove('hidden');
        overlay.classList.add('flex');
        overlayContent.innerHTML = `
            <div class="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6 border-4 border-red-100 mx-auto shadow-sm">
                <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"></path></svg>
            </div>
            <h2 class="text-2xl font-black text-gray-800 mb-2 text-center tracking-tight">${title}</h2>
            <p class="text-gray-500 mb-8 text-sm text-center leading-relaxed">${desc}</p>
            <button onclick="window.location.href='index.html'" class="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-4 px-6 rounded-2xl transition-all flex items-center justify-center gap-2 border border-gray-200 shadow-sm active:scale-95">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg> 
                กลับไปหน้าแรก
            </button>
        `;
    }
}

// ==========================================
// 2. จัดการเมื่อกดปุ่มเข้าสู่ระบบ (Google Auth @mst.ac.th)
// ==========================================
const loginBtn = document.getElementById("loginBtn");
if (loginBtn) {
    loginBtn.addEventListener("click", async () => {
        showFullScreenLoading("กำลังเข้าสู่ระบบด้วย Google...");
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({
            hd: 'mst.ac.th' 
        });

        try {
            const result = await signInWithPopup(auth, provider);
            const user = result.user;
            const email = user.email;

            // บัญชีแอดมิน ข้ามการตรวจสอบรหัสนักเรียน
            if (email === "studentcouncil@mst.ac.th") {
                window.location.href = "admin.html";
                return;
            }

            // 2.1 ตรวจสอบโดเมน
            if (!email.endsWith("@mst.ac.th")) {
                await auth.signOut();
                showFullScreenError('ไม่มีสิทธิ์ใช้งาน', 'กรุณาใช้อีเมล @mst.ac.th ของโรงเรียนเท่านั้น');
                return;
            }

            // 2.2 แยกรหัสนักเรียนและปีที่จบ (รูปแบบเช่น 6829903)
            const emailPrefix = email.split('@')[0];
            if (!/^\d{7}$/.test(emailPrefix)) {
                await auth.signOut();
                showFullScreenError('รูปแบบอีเมลไม่ถูกต้อง', 'อีเมลนี้ไม่ใช่อีเมลของนักเรียน (ต้องการรูปแบบ 68XXXXX@mst.ac.th)');
                return;
            }

            const gradYear = emailPrefix.substring(0, 2); 
            const studentId = emailPrefix.substring(2);   

            // 2.3 ตรวจสอบรายชื่อจากฐานข้อมูลนักเรียนปัจจุบัน (Firestore)
            showFullScreenLoading("กำลังตรวจสอบสิทธิ์ผู้ลงคะแนน...");
            
            // 🌟 เปลี่ยนคำสั่งเป็นของ Firestore
            const studentRef = doc(db, "students", studentId);
            const snapshot = await getDoc(studentRef);

            if (snapshot.exists()) {
                const studentData = snapshot.data(); // 🌟 ใช้ .data() แทน .val()
                const profile = {
                    id: studentId,
                    email: email,
                    name: studentData.name || user.displayName, 
                    level: studentData.level,
                    room: studentData.room,
                    gradYear: gradYear
                };
                sessionStorage.setItem("mst_voter_profile", JSON.stringify(profile));
                window.location.href = "student.html";
            } else {
                await auth.signOut();
                showFullScreenError('ไม่พบสิทธิ์การลงคะแนน', 'ไม่พบรายชื่อของคุณในฐานข้อมูลนักเรียนปัจจุบัน หรือคุณไม่มีสิทธิ์ในการโหวตรายการนี้');
            }

        } catch (error) {
            console.error(error);
            if (error.code !== 'auth/popup-closed-by-user') {
                await auth.signOut();
                showFullScreenError("เกิดข้อผิดพลาด", error.message);
            } else {
                overlay.classList.add('hidden');
                overlay.classList.remove('flex');
            }
        }
    });
}

// ==========================================
// 3. ตรวจสอบสถานะล็อกอินค้างไว้
// ==========================================
onAuthStateChanged(auth, (user) => {
    if (user && (window.location.pathname.endsWith("index.html") || window.location.pathname === "/")) {
        if (user.email === "studentcouncil@mst.ac.th") {
            window.location.href = "admin.html";
        } else if (sessionStorage.getItem("mst_voter_profile")) {
            window.location.href = "student.html";
        }
    }
});

// ==========================================
// 4. ระบบเข้าสู่ระบบสำหรับ Admin
// ==========================================
window.loginAsAdmin = () => {
    showFullScreenLoading("กำลังตรวจสอบสิทธิ์แอดมิน...");
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).then((result) => {
        if (result.user.email === "studentcouncil@mst.ac.th") {
            window.location.href = "admin.html";
        } else {
            auth.signOut();
            showFullScreenError("ปฏิเสธการเข้าถึง", "กรุณาใช้บัญชีทางการสภานักเรียนเท่านั้น");
        }
    }).catch((error) => {
        if (error.code !== 'auth/popup-closed-by-user') {
            showFullScreenError("เกิดข้อผิดพลาด", error.message);
        } else {
            overlay.classList.add('hidden');
            overlay.classList.remove('flex');
        }
    });
};