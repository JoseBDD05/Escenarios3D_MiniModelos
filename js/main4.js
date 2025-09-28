import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

let camera, scene, renderer, controls;
const objects = [];
const colliders = []; // AABBs para colisión

let raycaster;

let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;

let prevTime = performance.now();
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

init();

function init() {

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 1000);
    camera.position.y = 10;

    scene = new THREE.Scene();

    // === Fondo del cielo (cielo.jpg) ===
    const loader = new THREE.TextureLoader();
    const skyTex = loader.load('textures/pastizales/cielo.jpg');
    skyTex.colorSpace = THREE.SRGBColorSpace;
    scene.background = skyTex;

    scene.fog = new THREE.Fog(0xffffff, 0, 750);

    // Luces
    const hemi = new THREE.HemisphereLight(0xeeeeff, 0x777788, 1.5);
    hemi.position.set(0.5, 1, 0.75);
    scene.add(hemi);

    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(50, 100, 20);
    scene.add(dir);

    controls = new PointerLockControls(camera, document.body);

    const blocker = document.getElementById('blocker');
    const instructions = document.getElementById('instructions');

    instructions.addEventListener('click', () => controls.lock());
    controls.addEventListener('lock', () => { instructions.style.display = 'none'; blocker.style.display = 'none'; });
    controls.addEventListener('unlock', () => { blocker.style.display = 'block'; instructions.style.display = ''; });

    scene.add(controls.object);

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    raycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, 10);

    // === FLOOR con textura pasto.jpg ===
    const floorGeometry = new THREE.PlaneGeometry(2000, 2000, 100, 100);
    floorGeometry.rotateX(-Math.PI / 2);

    const grassTexture = loader.load('textures/pastizales/pasto.jpg');
    grassTexture.wrapS = grassTexture.wrapT = THREE.RepeatWrapping;
    grassTexture.repeat.set(20, 20);
    grassTexture.colorSpace = THREE.SRGBColorSpace;

    const floorMaterial = new THREE.MeshStandardMaterial({ map: grassTexture });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.receiveShadow = true;
    scene.add(floor);

    // === OBJETOS (cubos verde–azul) + colisión ===
    const boxGeometry = new THREE.BoxGeometry(20, 20, 20);

    for (let i = 0; i < 500; i++) {
        // HSL en rango verde–azul (≈ 0.40 a 0.60)
        const hue = Math.random() * 0.2 + 0.4;
        const sat = 0.8;
        const light = Math.random() * 0.3 + 0.45;

        const boxMaterial = new THREE.MeshPhongMaterial({ flatShading: true });
        boxMaterial.color.setHSL(hue, sat, light, THREE.SRGBColorSpace);

        const box = new THREE.Mesh(boxGeometry, boxMaterial);
        box.position.x = Math.floor(Math.random() * 20 - 10) * 20;
        box.position.y = Math.floor(Math.random() * 20) * 20 + 10;
        box.position.z = Math.floor(Math.random() * 20 - 10) * 20;

        scene.add(box);
        objects.push(box);

        // AABB estático para colisión
        const aabb = new THREE.Box3().setFromObject(box);
        colliders.push(aabb);
    }

    // === RENDER ===
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setAnimationLoop(animate);
    document.body.appendChild(renderer.domElement);

    window.addEventListener('resize', onWindowResize);
}

function onKeyDown(event) {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW': moveForward = true; break;
        case 'ArrowLeft':
        case 'KeyA': moveLeft = true; break;
        case 'ArrowDown':
        case 'KeyS': moveBackward = true; break;
        case 'ArrowRight':
        case 'KeyD': moveRight = true; break;
        case 'Space':
            if (canJump === true) velocity.y += 350;
            canJump = false;
            break;
    }
}

function onKeyUp(event) {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW': moveForward = false; break;
        case 'ArrowLeft':
        case 'KeyA': moveLeft = false; break;
        case 'ArrowDown':
        case 'KeyS': moveBackward = false; break;
        case 'ArrowRight':
        case 'KeyD': moveRight = false; break;
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- Colisión: esfera del "jugador" contra AABBs ---
const playerRadius = 10; // ajusta si lo sientes ancho/angosto
const playerSphere = new THREE.Sphere(new THREE.Vector3(), playerRadius);

function collidesAt(positionVec3) {
    playerSphere.center.copy(positionVec3);
    for (let i = 0; i < colliders.length; i++) {
        if (colliders[i].intersectsSphere(playerSphere)) return true;
    }
    return false;
}

function animate() {
    const time = performance.now();

    if (controls.isLocked === true) {
        // Raycast "hacia abajo" para salto en plataformas
        raycaster.ray.origin.copy(controls.object.position);
        raycaster.ray.origin.y -= 10;

        const intersections = raycaster.intersectObjects(objects, false);
        const onObject = intersections.length > 0;

        const delta = (time - prevTime) / 1000;

        // amortiguación
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
        velocity.y -= 9.8 * 100.0 * delta; // gravedad

        // dirección WASD (valores -1, 0, 1)
        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();

        if (moveForward || moveBackward) velocity.z -= direction.z * 400.0 * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * 400.0 * delta;

        if (onObject === true) {
            velocity.y = Math.max(0, velocity.y);
            canJump = true;
        }

        // ====== Movimiento relativo a la cámara con colisiones ======
        // displacement a aplicar (signos como en el ejemplo original)
        const dispRight = -velocity.x * delta;   // + → derecha
        const dispFwd   = -velocity.z * delta;   // + → adelante

        // Bases ortogonales en el plano XZ
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();

        const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();

        // Estado actual y candidato
        const current = controls.object.position.clone();
        let candidate = current.clone();

        // 1) Mover a lo largo de "right"
        if (dispRight !== 0) {
            candidate = current.clone().addScaledVector(right, dispRight);
            if (!collidesAt(candidate)) {
                current.copy(candidate);
            } else {
                velocity.x = 0;
            }
        }

        // 2) Mover a lo largo de "forward"
        if (dispFwd !== 0) {
            candidate = current.clone().addScaledVector(forward, dispFwd);
            if (!collidesAt(candidate)) {
                current.copy(candidate);
            } else {
                velocity.z = 0;
            }
        }

        // Aplicar resultado en XZ
        controls.object.position.x = current.x;
        controls.object.position.z = current.z;

        // Movimiento vertical (gravedad/salto)
        controls.object.position.y += (velocity.y * delta);

        if (controls.object.position.y < 10) {
            velocity.y = 0;
            controls.object.position.y = 10;
            canJump = true;
        }
    }

    prevTime = time;
    renderer.render(scene, camera);
}
