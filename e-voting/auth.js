import { auth, db } from "./firebase-config.js"; 
import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, getDocs, collection, query, where, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
        
        // เพิ่ม prompt: 'select_account' เพื่อบังคับให้เลือกบัญชีใหม่ทุกครั้ง
        provider.setCustomParameters({
            hd: 'mst.ac.th',
            prompt: 'select_account' 
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
                showFullScreenError('รูปแบบอีเมลไม่ถูกต้อง', 'อีเมลนี้ไม่ใช่อีเมลของนักเรียน (ต้องการรูปแบบ YYNNNNN@mst.ac.th)');
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

// ==========================================
// 5. ระบบเข้าสู่ระบบด้วย LINE (LIFF + Account Linking)
// ==========================================
const lineLoginBtn = document.getElementById("lineLoginBtn");
let currentLineUid = null; // ตัวแปรเก็บ LINE UID ชั่วคราว

if (lineLoginBtn) {
    // ⚠️ สำคัญ: ต้องใส่ LIFF ID ที่ได้จาก LINE Developers Console ตรงนี้
    const MY_LIFF_ID = "2008923798-hd6mzZd8"; 

    lineLoginBtn.addEventListener("click", () => {
        showFullScreenLoading("กำลังเชื่อมต่อ LINE...");
        
        liff.init({ liffId: MY_LIFF_ID }).then(() => {
            if (!liff.isLoggedIn()) {
                // ถ้ายังไม่ล็อกอิน ให้พาไปหน้าล็อกอินของ LINE
                liff.login();
            } else {
                // ถ้าล็อกอินแล้ว ดึงข้อมูลโปรไฟล์
                liff.getProfile().then(profile => {
                    currentLineUid = profile.userId;
                    checkLineAccount(currentLineUid);
                }).catch(err => {
                    showFullScreenError("เกิดข้อผิดพลาด", "ไม่สามารถดึงข้อมูลจาก LINE ได้");
                });
            }
        }).catch((err) => {
            showFullScreenError("เกิดข้อผิดพลาด", "ระบบ LINE LIFF เริ่มต้นไม่สำเร็จ");
        });
    });
}

// ฟังก์ชันตรวจสอบว่า LINE นี้เคยผูกกับรหัสใครไว้หรือยัง
async function checkLineAccount(lineUid) {
    showFullScreenLoading("กำลังตรวจสอบสิทธิ์...");
    try {
        // [จุดที่แก้ไข]: ต้องสั่งให้ Firebase ล็อกอินแบบ Anonymous "ก่อน" ที่จะดึงข้อมูล
        await signInAnonymously(auth);

        const q = query(collection(db, "students"), where("lineUid", "==", lineUid));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            // กรณีเคยผูกไว้แล้ว (เจอข้อมูลในฐาน) -> เข้าสู่ระบบได้เลย
            const studentDoc = querySnapshot.docs[0];
            const studentData = studentDoc.data();
            
            const profile = {
                id: studentDoc.id,
                name: studentData.name, 
                level: studentData.level,
                room: studentData.room,
                loginMethod: 'line'
            };
            sessionStorage.setItem("mst_voter_profile", JSON.stringify(profile));
            window.location.href = "student.html";
        } else {
            // กรณีไม่เคยผูกบัญชี -> เปิดหน้าต่างให้กรอกข้อมูลเชื่อมบัญชี
            overlay.classList.add('hidden'); 
            document.getElementById('line-link-modal').classList.remove('hidden');
            document.getElementById('line-link-modal').classList.add('flex');
        }
    } catch (error) {
        // พิมพ์ Error ลง Console เพื่อให้แอดมินตรวจสอบได้ง่ายขึ้นหากติดปัญหาอื่น
        console.error("Firebase Database Error: ", error); 
        showFullScreenError("เกิดข้อผิดพลาด", "ไม่สามารถตรวจสอบฐานข้อมูลได้ (โปรดแจ้งผู้ดูแลระบบ)");
    }
}

// ==========================================
// 6. กดปุ่มยืนยันการเชื่อมต่อ (ใน Modal)
// ==========================================
const confirmLinkBtn = document.getElementById("confirmLinkBtn");
if (confirmLinkBtn) {
    confirmLinkBtn.addEventListener("click", async () => {
        const inputId = document.getElementById("linkStudentId").value.trim();
        const inputName = document.getElementById("linkStudentName").value.trim();

        if (inputId.length !== 5 || inputName === "") {
            Swal.fire({ icon: 'warning', title: 'ข้อมูลไม่ครบ', text: 'กรุณากรอกรหัสนักเรียน 5 หลัก และชื่อ-สกุลให้ครบถ้วน', confirmButtonColor: '#06C755', customClass: { popup: 'rounded-3xl' }});
            return;
        }

        // 1. ดึงข้อมูลนักเรียนจากรหัสที่กรอก
        document.getElementById('line-link-modal').classList.add('hidden');
        showFullScreenLoading("กำลังตรวจสอบข้อมูล...");

        try {
            const studentRef = doc(db, "students", inputId);
            const docSnap = await getDoc(studentRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                
                // 2. เช็คว่ารหัสนี้ถูกคนอื่นเอาไปผูก LINE ไว้ก่อนแล้วหรือไม่
                if (data.lineUid) {
                    showFullScreenError("เชื่อมต่อไม่สำเร็จ", "รหัสนักเรียนนี้ถูกเชื่อมต่อกับบัญชี LINE อื่นไปแล้ว");
                    return;
                }

                // 3. เช็คชื่อ-สกุล ว่าตรงกับฐานข้อมูลไหม (ตัดช่องว่างออกเพื่อเทียบ)
                const dbNameClean = data.name.replace(/\s+/g, '');
                const inputNameClean = inputName.replace(/\s+/g, '');

                if (dbNameClean === inputNameClean) {
                    // 4. ชื่อตรงรหัสตรง! -> แจ้งเตือนข้อตกลงครั้งสุดท้าย
                    overlay.classList.add('hidden'); // ซ่อนตัวโหลด

                    Swal.fire({
                        title: 'ยืนยันการเชื่อมต่อบัญชี?',
                        html: `<div class="bg-yellow-50 text-yellow-700 p-4 rounded-xl text-sm font-bold border border-yellow-200 text-left">
                               <p>หากยืนยันการเชื่อมต่อบัญชี LINE นี้กับรหัสนักเรียน <b class="text-lg">${inputId}</b> แล้ว</p>
                               <p class="text-red-500 mt-2">⚠️ จะไม่สามารถยกเลิก และจะไม่สามารถแก้ไขได้ในภายหลัง</p>
                               </div>`,
                        icon: 'question',
                        showCancelButton: true,
                        confirmButtonColor: '#06C755',
                        cancelButtonColor: '#d1d5db',
                        confirmButtonText: 'ยืนยันผูกบัญชีถาวร',
                        cancelButtonText: 'ยกเลิก',
                        customClass: { popup: 'rounded-[2rem]' }
                    }).then(async (result) => {
                        if (result.isConfirmed) {
                            showFullScreenLoading("กำลังบันทึกข้อมูล...");
                            // อัปเดต lineUid ลงในฐานข้อมูล
                            await updateDoc(studentRef, { lineUid: currentLineUid });
                            // ล็อกอินแบบเงียบแล้วพาไปหน้าโหวต
                            await signInAnonymously(auth);
                            sessionStorage.setItem("mst_voter_profile", JSON.stringify({
                                id: docSnap.id, name: data.name, level: data.level, room: data.room, loginMethod: 'line'
                            }));
                            window.location.href = "student.html";
                        } else {
                            // ถ้ายกเลิก ให้โชว์ Modal กลับมา
                            document.getElementById('line-link-modal').classList.remove('hidden');
                        }
                    });

                } else {
                    showFullScreenError("ข้อมูลไม่ตรงกัน", "ชื่อ-สกุลที่กรอก ไม่ตรงกับฐานข้อมูลของรหัสนักเรียนนี้ (ตรวจสอบการเว้นวรรคและตัวสะกด)");
                }
            } else {
                showFullScreenError("ไม่พบข้อมูล", "ไม่พบรหัสนักเรียนนี้ในระบบ กรุณาตรวจสอบอีกครั้ง");
            }
        } catch (error) {
            showFullScreenError("เกิดข้อผิดพลาด", error.message);
        }
    });
}