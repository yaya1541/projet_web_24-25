import CANNON from 'https://cdn.jsdelivr.net/npm/cannon@0.6.2/+esm'
import { connections } from './back.ts';
import { Circuit } from './lib/circuit.js';

// Set up physics world
export const world = new CANNON.World();
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
    contactEquationRelaxation: 3
  }
);

// Add to world
world.addContactMaterial(carRoadContactMaterial);

console.log("Initiated server world");

export const circuit = new Circuit(null,world);


export const bodies = {}; // Store the Cannon.js bodies
export var stateL = {};
const inputs = {};

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

