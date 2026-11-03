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
    x: 0,
    y: 0,
    z: 4,
    targetX: 0,
    targetZ: 4,
    speed: 0.1,
    action: null,
    joined: false
};

let onlineUsers = {};
let userPrayers = [];

const ZONES = {
    'thanh-the': { x: 0, z: -4 },
    'duc-me': { x: -4, z: -4 },
    'carlo': { x: 2, z: -4 },
    'giuse': { x: 4, z: -4 },
    'tu-dao': { x: 6, z: -4 },
    'long-nha-tho': { x: 0, z: 4 }
};

// === KHỞI TẠO THREE.JS 3D SCENE ===
const container = document.getElementById('canvasContainer');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1d24);
scene.fog = new THREE.FogExp2(0x1a1d24, 0.035);

const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
camera.position.set(0, 12, 14);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

// Ánh sáng
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xfff5e6, 0.8);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
scene.add(dirLight);

// Dựng Không gian Nhà Thờ 3D
function buildChurch3D() {
    const floorGeo = new THREE.BoxGeometry(14, 0.5, 12);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x2b303c, roughness: 0.8 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -0.25;
    scene.add(floor);

    const carpetGeo = new THREE.BoxGeometry(2.5, 0.52, 11.5);
    const carpetMat = new THREE.MeshStandardMaterial({ color: 0xbf616a });
    const carpet = new THREE.Mesh(carpetGeo, carpetMat);
    carpet.position.set(0, -0.2, 0.25);
    scene.add(carpet);

    const altarGeo = new THREE.BoxGeometry(3.5, 1.2, 1.2);
    const altarMat = new THREE.MeshStandardMaterial({ color: 0x3b4252 });
    const mainAltar = new THREE.Mesh(altarGeo, altarMat);
    mainAltar.position.set(0, 0.6, -4.5);
    scene.add(mainAltar);

    createShrine(-4, -4.5, 1.5, 1.2, 1.2, 0x4c566a);
    createShrine(4, -4.5, 1.5, 1.2, 1.2, 0x4c566a);
}

function createShrine(x, z, w, h, d, color) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({ color: color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, h/2, z);
    scene.add(mesh);
}

buildChurch3D();

// Tạo Avatar 3D
const avatarMeshes = {};

function updateAvatarMesh(id, userData, isMe) {
    let meshGroup = avatarMeshes[id];
    if (!meshGroup) {
        meshGroup = new THREE.Group();

        const bodyGeo = new THREE.CylinderGeometry(0.3, 0.3, 1, 16);
        const bodyMat = new THREE.MeshStandardMaterial({ color: isMe ? 0x88c0d0 : 0xeceff4 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.5;
        meshGroup.add(body);

        const canvasLabel = document.createElement('canvas');
        const ctxLabel = canvasLabel.getContext('2d');
        canvasLabel.width = 256;
        canvasLabel.height = 64;
        ctxLabel.fillStyle = isMe ? '#88c0d0' : '#eceff4';
        ctxLabel.font = 'bold 22px sans-serif';
        ctxLabel.textAlign = 'center';
        ctxLabel.fillText(userData.name || 'Giáo dân', 128, 40);

        const texture = new THREE.CanvasTexture(canvasLabel);
        const spriteMat = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(1.8, 0.45, 1);
        sprite.position.y = 1.4;
        meshGroup.add(sprite);

        scene.add(meshGroup);
        avatarMeshes[id] = meshGroup;
    }

    // Di chuyển mượt mà
    meshGroup.position.x += (userData.x - meshGroup.position.x) * 0.1;
    meshGroup.position.z += (userData.z - meshGroup.position.z) * 0.1;
}

// 1. TẢI LỜI CHÚA
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
            document.getElementById('scripturePractice').innerText = `👉 Thực hành: ${found.thucHanh}`;
        }
    } catch (e) { console.error(e); }
}

// 2. TẢI Ý NGUYỆN
async function fetchPrayersFromSheet() {
    try {
        const res = await fetch(PRAYER_CSV);
        const text = await res.text();
        const rows = parseCSV(text).slice(1);
        let list = [];
        for (let i = rows.length - 1; i >= 0 && list.length < 5; i--) {
            let r = rows[i];
            if (r.length >= 3) {
                let name = r[1] ? r[1].replace(/^"|"$/g, '') : "Giáo dân";
                let content = r[2] ? r[2].replace(/^"|"$/g, '') : r[0];
                if (content) list.push(`${name}: ${content}`);
            }
        }
        if (list.length > 0) {
            userPrayers = list;
            updateTicker();
        }
    } catch (e) { console.error(e); }
}

function listenRealtimeData() {
    onValue(ref(db, 'rooms/phongcaunguyen/users'), (snapshot) => {
        onlineUsers = snapshot.val() || {};
    });
    onValue(ref(db, 'rooms/phongcaunguyen/prayers'), (snapshot) => {
        const data = snapshot.val();
        if (data) {
            let list = Object.values(data).reverse().slice(0, 5);
            userPrayers = list.map(p => `${p.name}: ${p.text}`);
            updateTicker();
        }
    });
}

