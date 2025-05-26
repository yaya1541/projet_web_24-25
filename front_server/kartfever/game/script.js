// Fixed client code integrating CarPredictionSystem
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
import * as defaults from 'https://cdn.jsdelivr.net/npm/cannon@0.6.2/+esm';
import { Circuit } from 'https://yanisrasp.duckdns.org:3000/api/lib/circuit.js';
import { Car } from 'https://yanisrasp.duckdns.org:3000/api/lib/car.js';
import { GLTFLoader } from 'https://yanisrasp.duckdns.org:3000/api/lib/GLTFLoader.js';
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
renderer.outputColorSpace = THREE.SRGBColorSpace;
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
const lastServerStates = {};

let clientCircuit = null;
let isPlaying = false;
let user = null;
let lastServerTimestamp = 0;

let raceStartEpoch = null; // Add at top

// Animation loop
let lastTime;
const gameData = {
    speed: 0,
    currentLap: 0,
    totalLaps: 3, // Standard 3 laps, can be overridden by server/circuit info
    playerRankings: [],
    timer: '00:00.000',
};
const checkpointStates = {}; // { [carId]: { currentLap: number, lastCheckpoint: idx, timestamp: ms } } [cite: 623]
let checkpointCount = 0;
const checkpointRadius = 15; // Increased slightly for easier detection [cite: 624]
let raceStartTime = 0;
let raceTimerInterval = null;

