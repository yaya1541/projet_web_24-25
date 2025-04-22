import CANNON from 'https://cdn.jsdelivr.net/npm/cannon@0.6.2/+esm'
import { connections } from './back.ts';

// Cannon.js world setup
export const world = new CANNON.World();
world.gravity.set(0, -9.82, 10); // Set gravity
world.broadphase = new CANNON.NaiveBroadphase(); // Broadphase algorithm
world.solver.iterations = 10; // Solver iterations

export const bodies = {}; // Store the Cannon.js bodies

function createBox(id, x, y, z, width, height, depth, mass) {
    const shape = new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2));
    const body = new CANNON.Body({ mass: mass, position: new CANNON.Vec3(x, y, z), shape: shape });
    console.log(body);
    
    world.addBody(body);
    bodies[id] = body;
}

function createCylinder(id, x, y, z, radius, height, mass) {
    const shape = new CANNON.Cylinder(radius, radius, height, 16);
    const body = new CANNON.Body({ mass: mass, position: new CANNON.Vec3(x, y, z), shape: shape, quaternion: new CANNON.Quaternion(.707,0,0,-.707)});
    world.addBody(body);
    bodies[id] = body;
}


export var stateL = {};

const EPSILON = 0.00005;

function updatePhysics() {
    world.step(1 / 60);

    const state = {};
    let hasChanges = false;

    for (const id in bodies) {
        const body = bodies[id];
        const newPosition = { x: body.position.x, y: body.position.y, z: body.position.z };
        const newQuaternion = { x: body.quaternion.x, y: body.quaternion.y, z: body.quaternion.z, w: body.quaternion.w };

        if (!stateL[id] ||
            Math.abs(stateL[id].position.x - newPosition.x ) > EPSILON &&
            Math.abs(stateL[id].position.y - newPosition.y ) > EPSILON &&
            Math.abs(stateL[id].position.z - newPosition.z ) > EPSILON ||
            Math.abs(stateL[id].quaternion.x - newQuaternion.x ) > EPSILON &&
            Math.abs(stateL[id].quaternion.y - newQuaternion.y ) > EPSILON &&
            Math.abs(stateL[id].quaternion.z - newQuaternion.z ) > EPSILON &&
            Math.abs(stateL[id].quaternion.w - newQuaternion.w) > EPSILON ) {
            state[id] = { position: newPosition, quaternion: newQuaternion };
            hasChanges = true;
        }
    }

    if (hasChanges) {
        stateL = state;
        connections.forEach((client) => {
            client.send(JSON.stringify(state));
        });

        console.log("Sent state:", state); // Add this line for logging
    }
}

setInterval(updatePhysics, 16.67); // Use 16.67ms for approximately 60 updates per second

