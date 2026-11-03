import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-analytics.js";
import { getDatabase, ref, set, update as fbUpdate, remove, onValue, onDisconnect, push } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCfgAZ0Pzd2W_6DkDTDNlErDAL5Uhy0NoI",
    authDomain: "phong-cau-nguyen-cha-tam.firebaseapp.com",
    databaseURL: "https://phong-cau-nguyen-cha-tam-default-rtdb.firebaseio.com",
    projectId: "phong-cau-nguyen-cha-tam",
    storageBucket: "phong-cau-nguyen-cha-tam.firebasestorage.app",
    messagingSenderId: "727510955809",
    appId: "1:727510955809:web:e91245a67e8fa7b853b060",
    measurementId: "G-ER6FQT9VM0"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getDatabase(app, "https://phong-cau-nguyen-cha-tam-default-rtdb.firebaseio.com");

const canvas = document.getElementById('churchCanvas');
const ctx = canvas.getContext('2d');

const SCRIPTURE_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSJ09XWzs4p3AEzE7g8DCH0Zff6_cTbmA_9TytwC0v7fjLw_BAuSHbGiQDnh8ixlUnABUn5AKCEO0sS/pub?gid=0&single=true&output=csv";
const PRAYER_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRUtj5dV5XJiJLem1z7p2_LO2nWCUnrurkP2giYbtfvUN2TbRG5D1Cw8kWFrtKhsndEazGeaecKJRFD/pub?gid=0&single=true&output=csv";
const GOOGLE_SHEET_WEBHOOK_URL = ""; 

function parseCSV(text) {
    let lines = text.split('\n');
    let result = [];
    for (let line of lines) {
        let row = [];
        let inQuotes = false;
        let entry = '';
        for (let i = 0; i < line.length; i++) {
            let char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                row.push(entry.trim());
                entry = '';
            } else {
                entry += char;
            }
        }
        row.push(entry.trim());
        result.push(row);
    }
    return result;
}

let myId = 'user_' + Math.floor(Math.random() * 90000 + 10000);
let myAvatar = {
    name: '',
    role: 'Giáo dân',
    x: 480,
    y: 420,
    targetX: 480,
    targetY: 420,
    speed: 3,
    action: null,
    joined: false
};

let onlineUsers = {};
let userPrayers = [];

const ZONES = {
    'thanh-the': { x: 620, y: 110 },
    'duc-me': { x: 130, y: 110 },
    'carlo': { x: 780, y: 110 },
    'giuse': { x: 840, y: 110 },
    'tu-dao': { x: 900, y: 110 },
    'long-nha-tho': { x: 480, y: 420 }
};

// 1. TẢI LỜI CHÚA TỪ GOOGLE SHEET
async function fetchScripture() {
    try {
        const res = await fetch(SCRIPTURE_CSV);
        const text = await res.text();
        const rows = parseCSV(text).slice(1);
        const todayStr = new Date().toISOString().split('T')[0];
        let found = null;

        for (let r of rows) {
            if (r.length >= 4 && r[0] === todayStr) {
                found = { cau: r[1].replace(/^"|"$/g, ''), trich: r[2].replace(/^"|"$/g, ''), thucHanh: r[3].replace(/^"|"$/g, '') };
                break;
            }
        }
        if (!found && rows.length > 0 && rows[0].length >= 4) {
            const r = rows[0];
            found = { cau: r[1].replace(/^"|"$/g, ''), trich: r[2].replace(/^"|"$/g, ''), thucHanh: r[3].replace(/^"|"$/g, '') };
        }
        if (found) {
            document.getElementById('scriptureText').innerText = `"${found.cau}" (${found.trich})`;
            document.getElementById('scripturePractice').innerText = `👉 Thực hành sống: ${found.thucHanh}`;
        }
    } catch (e) {
        console.error("Lỗi tải Lời Chúa:", e);
    }
}

