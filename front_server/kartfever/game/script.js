// Fixed client code integrating CarPredictionSystem
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
import * as defaults from 'https://cdn.jsdelivr.net/npm/cannon@0.6.2/+esm';
import { Circuit } from 'https://localhost:8080/lib/circuit.js';
import { Car, replaceAllMaterials } from 'https://localhost:8080/lib/car.js';
import { GLTFLoader } from 'https://localhost:8080/lib/GLTFLoader.js';
import { CarPredictionSystem } from './predictionsys.js';

const CANNON = defaults.default;

//
// INIT
//

export const cars = {};
// Basic Driveable Car using Cannon.js and Three.js
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
    75,
    globalThis.innerWidth / globalThis.innerHeight,
    0.1,
    4000,
);

const renderer = new THREE.WebGLRenderer();
renderer.outputColorSpace = THREE.SRGBColorSpace; // Replaces renderer.outputEncoding
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

// Initialize the prediction system
const predictionSystem = new CarPredictionSystem();

function loadModel() {
    const loader = new GLTFLoader();

    loader.load(
        `https://localhost:8080/src/city3.glb`,
        (gltf) => {
            const object = gltf.scene;
            console.log(object);
            /*
            // Modern material/texture handling
            object.traverse((node) => {
                if (node.isMesh) {
                    const materials = Array.isArray(node.material)
                        ? node.material
                        : [node.material];

                    node.material = materials.map(mat => {
                        // Create new material while preserving important properties
                        const newMat = mat.clone();

                        // Fix texture color spaces
                        if (newMat.map) {
                            newMat.map.colorSpace = THREE.SRGBColorSpace; // Replaces THREE.sRGBEncoding
                            newMat.map.format = THREE.RGBAFormat;
                            newMat.map.type = THREE.UnsignedByteType;
                        }

                        // Handle other texture types
                        const textureTypes = [
                            'normalMap', 'roughnessMap',
                            'metalnessMap', 'aoMap', 'displacementMap'
                        ];

                        textureTypes.forEach(type => {
                            if (newMat[type]) {
                                newMat[type].colorSpace = THREE.LinearSRGBColorSpace;
                            }
                        });

                        return newMat;
                    });

                    // Handle single material case
                    if (!Array.isArray(node.material)) {
                        node.material = node.material[0];
                    }
                }
            });
            */
            object.scale.set(500, 500, 500);
            object.position.set(-150, 25.1, 50);
            object.castShadow = true;
            scene.add(object);
        },
        (xhr) => {
            console.log(
                `${xhr.loaded} sur ${xhr.total} octets chargés (${
                    (xhr.loaded / xhr.total * 100).toFixed(2)
                }%)`,
            );
        }, // Progress callback (optional)
        (error) => {
            console.error('Error loading GLB:', error);
        },
    );
}
loadModel();

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
    roadMaterial,
    {
        friction: 0.5,
        restitution: 0.3,
        contactEquationStiffness: 1e8,
        contactEquationRelaxation: 3,
    },
);
physicsWorld.addContactMaterial(carRoadContactMaterial);

const testBody = new CANNON.Body({
    mass: 5,
    shape: new CANNON.Box(new CANNON.Vec3(2, 3, 4)),
});
testBody.position.y = 100;
//physicsWorld.addBody(testBody);

let clientCircuit = null;
let isPlaying = false;
let user = null;
let lastServerTimestamp = 0;
const serverUpdateRate = 200; // Expected server update rate in ms

// Animation loop
let lastTime;

