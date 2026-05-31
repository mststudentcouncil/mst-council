// auth.js
import { auth } from "./firebase-config.js";
import { signInWithEmailAndPassword, signInAnonymously, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

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
// 2. จัดการเมื่อกดปุ่มเข้าสู่ระบบ
// ==========================================
const loginBtn = document.getElementById("loginBtn");
if (loginBtn) {
    loginBtn.addEventListener("click", () => {
        showFullScreenLoading("กำลังพาไปยังระบบ MST Passport...");
        const currentUrl = window.location.href.split('#')[0];
        window.location.href = `https://ssomst-passport.pages.dev?redirect=${encodeURIComponent(currentUrl)}`;
    });
}

// ==========================================
// 3. จัดการเมื่อระบบ Passport ส่งข้อมูลกลับมา (SSO Callback)
// ==========================================
const hash = window.location.hash;
if (hash && hash.startsWith("#auth=")) {
    showFullScreenLoading("กำลังตรวจสอบสิทธิ์ความปลอดภัย...");

    const payloadBase64 = hash.replace("#auth=", "");
    try {
        // ถอดรหัสลับ
        const encryptedPayload = decodeURIComponent(payloadBase64);
        const bytes = CryptoJS.AES.decrypt(encryptedPayload, "MST_SECRET_KEY_2026");
        const decodedStr = bytes.toString(CryptoJS.enc.Utf8);
        
        if (!decodedStr) throw new Error("การถอดรหัสล้มเหลว (กุญแจลับไม่ตรงกัน หรือ ข้อมูลถูกปลอมแปลง)");

        const payload = JSON.parse(decodedStr);

        // เคลียร์ URL hash ทิ้งอย่างเนียนๆ เพื่อไม่ให้รีโหลดแล้วประมวลผลซ้ำ
        history.replaceState(null, null, ' ');

        // เช็คเวลาหมดอายุ 60 วินาที
        if (Date.now() - payload.timestamp > 60000) {
            showFullScreenError('เซสชันหมดอายุ', 'หมดเวลาการเชื่อมต่อ (Session Expired) กรุณากลับไปหน้าแรกและล็อกอินใหม่ผ่าน Passport อีกครั้ง');
            throw new Error("Session Expired"); 
        }
        
        // กรณีเป็น นักเรียน / บุคลากร
        if (payload.id) {
            
        // 🛑 สกัดกั้นศิษย์เก่า และสถานะอื่นๆ ที่ไม่ปกติ
        if (String(payload.status).startsWith("ศิษย์เก่า") || payload.status === "suspended" || payload.status === "pending" || payload.status === "new") {
            showFullScreenError('ไม่มีสิทธิ์ใช้งานระบบ', 'บัญชีของคุณไม่ได้รับสิทธิ์เข้าถึง หรือยังไม่ได้ยืนยันอีเมลให้เสร็จสมบูรณ์');
        }
        // ✅ ถ้านักเรียน/ครูปัจจุบัน (ไม่ใช่ศิษย์เก่า) ให้เข้าสู่ระบบตามปกติ
        else {
                signInAnonymously(auth)
                    .then(() => {
                        sessionStorage.setItem("mst_voter_profile", JSON.stringify(payload));
                        window.location.href = "student.html";
                    })
                    .catch((error) => {
                        showFullScreenError('เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อระบบรักษาความปลอดภัยของเซิร์ฟเวอร์ได้ในขณะนี้');
                    });
            }
        }
    } catch (err) {
        console.error("SSO Parsing Error:", err);
        if (err.message !== "Session Expired") {
            history.replaceState(null, null, ' ');
            showFullScreenError('พบข้อผิดพลาด', 'ข้อมูลการเชื่อมต่อไม่สมบูรณ์ หรือถูกปลอมแปลง กรุณาล็อกอินใหม่อีกครั้ง');
        }
    }
}

// ==========================================
// 4. ตรวจสอบสถานะล็อกอินค้างไว้
// ==========================================
onAuthStateChanged(auth, (user) => {
    if (!window.location.hash.startsWith("#auth=")) {
        if (user && (window.location.pathname.endsWith("index.html") || window.location.pathname === "/")) {
            if (user.email === "studentcouncil@mst.ac.th") {
                window.location.href = "admin.html";
            } else if (sessionStorage.getItem("mst_voter_profile")) {
                window.location.href = "student.html";
            }
        }
    }
});

// ==========================================
// 5. ระบบเข้าสู่ระบบสำหรับ Admin (Google Auth)
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
        showFullScreenError("เกิดข้อผิดพลาด", error.message);
    });
};