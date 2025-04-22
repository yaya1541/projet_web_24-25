import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
import CANNON from 'https://cdn.jsdelivr.net/npm/cannon@0.6.2/+esm';

// Main application setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

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

scene.background = new THREE.Color(0,0.2,0.5);

// Camera setup
camera.position.set(0, 100, 0);
camera.rotateX(-Math.PI/2)

const pathNodes = [];
const pathPoints = [];
const N = 10;
let currentPosition = new THREE.Vector3(0,0,0);
for (let index = 0; index < N; index++) {
    const node = new THREE.Mesh(
        new THREE.SphereGeometry(2),
        new THREE.MeshBasicMaterial({color:0xff0000+index*50})
    )
    if (index != 0){
        node.position.copy(currentPosition);
        let rd = Math.random()*25+5;
        let rr = Math.random()*Math.PI/2 + Math.PI/N*index*1.5;
        node.translateOnAxis(
            new THREE.Vector3(
                Math.cos(rr),
                0,
                Math.sin(rr)
            ),
            rd
        )
    }
    currentPosition = node.position;
    pathNodes.push(node);
    pathPoints.push(new THREE.Vector2(currentPosition.x,currentPosition.z));
    scene.add(node);
    
}
console.log(currentPosition);

console.log(pathPoints);

const path = new THREE.Path();
path.splineThru(pathPoints);
const points = path.getPoints();
console.log(points);

const geometry = new THREE.BufferGeometry().setFromPoints( points );
const material = new THREE.LineBasicMaterial( { color: 0x0044ff } );
const line = new THREE.Line( geometry, material );
line.position.y = 5;
line.rotateX(Math.PI/2);
scene.add( line );
// Animation loop
let lastTime;
function animate(time) {
    const dt = lastTime ? (time - lastTime) / 1000 : 0;
    lastTime = time;
    
    requestAnimationFrame(animate);
    
    // Update physics
    world.step(dt);
    
    renderer.render(scene, camera);
}

animate();