// 3. THAM GIA & RỜI PHÒNG
window.joinRoom = function() {
    const inputName = document.getElementById('inputName').value.trim();
    if (!inputName) { alert("Vui lòng nhập Tên Thánh + Họ tên!"); return; }
    myAvatar.name = inputName;
    myAvatar.role = document.getElementById('selectRole').value;
    myAvatar.joined = true;

    myAvatar.x = (Math.random() - 0.5) * 4;
    myAvatar.z = 3 + Math.random() * 2;
    myAvatar.targetX = myAvatar.x;
    myAvatar.targetZ = myAvatar.z;

    document.getElementById('joinModal').style.display = 'none';

    const userRef = ref(db, 'rooms/phongcaunguyen/users/' + myId);
    set(userRef, myAvatar);
    onDisconnect(userRef).remove();
    listenRealtimeData();
}

window.leaveRoom = function() {
    if (myAvatar.joined) remove(ref(db, 'rooms/phongcaunguyen/users/' + myId));
    myAvatar.joined = false;
    document.getElementById('joinModal').style.display = 'flex';
}

window.triggerAction = function(actionText, zoneKey = null) {
    if (!myAvatar.joined) return;
    myAvatar.action = actionText;
    if (zoneKey && ZONES[zoneKey]) {
        myAvatar.targetX = ZONES[zoneKey].x;
        myAvatar.targetZ = ZONES[zoneKey].z;
    }
    fbUpdate(ref(db, 'rooms/phongcaunguyen/users/' + myId), { 
        action: actionText, targetX: myAvatar.targetX, targetZ: myAvatar.targetZ 
    });
    setTimeout(() => {
        if (myAvatar.joined) fbUpdate(ref(db, 'rooms/phongcaunguyen/users/' + myId), { action: null });
    }, 8000);
}

// 4. SỔ TAY Ý NGUYỆN & LẦN CHUỖI MÂN CÔI
window.openPrayerInputModal = () => document.getElementById('prayerModal').style.display = 'flex';
window.closePrayerInputModal = () => document.getElementById('prayerModal').style.display = 'none';

window.submitPrayer = function() {
    const text = document.getElementById('inputPrayerText').value.trim();
    if (!text) { alert("Vui lòng nhập nội dung!"); return; }
    push(ref(db, 'rooms/phongcaunguyen/prayers'), {
        id: myId, name: myAvatar.name, role: myAvatar.role, text: text, timestamp: Date.now()
    });
    alert("Đã lưu ý nguyện thành công!");
    document.getElementById('inputPrayerText').value = '';
    closePrayerInputModal();
}

let currentRosaryStep = 0;
const totalRosaryBeads = 10;

window.openRosaryModal = function() {
    if (!myAvatar.joined) { alert("Vui lòng vào phòng trước!"); return; }
    triggerAction('📿 Đang lần chuỗi Mân Côi', 'duc-me');
    currentRosaryStep = 0;
    renderRosaryBeads();
    document.getElementById('rosaryModal').style.display = 'flex';
}

window.closeRosaryModal = function() {
    document.getElementById('rosaryModal').style.display = 'none';
    triggerAction('📿 Đã hoàn thành kinh Mân Côi');
}

function renderRosaryBeads() {
    const path = document.getElementById('rosaryPath');
    if (!path) return;
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
    const counter = document.getElementById('rosaryCounter');
    if (counter) counter.innerText = `Đã đọc: ${currentRosaryStep} / ${totalRosaryBeads} kinh`;
}

function updateTicker() {
    const track = document.getElementById('tickerTrack');
    if (track) track.innerHTML = `<span>${userPrayers.join("   •   ")}</span>`;
}

// 5. RAYCASTER CLICK CHUỘT DI CHUYỂN TRONG 3D
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

window.addEventListener('click', (e) => {
    if (!myAvatar.joined) return;
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const targetPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, targetPoint);

    if (targetPoint) {
        myAvatar.targetX = Math.max(-6, Math.min(6, targetPoint.x));
        myAvatar.targetZ = Math.max(-5, Math.min(5, targetPoint.z));
        fbUpdate(ref(db, 'rooms/phongcaunguyen/users/' + myId), {
            targetX: myAvatar.targetX, targetZ: myAvatar.targetZ
        });
    }
});

// 6. VÒNG LẶP RENDER 3D
function animate() {
    requestAnimationFrame(animate);

    if (myAvatar.joined) {
        let dx = myAvatar.targetX - myAvatar.x;
        let dz = myAvatar.targetZ - myAvatar.z;
        if (Math.hypot(dx, dz) > 0.1) {
            myAvatar.x += dx * myAvatar.speed;
            myAvatar.z += dz * myAvatar.speed;
            fbUpdate(ref(db, 'rooms/phongcaunguyen/users/' + myId), { x: myAvatar.x, z: myAvatar.z });
        }
    }

    // Cập nhật vị trí avatar online
    for (let id in onlineUsers) {
        updateAvatarMesh(id, onlineUsers[id], id === myId);
    }

    renderer.render(scene, camera);
}

fetchScripture();
fetchPrayersFromSheet();
animate();

// Âm thanh nền
let isAudioPlaying = false;
window.toggleAudio = function() {
    const audio = document.getElementById('bgAudio');
    const btn = document.getElementById('audioToggleBtn');
    if (!audio) return;
    if (isAudioPlaying) {
        audio.pause(); isAudioPlaying = false; btn.innerText = '🎵 Bật Nhạc';
    } else {
        audio.play().then(() => { isAudioPlaying = true; btn.innerText = '🎵 Tắt Nhạc'; }).catch(() => alert("Click tương tác trang trước!"));
    }
};
