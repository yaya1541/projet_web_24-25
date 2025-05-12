// Modified server code with optimized update rate
import CANNON from 'https://cdn.jsdelivr.net/npm/cannon@0.6.2/+esm';
import { connections, notifyAllUsers } from './back.ts';
import { Circuit } from './lib/circuit.js';
import { Car } from './lib/car.js';

export const world = new CANNON.World();

try {
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
} catch (e) {
    console.log(e);
}

// Initialize circuit
export const circuit = new Circuit(null, world, {
    turnNumber: 25,
    turnAmplitude: 95,
    roadWidth: 30,
});

// Game state tracking
export const bodies = {}; // Store the Cannon.js bodies
export const connectedUsers = [];
export const stateL = {};
export const inputs = {};

// CHANGE: Increase the physics update rate and decrease correction intensity
const PHYSICS_STEP = 1 / 180; // CHANGED: Increased from 1/120 for smoother simulation
const SERVER_UPDATE_INTERVAL = 50; // CHANGED: Increased from 100ms to 50ms for more frequent updates
const EPSILON = 0.1; // CHANGED: Increased threshold to reduce unnecessary updates

// Server authority state
const serverState = {
    type: 1,
    user: {},
};

/**
 * Update the physics simulation
 */
function updatePhysics() {
    // Step the physics world
    world.step(PHYSICS_STEP);

    // Apply control inputs for all players
    for (const id in bodies) {
        if (inputs[id]) {
            bodies[id].control(inputs[id], PHYSICS_STEP);
        }
        bodies[id].update();
    }
}

/**
 * Process and send state updates to clients
 * FIXED: Add debug logging for position updates
 */
function sendStateUpdates() {
    // Reset state for this update
    serverState.user = {};
    let hasChanges = false;

    // Check each body for significant movement
    for (const id in bodies) {
        const body = bodies[id].carBody;

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

        // Debug logging for body position
        //console.log(`Server: Body ${id} position: ${newPosition.x.toFixed(2)}, ${newPosition.y.toFixed(2)}, ${newPosition.z.toFixed(2)}`);
        //console.log(inputs["yanis"]);

        // Initialize stateL[id] if it doesn't exist
        if (!stateL[id]) {
            stateL[id] = {
                position: { x: 0, y: 0, z: 0 },
                quaternion: { x: 0, y: 0, z: 0, w: 1 },
            };
        }

        // Always send updates in development to debug synchronization issues
        // FIXED: In production, you can revert to only sending updates when needed
        const hasMovedEnough = hasChangedMoreThanEpsilon(
            stateL[id],
            newPosition,
            newQuaternion,
        ); // Force updates for debugging

        // Add to update packet if significant changes detected
        if (hasMovedEnough) {
            // Include velocity data for better client prediction
            const velocity = {
                x: body.velocity.x,
                y: body.velocity.y,
                z: body.velocity.z,
            };

            serverState.user[id] = {
                position: newPosition,
                quaternion: newQuaternion,
                velocity: velocity, // Add velocity for client prediction
                timestamp: Date.now(), // Add timestamp for synchronization
            };

            hasChanges = true;

            // Update the last known state for this body
            stateL[id].position = { ...newPosition };
            stateL[id].quaternion = { ...newQuaternion };
        }
    }

    // FIXED: Always send updates during debugging
    if (hasChanges) {
        // Send to all clients
        //console.log("sending");

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

// Router handler for WebSocket connections
export function setupGameRouter(router, authorizationMiddleware) {
    router.get('/game/kartfever', authorizationMiddleware, (ctx) => {
        console.log('Request received');
        try {
            const ws = ctx.upgrade();
            connections.push(ws);
            ws.onopen = async (_event) => {
                console.log(`New connection opened (${connections.length})`);
                const user = await ctx.cookies.get('user');
                console.log('user : ', user);
                if (connectedUsers.indexOf(user) == -1) {
                    connectedUsers.push(user);
                }
                ws.send(JSON.stringify({
                    type: 0, // Type 0 initialization
                    CircuitNodes: circuit.pathNodes,
                    CircuitPoints: circuit.pathPoints,
                    CircuitWitdh: circuit.options.roadWidth,
                }));
                // FIXED: Add debug output for player initialization
                if (!bodies[user]) {
                    console.log(`Initializing new player: ${user}`);
                    bodies[user] = new Car(world, null, user);
                    bodies[user].carBody.position.set(0, 3, 0); // FIXED: Raised initial position
                    inputs[user] = {};
                    console.log(
                        `Player initialized: ${user} at position y=${
                            bodies[user].carBody.position.y
                        }`,
                    );
                    notifyAllUsers({ type: 4, users: Object.keys(bodies) });
                }
            };
            ws.onclose = (_event) => {
                console.log('Connection closed');
                function removeValue(
                    value,
                    index,
                    arr,
                ) {
                    // If the value at the current array index matches the specified value
                    if (value === ws) {
                        // Removes the value from the original array
                        arr.splice(index, 1);
                        return true;
                    }
                    return false;
                }
                // Remove this connection from the connections array
                connections.filter(removeValue);
            };
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                //console.log('Message received', data);
                switch (data.type) {
                    case 2:
                        inputs[data.user][data.value] = true;
                        break;
                    case 3:
                        inputs[data.user][data.value] = false;
                        break;
                    default:
                        break;
                }
            };
        } catch (error) {
            console.error('WebSocket error:', error);
            ctx.response.status = 501;
            ctx.response.body = { message: 'Unable to establish WebSocket' };
        }
    });
}

// Run physics simulation at high frequency for accuracy
setInterval(updatePhysics, 1000 * PHYSICS_STEP);

// Send updates to clients at a lower frequency to reduce network traffic
setInterval(sendStateUpdates, SERVER_UPDATE_INTERVAL);
