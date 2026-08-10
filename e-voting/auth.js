import { auth, db } from "./firebase-config.js"; 
import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, getDocs, collection, query, where, updateDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
    const ua = navigator.userAgent;
    // 🌟 ดักจับแอพที่ฝังเบราว์เซอร์มาในตัว (FB, IG, Messenger, Twitter, TikTok, LINE ฯลฯ)
    const isInAppBrowser = /FBAN|FBAV|Instagram|Twitter|Threads|TikTok|Snapchat|Line/i.test(ua);

    if (isInAppBrowser) {
        // 1. ทำปุ่มให้จางและปิดการคลิก (Tailwind classes)
        loginBtn.classList.add("opacity-40", "pointer-events-none", "grayscale");
        loginBtn.classList.remove("hover:border-primary", "hover:shadow-xl", "active:scale-95");
        
        // 2. เปลี่ยนข้อความในปุ่มให้ชัดเจนขึ้น
        const spanText = loginBtn.querySelector("span");
        if (spanText) spanText.innerText = "แอพนี้ไม่รองรับ Google";

        // 3. แทรกข้อความแจ้งเตือนสีแดงแบบสะดุดตาไว้ใต้ปุ่ม
        const warningMsg = document.createElement("div");
        warningMsg.className = "text-red-600 text-xs font-bold mt-3 mb-2 leading-relaxed bg-red-50 p-3 rounded-xl border border-red-200 shadow-sm text-left";
        warningMsg.innerHTML = `<span class="flex items-start gap-2">
            <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            <span>แอพพลิเคชันนี้ปิดกั้นการเข้าสู่ระบบ<br>กรุณากดเมนู (...) มุมเครื่อง แล้วเลือก<br><b class="underline">"เปิดในเบราว์เซอร์เริ่มต้น"</b> (Safari / Chrome)</span>
        </span>`;
        
        loginBtn.parentNode.insertBefore(warningMsg, loginBtn.nextSibling);
    }

    loginBtn.addEventListener("click", async () => {
        showFullScreenLoading("กำลังเข้าสู่ระบบด้วย Google...");
        const provider = new GoogleAuthProvider();
        
        provider.setCustomParameters({
            hd: 'mst.ac.th',
            prompt: 'select_account' 
        });

        try {
            const result = await signInWithPopup(auth, provider);
            const user = result.user;
            const email = user.email;

            if (email === "studentcouncil@mst.ac.th") {
                window.location.href = "admin.html";
                return;
            }

            if (!email.endsWith("@mst.ac.th")) {
                await auth.signOut();
                showFullScreenError('ไม่มีสิทธิ์ใช้งาน', 'กรุณาใช้อีเมล @mst.ac.th ของโรงเรียนเท่านั้น');
                return;
            }

            const emailPrefix = email.split('@')[0];
            if (!/^\d{7}$/.test(emailPrefix)) {
                await auth.signOut();
                showFullScreenError('รูปแบบอีเมลไม่ถูกต้อง', 'อีเมลนี้ไม่ใช่อีเมลของนักเรียน (ต้องการรูปแบบ YYNNNNN@mst.ac.th)');
                return;
            }

            const gradYear = emailPrefix.substring(0, 2); 
            const studentId = emailPrefix.substring(2);   

            showFullScreenLoading("กำลังตรวจสอบสิทธิ์ผู้ลงคะแนน...");
            
            const studentRef = doc(db, "students", studentId);
            const snapshot = await getDoc(studentRef);

            if (snapshot.exists()) {
                const studentData = snapshot.data();
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
                showFullScreenError('ไม่พบสิทธิ์การลงคะแนน', 'ไม่พบรายชื่อของคุณในฐานข้อมูลนักเรียนปัจจุบัน หรือคุณไม่มีสิทธิ์ใช้งานระบบลงคะแนน กรุณาติดต่อผู้ดูแลระบบ');
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

// ==========================================
// 5. ระบบเข้าสู่ระบบด้วย LINE (Enterprise Update)
// ==========================================
const lineLoginBtn = document.getElementById("lineLoginBtn");
let currentLineUid = null; 

if (lineLoginBtn) {
    const MY_LIFF_ID = "2008923798-hd6mzZd8"; // ⚠️ ใช้ Liff ID เดิมของคุณ

    // ดักจับ User-Agent ซ่อนปุ่ม LINE ถ้านักเรียนไม่ได้เปิดผ่านแอปพลิเคชัน LINE
    if (!navigator.userAgent.includes("Line")) {
        lineLoginBtn.style.display = "none";
    } else {
        // 🌟 1. สั่งให้ LIFF เตรียมตัว (init) ทำงานรอไว้เบื้องหลังเลยตั้งแต่เปิดหน้าเว็บ
        liff.init({ liffId: MY_LIFF_ID }).catch(err => {
            console.error("LIFF Init Error:", err);
        });
    }

    lineLoginBtn.addEventListener("click", () => {
        showFullScreenLoading("กำลังเชื่อมต่อ LINE...");
        
        // 🌟 2. เมื่อกดปุ่ม ให้เช็คว่า LIFF เตรียมตัวเสร็จหรือยัง (ready) แล้วทำงานต่อทันที
        liff.ready.then(() => {
            if (!liff.isLoggedIn()) {
                // ถ้ายังไม่ล็อกอิน ให้ทำการล็อกอิน
                liff.login();
            } else {
                // ถ้าล็อกอินแล้ว ดึงโปรไฟล์ได้เลยแบบคลิกเดียวจบ!
                liff.getProfile().then(profile => {
                    currentLineUid = profile.userId;
                    checkLineAccount(currentLineUid);
                }).catch(err => {
                    showFullScreenError("เกิดข้อผิดพลาด", "ไม่สามารถดึงข้อมูลจาก LINE ได้");
                });
            }
        });
    });
}

// 🌟 [อัปเดตใหม่]: เช็คผ่านคอลเล็กชัน line_links แบบเจาะจง ไม่ค้นหากวาดรายชื่อทั้งหมด
async function checkLineAccount(lineUid) {
    showFullScreenLoading("กำลังตรวจสอบสิทธิ์...");
    try {
        await signInAnonymously(auth);

        const lineLinkRef = doc(db, "line_links", lineUid);
        const lineLinkSnap = await getDoc(lineLinkRef);

        if (lineLinkSnap.exists()) {
            const studentId = lineLinkSnap.data().studentId;
            const studentRef = doc(db, "students", studentId);
            const studentSnap = await getDoc(studentRef);
            
            if (studentSnap.exists()) {
                const studentData = studentSnap.data();
                const profile = {
                    id: studentSnap.id,
                    name: studentData.name, 
                    level: studentData.level,
                    room: studentData.room,
                    loginMethod: 'line'
                };
                sessionStorage.setItem("mst_voter_profile", JSON.stringify(profile));
                window.location.href = "student.html";
            } else {
                showFullScreenError("ข้อมูลสูญหาย", "พบประวัติการผูกบัญชี แต่ไม่พบรายชื่อในระบบฐานข้อมูล");
            }
        } else {
            overlay.classList.add('hidden'); 
            document.getElementById('line-link-modal').classList.remove('hidden');
        }
    } catch (error) {
        console.error("Firebase Database Error: ", error); 
        showFullScreenError("เกิดข้อผิดพลาด", "ไม่สามารถตรวจสอบฐานข้อมูลได้ (โปรดแจ้งผู้ดูแลระบบ)");
    }
}

// ==========================================
// 6. ระบบยืนยันตัวตนด้วยอีเมล (2FA OTP via Google Apps Script)
// ==========================================
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbxXJOY42Nk-C2pqS26dRW1AsJAHjr4yXqoGeqJg-R2HBQ2a4JcazfP5JwgUEytkef8D/exec"; // ⚠️ อย่าลืมใส่ URL

const requestOtpBtn = document.getElementById("requestOtpBtn");
const verifyOtpBtn = document.getElementById("verifyOtpBtn");
let currentStudentId = null;
let currentStudentData = null;
let otpInterval; // ตัวแปรสำหรับหยุดเวลาถอยหลัง

// 🌟 ฟังก์ชันกดยกเลิก (ซ่อนหน้าต่าง & ล้างเวลา)
window.cancelOtpProcess = function() {
    if(otpInterval) clearInterval(otpInterval);
    document.getElementById('line-link-modal').classList.add('hidden');
    // หน่วงเวลาเล็กน้อยให้หน้าต่างพับลงก่อนรีเซ็ตฟอร์ม
    setTimeout(() => {
        document.getElementById("step2_otp").classList.add("hidden");
        document.getElementById("step1_email").classList.remove("hidden");
        document.getElementById("linkOtpInput").value = "";
        document.getElementById("modalSubtitle").innerText = "กรุณากรอกอีเมลโรงเรียนเพื่อรับรหัส OTP";
    }, 300);
}

// 🌟 ฟังก์ชันนับเวลาถอยหลังและลดหลอดโปรเกรส
function startOtpTimer() {
    if (otpInterval) clearInterval(otpInterval);
    let timeLeft = 300; // 5 นาที (300 วินาที)
    
    const timerText = document.getElementById("otpTimerText");
    const progressBar = document.getElementById("otpProgressBar");
    
    // รีเซ็ตสีเริ่มต้น (สีเขียว)
    timerText.innerText = "05:00";
    timerText.className = "mt-1 font-black text-2xl tracking-wider transition-colors duration-500 text-green-600";
    progressBar.style.width = "100%";
    progressBar.className = "h-full rounded-full transition-all duration-1000 ease-linear bg-gradient-to-r from-green-500 to-emerald-500";

    otpInterval = setInterval(() => {
        timeLeft--;
        
        // คำนวณเวลาที่เหลือ
        const m = Math.floor(timeLeft / 60);
        const s = timeLeft % 60;
        timerText.innerText = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        
        // คำนวณเปอร์เซ็นต์หลอด
        const percent = (timeLeft / 300) * 100;
        progressBar.style.width = `${percent}%`;

        // แจ้งเตือนสีส้ม เมื่อเหลือ 2 นาที
        if (timeLeft === 120) {
            timerText.classList.replace("text-green-600", "text-orange-500");
            progressBar.classList.replace("from-green-500", "from-orange-400");
            progressBar.classList.replace("to-emerald-500", "to-orange-500");
        } 
        // แจ้งเตือนสีแดง เมื่อเหลือ 1 นาทีสุดท้าย
        else if (timeLeft === 60) {
            timerText.classList.replace("text-orange-500", "text-red-600");
            progressBar.classList.replace("from-orange-400", "from-red-500");
            progressBar.classList.replace("to-orange-500", "to-red-600");
        }

        // เมื่อหมดเวลา
        if (timeLeft <= 0) {
            clearInterval(otpInterval);
            document.getElementById('line-link-modal').classList.add('hidden');
            Swal.fire({ 
                icon: 'error', 
                title: 'หมดเวลา', 
                text: 'รหัส OTP หมดอายุแล้ว กรุณาขอรับรหัสใหม่อีกครั้ง', 
                confirmButtonColor: '#d33', 
                customClass: { popup: 'rounded-[2rem]' }
            }).then(() => {
                // พากลับไปขั้นตอนที่ 1
                document.getElementById("step2_otp").classList.add("hidden");
                document.getElementById("step1_email").classList.remove("hidden");
                document.getElementById("linkOtpInput").value = "";
                document.getElementById("modalSubtitle").innerText = "กรุณากรอกอีเมลโรงเรียนเพื่อรับรหัส OTP";
                document.getElementById('line-link-modal').classList.remove('hidden');
            });
        }
    }, 1000);
}

// ----------------------------------------------------
// กดขอ OTP
// ----------------------------------------------------
if (requestOtpBtn) {
    requestOtpBtn.addEventListener("click", async () => {
        let emailInput = document.getElementById("linkEmailInput").value.trim().toLowerCase();
        
        // 🌟 1. ถ้านักเรียนเผลอก๊อปปี้ @mst.ac.th มาวางด้วย ให้ระบบใจดีช่วยตัดทิ้งให้เหลือแต่ตัวเลข
        emailInput = emailInput.replace("@mst.ac.th", "").replace(/\s+/g, "");

        const pdpaConsent = document.getElementById("pdpaConsent").checked;

        if (!pdpaConsent) {
            Swal.fire({ icon: 'warning', title: 'กดยอมรับเงื่อนไข', text: 'คุณต้องยินยอมนโยบาย PDPA ก่อนทำรายการ', confirmButtonColor: '#06C755', customClass: { popup: 'rounded-[2rem]' }});
            return;
        }

        // 🌟 2. เช็คฟอร์แมตให้เหลือแค่ตัวเลข 7 หลัก (ปี 2 หลัก + รหัส 5 หลัก)
        const emailRegex = /^(\d{2})(\d{5})$/;
        const match = emailInput.match(emailRegex);

        if (!match) {
            Swal.fire({ icon: 'error', title: 'รูปแบบไม่ถูกต้อง', text: 'กรุณากรอกเฉพาะตัวเลข 7 หลัก (เช่น 7012345)', confirmButtonColor: '#06C755', customClass: { popup: 'rounded-[2rem]' }});
            return;
        }

        currentStudentId = match[2]; // ดึงรหัสนักเรียน 5 หลักออกมา
        const fullEmailAddress = emailInput + "@mst.ac.th"; // สร้างอีเมลเต็มเพื่อเตรียมส่ง OTP

        showFullScreenLoading("กำลังตรวจสอบฐานข้อมูล...");

        try {
            const studentRef = doc(db, "students", currentStudentId);
            const docSnap = await getDoc(studentRef);

            if (!docSnap.exists()) {
                showFullScreenError("ไม่พบรายชื่อ", `ไม่พบรหัส ${currentStudentId} ในระบบฐานข้อมูลของโรงเรียน`);
                return;
            }

            currentStudentData = docSnap.data();

            if (currentStudentData.lineUid) {
                showFullScreenError("เชื่อมต่อไม่สำเร็จ", `รหัส ${currentStudentId} ถูกผูกกับบัญชี LINE อื่นไปแล้ว`);
                return;
            }

            overlay.classList.add('hidden');
            document.getElementById('line-link-modal').classList.add('hidden');

            Swal.fire({ title: 'กำลังสร้างและส่งรหัส OTP...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

            const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

            // 4. บันทึก OTP ลง Firestore (เก็บไว้ 5 นาที)
            await setDoc(doc(db, "otp_requests", currentStudentId), {
                otp: otpCode,
                createdAt: new Date().getTime(),
                requesterUid: auth.currentUser.uid // ประทับตราว่าใครเป็นคนขอ
            });

            // 🌟 5. ยิงคำสั่งไปหา Google Apps Script API
            const formData = new FormData();
            formData.append("to_email", fullEmailAddress);
            formData.append("student_name", currentStudentData.name);
            formData.append("otp_code", otpCode);

            // ใช้โหมด no-cors ให้ยิงข้ามโดเมนได้ลื่นๆ โดยไม่สนการตอบกลับ
            await fetch(GAS_API_URL, {
                method: "POST",
                body: formData,
                mode: "no-cors" // 🌟 จุดสำคัญที่แก้ปัญหาจอดำ/เด้ง Error
            });

            // (ลบคำสั่ง await response.json() และการเช็ค status ออกไปเลยครับ เพราะ no-cors อ่านค่าไม่ได้)

            Swal.close();
            
            // 6. สลับหน้าจอเป็นช่องกรอก OTP
            document.getElementById('line-link-modal').classList.remove('hidden');
            document.getElementById("step1_email").classList.add("hidden");
            document.getElementById("step2_otp").classList.remove("hidden");
            document.getElementById("modalSubtitle").innerText = "เช็ครหัสที่กล่องข้อความในแอป Gmail ของคุณ";

            // เริ่มจับเวลาและหลอดโปรเกรสทันที
            startOtpTimer();

        } catch (error) {
            console.error("OTP Error:", error);
            showFullScreenError("เกิดข้อผิดพลาด", "ไม่สามารถส่งอีเมลได้ โปรดลองอีกครั้ง");
        }
    });
}

// ----------------------------------------------------
// กดยืนยัน OTP
// ----------------------------------------------------
if (verifyOtpBtn) {
    verifyOtpBtn.addEventListener("click", async () => {
        const inputOtp = document.getElementById("linkOtpInput").value.trim();

        if (inputOtp.length !== 6) {
            Swal.fire({ icon: 'warning', title: 'รหัสไม่ครบ', text: 'กรุณากรอกรหัส OTP 6 หลักให้ครบถ้วน', confirmButtonColor: '#6b21a8', customClass: { popup: 'rounded-[2rem]' }});
            return;
        }

        document.getElementById('line-link-modal').classList.add('hidden');
        showFullScreenLoading("กำลังตรวจสอบรหัส...");

        try {
            const otpDocRef = doc(db, "otp_requests", currentStudentId);
            const otpDoc = await getDoc(otpDocRef);
            
            if (!otpDoc.exists()) {
                showFullScreenError("รหัสหมดอายุ", "ไม่พบรหัสอ้างอิง หรือรหัสถูกใช้ไปแล้ว");
                return;
            }

            const otpData = otpDoc.data();
            const now = new Date().getTime();
            
            if (now - otpData.createdAt > 300000) {
                await deleteDoc(otpDocRef);
                showFullScreenError("รหัสหมดอายุ", "รหัส OTP หมดอายุแล้ว (เกิน 5 นาที) กรุณาทำรายการใหม่");
                return;
            }

            if (inputOtp !== otpData.otp) {
                overlay.classList.add('hidden');
                document.getElementById('line-link-modal').classList.remove('hidden');
                Swal.fire({ icon: 'error', title: 'รหัสไม่ถูกต้อง', text: 'รหัส OTP ไม่ตรงกัน กรุณาตรวจสอบอีเมลอีกครั้ง', confirmButtonColor: '#d33', customClass: { popup: 'rounded-[2rem]' }});
                return;
            }

            showFullScreenLoading("กำลังผูกบัญชีเข้ากับ LINE...");
            
            const studentRef = doc(db, "students", currentStudentId);
            await updateDoc(studentRef, { lineUid: currentLineUid });
            await setDoc(doc(db, "line_links", currentLineUid), { studentId: currentStudentId });
            
            // ลบข้อมูล OTP และหยุดเวลาทันที
            await deleteDoc(otpDocRef);
            clearInterval(otpInterval);
            
            sessionStorage.setItem("mst_voter_profile", JSON.stringify({
                id: currentStudentId, 
                name: currentStudentData.name, 
                level: currentStudentData.level, 
                room: currentStudentData.room, 
                loginMethod: 'line'
            }));
            
            window.location.href = "student.html";

        } catch (error) {
            console.error("Verify Error:", error);
            showFullScreenError("เกิดข้อผิดพลาด", "ไม่สามารถตรวจสอบรหัสได้ โปรดลองอีกครั้ง");
        }
    });
}