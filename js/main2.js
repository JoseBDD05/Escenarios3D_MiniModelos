import * as THREE from 'three';

import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { MapControls } from 'three/addons/controls/MapControls.js';

let camera, controls, scene, renderer;

const GROUND_Y = 0;     // nivel de suelo
const MIN_EYE = 2;      // altura mínima de la cámara sobre el suelo
const TARGET_MIN = 0.5; // evita que el target caiga por debajo del suelo

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
  camera.position.set(0, 200, -400);

  // controls
  controls = new MapControls(camera, renderer.domElement);

  // controls.addEventListener('change', render); // (no necesario con animation loop)
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

  controls.screenSpacePanning = false;

  controls.minDistance = 100;
  controls.maxDistance = 500;

  // evita “mirar” bajo el horizonte
  controls.maxPolarAngle = Math.PI / 2;

  // =========================
  // world: torres tipo "city"
  // =========================

  // geometría base: cubo de 1x1x1 elevado 0.5 en Y para que "asiente" sobre y=0
  const geometry = new THREE.BoxGeometry();
  geometry.translate(0, 0.5, 0);

  // Creamos muchas torres con colores distintos
  for (let i = 0; i < 500; i++) {

    const mesh = new THREE.Mesh(
      geometry,
      // Material por torre, color en HSL (varía con altura para percepción agradable)
      new THREE.MeshPhongMaterial({
        color: colorForHeight(), // función abajo
        flatShading: true
      })
    );

    mesh.position.x = Math.random() * 1600 - 800;
    mesh.position.y = 0;
    mesh.position.z = Math.random() * 1600 - 800;

    mesh.scale.x = 20;
    mesh.scale.y = Math.random() * 80 + 10;   // altura 10..90
    mesh.scale.z = 20;

    mesh.updateMatrix();
    mesh.matrixAutoUpdate = false;

    scene.add(mesh);
  }

  // lights
  const dirLight1 = new THREE.DirectionalLight(0xffffff, 3);
  dirLight1.position.set(1, 1, 1);
  scene.add(dirLight1);

  const dirLight2 = new THREE.DirectionalLight(0x002288, 3);
  dirLight2.position.set(-1, -1, -1);
  scene.add(dirLight2);

  const ambientLight = new THREE.AmbientLight(0x555555);
  scene.add(ambientLight);

  window.addEventListener('resize', onWindowResize);

  const gui = new GUI();
  gui.add(controls, 'zoomToCursor');
  gui.add(controls, 'screenSpacePanning');
}

function colorForHeight() {
  // Paleta: tono aleatorio, saturación media/alta.
  // La luminancia la variamos ligeramente aleatoria (0.45..0.75)
  // Si quisieras ligarla a la altura real, podrías pasar la altura aquí.
  const h = Math.random();                 // 0..1
  const s = 0.55 + 0.35 * Math.random();   // 0.55..0.90
  const l = 0.45 + 0.30 * Math.random();   // 0.45..0.75
  const c = new THREE.Color();
  c.setHSL(h, s, l);
  return c;
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  controls.update(); // requerido si enableDamping = true
  clampBelowGround(); // 🚫 no bajar del suelo
  render();
}

function render() {
  renderer.render(scene, camera);
}

// ================================
// Evitar traspasar el límite abajo
// ================================
function clampBelowGround() {
  // Impide que la cámara baje de y = GROUND_Y + MIN_EYE
  if (camera.position.y < GROUND_Y + MIN_EYE) {
    camera.position.y = GROUND_Y + MIN_EYE;
  }

  // También evitamos que el target se vaya por debajo del suelo, lo que
  // podría causar que el orbit “empuje” la cámara hacia abajo
  if (controls.target.y < GROUND_Y + TARGET_MIN) {
    controls.target.y = GROUND_Y + TARGET_MIN;
  }
}
