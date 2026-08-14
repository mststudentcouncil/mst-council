import { auth, db } from "./firebase-config.js";
import { signInAnonymously } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, doc, getDocs, onSnapshot, query, orderBy, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let unsubscribe = null;

async function initialize() {
    try {
        await signInAnonymously(auth);
        await loadCampaigns();
    } catch (error) {
        console.error("Initialization Error:", error);
        document.getElementById("resultsContainer").innerHTML = `<div class="text-center text-red-400 text-2xl font-bold mt-20">ไม่สามารถเชื่อมต่อระบบได้ กรุณารีเฟรชหน้าเว็บ</div>`;
    }
}

async function loadCampaigns() {
    const select = document.getElementById('campaignSelect');
    
    try {
        const q = query(collection(db, "campaigns"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        
        select.innerHTML = '';
        
        if (snapshot.empty) {
            select.innerHTML = '<option value="">ไม่มีรายการลงคะแนน</option>';
            document.getElementById("displayTitle").innerText = "ยังไม่มีรายการลงคะแนน";
            document.getElementById("resultsContainer").innerHTML = "";
            return;
        }

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const option = document.createElement('option');
            option.value = docSnap.id;
            
            // ใช้ข้อความธรรมดาใน Dropdown แทน Emoji 
            const statusText = data.status === "open" ? " (กำลังเปิด)" : " (ปิดระบบ)";
            option.text = data.title + statusText;
            option.className = "text-gray-800 font-medium";
            select.appendChild(option);
        });

        if(select.options.length > 0) {
            startLiveResults(select.value);
        }

        select.addEventListener('change', (e) => {
            if(e.target.value) {
                startLiveResults(e.target.value);
            }
        });

    } catch (error) {
        console.error("Error loading campaigns:", error);
    }
}

function startLiveResults(campaignId) {
    if (unsubscribe) {
        unsubscribe();
    }

    const docRef = doc(db, "campaigns", campaignId);
    
    // ดึงข้อมูลแค่ Document หลักตัวเดียวเท่านั้น (ประหยัด Read ขั้นสุด)
    unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (!docSnap.exists()) return;

        const data = docSnap.data();
        
        const isStatusOpen = data.status === "open";
        const statusIcon = isStatusOpen
            ? `<svg class="w-8 h-8 text-green-400 animate-pulse drop-shadow-[0_0_8px_rgba(74,222,128,0.8)]" fill="currentColor" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8"></circle></svg>`
            : `<svg class="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8"></circle></svg>`;
            
        document.getElementById("displayTitle").innerHTML = `${statusIcon} ${data.title}`;

        const options = data.options || [];
        
        // ดึงข้อมูลตัวเลขที่อัปเดตเรียบร้อยแล้วจากฝั่ง Server มาโชว์เลย
        const stats = data.stats || { totalVotes: 0, votes: {} };
        const votes = stats.votes || {};
        let totalVotes = stats.totalVotes || 0;
        
        let results = [];

        // วนลูปสร้างตัวเลือกผู้สมัคร
        options.forEach((opt, index) => {
            const count = votes[opt.name] || 0;
            results.push({
                candidateNumber: index + 1,
                name: opt.name,
                image: opt.image,
                count: count
            });
        });

        // ดึงตัวเลือก "ไม่ประสงค์ลงคะแนน"
        if (votes["ไม่ประสงค์ลงคะแนน"] !== undefined) {
            results.push({
                name: "ไม่ประสงค์ลงคะแนน",
                image: null,
                isNoVote: true,
                count: votes["ไม่ประสงค์ลงคะแนน"]
            });
        }

        document.getElementById("totalVotesDisplay").innerText = totalVotes.toLocaleString();

        // เรียงลำดับคะแนนจากมากไปน้อย
        results.sort((a, b) => b.count - a.count);

        // 🌟 เพิ่มบรรทัดนี้: เช็คว่าแอดมินสั่งซ่อนคะแนนระหว่างที่ยังเปิดโหวตอยู่หรือไม่
        const isHidden = data.hideScoresUntilClosed === true && data.status === "open";
        
        // ส่งตัวแปร isHidden เข้าไปในฟังก์ชันวาดกราฟด้วย
        renderResults(results, totalVotes, isHidden);
    });
}

