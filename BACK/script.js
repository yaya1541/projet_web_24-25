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

export const circuit = new Circuit(null,world,{turnNumber:25,turnAmplitude: 130,roadWidth:30});


export const bodies = {}; // Store the Cannon.js bodies
export const connectedUsers = [];
export let stateL = {};
export const inputs = {};

const EPSILON = 0.01;

function updatePhysics() {
  // Step the physics world once
  world.step(1 / 120);
  
  const state = {
    type: 1,
    user: {}
  };
  
  let hasChanges = false;
  
  // Check each body for significant movement
  for (const id in bodies) {
    // Apply any control inputs
    if (inputs[id]) {
      bodies[id].control(inputs[id]);
    }
    
    const body = bodies[id].carBody;
    const newPosition = { x: body.position.x, y: body.position.y, z: body.position.z };
    const newQuaternion = { x: body.quaternion.x, y: body.quaternion.y, z: body.quaternion.z, w: body.quaternion.w };
    
    // Check if this is a new body or if position/rotation has changed enough
    const hasMovedEnough = !stateL[id] || hasChangedMoreThanEpsilon(stateL[id], newPosition, newQuaternion);
    
    if (hasMovedEnough) {
      state.user[id] = { position: newPosition, quaternion: newQuaternion };
      hasChanges = true;
    }
  }
  
  // Only send updates if bodies have moved significantly
  if (hasChanges) {
    // Save the new state
    stateL = {
      type: state.type,
      user: { ...state.user }  // Create a deep copy
    };
    // Send to all clients
    connections.forEach((client) => {
      client.send(JSON.stringify(state));
    });
  }
  
  // Final physics step
  world.step(1 / 60);
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

// Run physics update approximately 30 times per second (16.67ms * 2)
setInterval(updatePhysics, 16.67 * 2);