function loadModel() {
    const loader = new GLTFLoader();
    loader.load(
        `https://yanisrasp.duckdns.org:3000/api/src/city3.glb`,
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
        },
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

function formatRaceTime(ms) {
    if (ms === undefined || ms === null || ms < 0) return '00:00.000';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = ms % 1000;
    return `${String(minutes).padStart(2, '0')}:${
        String(seconds).padStart(2, '0')
    }.${String(milliseconds).padStart(3, '0')}`;
}

function startRaceTimer() {
    raceStartTime = Date.now();
    if (raceTimerInterval) clearInterval(raceTimerInterval);
    raceTimerInterval = setInterval(() => {
        if (isPlaying && raceStartEpoch) {
            const elapsedTime = Date.now() - raceStartEpoch;
            gameData.timer = formatRaceTime(elapsedTime);
            // Update UI directly if needed, or rely on updateGameUI picking up gameData.timer
            const timerEl = document.querySelector('.timer');
            if (timerEl) timerEl.textContent = gameData.timer;
        }
    }, 50); // Update frequently
}

function detectCheckpointPass(carId) {
    if (!clientCircuit || !clientCircuit.pathNodes || checkpointCount === 0) {
        return;
    }
    const car = cars[carId];
    if (!car || !car.getPosition) return;

    const pos = car.getPosition();
    const carState = checkpointStates[carId] ||
        { currentLap: 0, lastCheckpoint: -1, timestamp: 0 };

    const nextCheckpointIdx = (carState.lastCheckpoint + 1) % checkpointCount;
    const targetCheckpointNode = clientCircuit.pathNodes[nextCheckpointIdx];

    if (
        distance2D(pos, {
            x: targetCheckpointNode.x,
            z: targetCheckpointNode.y,
        }) < checkpointRadius
    ) {
        const now = Date.now();
        let newLapCount = carState.currentLap;
        let justCompletedLap = false;

        if (
            nextCheckpointIdx === 0 &&
            carState.lastCheckpoint === checkpointCount - 1
        ) {
            if (newLapCount < gameData.totalLaps) { // Only count if not finished
                newLapCount++;
                justCompletedLap = true;
                console.log(`${carId} completed lap ${newLapCount}`);
            }
        }

        // Ensure player doesn't exceed total laps for checkpoint counting
        if (
            carState.currentLap >= gameData.totalLaps &&
            nextCheckpointIdx === 0 &&
            carState.lastCheckpoint === checkpointCount - 1
        ) {
            // Player has finished, don't update checkpoint, effectively stopping them at finish line for checkpoint logic
            console.log(`${carId} has already finished the race.`);
        } else {
            checkpointStates[carId] = {
                currentLap: newLapCount,
                lastCheckpoint: nextCheckpointIdx,
                timestamp: now,
            };
        }

        if (carId === user && globalThis.ws) {
            // Update local UI immediately for responsiveness
            if (justCompletedLap) {
                gameData.currentLap = newLapCount;
            }

            globalThis.ws.send(JSON.stringify({
                type: 5, // CHECKPOINT_PASS
                user: user,
                checkpoint: nextCheckpointIdx,
                lap: newLapCount,
                timestamp: now,
            }));
        }
    }
}

const FIXED_TIME_STEP = 1 / 60;
let accumulator = 0;

function animate(time) {
    const deltaTime = lastTime ? (time - lastTime) / 1000 : 0;
    lastTime = time;

    if (isPlaying && user) {
        Object.values(cars).forEach((car) => {
            if (car.id === user) {
                car.control(keysPressed, deltaTime);
            }
            car.update();
        });

        accumulator += deltaTime;
        while (accumulator >= FIXED_TIME_STEP) {
            accumulator -= FIXED_TIME_STEP;
        }

        physicsWorld.step(FIXED_TIME_STEP);

        Object.entries(cars).forEach(([carId, car]) => {
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
            // gameData.speed = cars[user].speed(); // Speed is updated in updateGameUI directly [cite: 645]
            detectCheckpointPass(user);
            updateCameraPosition(FIXED_TIME_STEP);
        }

        updateGameUI(gameData);
        predictionSystem.extrapolateRemoteCars(cars, FIXED_TIME_STEP);
    }

    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

function updateCameraPosition(deltaTime) {
    if (!cars[user] || !cars[user].getPosition) return;
    const carPos = cars[user].getPosition();
    const carQuat = cars[user].carMesh.quaternion;
    const cameraOffset = new THREE.Vector3(0, 4, -10);
    cameraOffset.applyQuaternion(carQuat);
    const targetPos = new THREE.Vector3().copy(carPos).add(cameraOffset);
    camera.position.lerp(targetPos, 5 * deltaTime);
    const lookAtOffset = new THREE.Vector3(0, 1, 5);
    lookAtOffset.applyQuaternion(carQuat);
    const lookAtPos = new THREE.Vector3().copy(carPos).add(lookAtOffset);
    camera.lookAt(lookAtPos);
}

globalThis.addEventListener('resize', () => {
    camera.aspect = globalThis.innerWidth / globalThis.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(globalThis.innerWidth, globalThis.innerHeight);
});

async function initializeUser(roomId) {
    try {
        const response = await fetch(
            `https://yanisrasp.duckdns.org:3000/api/kartfever/game?roomId=${roomId}`,
            {
                method: 'GET',
                credentials: 'include',
            },
        );
        if (!response.ok) {
            console.error(
                'Failed to initialize user, server returned error:',
                response.status,
            );
            document.location.search = ''; // Redirect to home if room fetch fails
            return null;
        }
        const res = await response.json();
        const data = res.data;

        if (data.circuit) {
            console.log(data.circuit);

            clientCircuit = new Circuit(scene, null, {
                roadWidth: data.circuit.CircuitWitdh,
            });
            clientCircuit.world = physicsWorld;
            clientCircuit.pathNodes = data.circuit.CircuitNodes;
            clientCircuit.pathPoints = data.circuit.CircuitPoints;
            clientCircuit.makePath();
            clientCircuit.makeRoad();
            checkpointCount = clientCircuit.pathNodes.length;
            gameData.totalLaps = data.circuit.totalLaps || 3; // Get total laps from server or default
            totalLaps.textContent = gameData.totalLaps;
        }

        if (data.raceStartEpoch) {
            raceStartEpoch = data.raceStartEpoch;
        }

        data.users.forEach((id) => {
            if (!cars[id]) {
                cars[id] = new Car(physicsWorld, scene, id);
                predictionSystem.initializeCarState(id);
            }
        });

        console.log('Initialized user and game data:', data);
        return res.user;
    } catch (error) {
        console.error('Error in initializeUser:', error);
        document.location.search = ''; // Redirect on error
        return null;
    }
}

const keysPressed = {};

document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    keysPressed[key] = true;
    if (globalThis.ws && globalThis.ws.readyState === WebSocket.OPEN) { // Send keydown to server
        globalThis.ws.send(JSON.stringify({ type: 2, user: user, value: key }));
    }
    if (key === 'escape') {
        // isPlaying = !isPlaying; // Toggle paused state if needed, not for starting game [cite: 667]
        // console.log("isPlaying toggled by escape:", isPlaying);
    }
});

document.addEventListener('keyup', (event) => {
    const key = event.key.toLowerCase();
    keysPressed[key] = false;
    if (globalThis.ws && globalThis.ws.readyState === WebSocket.OPEN) { // Send keyup to server
        globalThis.ws.send(JSON.stringify({ type: 3, user: user, value: key }));
    }
});

globalThis.onbeforeunload = () => {
    // Consider sending a disconnect message if ws is open
    if (globalThis.ws && globalThis.ws.readyState === WebSocket.OPEN) {
        globalThis.ws.send(JSON.stringify({ type: 'disconnect', user: user })); // Custom disconnect message
    }
};

const welcomeScreen = document.getElementById('welcome-screen');
const gameUI = document.getElementById('game-ui');
const countdownOverlay = document.getElementById('countdown-overlay');
const countdownNumber = document.querySelector('.countdown-number');
const joinGameBtn = document.getElementById('join-game');
const createGameBtn = document.getElementById('create-game');
const gameCodeInput = document.getElementById('game-code');
const speedValue = document.querySelector('.speed-value');
const currentLap = document.querySelector('.current-lap');
const totalLaps = document.querySelector('.total-laps');
const timer = document.querySelector('.timer');

function checkGameRoom() {
    const urlParams = new URLSearchParams(globalThis.location.search);
    const roomId = urlParams.get('roomId');
    if (roomId) {
        const wsProtocol = globalThis.location.protocol === 'https:'
            ? 'wss:'
            : 'ws:';
        const wsUrl =
            `${wsProtocol}//yanisrasp.duckdns.org:3000/api/kartfever/game?roomId=${roomId}`;
        console.log('Attempting to connect to WebSocket:', wsUrl);
        const room = new WebSocket(wsUrl);
        globalThis.ws = room;

        startGame(roomId, room);
        // animate() is called inside startGame -> ws.onopen after a successful connection and init
    } else {
        // Not in a game room, ensure welcome screen is visible and game UI is hidden
        welcomeScreen.style.display = 'flex';
        gameUI.style.display = 'none';
    }
}

function runCountdown(callback) {
    countdownOverlay.style.display = 'flex';
    let count = 3;
    countdownNumber.textContent = count;

    const interval = setInterval(() => {
        count--;
        if (count > 0) {
            countdownNumber.textContent = count;
        } else if (count === 0) {
            countdownNumber.textContent = 'GO!';
        } else {
            clearInterval(interval);
            countdownOverlay.style.display = 'none';
            if (callback) callback();
        }
    }, 1000);
}

function startGame(roomId, ws) {
    welcomeScreen.style.display = 'none';
    gameUI.style.display = 'block';

    ws.onopen = async () => {
        console.log('WebSocket connection established.');
        user = await initializeUser(roomId);
        if (!user) {
            console.error('User initialization failed. Cannot start game.');
            ws.close();
            // Optionally redirect or show error to user
            welcomeScreen.style.display = 'flex';
            gameUI.style.display = 'none';
            return;
        }
        console.log('Connected as:', user);
        if (user && !cars[user]) {
            cars[user] = new Car(physicsWorld, scene, user);
            predictionSystem.initializeCarState(user);
        }

        // All essential cars (local player, existing players from init) should now be in `cars` map.
        runCountdown(() => {
            isPlaying = true; // Set isPlaying to true AFTER countdown
            console.log('isPlaying set to true after countdown.');
            startRaceTimer(); // Start the race timer after countdown
            animate(); // Start the animation loop AFTER countdown AND successful init
        });
    };

    ws.onmessage = (event) => {
        console.log('[WS] Raw message:', event.data);
        let data;
        try {
            data = JSON.parse(event.data);
            console.log('[WS] Parsed data:', data);
        } catch (err) {
            console.error('[WS] Failed to parse message:', event.data, err);
            return;
        }

        switch (data.type) {
            case 1: { // Car position updates from server [cite: 679]
                lastServerTimestamp = Date.now();
                for (const id in data.user) {
                    const carData = data.user[id];
                    lastServerStates[id] = {
                        position: carData.position,
                        quaternion: carData.quaternion,
                        velocity: carData.velocity,
                        angularVelocity: carData.angularVelocity,
                        wheels: carData.wheels,
                    };

                    if (!cars[id]) {
                        console.log(
                            `Creating car for new user from type 1 message: ${id}`,
                        );
                        cars[id] = new Car(physicsWorld, scene, id);
                        predictionSystem.initializeCarState(id);
                    }
                    // Ensure physics and mesh are robustly synced for all cars
                    if (
                        cars[id] &&
                        typeof cars[id].syncFromServer === 'function'
                    ) {
                        // cars[id].syncFromServer(carData); // This might be too aggressive if prediction handles it [cite: 687]
                    }
                }
                break;
            }
            case 4: { // New player connection joining event [cite: 689]
                console.log('New player connection event from server', data);
                data.users.forEach((newUserInfo) => { // Assuming data.users is an array of {id: "userId", name: "userName"} or just IDs
                    const id = typeof newUserInfo === 'object'
                        ? newUserInfo.id
                        : newUserInfo;
                    if (!cars[id]) {
                        console.log(`Player ${id} joined the game.`);
                        cars[id] = new Car(physicsWorld, scene, id);
                        predictionSystem.initializeCarState(id);
                        // Server should send a full leaderboard update (type 6) soon after.
                    }
                });
                break;
            }
            case 5: { // Checkpoint update from another player (or self, if echoed by server) [cite: 694]
                const { user: carId, checkpoint, lap, timestamp } = data; // Expect 'lap' from server [cite: 694]

                // This state is mainly for reference; primary truth for ranking comes from Type 6.
                checkpointStates[carId] = {
                    currentLap: lap !== undefined
                        ? lap
                        : (checkpointStates[carId]
                            ? checkpointStates[carId].currentLap
                            : 0),
                    lastCheckpoint: checkpoint,
                    timestamp,
                };
                // If this update is for the local player, update local gameData for immediate UI feedback
                if (carId === user && lap !== undefined) {
                    gameData.currentLap = lap;
                }
                break;
            }
            case 6: { // Leaderboard update from server [cite: 696]
                // Server data structure: data.leaderboard = [{ name, carId, lap, lastCheckpoint, totalTimeStr, isCurrentPlayer (can be derived) }]
                gameData.playerRankings = data.leaderboard.map((p) => ({
                    name: p.name,
                    id: p.carId,
                    lap: p.lap,
                    checkpoint: p.lastCheckpoint, // Index of last checkpoint passed
                    time: p.totalTimeStr, // Server sends formatted string
                    isCurrentPlayer: p.carId === user,
                }));

                const localPlayerRanking = gameData.playerRankings.find((p) =>
                    p.id === user
                );
                if (localPlayerRanking) {
                    gameData.currentLap = localPlayerRanking.lap;
                    // gameData.timer could also be updated if server sends authoritative race time for local player
                }
                // updateGameUI(gameData) is called in animate() [cite: 697]
                break;
            }
            case 'player_disconnected': {
                const disconnectedUserId = data.user;
                console.log(`Player ${disconnectedUserId} disconnected.`);
                if (cars[disconnectedUserId]) {
                    scene.remove(cars[disconnectedUserId].carMesh);
                    if (cars[disconnectedUserId].carBody) {
                        physicsWorld.removeBody(
                            cars[disconnectedUserId].carBody,
                        );
                    }
                    delete cars[disconnectedUserId];
                    delete checkpointStates[disconnectedUserId];
                    delete lastServerStates[disconnectedUserId];
                    // Server should send an updated leaderboard.
                }
                break;
            }
            default:
                break;
        }
    };

    ws.onclose = (event) => {
        console.log('WebSocket connection closed:', event.code, event.reason);
        isPlaying = false;
        if (raceTimerInterval) clearInterval(raceTimerInterval);
        // Optionally, show message and redirect to home or allow rejoining
        // alert("Connection to the game server was lost.");
        // document.location.pathname = '/home';
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        // Handle error, e.g., display message, try to reconnect, or redirect
        // if (error.target && error.target.readyState === WebSocket.CLOSING) {
        // This might indicate server rejected connection or other issues
        // document.location.pathname = '/home';
        // }
    };
}

joinGameBtn.addEventListener('click', () => {
    const gameCode = gameCodeInput.value.trim().toUpperCase();
    if (gameCode) {
        alert(
            `you tried to join party ${gameCode}. We are sorry ! the game is not available at the moment.`,
        );
        globalThis.location.search = `?roomId=${gameCode}`; // Change search to trigger reload and checkGameRoom
    } else {
        alert('Please enter a valid game code');
    }
});

createGameBtn.addEventListener('click', () => {
    /*
    try {
        const response = await fetch(
            'https://yanisrasp.duckdns.org:3000/api/kartfever/game',
            {
                method: 'POST',
                credentials: 'include',
            },
        );
        if (!response.ok) {
            throw new Error(`Failed to create game: ${response.status}`);
        }
        const newRoomData = await response.json();
        if (newRoomData && newRoomData.id) {
            globalThis.location.search = `?roomId=${newRoomData.id}`; // Change search
        } else {
            alert('Could not create game room.');
        }
    } catch (error) {
        console.error('Error creating game:', error);
        alert(`Error creating game: ${error.message}`);
    }
    */
    alert('We are sorry ! the game is not available at the moment.');
});

gameCodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        joinGameBtn.click();
    }
});

