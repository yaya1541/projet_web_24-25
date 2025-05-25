// server.js - Modified server code with optimized update rate
import CANNON from 'https://cdn.jsdelivr.net/npm/cannon@0.6.2/+esm';
import { connections, notifyAllUsers } from './back.ts';
import { Circuit } from './lib/circuit.js';
import { Car } from './lib/car.js';
import { activeGames } from './partyUtils';
import * as db from './rest.ts';
import { broadcastToRoom, kartRooms } from './router/partyRoutes.ts';

// Game state tracking
export const bodies = {}; // Store the Cannon.js bodies
export const connectedUsers = [];
export const stateL = {};
export const inputs = {};
export const Worlds = new Map();
export const checkpointStates = {}; // Map<roomId, { [userId]: checkpointState }>
export const leaderboard = {}; // Map<roomId, leaderboardArray>

export function createWorld(roomId) {
    console.log(`[DEBUG] Creating world for room: ${roomId}`);
    const world = new CANNON.World();
    // Set up physics world
    world.gravity.set(0, -9.82, 0);
    world.broadphase = new CANNON.NaiveBroadphase();
    world.solver.iterations = 10;

    // Create materials
    const carMaterial = new CANNON.Material('car');
    const roadMaterial = new CANNON.Material('road');

    // Create contact material (interaction between the two)
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

    // Add to world
    world.addContactMaterial(carRoadContactMaterial);
    console.log('[DEBUG] Initiated server world');

    Worlds.set(roomId, world);
    bodies[roomId] = {};
    connectedUsers[roomId] = [];
    stateL[roomId] = {};
    inputs[roomId] = {};
    checkpointStates[roomId] = {};
    leaderboard[roomId] = [];
    console.log(
        `[DEBUG] World created and state initialized for room: ${roomId}`,
    );
    return world;
}

// Remove a world and all state for a room
export function removeWorld(roomId) {
    console.log(`[DEBUG] Removing world for room: ${roomId}`);
    Worlds.delete(roomId);
    delete bodies[roomId];
    delete connectedUsers[roomId];
    delete stateL[roomId];
    delete inputs[roomId];
    delete checkpointStates[roomId];
    delete leaderboard[roomId];
    console.log(`[DEBUG] World and state removed for room: ${roomId}`);
}

// CHANGE: Increase the physics update rate and decrease correction intensity
const PHYSICS_STEP = 1 / 60; // Higher frequency for smoother simulation
const SERVER_UPDATE_INTERVAL = 100; // Less frequent updates to reduce bandwidth
const EPSILON = 0.1; // Threshold for sending updates

// Handle client connection for a specific room
export function handleClientConnection(userId, roomId) {
    console.log(
        `[DEBUG] handleClientConnection called for user: ${userId}, room: ${roomId}`,
    );
    if (!bodies[roomId][userId] && Worlds.has(roomId)) {
        const world = Worlds.get(roomId);
        const startPosition = new CANNON.Vec3(0, 3, 0);

        bodies[roomId][userId] = new Car(world, null, userId, {
            position: startPosition,
        });

        connectedUsers[roomId].push(userId);

        checkpointStates[roomId][userId] = {
            currentCheckpoint: 0,
            totalCheckpoints: 0,
            lastCheckpointTime: Date.now(),
            totalTime: 0,
            lapCount: 0,
            name: `Player ${userId}`,
        };

        updateLeaderboard(roomId, userId);
        //sendInitialState(roomId);
        sendStateUpdates(roomId);
        console.log(`[DEBUG] User ${userId} added to room ${roomId}`);
    } else {
        console.log(
            `[DEBUG] User ${userId} already exists in room ${roomId} or world missing`,
        );
    }
}

// Handle client disconnection for a specific room
export function handleClientDisconnection(userId, roomId) {
    console.log(
        `[DEBUG] handleClientDisconnection called for user: ${userId}, room: ${roomId}`,
    );
    if (bodies[roomId][userId]) {
        const idx = connectedUsers[roomId].indexOf(userId);
        if (idx !== -1) connectedUsers[roomId].splice(idx, 1);

        delete bodies[roomId][userId];
        delete inputs[roomId][userId];
        delete stateL[roomId][userId];
        delete checkpointStates[roomId][userId];

        notifyAllUsers({
            type: 'user_disconnected',
            userId: userId,
            roomId: roomId,
        });
        console.log(`[DEBUG] User ${userId} removed from room ${roomId}`);
    } else {
        console.log(
            `[DEBUG] Tried to remove user ${userId} from room ${roomId}, but user not found`,
        );
    }
}

