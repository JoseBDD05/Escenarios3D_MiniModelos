import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let camera, controls, scene, renderer;

// --- Movimiento / colisiones ---
const keys = { ArrowUp:false, ArrowDown:false, ArrowLeft:false, ArrowRight:false, KeyW:false, KeyA:false, KeyS:false, KeyD:false, ShiftLeft:false };
const playerHeight = 10;      // altura de “cámara-jugador” sobre el suelo
const moveSpeed = 1.6;        // velocidad base
const sprintMult = 1.8;       // multiplicador con Shift
const playerRadius = 3.0;     // “radio” del jugador para la colisión
const colliders = [];         // { x, z, r } por pirámide

init();

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xcccccc);
    scene.fog = new THREE.FogExp2(0xcccccc, 0.002);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setAnimationLoop(animate);
    document.body.appendChild(renderer.domElement);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1000);
    camera.position.set(60, playerHeight, 60);

    // controls (seguimos permitiendo orbit, pero el movimiento es con teclas)
    controls = new OrbitControls(camera, renderer.domElement);
    controls.listenToKeyEvents(window);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 30;
    controls.maxDistance = 500;
    controls.maxPolarAngle = Math.PI / 2;
    controls.target.set(0, playerHeight, 0);

    // === Texturas ===
    const loader = new THREE.TextureLoader();
    const tex1 = loader.load('textures/piramide/piramidetext.jpg');
    const tex2 = loader.load('textures/piramide/piramidetext2.jpg');
    const sueloTex = loader.load('textures/piramide/textdesierto.jpg');

    sueloTex.wrapS = THREE.RepeatWrapping;
    sueloTex.wrapT = THREE.RepeatWrapping;
    sueloTex.repeat.set(20, 20);
    sueloTex.anisotropy = 8;

    // === Suelo ===
    const sueloGeo = new THREE.PlaneGeometry(2000, 2000);
    const sueloMat = new THREE.MeshPhongMaterial({ map: sueloTex });
    const suelo = new THREE.Mesh(sueloGeo, sueloMat);
    suelo.rotation.x = -Math.PI / 2;
    suelo.position.y = 0;
    scene.add(suelo);

    // === Pirámides con base más ancha ===
    // radio base (más ancho), altura igual
    const baseRadius = 16; // antes 10 → ahora 16 se ven más robustas
    const height = 30;
    const geometry = new THREE.ConeGeometry(baseRadius, height, 4, 1); // 4 lados = pirámide “cuadrada”
    const rngMat = () =>
        new THREE.MeshPhongMaterial({
            map: Math.random() > 0.5 ? tex1 : tex2,
            flatShading: true
        });

    for (let i = 0; i < 500; i++) {
        const mat = rngMat();
        const mesh = new THREE.Mesh(geometry, mat);
        mesh.position.x = Math.random() * 1600 - 800;
        mesh.position.y = height / 2; // apoyada en el suelo (el cono apunta hacia arriba desde su centro)
        mesh.position.z = Math.random() * 1600 - 800;
        mesh.rotation.y = Math.random() * Math.PI; // giro aleatorio para variar
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        scene.add(mesh);

        // Colisionador: usa un radio cercano al de la base + margen
        colliders.push({ x: mesh.position.x, z: mesh.position.z, r: baseRadius + 2 });
    }

    // === Luces ===
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 3);
    dirLight1.position.set(1, 1, 1);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x002288, 3);
    dirLight2.position.set(-1, -1, -1);
    scene.add(dirLight2);

    const ambientLight = new THREE.AmbientLight(0x555555);
    scene.add(ambientLight);

    // input
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('keydown', (e) => { if (e.code in keys) keys[e.code] = true; });
    window.addEventListener('keyup',   (e) => { if (e.code in keys) keys[e.code] = false; });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Aplica colisión circular en XZ contra todas las pirámides
function resolveCollisionsXZ(pos) {
    // pos: THREE.Vector3 (se usa x,z)
    for (let i = 0; i < colliders.length; i++) {
        const c = colliders[i];
        const dx = pos.x - c.x;
        const dz = pos.z - c.z;
        const distSq = dx * dx + dz * dz;
        const minDist = c.r + playerRadius;

        if (distSq < minDist * minDist) {
            const dist = Math.sqrt(distSq) || 0.0001;
            // empujar hacia afuera hasta el borde
            const nx = dx / dist;
            const nz = dz / dist;
            pos.x = c.x + nx * minDist;
            pos.z = c.z + nz * minDist;
        }
    }
    return pos;
}

function animate() {
    // Movimiento con teclas: WASD / flechas
    const forward = (keys.KeyW || keys.ArrowUp) ? 1 : (keys.KeyS || keys.ArrowDown) ? -1 : 0;
    const strafe  = (keys.KeyD || keys.ArrowRight) ? 1 : (keys.KeyA || keys.ArrowLeft) ? -1 : 0;
    const speed = (keys.ShiftLeft ? moveSpeed * sprintMult : moveSpeed);

    if (forward !== 0 || strafe !== 0) {
        // Direcciones en XZ a partir de la cámara
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);      // dirección vista
        dir.y = 0; dir.normalize();         // proyectada al plano XZ

        const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();

        const move = new THREE.Vector3();
        move.addScaledVector(dir,  forward * speed);
        move.addScaledVector(right, strafe  * speed);

        // Proponemos nuevo punto para camera y target (se mueven juntos)
        const nextCam = camera.position.clone().add(move);
        const nextTgt = controls.target.clone().add(move);

        // Colisión: resolvemos para la cámara (XZ) y aplicamos el mismo “corrección” al target
        const beforeXZ = new THREE.Vector2(camera.position.x, camera.position.z);
        const corrected = resolveCollisionsXZ(nextCam.clone());
        const afterXZ = new THREE.Vector2(corrected.x, corrected.z);
        const correction = new THREE.Vector2().subVectors(afterXZ, beforeXZ);

        camera.position.x = corrected.x;
        camera.position.z = corrected.z;
        controls.target.x += correction.x;
        controls.target.z += correction.y;

        // Mantener altura "a pie de suelo"
        camera.position.y = playerHeight;
        controls.target.y = playerHeight;
    }

    controls.update(); // damping
    render();
}

function render() {
    renderer.render(scene, camera);
}
