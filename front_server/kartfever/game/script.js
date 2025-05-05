import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';

import { Circuit } from 'https://localhost:3000/lib/circuit.js';
import { Car } from 'https://localhost:3000/lib/car.js';

const ws = new WebSocket('wss://localhost:3000/game/kartfever');

// Basic Driveable Car using Cannon.js and Three.js
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
    75,
    globalThis.innerWidth / globalThis.innerHeight,
    0.1,
    1000,
);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(globalThis.innerWidth, globalThis.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const gridHelper = new THREE.GridHelper(10, 10);
scene.add(gridHelper);
const axesHelper = new THREE.AxesHelper(10, 10);
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

const keysPressed = {};
document.addEventListener('keydown', (event) => {
    keysPressed[event.key.toLowerCase()] = true;
});

document.addEventListener('keyup', (event) => {
    keysPressed[event.key.toLowerCase()] = false;
});

camera.position.y = 50;
camera.position.z = 100;
camera.rotateX(-Math.PI / 6);

const cars = {};

// Animation loop
let lastTime;
function animate(time) {
    const _dt = lastTime ? (time - lastTime) / 1000 : 0;
    lastTime = time;

    requestAnimationFrame(animate);

    const cameraOffset = new THREE.Vector3();
    cameraOffset.set(0, 5, -10);
    if (username) {
        if (cars[username]) {
            //cameraOffset.applyQuaternion(car.carMesh.quaternion);

            //camera.position.copy(car.carPosition()).add(cameraOffset);
            //camera.lookAt(car.carPosition());

            cameraOffset.applyQuaternion(cars[username].carMesh.quaternion);

            camera.position.copy(cars[username].carPosition()).add(
                cameraOffset,
            );
            camera.lookAt(cars[username].carPosition());
        }
    }
    renderer.render(scene, camera);
}

// Handle window resize
globalThis.addEventListener('resize', () => {
    camera.aspect = globalThis.innerWidth / globalThis.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(globalThis.innerWidth, globalThis.innerHeight);
});

let username = await fetch(`https://localhost:3000/api/user/getdata`, {
    method: 'GET',
    credentials: 'include',
}).then(async (res) => {
    return await res.json();
}).then((data) => {
    console.log(data);
    data.others.forEach((elt) => {
        if (!cars[elt]) {
            cars[elt] = new Car(null, scene, elt);
        }
    });
    return data.user;
});
console.log(username);

// Start animation loop
animate();

ws.onopen = async (_ctx) => {
    username = await fetch(`https://localhost:3000/api/user/getdata`, {
        method: 'GET',
        credentials: 'include',
    }).then(async (res) => {
        return await res.json();
    }).then((data) => {
        console.log(data);
        return data.user;
    });
};

let circuit;

ws.onmessage = (ctx) => {
    const data = JSON.parse(ctx.data);
    switch (data.type) {
        case 0: {
            console.log('Received data:', data); // Add this line for logging
            circuit = new Circuit(scene, null, {
                roadWidth: data.CircuitWitdh,
            });
            data.CircuitPoints.forEach((element) => {
                const obj = new THREE.Mesh(
                    new THREE.BoxGeometry(2, 2, 2),
                    new THREE.MeshBasicMaterial({ color: 0x00FF00 }),
                );
                obj.position.set(
                    element.x,
                    0,
                    element.y,
                );
                scene.add(obj);
            });
            circuit.pathNodes = data.CircuitNodes;
            circuit.pathPoints = data.CircuitPoints;
            circuit.makePath();
            circuit.makeRoad();

            console.log(data.CircuitPoints[2], circuit.pathPoints[2]);
            console.log(document.cookie);

            //car = new Car(null,scene,username);
            if (username != undefined) {
                cars[username] = new Car(null, scene, username);
                partyStatus = true;
            }
            break;
        }
        case 1: {
            //console.log("Recieved positions",data);
            //console.log(username);
            /*
            if (data.user == username) {
                car.carMesh.position.copy(data.user[username].position);
                car.carMesh.quaternion.copy(data.user[username].quaternion);
            }
            */
            console.log(data);

            for (const id in data.user) {
                if (cars[id]) {
                    console.log(id, cars);
                    cars[id].carMesh.position.copy(data.user[id].position);
                    cars[id].carMesh.quaternion.copy(data.user[id].quaternion);
                }
            }
            break;
        }
        case 4: {
            /*new player connection;*/
            console.log('New player connected', data);
            data.users.forEach((elt) => {
                if (!cars[elt]) {
                    cars[elt] = new Car(null, scene, elt);
                }
            });

            break;
        }
        default:
            break;
    }
};

ws.onerror = (ctx) => {
    switch (ctx.status) {
        case 401:
            document.location.replace('https://localhost:8080/login');
            break;
        default:
            break;
    }
};

const inputs = {};

document.addEventListener('keydown', (event) => {
    if (!inputs[event.key]) {
        ws.send(JSON.stringify({
            type: 2,
            user: username,
            value: event.key,
        }));
    }
    inputs[event.key] = true;
});

document.addEventListener('keyup', (event) => {
    ws.send(JSON.stringify({
        type: 3,
        user: username,
        value: event.key,
    }));
    inputs[event.key] = false;
});

globalThis.onbeforeunload = (_ev) => {
    alert('window unloading');
};
/*
window.addEventListener("gamepadconnected", (e) => {
    console.log(
      "Gamepad connected at index %d: %s. %d buttons, %d axes.",
      e.gamepad.index,
      e.gamepad.id,
      e.gamepad.buttons.length,
      e.gamepad.axes.length,
    );
  });
*/