function animate(time) {
    const deltaTime = lastTime ? (time - lastTime) / 1000 : 0;
    lastTime = time;

    if (isPlaying && user && cars[user]) {
        //console.log("controlling car");

        // Apply control to local player car
        cars[user].control(keysPressed, deltaTime);

        // Step physics world
        physicsWorld.step(deltaTime * 2);

        // Update local car position
        cars[user].update();

        // Update camera position relative to player car
        updateCameraPosition(deltaTime);

        // Use prediction system to update all remote cars
        predictionSystem.extrapolateRemoteCars(cars, deltaTime);
    }

    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

/**
 * Improve camera follow logic
 * @param {*} deltaTime
 * @returns
 */
function updateCameraPosition(deltaTime) {
    if (!cars[user]) return;

    // Get player car position and rotation
    const carPos = cars[user].getPosition();
    const carQuat = cars[user].carMesh.quaternion;

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

// Handle window resize
globalThis.addEventListener('resize', () => {
    camera.aspect = globalThis.innerWidth / globalThis.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(globalThis.innerWidth, globalThis.innerHeight);
});

// Fetch initial user data
/**
 * @returns
 */
async function initializeUser(roomId) {
    const response = await fetch(
        `https://localhost:8080/kartfever/game?roomId=${roomId}`,
        {
            method: 'GET',
            credentials: 'include',
        },
    ).then((res) => {
        if (res.status == 200) return res;
    });
    if (response) {
        const res = await response.json();
        const data = res.data;
        // Initialize other cars
        data.users.forEach((id) => {
            if (!cars[id]) {
                // Create car and initialize prediction state
                cars[id] = new Car(null, scene, id);
                predictionSystem.initializeCarState(id);
            }
        });

        clientCircuit = new Circuit(scene, null, {
            roadWidth: data.circuit.CircuitWitdh,
        });
        clientCircuit.world = physicsWorld;
        clientCircuit.pathNodes = data.circuit.CircuitNodes;
        clientCircuit.pathPoints = data.circuit.CircuitPoints;
        clientCircuit.makePath();
        clientCircuit.makeRoad();

        // Create visualization points
        data.circuit.CircuitPoints.forEach((element) => {
            const obj = new THREE.Mesh(
                new THREE.BoxGeometry(2, 2, 2),
                new THREE.MeshBasicMaterial({ color: 0x00FF00 }),
            );
            obj.position.set(element.x, 0, element.y);
            scene.add(obj);
        });

        console.log(data);

        return res.user;
    } else {
        document.location.search = '';
    }
}

// Input handling
const keysPressed = {};

// CHANGE 1: Add input debugging to verify key events
document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    console.log('Key pressed:', key); // ADDED: Debug logging
    keysPressed[key] = true;

    // ADDED: Immediate client-side control for better responsiveness
    if (user && cars[user]) {
        cars[user].control(keysPressed, 1 / 60);
    }
});

function setupWSEventLitener(ws) {
    document.addEventListener('keyup', (event) => {
        const key = event.key.toLowerCase();
        ws.send(JSON.stringify({
            type: 3,
            user: user,
            value: key,
        }));
        keysPressed[key] = false;
    });
    // Send input events to server
    document.addEventListener('keydown', (event) => {
        const key = event.key.toLowerCase();
        ws.send(JSON.stringify({
            type: 2,
            user: user,
            value: key,
        }));
        keysPressed[key] = true;

        if (key == 'escape') {
            isPlaying = isPlaying ? false : true;
            console.log(isPlaying);
        }
    });
}

globalThis.onbeforeunload = () => {
    alert('window unloading');
};

// DOM Elements
const welcomeScreen = document.getElementById('welcome-screen');
const gameUI = document.getElementById('game-ui');
const countdownOverlay = document.getElementById('countdown-overlay');
const joinGameBtn = document.getElementById('join-game');
const createGameBtn = document.getElementById('create-game');
const gameCodeInput = document.getElementById('game-code');
const countdownNumber = document.querySelector('.countdown-number');
const speedValue = document.querySelector('.speed-value');
const currentLap = document.querySelector('.current-lap');
const totalLaps = document.querySelector('.total-laps');
const timer = document.querySelector('.timer');

// Check if we're already in a game room (URL has roomId)
function checkGameRoom() {
    const urlParams = new URLSearchParams(globalThis.location.search);
    const roomId = urlParams.get('roomId');
    console.log(roomId);

    if (roomId) {
        console.log('trying ws creation');
        const room = new WebSocket(
            `wss://localhost:8080/kartfever/game?roomId=${roomId}`,
        );
        console.log(room);
        console.log('ws passed ');

        if (room) {
            setupWSEventLitener(room);
            startGame(roomId, room);
            // Start animation loop
            animate();
        } else {
            // TODO : display room not found.
            showError();
        }
    }
}