// 2. TẢI Ý NGUYỆN TỪ GOOGLE SHEET
async function fetchPrayersFromSheet() {
    try {
        const res = await fetch(PRAYER_CSV);
        const text = await res.text();
        const rows = parseCSV(text).slice(1);
        let list = [];

        for (let i = rows.length - 1; i >= 0 && list.length < 5; i--) {
            let r = rows[i];
            if (r.length >= 5) {
                let name = r[2].replace(/^"|"$/g, '');
                let content = r[4].replace(/^"|"$/g, '');
                if (content) list.push(`${name}: ${content}`);
            } else if (r.length >= 3) {
                let name = r[1] ? r[1].replace(/^"|"$/g, '') : "Giáo dân";
                let content = r[2] ? r[2].replace(/^"|"$/g, '') : r[0];
                if (content) list.push(`${name}: ${content}`);
            }
        }

        if (list.length > 0) {
            userPrayers = list;
            updateTicker();
        }
    } catch (e) {
        console.error("Lỗi tải Ý nguyện từ Google Sheet:", e);
    }
}

// 3. LẮNG NGHE REALTIME FIREBASE
function listenRealtimeData() {
    const usersRef = ref(db, 'rooms/phongcaunguyen/users');
    onValue(usersRef, (snapshot) => {
        onlineUsers = snapshot.val() || {};
    });

    const prayersRef = ref(db, 'rooms/phongcaunguyen/prayers');
    onValue(prayersRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            let list = Object.values(data).reverse().slice(0, 5);
            userPrayers = list.map(p => `${p.name}: ${p.text}`);
            updateTicker();
        }
    });
}

// 4. THAM GIA VÀ RỜI PHÒNG
window.joinRoom = function() {
    const inputName = document.getElementById('inputName').value.trim();
    if (!inputName) {
        alert("Vui lòng nhập Tên Thánh + Họ tên của bạn!");
        return;
    }
    myAvatar.name = inputName;
    myAvatar.role = document.getElementById('selectRole').value;
    myAvatar.joined = true;

    myAvatar.x = Math.floor(Math.random() * (700 - 260)) + 260;
    myAvatar.y = Math.floor(Math.random() * (460 - 320)) + 320;
    myAvatar.targetX = myAvatar.x;
    myAvatar.targetY = myAvatar.y;

    document.getElementById('joinModal').style.display = 'none';

    const userRef = ref(db, 'rooms/phongcaunguyen/users/' + myId);
    set(userRef, myAvatar);
    onDisconnect(userRef).remove();

    listenRealtimeData();
}

window.leaveRoom = function() {
    if (myAvatar.joined) {
        remove(ref(db, 'rooms/phongcaunguyen/users/' + myId));
    }
    myAvatar.joined = false;
    document.getElementById('joinModal').style.display = 'flex';
}

window.triggerAction = function(actionText, zoneKey = null) {
    if (!myAvatar.joined) return;
    myAvatar.action = actionText;

    if (zoneKey && ZONES[zoneKey]) {
        myAvatar.targetX = ZONES[zoneKey].x;
        myAvatar.targetY = ZONES[zoneKey].y;
    }
    
    fbUpdate(ref(db, 'rooms/phongcaunguyen/users/' + myId), { 
        action: actionText,
        targetX: myAvatar.targetX,
        targetY: myAvatar.targetY
    });

    setTimeout(() => {
        if (myAvatar.joined) {
            myAvatar.action = null;
            fbUpdate(ref(db, 'rooms/phongcaunguyen/users/' + myId), { action: null });
        }
    }, 8000);
}

// 5. SỔ TAY Ý NGUYỆN
window.openPrayerInputModal = function() {
    if (!myAvatar.joined) {
        alert("Vui lòng bước vào phòng cầu nguyện trước!");
        return;
    }
    document.getElementById('prayerModal').style.display = 'flex';
}

window.closePrayerInputModal = function() {
    document.getElementById('prayerModal').style.display = 'none';
}

