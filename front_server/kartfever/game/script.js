// Fixed client code integrating CarPredictionSystem
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
import * as defaults from 'https://cdn.jsdelivr.net/npm/cannon@0.6.2/+esm';
import { Circuit } from 'https://localhost:3000/lib/circuit.js';
import { Car } from 'https://localhost:3000/lib/car.js';
import { GLTFLoader } from 'https://localhost:3000/lib/GLTFLoader.js';
import { CarPredictionSystem } from './predictionsys.js';

const CANNON = defaults.default;

//
// INIT SCENE
//
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
    75,
    globalThis.innerWidth / globalThis.innerHeight,
    0.1,
    4000,
);
camera.position.y = 50;
camera.position.z = 100;
camera.rotateX(-Math.PI / 6);

const renderer = new THREE.WebGLRenderer();
renderer.outputColorSpace = THREE.SRGBColorSpace; // Replaces renderer.outputEncoding
renderer.setSize(globalThis.innerWidth, globalThis.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

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
// INIT WORLD
//

const physicsWorld = new CANNON.World();
physicsWorld.gravity.set(0, -9.82, 0);
physicsWorld.broadphase = new CANNON.NaiveBroadphase();
physicsWorld.solver.iterations = 10;

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

//
// INIT VARS
//

const predictionSystem = new CarPredictionSystem();
export const cars = {};
const lastServerStates = {}; // Store last server state for each car
const lastServerState = null; // Keep for backward compatibility

let clientCircuit = null;
let isPlaying = false;
let user = null;
let lastServerTimestamp = 0;
const serverUpdateRate = 50; // Expected server update rate in ms

// Animation loop
let lastTime;

const gameData = {
    speed: 0,
    currentLap: 0,
    totalLaps: 4,
    playerRankings: [],
};

const checkpointStates = {}; // { [carId]: { lastCheckpoint: idx, timestamp: ms } }
let checkpointCount = 0; // Number of checkpoints (nodes)
const checkpointRadius = 10; // Distance threshold for checkpoint pass

function loadModel() {
    const loader = new GLTFLoader();

    loader.load(
        `https://localhost:8080/src/city3.glb`,
        (gltf) => {
            const object = gltf.scene;
            console.log(object);
            object.scale.set(500, 500, 500);
            object.position.set(-150, 20.1, 50);
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

function distance2D(a, b) {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
}

function detectCheckpointPass(carId) {
    if (!clientCircuit || !clientCircuit.pathNodes) return;

    const car = cars[carId];
    if (!car) return;

    // Get car position (assume getPosition returns THREE.Vector3)
    const pos = car.getPosition();
    // Find next checkpoint for this car
    const state = checkpointStates[carId] ||
        { lastCheckpoint: -1, timestamp: 0 };
    const nextCheckpoint = (state.lastCheckpoint + 1) % checkpointCount;
    const checkpoint = clientCircuit.pathNodes[nextCheckpoint];

    // Check if car is within radius of checkpoint
    if (
        distance2D(pos, { x: checkpoint.x, z: checkpoint.y }) < checkpointRadius
    ) {
        // Passed checkpoint!
        const now = Date.now();
        checkpointStates[carId] = {
            lastCheckpoint: nextCheckpoint,
            timestamp: now,
        };

        // If it's the local player, send update to server
        if (carId === user && globalThis.ws) {
            globalThis.ws.send(JSON.stringify({
                type: 5,
                user: user,
                checkpoint: nextCheckpoint,
                timestamp: now,
            }));
        }
    }
}

function animate(time) {
    const deltaTime = lastTime ? (time - lastTime) / 1000 : 0;
    lastTime = time;

    if (isPlaying && user) {
        // Step physics for all cars (local and remote)
        Object.values(cars).forEach((car) => {
            // Control only local player car
            if (car.id === user) {
                car.control(keysPressed, deltaTime);
            }
            // Remote cars are controlled by server updates and prediction
        });

        physicsWorld.step(deltaTime);

        // Update all cars (mesh positions, etc.)
        Object.values(cars).forEach((car) => {
            car.update();
        });

        // Apply prediction/correction for all cars
        Object.entries(cars).forEach(([carId, car]) => {
            // Get last server state for this car
            const serverState = lastServerStates[carId];

            if (serverState) {
                predictionSystem.handlePlayerCarUpdate(
                    car,
                    serverState.position,
                    serverState.quaternion,
                    serverState.velocity,
                    serverState.angularVelocity,
                    serverState.wheels,
                );
            }
        });

        if (cars[user]) {
            gameData.speed = cars[user].speed();
            // Checkpoint Detection for Local Player
            detectCheckpointPass(user);
            updateCameraPosition(deltaTime);
        }

        updateGameUI(gameData);
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
    const cameraOffset = new THREE.Vector3(0, 4, -10);

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
    camera.quaternion.slerp(camera.quaternion, 0.1); // 0.1 is the interpolation factor
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
                cars[id] = new Car(physicsWorld, scene, id);
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

        checkpointCount = clientCircuit.pathNodes.length;

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
    if (roomId) {
        const room = new WebSocket(
            `wss://localhost:8080/kartfever/game?roomId=${roomId}`,
        );
        globalThis.ws = room; // Save for checkpoint sends
        if (room) {
            setupWSEventLitener(room);
            startGame(roomId, room);
            animate();
        } else {
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
        //console.log(data);

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

                    // Store the latest server state for alzl cars
                    lastServerStates[id] = {
                        position: serverPos,
                        quaternion: serverQuat,
                        velocity: serverVelocity,
                        angularVelocity: serverAngularVelocity,
                        wheels: serverWheels,
                    };

                    // For backward compatibility
                    if (id == user) {
                        lastServerState = lastServerStates[id];
                    }

                    // Create car if it doesn't exist yet
                    if (!cars[id]) {
                        cars[id] = new Car(physicsWorld, scene, id);
                        predictionSystem.initializeCarState(id);
                    }

                    // Ensure physics and mesh are robustly synced for all cars
                    if (
                        cars[id] &&
                        typeof cars[id].syncFromServer === 'function'
                    ) {
                        cars[id].syncFromServer(carData);
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
                            physicsWorld,
                            scene,
                            id,
                            { position: new CANNON.Vector3(1, 1, id) },
                        );
                        predictionSystem.initializeCarState(id);
                        gameData.playerRankings.add(id);
                    }
                });
                break;
            }
            case 5: { // Checkpoint update from another player
                // Update checkpointStates for that player
                const { user: carId, checkpoint, timestamp } = data;
                checkpointStates[carId] = {
                    lastCheckpoint: checkpoint,
                    timestamp,
                };
                break;
            }
            case 6: { // Leaderboard update from server
                // data.leaderboard = [{ name, checkpoint, timestamp, isCurrentPlayer }]
                gameData.playerRankings = data.leaderboard;
                updateGameUI(gameData);
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
// TODO : uncomment for final functionment
/*
window.addEventListener('focus', () => {
    console.log('Window has gained focus');
    isPlaying = true;
  });
window.addEventListener('blur', () => {
    console.log('Window has lost focus');
    isPlaying = false;
  });
*/
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
                <span class="player-checkpoint">Checkpoint: ${
                player.checkpoint + 1
            }/${checkpointCount}</span>
                <span class="player-time">${player.time || ''}</span>
            `;
            playerList.appendChild(li);
        });
    }
    if (user && cars[user]) {
        speedValue.textContent = cars[user].speed();
    }
};

// Run initial check and setup
console.log('checking room ...');
checkGameRoom();
console.log('room checked');