globalThis.updateGameUI = function (gameData) {
    if (cars[user] && typeof cars[user].speed === 'function') {
        speedValue.textContent = Math.floor(cars[user].speed());
    } else {
        speedValue.textContent = '0';
    }

    currentLap.textContent = gameData.currentLap || 0;
    totalLaps.textContent = gameData.totalLaps;
    // Timer is updated by its own interval now. timer.textContent = gameData.timer;

    const playerList = document.querySelector('.player-list');
    playerList.innerHTML = '';

    if (gameData.playerRankings && gameData.playerRankings.length > 0) {
        gameData.playerRankings.forEach((player, index) => {
            const li = document.createElement('li');
            li.className = 'player-item';
            if (player.isCurrentPlayer) {
                li.classList.add('current-player');
            }

            const totalCheckpointsStr = checkpointCount > 0
                ? `/${checkpointCount}`
                : '';
            const checkpointProgress =
                (player.checkpoint !== undefined && player.checkpoint !== null)
                    ? `${player.checkpoint + 1}${totalCheckpointsStr}`
                    : 'N/A';

            li.innerHTML = `
                <span class="player-position">${index + 1}</span>
                <span class="player-name">${
                player.name || `P-${player.id || '?'}`
            }</span>
                <span class="player-checkpoint">Lap: ${
                player.lap !== undefined ? player.lap : 0
            }/${gameData.totalLaps} (CP: ${checkpointProgress})</span>
                <span class="player-time">${player.time || '00:00.000'}</span>
            `;
            playerList.appendChild(li);
        });
    } else {
        playerList.innerHTML =
            '<li class="player-item" style="justify-content: center;">Waiting for players...</li>';
    }
};

// Run initial check and setup
console.log('checking room ...');
checkGameRoom();
console.log('room checked');