// Start the game UI
function startGame(roomId, ws) {
    welcomeScreen.style.display = 'none';

    ws.onopen = async () => {
        user = await initializeUser(roomId);
        console.log('Connected as:', user);

        // Initialize the player car with physics
        if (user && !cars[user]) {
            cars[user] = new Car(physicsWorld, scene, user);
            predictionSystem.initializeCarState(user);
        }
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        switch (data.type) {
            case 1: { // Car position updates from server
                // Calculate time since last server update
                const now = Date.now();
                const timeSinceLastUpdate = now - lastServerTimestamp;
                lastServerTimestamp = now;

                // Process position updates for all cars
                for (const id in data.user) {
                    const carData = data.user[id];
                    const serverPos = carData.position;
                    const serverQuat = carData.quaternion;
                    const serverVelocity = carData.velocity;
                    const serverAngularVelocity = carData.angularVelocity;
                    const serverWheels = carData.wheels;
                    const now = Date.now();

                    if (id === user) {
                        predictionSystem.handlePlayerCarUpdate(
                            cars[id],
                            serverPos,
                            serverQuat,
                            serverVelocity,
                            serverAngularVelocity,
                            serverWheels,
                        );
                        // Ensure physics and mesh are robustly synced and clamped
                        if (
                            cars[id] &&
                            typeof cars[id].syncFromServer === 'function'
                        ) {
                            cars[id].syncFromServer(carData);
                        }
                    } else {
                        predictionSystem.handleRemoteCarUpdate(
                            id,
                            cars[id],
                            serverPos,
                            serverQuat,
                            serverVelocity,
                            serverAngularVelocity,
                            serverWheels,
                            now,
                        );
                        // Optionally, if you want to keep remote car physics in sync (if physics bodies exist)
                        // if (cars[id] && typeof cars[id].syncFromServer === 'function') {
                        //     cars[id].syncFromServer(carData);
                        // }
                    }
                }
                break;
            }
            case 4: { // New player connection
                console.log('New player connected', data);
                data.users.forEach((id) => {
                    if (!cars[id]) {
                        // Create car with physics if it's the local player
                        cars[id] = new Car(
                            id === user ? physicsWorld : null,
                            scene,
                            id,
                        );
                        predictionSystem.initializeCarState(id);
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
            document.location.pathname = '/home';
        }
    };
}

// Handle join game button
joinGameBtn.addEventListener('click', () => {
    const gameCode = gameCodeInput.value.trim().toUpperCase();
    if (gameCode) {
        // Redirect to game URL with room ID
        globalThis.location.href =
            `https://localhost:8080/kartfever/game?roomId=${gameCode}`;
    } else {
        alert('Please enter a valid game code');
    }
});

// Handle create game button
createGameBtn.addEventListener('click', async () => {
    // In a real app, would make API call to create game
    // For now, just generate a random code
    const newRoomId = await fetch('https://localhost:8080/kartfever/game', {
        method: 'POST',
        credentials: 'include',
    }).then((r) => {
        return r.json();
    });
    console.log('newroomid', newRoomId);

    if (newRoomId) {
        globalThis.location.href =
            `https://localhost:8080/kartfever/game?roomId=${newRoomId.id}`;
    } else {
        showError();
    }
});

// Allow Enter key to submit the join game form
gameCodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        joinGameBtn.click();
    }
});

// Function to handle actual game state updates
globalThis.updateGameUI = function (gameData) {
    if (gameData.speed) {
        speedValue.textContent = Math.floor(gameData.speed);
    }

    if (gameData.currentLap) {
        currentLap.textContent = gameData.currentLap;
    }

    if (gameData.totalLaps) {
        totalLaps.textContent = gameData.totalLaps;
    }

    if (gameData.playerRankings) {
        const playerList = document.querySelector('.player-list');
        playerList.innerHTML = '';

        gameData.playerRankings.forEach((player, index) => {
            const li = document.createElement('li');
            li.className = 'player-item';
            if (player.isCurrentPlayer) {
                li.classList.add('current-player');
            }

            li.innerHTML = `
                <span class="player-position">${index + 1}</span>
                <span class="player-name">${player.name}</span>
                <span class="player-time">${player.time}</span>
            `;

            playerList.appendChild(li);
        });
    }

    // Update speed display from player car
    if (user && cars[user]) {
        speedValue.textContent = cars[user].speed();
    }
};

// Run initial check and setup
console.log('checking room ...');
checkGameRoom();
console.log('room checked');
