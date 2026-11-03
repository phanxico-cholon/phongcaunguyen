import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { getDatabase, ref, set, update as fbUpdate, remove, onValue, onDisconnect, push } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCfgAZ0Pzd2W_6DkDTDNlErDAL5Uhy0NoI",
    authDomain: "phong-cau-nguyen-cha-tam.firebaseapp.com",
    databaseURL: "https://phong-cau-nguyen-cha-tam-default-rtdb.firebaseio.com",
    projectId: "phong-cau-nguyen-cha-tam",
    storageBucket: "phong-cau-nguyen-cha-tam.firebasestorage.app",
    messagingSenderId: "727510955809",
    appId: "1:727510955809:web:e91245a67e8fa7b853b060"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app, firebaseConfig.databaseURL);

let myId = 'user_' + Math.floor(Math.random() * 90000 + 10000);
let myAvatar = {
    name: 'Giáo dân',
    role: 'Giáo dân',
    x: 0, z: 3,
    targetX: 0, targetZ: 3,
    speed: 0.08,
    action: null,
    joined: false
};

let onlineUsers = {};

// === KHỞI TẠO 3D SCENE (THREE.JS) ===
const container = document.getElementById('canvasContainer');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1d24);

const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
camera.position.set(0, 7, 11);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
container.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const dirLight = new THREE.DirectionalLight(0xfff5e6, 0.9);
dirLight.position.set(5, 15, 8);
scene.add(dirLight);

// Dựng không gian nhà thờ tối giản
function buildTemple() {
    const floor = new THREE.Mesh(new THREE.BoxGeometry(14, 0.4, 12), new THREE.MeshStandardMaterial({ color: 0x2b303c }));
    floor.position.y = -0.2;
    scene.add(floor);

    const carpet = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.42, 11), new THREE.MeshStandardMaterial({ color: 0xbf616a }));
    carpet.position.set(0, -0.18, 0);
    scene.add(carpet);

    const altar = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.1, 1.2), new THREE.MeshStandardMaterial({ color: 0x3b4252 }));
    altar.position.set(0, 0.55, -4.5);
    scene.add(altar);
}
buildTemple();

// Avatar 3D
const avatarMeshes = {};
function updateAvatarMesh(id, userData, isMe) {
    let group = avatarMeshes[id];
    if (!group) {
        group = new THREE.Group();
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 1, 16), new THREE.MeshStandardMaterial({ color: isMe ? 0x88c0d0 : 0xeceff4 }));
        body.position.y = 0.5;
        group.add(body);

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 256; canvas.height = 64;
        ctx.fillStyle = '#fff'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(userData.name || 'Giáo dân', 128, 40);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas) }));
        sprite.scale.set(1.5, 0.4, 1); sprite.position.y = 1.4;
        group.add(sprite);

        scene.add(group);
        avatarMeshes[id] = group;
    }
    group.position.x += (userData.x - group.position.x) * 0.1;
    group.position.z += (userData.z - group.position.z) * 0.1;
}

// Xử lý tham gia phòng
window.joinRoom = function() {
    const inputName = document.getElementById('inputName').value.trim();
    if (!inputName) { alert("Vui lòng nhập tên!"); return; }
    myAvatar.name = inputName;
    myAvatar.role = document.getElementById('selectRole').value;
    myAvatar.joined = true;

    document.getElementById('joinModal').style.display = 'none';

    const userRef = ref(db, 'rooms/chanmi/users/' + myId);
    set(userRef, myAvatar);
    onDisconnect(userRef).remove();

    onValue(ref(db, 'rooms/chanmi/users'), (snapshot) => {
        onlineUsers = snapshot.val() || {};
        const count = Object.keys(onlineUsers).length;
        document.getElementById('onlineCount').innerText = `(${count} người đang hiệp thông)`;
    });
}

window.leaveRoom = function() {
    if (myAvatar.joined) remove(ref(db, 'rooms/chanmi/users/' + myId));
    myAvatar.joined = false;
    document.getElementById('joinModal').style.display = 'flex';
}

