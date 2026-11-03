const canvas = document.getElementById('churchCanvas');
const ctx = canvas.getContext('2d');

// 2 ĐƯỜNG LINK CSV GOOGLE SHEETS CỦA BẠN
const PRESENCE_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSxnDM9oFanvUUUtL-NqOvn6fM7mQhxD8L95hUqIv6c1CmwQN9htcN76ofjtLZMUSVSLrjSX8yyWqsV/pub?gid=0&single=true&output=csv";
const SCRIPTURE_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSJ09XWzs4p3AEzE7g8DCH0Zff6_cTbmA_9TytwC0v7fjLw_BAuSHbGiQDnh8ixlUnABUn5AKCEO0sS/pub?gid=0&single=true&output=csv";

// Khởi tạo Nhân vật bản thân
let myAvatar = {
    id: 'user_' + Math.floor(Math.random() * 90000 + 10000),
    name: '',
    role: 'Giáo dân',
    x: 480,
    y: 450,
    targetX: 480,
    targetY: 450,
    speed: 3,
    action: null,
    actionTimer: 0,
    joined: false
};

let otherAvatars = [];
const candles = [{ x: 440, y: 160 }, { x: 520, y: 160 }];

// 1. TẢI LỜI CHÚA TRONG NGÀY TỪ GOOGLE SHEET
async function fetchScripture() {
    try {
        const res = await fetch(SCRIPTURE_CSV);
        const text = await res.text();
        const rows = text.split('\n').slice(1);
        
        const todayStr = new Date().toISOString().split('T')[0];
        let found = null;

        for (let r of rows) {
            const cols = r.split(',');
            if (cols.length >= 4 && cols[0].trim() === todayStr) {
                found = { cau: cols[1].trim(), trich: cols[2].trim(), thucHanh: cols[3].trim() };
                break;
            }
        }

        // Nếu ngày hôm nay chưa có dòng khớp chính xác, lấy dòng đầu tiên làm mặc định
        if (!found && rows.length > 0 && rows[0].split(',').length >= 4) {
            const cols = rows[0].split(',');
            found = { cau: cols[1].trim(), trich: cols[2].trim(), thucHanh: cols[3].trim() };
        }

        if (found) {
            document.getElementById('scriptureText').innerText = `"${found.cau}" (${found.trich})`;
            document.getElementById('scripturePractice').innerText = `👉 Thực hành sống: ${found.thucHanh}`;
        }
    } catch (e) {
        console.error("Lỗi tải Lời Chúa:", e);
    }
}

// 2. TẢI DANH SÁCH HIỆN DIỆN TỪ GOOGLE SHEET
async function fetchPresence() {
    try {
        const res = await fetch(PRESENCE_CSV);
        const text = await res.text();
        const rows = text.split('\n').slice(1);
        
        let loaded = [];
        rows.forEach(r => {
            const cols = r.split(',');
            if (cols.length >= 4 && cols[1]) {
                loaded.push({
                    id: cols[0].trim(),
                    name: cols[1].trim(),
                    role: cols[2].trim() || 'Giáo dân',
                    action: cols[3] ? cols[3].trim() : null,
                    // Phân bổ vị trí ngẫu nhiên quanh khuôn viên nhà thờ
                    x: Math.floor(Math.random() * (760 - 200)) + 200,
                    y: Math.floor(Math.random() * (500 - 320)) + 320
                });
            }
        });

        otherAvatars = loaded.filter(u => u.id !== myAvatar.id);
    } catch (e) {
        console.error("Lỗi tải hiện diện:", e);
    }
}

