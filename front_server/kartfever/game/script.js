// Fixed client code with proper car updates
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
import * as defaults from 'https://cdn.jsdelivr.net/npm/cannon@0.6.2/+esm';
import { Circuit } from 'https://localhost:3000/lib/circuit.js';
import { Car } from 'https://localhost:3000/lib/car.js';
import { handleOtherCarUpdate, handlePlayerCarUpdate } from './hendleUpdate.js';

const CANNON = defaults.default;

//
// INIT
//
const ws = new WebSocket('wss://localhost:3000/game/kartfever');

export const cars = {};
// Basic Driveable Car using Cannon.js and Three.js
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
    75,
    globalThis.innerWidth / globalThis.innerHeight,
    0.1,
    400,
);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(globalThis.innerWidth, globalThis.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// Setup scene
const gridHelper = new THREE.GridHelper(1000, 1000);
//scene.add(gridHelper);
const axesHelper = new THREE.AxesHelper(100, 100);
scene.add(axesHelper);
scene.background = new THREE.Color(0, 0.2, 0.5);

// Set up lights
const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(10, 20, 10);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 1024;
directionalLight.shadow.mapSize.height = 1024;
scene.add(directionalLight);
//
//
//



// Camera setup
camera.position.y = 50;
camera.position.z = 100;
camera.rotateX(-Math.PI / 6);

// Create physics world for client-side prediction
const physicsWorld = new CANNON.World();
physicsWorld.gravity.set(0, -9.82, 0);
physicsWorld.broadphase = new CANNON.NaiveBroadphase();
physicsWorld.solver.iterations = 10;

// Create materials for prediction
const carMaterial = new CANNON.Material('car');
const roadMaterial = new CANNON.Material('road');
const carRoadContactMaterial = new CANNON.ContactMaterial(
    carMaterial,
    roadMaterial, {
        friction: 0.5,
        restitution: 0.3,
        contactEquationStiffness: 1e8,
        contactEquationRelaxation: 3,
    },
);
physicsWorld.addContactMaterial(carRoadContactMaterial);

const testBody = new CANNON.Body({
    mass : 5,
    shape : new CANNON.Box(new CANNON.Vec3(2,3,4))
});
testBody.position.y = 100;
//physicsWorld.addBody(testBody);

let clientCircuit = null;
let isPlaying = false;
let username = null;
let lastServerTimestamp = 0;
const serverUpdateRate = 100; // Expected server update rate in ms

// Animation loop
let lastTime;
// CHANGE 2: Improve the animation loop to better apply inputs
function animate(time) {
    const deltaTime = lastTime ? (time - lastTime) / 1000 : 0;
    lastTime = time;
    //console.log(deltaTime,testBody.position.y);
    //console.log(cars);
    
    // Run client-side physics for prediction
    if (isPlaying && username && cars[username]) {
        // CHANGED: Always apply control regardless of key status for smoother handling
        cars[username].control(keysPressed, deltaTime);
        
        // Step physics world
        physicsWorld.step(deltaTime);
        
        // Update local car position
        cars[username].update();
        
        // Update camera position relative to player car
        updateCameraPosition(deltaTime);
        
        // Predict other cars' positions based on their velocity and time since last update
        Object.keys(cars).forEach(id => {
            if (id !== username && cars[id]) {
                // Apply prediction for other cars
                updateOtherCar(id, deltaTime);
            }
        });
    }
    
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

// Improve camera follow logic
function updateCameraPosition(deltaTime) {
    if (!cars[username]) return;
    
    // Get player car position and rotation
    const carPos = cars[username].carPosition();
    const carQuat = cars[username].carMesh.quaternion;
    
    // Create an offset vector behind and slightly above the car
    const cameraOffset = new THREE.Vector3(0, 8, -15);
    
    // Apply car rotation to offset (this makes camera follow car's direction)
    cameraOffset.applyQuaternion(carQuat);
    
    // Calculate target camera position
    const targetPos = new THREE.Vector3().copy(carPos).add(cameraOffset);
    
    // Smoothly move camera to target position (with lag)
    camera.position.lerp(targetPos, 5 * deltaTime);
    
    // Make camera look at a point slightly ahead of the car
    const lookAtOffset = new THREE.Vector3(0, 1, 5);
    lookAtOffset.applyQuaternion(carQuat);
    const lookAtPos = new THREE.Vector3().copy(carPos).add(lookAtOffset);
    
    camera.lookAt(lookAtPos);
}

// Improved function to update other cars with better prediction
function updateOtherCar(id, deltaTime) {
    const car = cars[id];
    
    // Skip if car isn't properly initialized
    if (!car || !car.lastServerPosition || !car.velocity) return;
    
    // Calculate time since last server update
    const timeSinceUpdate = (Date.now() - car.lastUpdateTime) / 1000;
    
    // Only predict if we have recent data (less than 2 seconds old)
    if (timeSinceUpdate < 2) {
        // Create predicted position
        const predictedPosition = new THREE.Vector3(
            car.lastServerPosition.x + car.velocity.x * timeSinceUpdate,
            car.lastServerPosition.y + car.velocity.y * timeSinceUpdate,
            car.lastServerPosition.z + car.velocity.z * timeSinceUpdate
        );
        
        // Apply prediction to car mesh with smooth interpolation
        if (car.carMesh) {
            // Use lerp for smoother movement
            car.carMesh.position.lerp(predictedPosition, 0.2);
            
            // If we have quaternion data, apply rotation prediction
            if (car.lastServerQuaternion && car.angularVelocity) {
                // Create a quaternion for rotation prediction
                const angularSpeed = car.angularVelocity.length();
                
                if (angularSpeed > 0.001) {
                    const axis = car.angularVelocity.clone().normalize();
                    const rotationQuat = new THREE.Quaternion();
                    rotationQuat.setFromAxisAngle(axis, angularSpeed * timeSinceUpdate);
                    
                    // Apply rotation to last known quaternion
                    const predictedQuat = car.lastServerQuaternion.clone();
                    predictedQuat.multiply(rotationQuat);
                    
                    // Apply with slerp for smooth rotation
                    car.carMesh.quaternion.slerp(predictedQuat, 0.2);
                }
            }
        }
    }
}

// Handle window resize
globalThis.addEventListener('resize', () => {
    camera.aspect = globalThis.innerWidth / globalThis.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(globalThis.innerWidth, globalThis.innerHeight);
});

// Fetch initial user data
async function initializeUser() {
    const response = await fetch(`https://localhost:3000/api/user/getdata`, {
        method: 'GET',
        credentials: 'include',
    });
    const data = await response.json();
    
    // Initialize other cars
    data.others.forEach((id) => {
        if (!cars[id]) {
            cars[id] = new Car(physicsWorld, scene, id);
            cars[id].lastUpdateTime = Date.now();
            cars[id].lastServerPosition = new THREE.Vector3();
            cars[id].velocity = new THREE.Vector3();
            cars[id].angularVelocity = new THREE.Vector3();
        }
    });
    
    return data.user;
}

// Start animation loop
animate();

ws.onopen = async () => {
    username = await initializeUser();
    console.log("Connected as:", username);
};

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log("Received message type:", data.type);
    
    switch (data.type) {
        case 0: { // Circuit initialization
            console.log('Received circuit data:', data);
            
            // Initialize circuit for rendering
            clientCircuit = new Circuit(scene, null, {
                roadWidth: data.CircuitWitdh,
            });
            clientCircuit.world = physicsWorld;
            clientCircuit.pathNodes = data.CircuitNodes;
            clientCircuit.pathPoints = data.CircuitPoints;
            clientCircuit.makePath();
            clientCircuit.makeRoad();
            
            // Create visualization points
            data.CircuitPoints.forEach((element) => {
                const obj = new THREE.Mesh(
                    new THREE.BoxGeometry(2, 2, 2),
                    new THREE.MeshBasicMaterial({ color: 0x00FF00 }),
                );
                obj.position.set(element.x, 0, element.y);
                scene.add(obj);
            });
            
            // Initialize player car with physics for prediction
            if (username) {
                cars[username] = new Car(physicsWorld, scene, username);
                isPlaying = true;
            }
            break;
        }
        
        case 1: { // Car position updates from server
            // Calculate time since last server update
            const now = Date.now();
            const timeSinceLastUpdate = now - lastServerTimestamp;
            lastServerTimestamp = now;
            
            // Process position updates for all cars
            for (const id in data.user) {
                const serverPos = data.user[id].position;
                const serverQuat = data.user[id].quaternion;
                const serverVelocity = data.user[id].velocity;
                
                if (!cars[id]) {
                    // Create car if it doesn't exist
                    cars[id] = new Car(null, scene, id);
                    cars[id].lastUpdateTime = now;
                    cars[id].lastServerPosition = new THREE.Vector3(
                        serverPos.x, serverPos.y, serverPos.z
                    );
                    cars[id].lastServerQuaternion = new THREE.Quaternion(
                        serverQuat.x, serverQuat.y, serverQuat.z, serverQuat.w
                    );
                    if (serverVelocity) {
                        cars[id].velocity = new THREE.Vector3(
                            serverVelocity.x, serverVelocity.y, serverVelocity.z
                        );
                    } else {
                        cars[id].velocity = new THREE.Vector3();
                    }
                    cars[id].angularVelocity = new THREE.Vector3();
                }
                
                if (id === username) {
                    // Server reconciliation for player car
                    handlePlayerCarUpdate(id, serverPos, serverQuat, serverVelocity);
                } else {
                    // Update for other player cars
                    handleOtherCarUpdate(id, serverPos, serverQuat, serverVelocity, now);
                }
            }
            break;
        }
        case 4: { // New player connection
            console.log('New player connected', data);
            data.users.forEach((id) => {
                if (!cars[id]) {
                    cars[id] = new Car(null, scene, id);
                    cars[id].lastUpdateTime = Date.now();
                    cars[id].lastServerPosition = new THREE.Vector3();
                    cars[id].velocity = new THREE.Vector3();
                    cars[id].angularVelocity = new THREE.Vector3();
                }
            });
            break;
        } 
        default:
            break;
    }
};

ws.onerror = (ctx) => {
    if (ctx.status === 401) {
        document.location.replace('https://localhost:8080/login');
    }
};

// Input handling
const keysPressed = {};

/*
// CHANGE 1: Add input debugging to verify key events
document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    console.log('Key pressed:', key); // ADDED: Debug logging
    keysPressed[key] = true;
    
    // ADDED: Immediate client-side control for better responsiveness
    if (username && cars[username]) {
        cars[username].control(keysPressed, 1/60);
    }
});
*/
document.addEventListener('keyup', (event) => {
    keysPressed[event.key.toLowerCase()] = false;
});
// Send input events to server
document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (!keysPressed[key]) {
        ws.send(JSON.stringify({
            type: 2,
            user: username,
            value: key,
        }));
    }
    keysPressed[key] = true;
});

document.addEventListener('keyup', (event) => {
    const key = event.key.toLowerCase();
    ws.send(JSON.stringify({
        type: 3,
        user: username,
        value: key,
    }));
    keysPressed[key] = false;
});

globalThis.onbeforeunload = () => {
    alert('window unloading');
};

document.addEventListener('keydown',(event)=>{
    if (event.key.toLowerCase()== "escape" ){
        isPlaying = isPlaying?false:true;
    }
})