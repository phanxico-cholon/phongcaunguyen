// Import Firebase SDKs từ CDN chính thức
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-analytics.js";
import { getDatabase, ref, set, update, remove, onValue, onDisconnect } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-database.js";

// Cấu hình Firebase của bạn
const firebaseConfig = {
    apiKey: "AIzaSyCfgAZ0Pzd2W_6DkDTDNlErDAL5Uhy0NoI",
    authDomain: "phong-cau-nguyen-cha-tam.firebaseapp.com",
    projectId: "phong-cau-nguyen-cha-tam",
    storageBucket: "phong-cau-nguyen-cha-tam.firebasestorage.app",
    messagingSenderId: "727510955809",
    appId: "1:727510955809:web:e91245a67e8fa7b853b060",
    measurementId: "G-ER6FQT9VM0"
};

// Khởi tạo Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getDatabase(app); // Khởi tạo Realtime Database

const canvas = document.getElementById('churchCanvas');
const ctx = canvas.getContext('2d');

const SCRIPTURE_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSJ09XWzs4p3AEzE7g8DCH0Zff6_cTbmA_9TytwC0v7fjLw_BAuSHbGiQDnh8ixlUnABUn5AKCEO0sS/pub?gid=0&single=true&output=csv";

// Hàm parse CSV thông minh (hỗ trợ dấu phẩy trong ngoặc kép "")
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

// Thông tin người dùng hiện tại
let myId = 'user_' + Math.floor(Math.random() * 90000 + 10000);
let myAvatar = {
    name: '',
    role: 'Giáo dân',
    x: 480,
    y: 400,
    targetX: 480,
    targetY: 400,
    speed: 3,
    action: null,
    joined: false
};

let onlineUsers = {};
const candles = [{ x: 440, y: 140 }, { x: 520, y: 140 }];
let userPrayers = ["Cầu cho gia đình luôn bình an và hiệp nhất trong tình yêu Chúa."];

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

// 2. LẮNG NGHE DỮ LIỆU THỜI GIAN THỰC TỪ FIREBASE
function listenRealtimeUsers() {
    const usersRef = ref(db, 'rooms/phongcaunguyen/users');
    onValue(usersRef, (snapshot) => {
        const data = snapshot.val();
        onlineUsers = data || {};
    });
}

// 3. THAO TÁC THAM GIA VÀ RỜI PHÒNG
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
    myAvatar.y = Math.floor(Math.random() * (440 - 320)) + 320;
    myAvatar.targetX = myAvatar.x;
    myAvatar.targetY = myAvatar.y;

    document.getElementById('joinModal').style.display = 'none';

    // Đẩy dữ liệu lên Firebase Database
    const userRef = ref(db, 'rooms/phongcaunguyen/users/' + myId);
    set(userRef, myAvatar);
    onDisconnect(userRef).remove(); // Tự động xóa khi mất kết nối/đóng trang

    listenRealtimeUsers();
}

window.leaveRoom = function() {
    if (myAvatar.joined) {
        remove(ref(db, 'rooms/phongcaunguyen/users/' + myId));
    }
    myAvatar.joined = false;
    document.getElementById('joinModal').style.display = 'flex';
}

window.triggerAction = function(actionText) {
    if (!myAvatar.joined) return;
    myAvatar.action = actionText;
    
    update(ref(db, 'rooms/phongcaunguyen/users/' + myId), { action: actionText });

    if (actionText.includes('Thắp nến')) {
        candles.push({ x: myAvatar.x, y: myAvatar.y - 12 });
    }

    setTimeout(() => {
        if (myAvatar.joined) {
            myAvatar.action = null;
            update(ref(db, 'rooms/phongcaunguyen/users/' + myId), { action: null });
        }
    }, 8000);
}

// 4. DI CHUYỂN TRONG CANVAS
canvas.addEventListener('click', (e) => {
    if (!myAvatar.joined) return;
    const rect = canvas.getBoundingClientRect();
    myAvatar.targetX = e.clientX - rect.left;
    myAvatar.targetY = e.clientY - rect.top;
});

function update() {
    if (!myAvatar.joined) return;
    const dx = myAvatar.targetX - myAvatar.x;
    const dy = myAvatar.targetY - myAvatar.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 2) {
        myAvatar.x += (dx / dist) * myAvatar.speed;
        myAvatar.y += (dy / dist) * myAvatar.speed;

        update(ref(db, 'rooms/phongcaunguyen/users/' + myId), {
            x: Math.round(myAvatar.x),
            y: Math.round(myAvatar.y)
        });
    }
}

// 5. CÁC TÍNH NĂNG MỞ RỘNG (LẦN CHUỖI, Ý NGUYỆN, ÂM THANH)
let currentRosaryStep = 0;
const totalRosaryBeads = 10;

window.openRosaryModal = function() {
    if (!myAvatar.joined) {
        alert("Vui lòng bước vào phòng cầu nguyện trước!");
        return;
    }
    currentRosaryStep = 0;
    renderRosaryBeads();
    document.getElementById('rosaryModal').style.display = 'flex';
    window.triggerAction('📿 Đang lần chuỗi Mân Côi');
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
    userPrayers.push(`${myAvatar.name}: ${text}`);
    updateTicker();
    document.getElementById('inputPrayerText').value = '';
    closePrayerInputModal();
    alert("Ý nguyện của bạn đã được gửi lên Sổ tay cộng đoàn!");
}

function updateTicker() {
    const track = document.getElementById('tickerTrack');
    if (track) track.innerHTML = `<span>${userPrayers.join("   •   ")}</span>`;
}

let isAudioPlaying = false;
window.toggleAudio = function() {
    const audio = document.getElementById('bgAudio');
    const btn = document.getElementById('audioToggleBtn');
    if (isAudioPlaying) {
        audio.pause();
        isAudioPlaying = false;
        btn.classList.remove('active');
        btn.innerText = '🎵 Bật Nhạc';
    } else {
        audio.play().catch(e => console.log("Trình duyệt chặn autoplay:", e));
        isAudioPlaying = true;
        btn.classList.add('active');
        btn.innerText = '🎵 Tắt Nhạc';
    }
}

// 6. RENDER CANVAS
function getRoleIcon(role) {
    switch(role) {
        case 'Linh mục': return '✝️';
        case 'Tu sĩ nam': return '⛪';
        case 'Tu sĩ nữ': return '🕊️';
        default: return '🕯️';
    }
}

function drawChurch() {
    ctx.fillStyle = '#2b303c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#bf616a';
    ctx.fillRect(430, 120, 100, 360);

    ctx.fillStyle = '#3b4252';
    ctx.fillRect(280, 50, 400, 80);
    ctx.fillStyle = '#d8dee9';
    ctx.fillRect(400, 75, 160, 30);
    ctx.fillStyle = '#ebcb8b';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✝ CUNG THÁNH - NHÀ THỜ CHA TAM', 480, 95);

    ctx.beginPath();
    ctx.arc(130, 110, 20, 0, Math.PI * 2);
    ctx.fillStyle = '#81a1c1';
    ctx.fill();
    ctx.fillStyle = '#eceff4';
    ctx.fillText('Đức Mẹ', 130, 145);

    candles.forEach(c => {
        ctx.fillStyle = '#d08770';
        ctx.fillRect(c.x - 2, c.y, 4, 8);
        ctx.beginPath();
        ctx.arc(c.x, c.y - 3, 3 + Math.random() * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ebcb8b';
        ctx.fill();
    });
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
    update();
    render();
    requestAnimationFrame(loop);
}

// Khởi chạy
fetchScripture();
updateTicker();
loop();
