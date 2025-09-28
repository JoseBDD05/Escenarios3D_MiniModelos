import * as THREE from 'three';

import Stats from 'three/addons/libs/stats.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

let container, stats;
let camera, controls, scene, renderer;

const worldWidth = 128, worldDepth = 128;
const worldHalfWidth = worldWidth / 2;
const worldHalfDepth = worldDepth / 2;
const data = generateHeight(worldWidth, worldDepth);

const clock = new THREE.Clock();

// Movimiento
const keys = { ArrowUp:false, ArrowDown:false, ArrowLeft:false, ArrowRight:false,
               w:false, a:false, s:false, d:false };
const MOVE_SPEED = 400; // ajusta la velocidad

init();

function init() {

  container = document.getElementById('container');

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 20000);
  camera.position.set(0, getY(worldHalfWidth, worldHalfDepth) * 100 + 200, 500);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbfd1e5);

  // Construcción del mundo tipo voxel
  const matrix = new THREE.Matrix4();
  const pxGeometry = new THREE.PlaneGeometry(100, 100);
  pxGeometry.attributes.uv.array[1] = 0.5;
  pxGeometry.attributes.uv.array[3] = 0.5;
  pxGeometry.rotateY(Math.PI / 2);
  pxGeometry.translate(50, 0, 0);

  const nxGeometry = new THREE.PlaneGeometry(100, 100);
  nxGeometry.attributes.uv.array[1] = 0.5;
  nxGeometry.attributes.uv.array[3] = 0.5;
  nxGeometry.rotateY(- Math.PI / 2);
  nxGeometry.translate(- 50, 0, 0);

  const pyGeometry = new THREE.PlaneGeometry(100, 100);
  pyGeometry.attributes.uv.array[5] = 0.5;
  pyGeometry.attributes.uv.array[7] = 0.5;
  pyGeometry.rotateX(- Math.PI / 2);
  pyGeometry.translate(0, 50, 0);

  const pzGeometry = new THREE.PlaneGeometry(100, 100);
  pzGeometry.attributes.uv.array[1] = 0.5;
  pzGeometry.attributes.uv.array[3] = 0.5;
  pzGeometry.translate(0, 0, 50);

  const nzGeometry = new THREE.PlaneGeometry(100, 100);
  nzGeometry.attributes.uv.array[1] = 0.5;
  nzGeometry.attributes.uv.array[3] = 0.5;
  nzGeometry.rotateY(Math.PI);
  nzGeometry.translate(0, 0, - 50);

  const geometries = [];

  for (let z = 0; z < worldDepth; z++) {
    for (let x = 0; x < worldWidth; x++) {
      const h = getY(x, z);

      matrix.makeTranslation(
        x * 100 - worldHalfWidth * 100,
        h * 100,
        z * 100 - worldHalfDepth * 100
      );

      const px = getY(x + 1, z);
      const nx = getY(x - 1, z);
      const pz = getY(x, z + 1);
      const nz = getY(x, z - 1);

      geometries.push(pyGeometry.clone().applyMatrix4(matrix));

      if ((px !== h && px !== h + 1) || x === 0) {
        geometries.push(pxGeometry.clone().applyMatrix4(matrix));
      }
      if ((nx !== h && nx !== h + 1) || x === worldWidth - 1) {
        geometries.push(nxGeometry.clone().applyMatrix4(matrix));
      }
      if ((pz !== h && pz !== h + 1) || z === worldDepth - 1) {
        geometries.push(pzGeometry.clone().applyMatrix4(matrix));
      }
      if ((nz !== h && nz !== h + 1) || z === 0) {
        geometries.push(nzGeometry.clone().applyMatrix4(matrix));
      }
    }
  }

  const geometry = BufferGeometryUtils.mergeGeometries(geometries);
  geometry.computeBoundingSphere();

  const texture = new THREE.TextureLoader().load('textures/minecraft/atlas.png');
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;

  const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ map: texture, side: THREE.DoubleSide }));
  scene.add(mesh);

  const ambientLight = new THREE.AmbientLight(0xeeeeee, 3);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 12);
  directionalLight.position.set(1, 1, 0.5).normalize();
  scene.add(directionalLight);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setAnimationLoop(animate);
  container.appendChild(renderer.domElement);

  // OrbitControls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.screenSpacePanning = false;
  controls.maxPolarAngle = Math.PI / 2;
  controls.target.set(0, 0, 0);

  stats = new Stats();
  container.appendChild(stats.dom);

  window.addEventListener('resize', onWindowResize);

  // Eventos de teclado
  window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = true;
    if (keys.hasOwnProperty(e.code)) keys[e.code] = true;
  });
  window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = false;
    if (keys.hasOwnProperty(e.code)) keys[e.code] = false;
  });
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// === Generación procedural ===
function generateHeight(width, height) {
  const data = [], perlin = new ImprovedNoise(),
    size = width * height, z = Math.random() * 100;
  let quality = 2;
  for (let j = 0; j < 4; j++) {
    if (j === 0) for (let i = 0; i < size; i++) data[i] = 0;
    for (let i = 0; i < size; i++) {
      const x = i % width, y = (i / width) | 0;
      data[i] += perlin.noise(x / quality, y / quality, z) * quality;
    }
    quality *= 4;
  }
  return data;
}

function getY(x, z) {
  return (data[x + z * worldWidth] * 0.15) | 0;
}

// === Movimiento manual (flechas/WASD) ===
function moveCamera(delta) {
  const dir = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();

  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  right.crossVectors(forward, camera.up).normalize();

  if (keys.w || keys.ArrowUp) dir.add(forward);
  if (keys.s || keys.ArrowDown) dir.sub(forward);
  if (keys.a || keys.ArrowLeft) dir.sub(right);
  if (keys.d || keys.ArrowRight) dir.add(right);

  if (dir.lengthSq() > 0) {
    dir.normalize().multiplyScalar(MOVE_SPEED * delta);
    camera.position.add(dir);
    controls.target.add(dir); // mantiene el orbit mirando donde avanzas
  }
}

// === Animación ===
function animate() {
  const delta = clock.getDelta();
  moveCamera(delta);
  controls.update();
  enforceGroundCollision();
  render();
  stats.update();
}

function render() {
  renderer.render(scene, camera);
}

// === Evitar atravesar el suelo ===
function enforceGroundCollision() {
  const x = Math.floor((camera.position.x + worldHalfWidth * 100) / 100);
  const z = Math.floor((camera.position.z + worldHalfDepth * 100) / 100);

  if (x >= 0 && x < worldWidth && z >= 0 && z < worldDepth) {
    const groundY = getY(x, z) * 100;
    const minHeight = groundY + 50;
    if (camera.position.y < minHeight) {
      camera.position.y = minHeight;
    }
  }
}

