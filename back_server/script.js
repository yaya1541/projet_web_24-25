// server.js - Modified server code with optimized update rate
import CANNON from 'https://cdn.jsdelivr.net/npm/cannon@0.6.2/+esm';
import { connections, notifyAllUsers } from './back.ts';
import { Circuit } from './lib/circuit.js';
import { Car } from './lib/car.js';
import { activeGames } from './partyUtils';
import * as db from './rest.ts';

export const Worlds = new Map();

export function createWorld() {
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
    console.log('Initiated server world');
    return world;
}

// Game state tracking
export const bodies = {}; // Store the Cannon.js bodies
export const connectedUsers = [];
export const stateL = {};
export const inputs = {};

// CHANGE: Increase the physics update rate and decrease correction intensity
const PHYSICS_STEP = 1 / 240; // Higher frequency for smoother simulation
const SERVER_UPDATE_INTERVAL = 40; // Less frequent updates to reduce bandwidth
const EPSILON = 0.1; // Threshold for sending updates

// Server authority state
const serverState = {
    type: 1,
    user: {},
};

/**
 * Update the physics simulation
 */
function updatePhysics(world) {
    // Step the physics world
    if (world) {
        world.step(PHYSICS_STEP);

        // Apply control inputs for all players
        for (const id in bodies) {
            if (inputs[id]) {
                bodies[id].control(inputs[id], PHYSICS_STEP);
            }
            bodies[id].update();
        }
    }
}

async function sendStateUpdates() {
    // Reset state for this update
    serverState.user = {};
    let hasChanges = false;

    // Check each body for significant movement
    for (const id in bodies) {
        const carObj = bodies[id];
        //console.log(carObj.speed());
        
        const body = carObj.carBody;

        // Get current position and rotation
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

        // Initialize stateL[id] if it doesn't exist
        if (!stateL[id]) {
            stateL[id] = {
                position: { x: 0, y: 0, z: 0 },
                quaternion: { x: 0, y: 0, z: 0, w: 1 },
            };
        }

        const hasMovedEnough = hasChangedMoreThanEpsilon(
            stateL[id],
            newPosition,
            newQuaternion,
        );

        // Add to update packet if significant changes detected
        if (hasMovedEnough) {
            // Include velocity data for better client prediction
            const velocity = {
                x: body.velocity.x,
                y: body.velocity.y,
                z: body.velocity.z,
            };

            // Include angular velocity for rotation prediction
            const angularVelocity = {
                x: body.angularVelocity.x,
                y: body.angularVelocity.y,
                z: body.angularVelocity.z,
            };

            // --- NEW: Add wheel state if available ---
            let wheels = [];
            if (carObj.vehicle && carObj.vehicle.wheelInfos) {
                wheels = carObj.vehicle.wheelInfos.map((wheel) => ({
                    steering: wheel.steering, // radians
                    rotation: wheel.rotation, // total rotation, radians
                    deltaRotation: wheel.deltaRotation, // radians per step
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
                wheels: wheels, // <-- Add wheels array to packet
                timestamp: Date.now(),
            };

            hasChanges = true;

            // Update the last known state for this body
            stateL[id].position = { ...newPosition };
            stateL[id].quaternion = { ...newQuaternion };
        }
    }

    // Only send updates when changes exceed threshold
    if (hasChanges) {
        connections.forEach((client) => {
            client.send(JSON.stringify(serverState));
        });
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

// Run physics simulation at high frequency for accuracy
setInterval(() => {
    Worlds.forEach((v, k) => {
        updatePhysics(v);
    });
}, PHYSICS_STEP*500);

// Send updates to clients at a lower frequency to reduce network traffic
setInterval(sendStateUpdates, SERVER_UPDATE_INTERVAL);

// Handler for client input messages
export function handleClientInput(message, userId) {
    // Parse input message
    try {
        const inputData = JSON.parse(message);
        if (inputData.type === 'input') {
            // Store inputs for this user
            inputs[userId] = inputData.keys;
        }
    } catch (e) {
        console.error('Error processing client input:', e);
    }
}

// Handle new client connection
export function handleClientConnection(userId, worldId) {
    // Create car for new user if not exists
    if (!bodies[userId] && Worlds.has(worldId)) {
        const world = Worlds.get(worldId);
        const startPosition = new CANNON.Vec3(0, 3, 0); // Starting position

        // Create car for this user
        bodies[userId] = new Car(world, null, userId, {
            position: startPosition,
            color: 0x00ff00, // Green color
        });

        connectedUsers.push(userId);

        // Send initial state to all clients
        sendStateUpdates();
    }
}

// Handle client disconnection
export function handleClientDisconnection(userId) {
    // Remove car and inputs for this user
    if (bodies[userId]) {
        const index = connectedUsers.indexOf(userId);
        if (index !== -1) {
            connectedUsers.splice(index, 1);
        }

        delete bodies[userId];
        delete inputs[userId];
        delete stateL[userId];

        // Notify other clients about disconnection
        notifyAllUsers({
            type: 'user_disconnected',
            userId: userId,
        });
    }
}