window.submitPrayer = function() {
    const text = document.getElementById('inputPrayerText').value.trim();
    if (!text) {
        alert("Vui lòng nhập nội dung ý nguyện!");
        return;
    }

    const prayerData = {
        id: myId,
        thoiGian: new Date().toLocaleString("vi-VN"),
        name: myAvatar.name,
        role: myAvatar.role,
        text: text,
        timestamp: Date.now()
    };

    const prayersRef = ref(db, 'rooms/phongcaunguyen/prayers');
    push(prayersRef, prayerData);

    if (GOOGLE_SHEET_WEBHOOK_URL) {
        fetch(GOOGLE_SHEET_WEBHOOK_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(prayerData)
        }).catch(err => console.log("Lỗi gửi ngầm sổ tay Cầu nguyện:", err));
    }

    alert("Ý nguyện của bạn đã được lưu vào Sổ tay và hiển thị trực tiếp tại nhà thờ!");
    document.getElementById('inputPrayerText').value = '';
    closePrayerInputModal();
}

function updateTicker() {
    const track = document.getElementById('tickerTrack');
    if (track) {
        track.innerHTML = `<span>${userPrayers.length > 0 ? userPrayers.join("   •   ") : "Cầu cho gia đình luôn bình an và hiệp nhất trong tình yêu Chúa."}</span>`;
    }
}

// 6. DI CHUYỂN TRONG CANVAS (Bấm chuột để di chuyển)
canvas.addEventListener('click', (e) => {
    if (!myAvatar.joined) return;
    const rect = canvas.getBoundingClientRect();
    myAvatar.targetX = e.clientX - rect.left;
    myAvatar.targetY = e.clientY - rect.top;

    // Gửi ngay tọa độ đích mới lên Firebase để đồng bộ thời gian thực
    fbUpdate(ref(db, 'rooms/phongcaunguyen/users/' + myId), {
        targetX: Math.round(myAvatar.targetX),
        targetY: Math.round(myAvatar.targetY)
    });
});

function updateGame() {
    if (!myAvatar.joined) return;
    const dx = myAvatar.targetX - myAvatar.x;
    const dy = myAvatar.targetY - myAvatar.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 2) {
        myAvatar.x += (dx / dist) * myAvatar.speed;
        myAvatar.y += (dy / dist) * myAvatar.speed;

        // Cập nhật tọa độ hiện tại liên tục lên Firebase
        fbUpdate(ref(db, 'rooms/phongcaunguyen/users/' + myId), {
            x: Math.round(myAvatar.x),
            y: Math.round(myAvatar.y)
        });
    }
}

// 7. LẦN CHUỖI TẠI BỆ THỜ ĐỨC MẸ
let currentRosaryStep = 0;
const totalRosaryBeads = 10;

window.openRosaryModal = function() {
    if (!myAvatar.joined) {
        alert("Vui lòng bước vào phòng cầu nguyện trước!");
        return;
    }
    triggerAction('📿 Đang lần chuỗi Mân Côi', 'duc-me');
    currentRosaryStep = 0;
    renderRosaryBeads();
    document.getElementById('rosaryModal').style.display = 'flex';
}

window.closeRosaryModal = function() {
    document.getElementById('rosaryModal').style.display = 'none';
    window.triggerAction('📿 Đã hoàn thành giờ kinh Mân Côi');
}

function renderRosaryBeads() {
    const path = document.getElementById('rosaryPath');
    path.innerHTML = '';
    for (let i = 0; i < totalRosaryBeads; i++) {
        const bead = document.createElement('div');
        bead.className = 'rosary-bead';
        if (i < currentRosaryStep) bead.classList.add('completed');
        if (i === currentRosaryStep) bead.classList.add('active');
        bead.innerText = i + 1;
        bead.onclick = () => {
            if (i === currentRosaryStep) {
                currentRosaryStep++;
                renderRosaryBeads();
            }
        };
        path.appendChild(bead);
    }
    document.getElementById('rosaryCounter').innerText = `Đã đọc: ${currentRosaryStep} / ${totalRosaryBeads} kinh`;
}

