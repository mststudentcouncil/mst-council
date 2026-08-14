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

        renderResults(results, totalVotes);
    });
}

function renderResults(results, totalVotes) {
    const container = document.getElementById("resultsContainer");
    container.innerHTML = '';

    results.forEach((item, index) => {
        const percent = totalVotes === 0 ? 0 : ((item.count / totalVotes) * 100).toFixed(1);
        
        let rankBadge = '';
        let cardStyle = 'glass-panel';
        let barColor = 'bg-white/40';

        if (!item.isNoVote) {
            if (index === 0 && item.count > 0) {
                rankBadge = `<div class="absolute -left-4 -top-4 w-12 h-12 bg-gradient-to-br from-yellow-300 to-yellow-600 rounded-full flex items-center justify-center font-black text-2xl text-yellow-900 shadow-lg border-4 border-[#3b0764] z-20">1</div>`;
                cardStyle = 'bg-gradient-to-r from-purple-800/80 to-indigo-900/80 backdrop-blur-md border-2 border-yellow-400/50 shadow-[0_0_30px_rgba(250,204,21,0.2)] transform scale-[1.02]';
                barColor = 'bg-gradient-to-r from-yellow-400 to-yellow-200 shadow-[0_0_15px_rgba(250,204,21,0.5)]';
            } else if (index === 1 && item.count > 0) {
                rankBadge = `<div class="absolute -left-3 -top-3 w-10 h-10 bg-gradient-to-br from-gray-300 to-gray-500 rounded-full flex items-center justify-center font-black text-xl text-gray-900 shadow-lg border-4 border-[#3b0764] z-20">2</div>`;
                barColor = 'bg-gradient-to-r from-gray-300 to-white';
            } else if (index === 2 && item.count > 0) {
                rankBadge = `<div class="absolute -left-3 -top-3 w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-700 rounded-full flex items-center justify-center font-black text-xl text-white shadow-lg border-4 border-[#3b0764] z-20">3</div>`;
                barColor = 'bg-gradient-to-r from-orange-400 to-orange-300';
            } else {
                barColor = 'bg-gradient-to-r from-purple-400 to-purple-300';
            }
        } else {
            barColor = 'bg-red-400';
        }

        // กำหนดการแสดงรูป ไอคอน หรือตัวเลข
        let avatarHtml = '';
        if (item.isNoVote) {
            // ไอคอนกากบาท สำหรับไม่ประสงค์ลงคะแนน
            avatarHtml = `<div class="w-20 h-20 md:w-24 md:h-24 shrink-0 rounded-full bg-red-500/20 border-2 border-red-400/50 flex items-center justify-center text-red-300 shadow-inner"><svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"></path></svg></div>`;
        } else if (item.image) {
            // กรณีมีรูปภาพ -> กดแล้วขยายรูปผ่านฟังก์ชันที่เขียนไว้ใน HTML
            avatarHtml = `
                <div class="relative cursor-pointer group" onclick="openImageModal('${item.image}')">
                    <img src="${item.image}" class="w-20 h-20 md:w-24 md:h-24 shrink-0 rounded-full object-cover border-2 border-white/50 bg-white/10 shadow-lg transition-transform duration-300 group-hover:scale-105">
                    <div class="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
                        <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"></path></svg>
                    </div>
                </div>`;
        } else {
            // กรณีไม่มีรูปภาพ -> นำลำดับเบอร์ที่ลงทะเบียนไว้มาแสดงผลเป็นตัวเลข
            avatarHtml = `<div class="w-20 h-20 md:w-24 md:h-24 shrink-0 rounded-full bg-white/10 border-2 border-white/30 flex items-center justify-center font-black text-4xl text-white/90 shadow-inner">${item.candidateNumber}</div>`;
        }

        const html = `
            <div class="${cardStyle} p-4 md:p-6 rounded-3xl relative transition-all duration-500 flex items-center gap-4 md:gap-6">
                ${rankBadge}
                ${avatarHtml}
                
                <div class="flex-1 min-w-0 py-2">
                    <div class="flex justify-between items-end mb-3">
                        <h3 class="text-xl md:text-3xl font-bold truncate pr-4 ${item.isNoVote ? 'text-red-300' : 'text-white'}">${item.name}</h3>
                        <div class="text-right shrink-0">
                            <div class="text-2xl md:text-4xl font-black tracking-tight">${item.count.toLocaleString()}</div>
                            <div class="text-sm md:text-base font-medium opacity-80">${percent}%</div>
                        </div>
                    </div>
                    
                    <div class="w-full bg-black/40 rounded-full h-4 md:h-5 overflow-hidden border border-white/10 shadow-inner">
                        <div class="${barColor} h-full rounded-full bar-animate" style="width: ${percent}%"></div>
                    </div>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', html);
    });
}

window.addEventListener('DOMContentLoaded', initialize);