function renderResults(results, totalVotes, isHidden = false) {
            const container = document.getElementById("resultsContainer");
            container.innerHTML = '';

            // 🌟 1. เพิ่มลอจิกคำนวณอันดับ (Tie-breaker) ก่อนเริ่มวนลูป
            let currentRank = 1;
            let prevCount = null;
            
            // ให้ค่า rank แต่ละผู้สมัครก่อน (ยกเว้น "ไม่ประสงค์ลงคะแนน")
            results.forEach(item => {
                if (!item.isNoVote) {
                    // ถ้าคะแนนน้อยกว่าคนก่อนหน้า ให้อันดับตกลง (เช่น จาก 1 เป็น 2)
                    // แต่ถ้าคะแนนเท่ากัน currentRank จะไม่บวกเพิ่ม (ครองอันดับร่วม)
                    if (prevCount !== null && item.count < prevCount) {
                        currentRank++;
                    }
                    item.rank = currentRank;
                    prevCount = item.count;
                }
            });

            // 2. เริ่มวาดกราฟ
            results.forEach((item, index) => {
                const percentVal = totalVotes === 0 ? 0 : ((item.count / totalVotes) * 100).toFixed(1);
                
                // ถ้าระบบตั้งค่าเป็นซ่อน ให้แสดงผลเป็น ? แทน
                const displayCount = isHidden ? "?" : item.count.toLocaleString();
                const displayPercent = isHidden ? "?" : percentVal;
                const barWidthPercent = isHidden ? 0 : percentVal;
                
                let rankBadge = '';
                let cardStyle = 'glass-card';
                let barColor = 'bg-gray-200';
                let textNameColor = 'text-gray-800';
                let textScoreColor = 'text-purple-700';

                // 🌟 3. เปลี่ยนจากการเช็ค index (ลำดับแถว) มาเป็นการเช็ค item.rank (อันดับที่คำนวณไว้)
                if (!item.isNoVote) {
                    if (item.rank === 1 && item.count > 0 && !isHidden) {
                        rankBadge = `<div class="absolute -left-3 -top-3 md:-left-4 md:-top-4 w-10 h-10 md:w-14 md:h-14 bg-gradient-to-br from-yellow-300 to-yellow-500 rounded-full flex items-center justify-center font-black text-xl md:text-3xl text-yellow-900 shadow-[0_4px_15px_rgba(250,204,21,0.5)] border-4 border-white z-20">1</div>`;
                        cardStyle = 'bg-white/90 backdrop-blur-xl border-2 border-yellow-400 shadow-[0_10px_30px_rgba(250,204,21,0.2)] transform scale-[1.02] md:scale-[1.03] z-10';
                        barColor = 'bg-gradient-to-r from-yellow-400 to-yellow-300 shadow-[0_0_10px_rgba(250,204,21,0.6)]';
                        textNameColor = 'text-gray-900 font-extrabold';
                        textScoreColor = 'text-transparent bg-clip-text bg-gradient-to-r from-yellow-600 to-yellow-500';
                    } else if (item.rank === 2 && item.count > 0 && !isHidden) {
                        rankBadge = `<div class="absolute -left-2 -top-2 md:-left-3 md:-top-3 w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-gray-200 to-gray-400 rounded-full flex items-center justify-center font-black text-lg md:text-xl text-gray-800 shadow-md border-2 border-white z-20">2</div>`;
                        barColor = 'bg-gradient-to-r from-gray-400 to-gray-300';
                        textNameColor = 'text-gray-800 font-bold';
                    } else if (item.rank === 3 && item.count > 0 && !isHidden) {
                        rankBadge = `<div class="absolute -left-2 -top-2 md:-left-3 md:-top-3 w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-orange-300 to-orange-500 rounded-full flex items-center justify-center font-black text-lg md:text-xl text-orange-950 shadow-md border-2 border-white z-20">3</div>`;
                        barColor = 'bg-gradient-to-r from-orange-400 to-orange-300';
                        textNameColor = 'text-gray-800 font-bold';
                    } else {
                        barColor = isHidden ? 'bg-gray-400' : 'bg-gradient-to-r from-purple-500 to-purple-400';
                        if(isHidden) textScoreColor = 'text-gray-500';
                    }
                } else {
                    barColor = isHidden ? 'bg-gray-400' : 'bg-gradient-to-r from-red-500 to-red-400';
                    textNameColor = 'text-red-500 font-bold';
                    textScoreColor = isHidden ? 'text-gray-500' : 'text-red-600';
                }

                let avatarHtml = '';
                if (item.isNoVote) {
                    avatarHtml = `<div class="w-16 h-16 md:w-24 md:h-24 shrink-0 rounded-full bg-red-50 border-4 border-white flex items-center justify-center text-red-500 shadow-md"><svg class="w-8 h-8 md:w-12 md:h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"></path></svg></div>`;
                } else if (item.image) {
                    avatarHtml = `
                        <div class="relative cursor-pointer group shrink-0" onclick="openImageModal('${item.image}')" title="คลิกเพื่อดูรูปขยาย">
                            <img src="${item.image}" class="w-16 h-16 md:w-24 md:h-24 rounded-full object-cover border-4 border-white bg-gray-50 shadow-md transition-transform duration-300 group-hover:scale-105">
                            <div class="absolute inset-0 bg-purple-900/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
                                <svg class="w-6 h-6 md:w-8 md:h-8 text-white drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"></path></svg>
                            </div>
                        </div>`;
                } else {
                    avatarHtml = `<div class="w-16 h-16 md:w-24 md:h-24 shrink-0 rounded-full bg-purple-100 border-4 border-white flex items-center justify-center font-black text-2xl md:text-4xl text-purple-700 shadow-md">${item.candidateNumber}</div>`;
                }

                const html = `
                    <div class="${cardStyle} p-4 md:p-6 rounded-3xl relative transition-all duration-500 flex items-center gap-4 md:gap-6 fade-in" style="animation-delay: ${index * 0.05}s">
                        ${rankBadge}
                        ${avatarHtml}
                        
                        <div class="flex-1 min-w-0 py-1">
                            <div class="flex justify-between items-end mb-2 md:mb-3">
                                <h3 class="text-lg md:text-2xl truncate pr-2 ${textNameColor}">${item.name}</h3>
                                <div class="text-right shrink-0">
                                    <div class="text-2xl md:text-4xl font-black tracking-tight ${textScoreColor}">${displayCount}</div>
                                </div>
                            </div>
                            
                            <div class="flex items-center gap-3">
                                <div class="w-full bg-gray-200/50 rounded-full h-3 md:h-4 overflow-hidden border border-white/60 shadow-inner">
                                    <div class="${barColor} h-full rounded-full bar-animate" style="width: ${barWidthPercent}%"></div>
                                </div>
                                <div class="text-sm md:text-base font-extrabold ${textScoreColor} w-16 text-right shrink-0">${displayPercent}%</div>
                            </div>
                        </div>
                    </div>
                `;
                container.insertAdjacentHTML('beforeend', html);
            });
        }

window.addEventListener('DOMContentLoaded', initialize);