// 8. QUẢN LÝ ÂM THANH NỀN
let isAudioPlaying = false;
window.toggleAudio = function() {
    const audio = document.getElementById('bgAudio');
    const btn = document.getElementById('audioToggleBtn');
    
    if (!audio) return;

    if (isAudioPlaying) {
        audio.pause();
        isAudioPlaying = false;
        btn.classList.remove('active');
        btn.innerText = '🎵 Bật Nhạc';
    } else {
        audio.play().then(() => {
            isAudioPlaying = true;
            btn.classList.add('active');
            btn.innerText = '🎵 Tắt Nhạc';
        }).catch(e => {
            console.log("Trình duyệt chặn autoplay:", e);
            alert("Vui lòng tương tác với trang web trước khi bật nhạc!");
        });
    }
}

// 9. RENDER KHÔNG GIAN NHÀ THỜ CHI TIẾT
function getRoleIcon(role) {
    switch(role) {
        case 'Linh mục': return '✝️';
        case 'Tu sĩ nam': return '🚹';
        case 'Tu sĩ nữ': return '🚺';
        default: return '🕯️';
    }
}

function drawChurch() {
    ctx.fillStyle = '#2b303c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#bf616a';
    ctx.fillRect(400, 100, 120, 380);

    ctx.fillStyle = '#3b4252';
    ctx.fillRect(320, 45, 280, 75);
    ctx.fillStyle = '#d8dee9';
    ctx.fillRect(415, 65, 90, 25);
    ctx.fillStyle = '#ebcb8b';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✝ BÀN THỜ CHÍNH', 460, 82);

    ctx.fillStyle = '#4c566a';
    ctx.fillRect(590, 60, 65, 55);
    ctx.fillStyle = '#ebcb8b';
    ctx.fillText('Nhà Tạm', 622, 85);

    ctx.beginPath();
    ctx.arc(622, 98, 4 + Math.sin(Date.now() / 200) * 1.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ff5555';
    ctx.fill();

    ctx.fillStyle = '#4c566a';
    ctx.fillRect(100, 60, 65, 55);
    ctx.fillStyle = '#81a1c1';
    ctx.fillText('Bệ Đức Mẹ', 132, 90);

    ctx.fillStyle = '#3b4252';
    ctx.fillRect(740, 60, 75, 55);
    ctx.fillStyle = '#d8dee9';
    ctx.font = '9px sans-serif';
    ctx.fillText('St. Carlo', 777, 85);

    ctx.fillStyle = '#3b4252';
    ctx.fillRect(825, 60, 75, 55);
    ctx.fillText('St. Giuse', 862, 85);

    ctx.fillStyle = '#3b4252';
    ctx.fillRect(910, 60, 45, 55);
    ctx.fillText('Tử Đạo', 932, 85);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 2;
    for (let y = 200; y < 450; y += 45) {
        ctx.strokeRect(80, y, 260, 25);
        ctx.strokeRect(620, y, 260, 25);
    }
}

function drawAvatar(p, isMe = false) {
    ctx.save();
    ctx.translate(p.x, p.y);

    if (isMe) {
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(136, 192, 208, 0.3)';
        ctx.fill();
    }

    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(getRoleIcon(p.role), 0, 6);

    ctx.fillStyle = isMe ? '#88c0d0' : '#eceff4';
    ctx.font = '11px sans-serif';
    ctx.fillText(p.name, 0, -16);

    if (p.action) {
        ctx.fillStyle = '#ebcb8b';
        ctx.font = '10px sans-serif';
        ctx.fillText(p.action, 0, -30);
    }

    ctx.restore();
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawChurch();

    for (let id in onlineUsers) {
        let user = onlineUsers[id];
        if (id === myId) {
            drawAvatar(myAvatar, true);
        } else {
            drawAvatar(user, false);
        }
    }
}

function loop() {
    updateGame();
    render();
    requestAnimationFrame(loop);
}

// Khởi chạy hệ thống
fetchScripture();
fetchPrayersFromSheet();
loop();