/**
 * Update the physics simulation
 */
function updatePhysics(world, roomId) {
    if (world) {
        world.step(PHYSICS_STEP);
        for (const id in bodies[roomId]) {
            // Use inputs[roomId][id] instead of inputs[id]
            if (inputs[roomId] && inputs[roomId][id]) {
                console.log(
                    `[DEBUG] Applying input for user ${id} in room ${roomId}:`,
                    inputs[roomId][id],
                );
                bodies[roomId][id].control(inputs[roomId][id], PHYSICS_STEP);
            }
            bodies[roomId][id].update();
        }
        console.log(`[DEBUG] Physics updated for room ${roomId}`);
    }
}

// Send state updates for a room
function sendStateUpdates(roomId) {
    const serverState = { type: 1, user: {} };
    let hasChanges = false;
    for (const id in bodies[roomId]) {
        const carObj = bodies[roomId][id];
        const body = carObj.carBody;
        const newPosition = {
            x: body.position.x,
            y: body.position.y,
            z: body.position.z,
        };
        const newQuaternion = {
            x: body.quaternion.x,
            y: body.quaternion.y,
            z: body.quaternion.z,
            w: body.quaternion.w,
        };
        if (!stateL[roomId][id]) {
            stateL[roomId][id] = {
                position: { x: 0, y: 0, z: 0 },
                quaternion: { x: 0, y: 0, z: 0, w: 1 },
            };
        }
        const hasMovedEnough = hasChangedMoreThanEpsilon(
            stateL[roomId][id],
            newPosition,
            newQuaternion,
        );
        if (hasMovedEnough) {
            const velocity = {
                x: body.velocity.x,
                y: body.velocity.y,
                z: body.velocity.z,
            };
            const angularVelocity = {
                x: body.angularVelocity.x,
                y: body.angularVelocity.y,
                z: body.angularVelocity.z,
            };
            let wheels = [];
            if (carObj.vehicle && carObj.vehicle.wheelInfos) {
                wheels = carObj.vehicle.wheelInfos.map((wheel) => ({
                    steering: wheel.steering,
                    rotation: wheel.rotation,
                    deltaRotation: wheel.deltaRotation,
                    engineForce: wheel.engineForce,
                    brake: wheel.brake,
                    slip: wheel.slipInfo,
                    suspensionLength: wheel.suspensionLength,
                }));
            }
            serverState.user[id] = {
                position: newPosition,
                quaternion: newQuaternion,
                velocity: velocity,
                angularVelocity: angularVelocity,
                wheels: wheels,
                timestamp: Date.now(),
            };
            hasChanges = true;
            stateL[roomId][id].position = { ...newPosition };
            stateL[roomId][id].quaternion = { ...newQuaternion };
            console.log(
                `[DEBUG] State updated for user ${id} in room ${roomId}:`,
                serverState.user[id],
            );
        }
    }
    console.log(
        `[DEBUG] Connected users in room ${roomId}:`,
        connectedUsers[roomId],
    );

    if (hasChanges) {
        console.log(
            `[DEBUG] Broadcasting state to room ${roomId}:`,
            serverState,
        );
        broadcastToRoom(
            roomId,
            JSON.stringify(serverState),
        );
    } else {
        console.log(
            `[DEBUG] No significant state changes for room ${roomId}, nothing broadcasted.`,
        );
    }
}

/**
 * Helper function to check if position or quaternion has changed more than epsilon
 */
