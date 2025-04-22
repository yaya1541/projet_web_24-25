import CANNON from 'https://cdn.jsdelivr.net/npm/cannon@0.6.2/+esm';
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
import { Car } from './car.js';

// Basic Driveable Car using Cannon.js and Three.js
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);


const gridHelper = new THREE.GridHelper( 10, 10 );
scene.add( gridHelper );
const axesHelper = new THREE.AxesHelper( 10, 10 );
scene.add( axesHelper );

scene.background = new THREE.Color(0,0.2,0.5);

// Set up lights
const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(10, 20, 10);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 1024;
directionalLight.shadow.mapSize.height = 1024;
scene.add(directionalLight);

// Set up physics world
const world = new CANNON.World();
world.gravity.set(0, -9.82, 0);
world.broadphase = new CANNON.NaiveBroadphase();
world.solver.iterations = 10;

// Create ground
const groundShape = new CANNON.Plane();
const groundBody = new CANNON.Body({ mass: 0 });
groundBody.addShape(groundShape);
groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
world.addBody(groundBody);

// Create ground visual
const groundGeometry = new THREE.PlaneGeometry(100, 100);
const groundMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x999999,
    roughness: 0.8,
    metalness: 0.2
});
const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
groundMesh.rotation.x = -Math.PI / 2;
groundMesh.receiveShadow = true;
scene.add(groundMesh);

// Set up keyboard controls
const keysPressed = {};
document.addEventListener('keydown', (event) => {
    keysPressed[event.key.toLowerCase()] = true;
});

document.addEventListener('keyup', (event) => {
    keysPressed[event.key.toLowerCase()] = false;
});

let car = new Car(world,scene);

// Camera setup
camera.position.set(0, 10, -10);
camera.lookAt(car.carMesh.position);

// At the beginning of your script, get or create a DOM element for speed display
const speedDisplay = document.getElementById('speedDisplay') || (() => {
  const div = document.createElement('div');
  div.id = 'speedDisplay';
  div.style.position = 'absolute';
  div.style.bottom = '20px';
  div.style.right = '20px';
  div.style.background = 'rgba(0,0,0,0.5)';
  div.style.color = 'white';
  div.style.padding = '10px';
  div.style.fontFamily = 'Arial, sans-serif';
  div.style.borderRadius = '5px';
  document.body.appendChild(div);
  return div;
})();

// Animation loop
let lastTime;
function animate(time) {
    const dt = lastTime ? (time - lastTime) / 1000 : 0;
    lastTime = time;
    
    requestAnimationFrame(animate);
    
    car.control(keysPressed);

    // Update physics
    world.step(dt);
    
    car.update();

    // Then in your animation loop:
    speedDisplay.textContent = `Speed: ${car.speed()} km/h`;
    
    // Update camera to follow car
    const cameraOffset = new THREE.Vector3();
    cameraOffset.set(0, 5, -10);
    cameraOffset.applyQuaternion(car.carMesh.quaternion);
    
    camera.position.copy(car.carPosition()).add(cameraOffset);
    camera.lookAt(car.carPosition());
    
    renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start animation loop
animate();