// 3. THAO TÁC BƯỚC VÀO VÀ RA VỀ
function joinRoom() {
    const inputName = document.getElementById('inputName').value.trim();
    if (!inputName) {
        alert("Vui lòng nhập Tên hiển thị / Tên thánh của bạn!");
        return;
    }
    myAvatar.name = inputName;
    myAvatar.role = document.getElementById('selectRole').value;
    myAvatar.joined = true;

    // Random vị trí xuất hiện ban đầu
    myAvatar.x = Math.floor(Math.random() * (700 - 260)) + 260;
    myAvatar.y = Math.floor(Math.random() * (480 - 360)) + 360;
    myAvatar.targetX = myAvatar.x;
    myAvatar.targetY = myAvatar.y;

    document.getElementById('joinModal').style.display = 'none';
}

function leaveRoom() {
    myAvatar.joined = false;
    myAvatar.action = null;
    document.getElementById('joinModal').style.display = 'flex';
}

function triggerAction(actionText) {
    if (!myAvatar.joined) return;
    myAvatar.action = actionText;
    myAvatar.actionTimer = 240;

    if (actionText.includes('Thắp nến')) {
        candles.push({ x: myAvatar.x, y: myAvatar.y - 12 });
    }
}

// 4. DI CHUYỂN BẰNG CLICK CHUỘT / CHẠM MÀN HÌNH
canvas.addEventListener('click', (e) => {
    if (!myAvatar.joined) return;
    const rect = canvas.getBoundingClientRect();
    myAvatar.targetX = e.clientX - rect.left;
    myAvatar.targetY = e.clientY - rect.top;
});

// 5. RENDER ĐỒ HỌA KHÔNG GIAN 2D
function getRoleIcon(role) {
    switch(role) {
        case 'Linh mục': return '✝️';
        case 'Tu sĩ nam': return '⛪';
        case 'Tu sĩ nữ': return '🕊️';
        default: return '🕯️';
    }
}

function update() {
    if (!myAvatar.joined) return;
    const dx = myAvatar.targetX - myAvatar.x;
    const dy = myAvatar.targetY - myAvatar.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 2) {
        myAvatar.x += (dx / dist) * myAvatar.speed;
        myAvatar.y += (dy / dist) * myAvatar.speed;
    }

    if (myAvatar.actionTimer > 0) {
        myAvatar.actionTimer--;
        if (myAvatar.actionTimer === 0) myAvatar.action = null;
    }
}

function drawChurch() {
    // Sàn nhà thờ
    ctx.fillStyle = '#2b303c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Thảm đỏ cung thánh
    ctx.fillStyle = '#bf616a';
    ctx.fillRect(430, 140, 100, 400);

    // Bục Cung Thánh & Bàn Thờ
    ctx.fillStyle = '#3b4252';
    ctx.fillRect(280, 70, 400, 90);
    ctx.fillStyle = '#d8dee9';
    ctx.fillRect(400, 95, 160, 35);
    ctx.fillStyle = '#ebcb8b';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✝ CUNG THÁNH - NHÀ THỜ CHA TAM', 480, 117);

    // Tượng Đức Mẹ bên trái
    ctx.beginPath();
    ctx.arc(140, 130, 22, 0, Math.PI * 2);
    ctx.fillStyle = '#81a1c1';
    ctx.fill();
    ctx.fillStyle = '#eceff4';
    ctx.fillText('Đức Mẹ', 140, 168);

    // Vẽ nến
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

    // Biểu tượng Avatar theo Bậc sống
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(getRoleIcon(p.role), 0, 6);

    // Tên hiển thị
    ctx.fillStyle = isMe ? '#88c0d0' : '#eceff4';
    ctx.font = '11px sans-serif';
    ctx.fillText(p.name, 0, -16);

    // Hành động tâm linh
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

    otherAvatars.forEach(p => drawAvatar(p, false));
    if (myAvatar.joined) drawAvatar(myAvatar, true);
}

function loop() {
    update();
    render();
    requestAnimationFrame(loop);
}

// Khởi chạy hệ thống
fetchScripture();
fetchPresence();
setInterval(fetchPresence, 10000); // Tự động đồng bộ mỗi 10 giây
loop();