window.triggerAction = function(text, zone) {
    if (!myAvatar.joined) return;
    if (zone === 'thanh-the') { myAvatar.targetX = 0; myAvatar.targetZ = -3.5; }
    else if (zone === 'duc-me') { myAvatar.targetX = -3; myAvatar.targetZ = -3.5; }
    fbUpdate(ref(db, 'rooms/chanmi/users/' + myId), { targetX: myAvatar.targetX, targetZ: myAvatar.targetZ });
}

// === TƯƠNG TÁC CHUỖI HẠT MÂN CÔI 3D (GIỐNG SANSA) ===
let currentBeadIndex = 0;
const totalBeads = 10;

window.openRosaryPanel = function() {
    if (!myAvatar.joined) { alert("Vui lòng vào phòng trước!"); return; }
    currentBeadIndex = 0;
    renderChainBeads();
    document.getElementById('rosaryOverlay').style.display = 'flex';
}

function renderChainBeads() {
    const containerChain = document.getElementById('rosaryChainContainer');
    if (!containerChain) return;
    containerChain.innerHTML = '';
    for (let i = 0; i < totalBeads; i++) {
        const bead = document.createElement('div');
        bead.className = 'rosary-bead-item';
        if (i < currentBeadIndex) bead.classList.add('done');
        if (i === currentBeadIndex) bead.classList.add('active');
        bead.innerText = i + 1;
        containerChain.appendChild(bead);
    }
    document.getElementById('rosaryCurrentCount').innerText = currentBeadIndex;
}

window.nextBead = function() {
    if (currentBeadIndex < totalBeads) {
        currentBeadIndex++;
        renderChainBeads();
        if (currentBeadIndex === totalBeads) {
            setTimeout(() => {
                alert("Đã hoàn thành vòng kinh Mân Côi dâng kính Đức Mẹ!");
                document.getElementById('rosaryOverlay').style.display = 'none';
            }, 300);
        }
    }
}

window.previousBead = function() {
    if (currentBeadIndex > 0) {
        currentBeadIndex--;
        renderChainBeads();
    }
}

// Sổ ý nguyện
window.openPrayerModal = () => document.getElementById('prayerModal').style.display = 'flex';
window.closePrayerModal = () => document.getElementById('prayerModal').style.display = 'none';
window.submitPrayer = function() {
    const txt = document.getElementById('inputPrayerText').value.trim();
    if (txt) {
        push(ref(db, 'rooms/chanmi/prayers'), { name: myAvatar.name, text: txt, time: Date.now() });
        alert("Ý nguyện của bạn đã được gửi lên bàn thờ Chúa!");
        document.getElementById('inputPrayerText').value = '';
        closePrayerModal();
    }
}

// Click chuột di chuyển
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

window.addEventListener('click', (e) => {
    if (!myAvatar.joined || e.target.closest('.rosary-3d-panel') || e.target.closest('.bottom-nav')) return;
    mouse.x = (e.clientX / container.clientWidth) * 2 - 1;
    mouse.y = -(e.clientY / container.clientHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const targetPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, targetPoint);
    if (targetPoint) {
        myAvatar.targetX = Math.max(-6, Math.min(6, targetPoint.x));
        myAvatar.targetZ = Math.max(-5, Math.min(5, targetPoint.z));
        fbUpdate(ref(db, 'rooms/chanmi/users/' + myId), { targetX: myAvatar.targetX, targetZ: myAvatar.targetZ });
    }
});

// Vòng lặp Animation
function animate() {
    requestAnimationFrame(animate);
    if (myAvatar.joined) {
        let dx = myAvatar.targetX - myAvatar.x;
        let dz = myAvatar.targetZ - myAvatar.z;
        if (Math.hypot(dx, dz) > 0.1) {
            myAvatar.x += dx * myAvatar.speed;
            myAvatar.z += dz * myAvatar.speed;
            fbUpdate(ref(db, 'rooms/chanmi/users/' + myId), { x: myAvatar.x, z: myAvatar.z });
        }
    }
    for (let id in onlineUsers) {
        updateAvatarMesh(id, onlineUsers[id], id === myId);
    }
    renderer.render(scene, camera);
}
animate();

// Âm thanh
let isPlaying = false;
window.toggleAudio = function() {
    const audio = document.getElementById('bgAudio');
    if (isPlaying) { audio.pause(); isPlaying = false; }
    else { audio.play().then(() => isPlaying = true).catch(() => alert("Cần tương tác trang trước!")); }
};