function hasChangedMoreThanEpsilon(oldState, newPosition, newQuaternion) {
    // Check position (any axis exceeding epsilon counts as movement)
    const positionChanged =
        Math.abs(oldState.position.x - newPosition.x) > EPSILON ||
        Math.abs(oldState.position.y - newPosition.y) > EPSILON ||
        Math.abs(oldState.position.z - newPosition.z) > EPSILON;

    // Check quaternion (any component exceeding epsilon counts as rotation)
    const quaternionChanged =
        Math.abs(oldState.quaternion.x - newQuaternion.x) > EPSILON ||
        Math.abs(oldState.quaternion.y - newQuaternion.y) > EPSILON ||
        Math.abs(oldState.quaternion.z - newQuaternion.z) > EPSILON ||
        Math.abs(oldState.quaternion.w - newQuaternion.w) > EPSILON;

    // Return true if either position or rotation changed significantly
    return positionChanged || quaternionChanged;
}

// Send initial state for a room
function sendInitialState(roomId) {
    const initialState = {
        type: 'initial_state',
        circuit: {
            CircuitWitdh: 20,
            CircuitNodes: kartRooms.get(roomId)?.gameState.circuit.CircuitNodes,
            CircuitPoints: kartRooms.get(roomId)?.gameState.circuit
                .CircuitPoints,
        },
        cars: Object.keys(bodies[roomId]).map((id) => ({
            id: id,
            position: bodies[roomId][id].carBody.position,
            quaternion: bodies[roomId][id].carBody.quaternion,
            velocity: bodies[roomId][id].carBody.velocity,
            angularVelocity: bodies[roomId][id].carBody.angularVelocity,
            name: checkpointStates[roomId][id]?.name || `Player ${id}`,
        })),
    };
    console.log(
        `[DEBUG] Sending initial state to room ${roomId}:`,
        initialState,
    );
    broadcastToRoom(roomId, JSON.stringify(initialState));
}

// Physics update for all worlds
setInterval(() => {
    Worlds.forEach((world, roomId) => {
        console.log(`[DEBUG] Running physics step for room ${roomId}`);
        updatePhysics(world, roomId);
    });
}, PHYSICS_STEP * 500);

// Send state updates for all rooms
setInterval(() => {
    Worlds.forEach((_, roomId) => {
        console.log(`[DEBUG] Sending state updates for room ${roomId}`);
        sendStateUpdates(roomId);
    });
}, SERVER_UPDATE_INTERVAL);

// Update leaderboard for a room
function updateLeaderboard(roomId, newUserId = null) {
    console.log(`[DEBUG] Updating leaderboard for room ${roomId}`);
    const leaderboardData = Object.keys(checkpointStates[roomId]).map(
        (userId) => ({
            userId: userId,
            name: checkpointStates[roomId][userId].name,
            checkpoint: checkpointStates[roomId][userId].currentCheckpoint,
            lapCount: checkpointStates[roomId][userId].lapCount,
            timestamp: checkpointStates[roomId][userId].lastCheckpointTime,
            totalTime: Date.now() - checkpointStates[roomId][userId].totalTime,
        }),
    );
    leaderboardData.sort((a, b) => {
        if (a.lapCount !== b.lapCount) return b.lapCount - a.lapCount;
        if (a.checkpoint !== b.checkpoint) return b.checkpoint - a.checkpoint;
        return a.totalTime - b.totalTime;
    });
    leaderboard[roomId] = leaderboardData;
    const leaderboardMessage = {
        type: 6,
        leaderboard: leaderboardData.map((player, index) => ({
            rank: index + 1,
            name: player.name,
            checkpoint: player.checkpoint,
            lapCount: player.lapCount,
            timestamp: player.timestamp,
            isCurrentPlayer: false,
        })),
    };
    console.log(
        `[DEBUG] Broadcasting leaderboard for room ${roomId}:`,
        leaderboardMessage,
    );
    broadcastToRoom(roomId, JSON.stringify(leaderboardMessage));
}

// Handler for client input messages (per room)
export function handleClientInput(message, userId, roomId) {
    console.log(
        `[DEBUG] Received input from user ${userId} in room ${roomId}:`,
        message,
    );
    try {
        const inputData = JSON.parse(message);
        if (inputData.type === 'input') {
            inputs[roomId][userId] = inputData.keys;
            console.log(
                `[DEBUG] Updated inputs for user ${userId} in room ${roomId}:`,
                inputs[roomId][userId],
            );
        }
    } catch (e) {
        console.error('[DEBUG] Error processing client input:', e);
    }
}
