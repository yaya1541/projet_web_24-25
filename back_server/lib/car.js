// Simplified Car class without prediction logic
import CANNON from 'https://cdn.jsdelivr.net/npm/cannon@0.6.2/+esm';
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
import { CSS2DObject, CSS2DRenderer } from './CSS2DRenderer.js';
import { GLTFLoader } from './GLTFLoader.js';

// Simple function to replace ALL materials in your model
export function replaceAllMaterials(scene) {
    console.log('Replacing all materials with compatible ones');

    scene.traverse((object) => {
        if (object.isMesh) {
            // Get basic properties from the original material
            const originalMaterial = object.material;

            if (originalMaterial) {
                // Handle array of materials
                if (Array.isArray(originalMaterial)) {
                    // Create an array of new materials to replace the old ones
                    const newMaterials = originalMaterial.map((mat) => {
                        return createSimpleMaterial(mat);
                    });

                    // Replace with array of new materials
                    object.material = newMaterials;
                } // Handle single material
                else {
                    object.material = createSimpleMaterial(originalMaterial);
                }
            }
        }
    });

    console.log('All materials replaced successfully');
}

// Helper function to create a compatible material
function createSimpleMaterial(originalMaterial) {
    // Extract properties from original material
    const texture = originalMaterial.map || null;
    const color = originalMaterial.color
        ? originalMaterial.color.getHex()
        : 0xcccccc;
    const transparent = originalMaterial.transparent || false;
    const opacity = originalMaterial.opacity || 1.0;
    const normalMap = originalMaterial.normalMap || null;
    const emissive = originalMaterial.emissive
        ? originalMaterial.emissive.getHex()
        : 0x000000;
    const emissiveMap = originalMaterial.emissiveMap || null;

    // Create new material - MeshPhongMaterial works well for most models
    const newMaterial = new THREE.MeshPhongMaterial({
        map: texture,
        color: color,
        transparent: transparent,
        opacity: opacity,
        normalMap: normalMap,
        emissive: emissive,
        emissiveMap: emissiveMap,
        shininess: 30,
        side: originalMaterial.side || THREE.DoubleSide,
    });

    // Copy name for debugging
    newMaterial.name = originalMaterial.name
        ? originalMaterial.name + '_fixed'
        : 'fixed_material';

    return newMaterial;
}

export class Car {
    constructor(world, scene, id, options = {}) {
        this.world = world;
        this.scene = scene;
        this.id = id;
        this.options = {
            position: new CANNON.Vec3(0, 1, 0),
            dimensions: { width: 1.5, height: 1, length: 2.5 },
            color: 0x0066ff,
            mass: 500,
            yOffset: 2,
            roadLevel: 0, // Default road Y level
            resetHeight: 2, // Height above road to reset
            name: options.name || `Car ${id}`, // Add name option
            ...options,
        };

        // Store road level and reset height for position checks
        this.roadLevel = this.options.roadLevel;
        this.resetHeight = this.options.resetHeight;

        // Car control parameters
        this.maxSteerVal = 0.5;
        this.maxForce = 1000;
        this.brakeForce = 5;
        this.decelerationRate = 1000;
        this.steeringSmoothing = 0.05;
        this.currentSteering = 0.0;

        this.normalFrictionSlip = 5;

        // Store yOffset for position adjustments
        this.yOffset = this.options.yOffset;

        // Create physics body if world is provided
        if (world) {
            this.createPhysicBody();
            this.createPhysicWheels();
        }

        // Create visual elements if scene is provided
        if (scene) {
            // If no physics world, create a temporary object to hold position/rotation
            if (!world) {
                this.carBody = {
                    position: new CANNON.Vec3(0, 2, 0),
                    quaternion: new CANNON.Quaternion(0, 0, 0, 1),
                    velocity: new CANNON.Vec3(0, 0, 0),
                    angularVelocity: new CANNON.Vec3(0, 0, 0),
                };
                this.carBody.allowSleep = false;
                this.carBody.sleepSpeedLimit = 0.01;
            }
            this.createBody();
            //this.createWheels();
            this.loadModel();
            this.createNameLabel(this.options.name);
        }
    }

    createNameLabel(name) {
        // Create a div element for the label
        const labelDiv = document.createElement('div');
        labelDiv.className = 'car-label';
        labelDiv.textContent = name;
        // Style the label (customize as needed)
        labelDiv.style.padding = '2px 8px';
        labelDiv.style.background = 'rgba(0,0,0,0.6)';
        labelDiv.style.color = '#fff';
        labelDiv.style.borderRadius = '6px';
        labelDiv.style.fontSize = '14px';
        labelDiv.style.whiteSpace = 'nowrap';
        labelDiv.style.pointerEvents = 'none';
        labelDiv.style.transform = 'translate(-50%, -100%)';

        // Create the CSS2DObject
        this.nameLabel = new CSS2DObject(labelDiv);

        // Position the label above the car (y offset)
        this.nameLabel.position.set(
            0,
            this.options.dimensions.height / 2 + 0.8,
            0,
        );

        // Attach to car mesh if available, else to scene (will reattach after model loads)
        if (this.carMesh) {
            this.carMesh.add(this.nameLabel);
        } else if (this.scene) {
            this.scene.add(this.nameLabel);
        }
    }

    loadModel() {
        const loader = new GLTFLoader();
        // Configure request handler
        loader.withCredentials = true;
        loader.load(
            `https://yanisrasp.duckdns.org:3000/api/src/racing_kart.glb`,
            (obj) => {
                if (this.carMesh) {
                    this.scene.remove(this.carMesh);
                }
                const object = obj.scene;

                this.wheelMeshes = [];
                this.frontWheelIndices = []; // Track front wheel indices
                this.carMesh = object;
                const kart =
                    object.children[0].children[0].children[0].children;
                console.log(kart);

                const box = new THREE.Box3().setFromObject(object);
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                const scale = 5 / maxDim;

                // Only adjust X and Z, preserve Y to maintain height
                object.position.x -= center.x;
                object.position.z -= center.z;

                replaceAllMaterials(object);
                console.log(this.wheelMeshes);
                console.log('Front wheel indices:', this.frontWheelIndices);

                object.scale.set(scale, scale, scale);
                this.scene.add(object);

                // --- Attach label to car mesh after model loads ---
                if (this.nameLabel) {
                    object.add(this.nameLabel);
                    // Adjust label position if needed
                    this.nameLabel.position.set(0, size.y * scale + 0.8, 0);
                }
            },
            // called while loading is progressing
            (xhr) => {
                console.log(
                    `${xhr.loaded} sur ${xhr.total} octets chargés (${
                        (xhr.loaded / xhr.total * 100).toFixed(2)
                    }%)`,
                );
            },
            // called when loading has errors
            function (error) {
                console.log('An error happened');
                console.log(error);
            },
        );
    }

    createPhysicBody() {
        const carBodyShape = new CANNON.Box(new CANNON.Vec3(1.5, 1, 2.5));
        this.carBody = new CANNON.Body({ mass: 500 });
        this.carBody.addShape(carBodyShape);
        this.carBody.position.set(0, 2, 0);
        this.carBody.angularDamping = 0.3;
        this.carBody.ccdSpeedThreshold = 1; // Set this lower than your car's top speed

        // For the car body
        this.carBody.shapes.forEach((shape) => {
            shape.collisionFilterGroup = 1; // Car group
            shape.collisionFilterMask = 2; // Road group
        });

        this.carMaterial = new CANNON.Material('car');
        this.carBody.material = this.carMaterial;

        this.world.addBody(this.carBody);
    }

    createBody() {
        // Create car body
        const carGeometry = new THREE.BoxGeometry(
            this.options.dimensions.width,
            this.options.dimensions.height,
            this.options.dimensions.length,
        );

        // Create car body material
        this.carMaterial = new THREE.MeshStandardMaterial({
            color: this.options.color,
            roughness: 0.5,
            metalness: 0.5,
        });

        // Create car body visual
        this.carMesh = new THREE.Mesh(carGeometry, this.carMaterial);
        this.carMesh.castShadow = true;

        // Add to scene
        this.scene.add(this.carMesh);
    }

    createPhysicWheels() {
        // Create wheels
        this.wheelShape = new CANNON.Sphere(0.5);
        this.wheelMaterial = new CANNON.Material('wheel');

        // Vehicle properties
        this.vehicle = new CANNON.RaycastVehicle({
            chassisBody: this.carBody,
            indexForwardAxis: 2,
            indexRightAxis: 0,
            indexUpAxis: 1,
        });

        // Car dimensions
        const width = this.options.dimensions.width || 1.5;
        const length = this.options.dimensions.length || 2.5;
        const wheelYOffset = -0.7; // Slightly below chassis

        // Wheel positions (relative to car center)
        const halfWidth = width / 2;
        const halfLength = length / 2;

        // Common wheel options
        const baseWheelOptions = {
            directionLocal: new CANNON.Vec3(0, -1, 0),
            suspensionStiffness: 30,
            suspensionRestLength: 0.3,
            frictionSlip: this.normalFrictionSlip,
            dampingRelaxation: 2.3,
            dampingCompression: 4.4,
            maxSuspensionForce: 100000,
            rollInfluence: 0.01,
            axleLocal: new CANNON.Vec3(1, 0, 0),
            maxSuspensionTravel: 0.3,
            customSlidingRotationalSpeed: -30,
            useCustomSlidingRotationalSpeed: true,
            radius: 0.4,
        };

        // Front left wheel
        this.vehicle.addWheel({
            ...baseWheelOptions,
            isFrontWheel: true,
            chassisConnectionPointLocal: new CANNON.Vec3(
                -halfWidth,
                wheelYOffset,
                halfLength,
            ),
        });

        // Front right wheel
        this.vehicle.addWheel({
            ...baseWheelOptions,
            isFrontWheel: true,
            chassisConnectionPointLocal: new CANNON.Vec3(
                halfWidth,
                wheelYOffset,
                halfLength,
            ),
        });

        // Rear left wheel
        this.vehicle.addWheel({
            ...baseWheelOptions,
            isFrontWheel: false,
            chassisConnectionPointLocal: new CANNON.Vec3(
                -halfWidth,
                wheelYOffset,
                -halfLength,
            ),
        });

        // Rear right wheel
        this.vehicle.addWheel({
            ...baseWheelOptions,
            isFrontWheel: false,
            chassisConnectionPointLocal: new CANNON.Vec3(
                halfWidth,
                wheelYOffset,
                -halfLength,
            ),
        });

        this.vehicle.addToWorld(this.world);
    }

    createWheels() {
        // Create wheel visuals
        this.wheelGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.5, 32);
        this.wheelGeometry.rotateZ(Math.PI / 2);
        this.wheelMesh = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.7,
            metalness: 0,
        });
        this.wheelMeshes = [];

        for (let i = 0; i < 4; i++) {
            const cylinderMesh = new THREE.Mesh(
                this.wheelGeometry,
                this.wheelMesh,
            );
            cylinderMesh.castShadow = true;
            this.scene.add(cylinderMesh);
            this.wheelMeshes.push(cylinderMesh);
        }
    }

    // Apply natural deceleration to the car
    applyNaturalDeceleration(deltaTime) {
        // Get current velocity
        const velocity = this.carBody.velocity.clone();
        const speed = velocity.length() * 3.6;

        // If the car is moving, apply deceleration
        if (speed > 0.1) {
            // Calculate deceleration force
            const decelForce = this.decelerationRate * deltaTime * 100;

            // Create normalized direction vector
            const direction = velocity.clone();
            direction.normalize();

            // Scale direction by deceleration force
            direction.scale(-Math.min(decelForce, speed), direction);

            // Apply force to slow down the car
            this.carBody.applyLocalForce(direction, new CANNON.Vec3(0, 0, 0));
        }
    }

    // Apply smooth steering
    applySmoothSteering(targetSteeringValue, deltaTime) {
        // Interpolate between current and target steering value
        const steeringDiff = targetSteeringValue - this.currentSteering;
        this.currentSteering += steeringDiff * this.steeringSmoothing /
            deltaTime / 100;

        // Apply the smooth steering value to both front wheels
        this.vehicle.setSteeringValue(this.currentSteering, 0);
        this.vehicle.setSteeringValue(this.currentSteering, 1);
    }

    /**
     * Set wheel mesh states (steering and rotation) from server data.
     * @param {Array} wheels - Array of wheel state objects from server.
     */
    setWheelStatesFromServer(wheels) {
        if (!this.wheelMeshes || !wheels) return;
        for (
            let i = 0;
            i < Math.min(this.wheelMeshes.length, wheels.length);
            i++
        ) {
            const mesh = this.wheelMeshes[i];
            const wheel = wheels[i];
            // Only update X (roll) and Y (steer), never Z!
            mesh.rotation.y = wheel.steering || 0; // steering (front wheels)
            mesh.rotation.x = wheel.rotation || 0; // rolling
            // mesh.rotation.z = 0; // (optional: forcibly zero out Z)
        }
    }

    setName(newName) {
        if (this.nameLabel && this.nameLabel.element) {
            this.nameLabel.element.textContent = newName;
        }
    }

    control(keysPressed, deltaTime = 1 / 60) {
        if (!this.vehicle) return;

        // Calculate target steering value
        deltaTime = deltaTime !== 0 ? deltaTime : 0.01;
        let targetSteering = 0;
        if (keysPressed['q'] || keysPressed['arrowleft']) {
            targetSteering = this.maxSteerVal;
        } else if (keysPressed['d'] || keysPressed['arrowright']) {
            targetSteering = -this.maxSteerVal;
        }

        // Apply smooth steering
        this.applySmoothSteering(targetSteering, deltaTime);

        // Apply engine force on rear wheels
        if (
            (keysPressed['z'] || keysPressed['arrowup']) && this.speed() < 130
        ) {
            console.log('Accelerating');

            this.vehicle.applyEngineForce(-this.maxForce, 2);
            this.vehicle.applyEngineForce(-this.maxForce, 3);
        } else if (keysPressed['s'] || keysPressed['arrowdown']) {
            this.vehicle.applyEngineForce(this.maxForce, 2);
            this.vehicle.applyEngineForce(this.maxForce, 3);
        } else {
            // No key pressed, apply natural deceleration
            this.vehicle.applyEngineForce(0, 2);
            this.vehicle.applyEngineForce(0, 3);
            this.applyNaturalDeceleration(deltaTime);
        }

        // Apply brake
        if (keysPressed[' ']) { // Spacebar
            this.vehicle.setBrake(this.brakeForce, 0);
            this.vehicle.setBrake(this.brakeForce, 1);
            this.vehicle.setBrake(this.brakeForce, 2);
            this.vehicle.setBrake(this.brakeForce, 3);
        } else {
            this.vehicle.setBrake(0, 0);
            this.vehicle.setBrake(0, 1);
            this.vehicle.setBrake(0, 2);
            this.vehicle.setBrake(0, 3);
        }

        // Drift control - triggered with Shift key while turning
        const isTurning = Math.abs(targetSteering) > 0.1;
        const speed = this.speed();
        const isDriftKeyPressed = keysPressed['shift'];

        if (isTurning && speed > 40 && isDriftKeyPressed && !this.isDrifting) {
            // Initiate drift
            this.isDrifting = true;

            // Lower friction during drift
            for (let i = 0; i < 4; i++) {
                this.vehicle.wheelInfos[i].frictionSlip =
                    this.driftFrictionSlip;
            }
        } else if (this.isDrifting && (!isDriftKeyPressed || speed < 20)) {
            // End drift
            this.isDrifting = false;

            // Reset friction
            for (let i = 0; i < 4; i++) {
                this.vehicle.wheelInfos[i].frictionSlip =
                    this.normalFrictionSlip;
            }
        }
    }

    // Modified update method
    update() {
        if (!this.carMesh) return;

        // For physics-enabled cars (local player)
        if (this.world && this.carBody) {
            // Apply anti-clipping before updating visual position
            this.preventClipping();
            this.checkWrongPosition();

            this.carMesh.position.copy(this.carBody.position);
            this.carMesh.quaternion.copy(this.carBody.quaternion);

            // Update wheel meshes
            for (let i = 0; i < Math.min(4, this.wheelMeshes.length); i++) {
                if (this.vehicle) {
                    this.vehicle.updateWheelTransform(i);
                    const transform = this.vehicle.wheelInfos[i].worldTransform;
                    this.wheelMeshes[i].position.copy(transform.position);
                    this.wheelMeshes[i].position.y -= this.yOffset;
                    this.wheelMeshes[i].quaternion.copy(transform.quaternion);
                }
            }

            // Apply visual steering rotation to front wheels
            if (this.frontWheelIndices && this.frontWheelIndices.length > 0) {
                // Get the current steering value from the vehicle
                let steeringValue = 0;
                if (this.vehicle && this.vehicle.wheelInfos) {
                    // Use the steering value from the first front wheel
                    steeringValue = this.vehicle.wheelInfos[0].steering;
                } else {
                    steeringValue = this.currentSteering;
                }

                // Apply rotation to each front wheel
                for (const idx of this.frontWheelIndices) {
                    if (this.wheelMeshes[idx]) {
                        // Rotate around Y axis for steering
                        this.wheelMeshes[idx].rotation.y = steeringValue;
                    }
                }
            }
        } // For non-physics cars (remote players)
        else if (this.carMesh) {
            // Position and rotation are set by prediction system
            // Just ensure wheels are updated if available
            if (this.wheelMeshes && this.wheelStates) {
                this.setWheelStatesFromServer(this.wheelStates);
            }
        }
    }

    // Enhanced sync from server
    syncFromServer(serverState) {
        if (this.carBody) {
            // For physics body (local player)
            this.carBody.position.set(
                serverState.position.x,
                serverState.position.y,
                serverState.position.z,
            );
            this.carBody.quaternion.set(
                serverState.quaternion.x,
                serverState.quaternion.y,
                serverState.quaternion.z,
                serverState.quaternion.w,
            );
            this.carBody.velocity.set(
                serverState.velocity.x,
                serverState.velocity.y,
                serverState.velocity.z,
            );
            this.carBody.angularVelocity.set(
                serverState.angularVelocity.x,
                serverState.angularVelocity.y,
                serverState.angularVelocity.z,
            );
        } else {
            // For non-physics cars (remote players)
            this.carMesh.position.set(
                serverState.position.x,
                serverState.position.y,
                serverState.position.z,
            );
            this.carMesh.quaternion.set(
                serverState.quaternion.x,
                serverState.quaternion.y,
                serverState.quaternion.z,
                serverState.quaternion.w,
            );
        }

        // Store wheel states for later use
        if (serverState.wheels) {
            this.wheelStates = serverState.wheels;
            this.setWheelStatesFromServer(this.wheelStates);
        }
    }

    checkWrongPosition() {
        // The threshold can be adjusted based on your road's Y position
        const minY = this.roadLevel - 0.5; // Allow a little margin below road
        if (this.carBody && this.carBody.position.y < minY) {
            // Reset car if it falls off the world or clips into the road
            this.resetCarPosition();
        }
    }

    // Reset car to a safe position above the road
    resetCarPosition() {
        // Place car at starting position or above the road
        const safeY = this.roadLevel + this.resetHeight;
        const pos = this.options.position || new CANNON.Vec3(0, safeY, 0);

        this.carBody.position.set(pos.x, safeY, pos.z);
        this.carBody.velocity.set(0, 0, 0);
        this.carBody.angularVelocity.set(0, 0, 0);
        this.carBody.quaternion.set(0, 0, 0, 1);

        // Also reset visual mesh if needed
        if (this.carMesh) {
            this.carMesh.position.set(pos.x, safeY - this.yOffset, pos.z);
            this.carMesh.quaternion.set(0, 0, 0, 1);
        }
    }

    // Prevent car from clipping through the road during normal operation
    preventClipping() {
        // Prevent car from sinking below the road
        const minY = this.roadLevel + 0.1; // Small margin above road
        if (this.carBody && this.carBody.position.y < minY) {
            this.carBody.position.y = minY;
            this.carBody.velocity.y = Math.max(0, this.carBody.velocity.y); // Prevent downward velocity
        }
    }

    // Get car position - useful for cameras and other attachments
    getPosition() {
        return this.carMesh ? this.carMesh.position : new THREE.Vector3();
    }

    // Get car speed in km/h
    speed() {
        if (!this.carBody || !this.carBody.velocity) return 0;
        return (this.carBody.velocity.length() * 3.6).toFixed(1);
    }

    // Get the full state of the car for networking
    getState() {
        if (!this.carBody) return null;

        return {
            position: {
                x: this.carBody.position.x,
                y: this.carBody.position.y,
                z: this.carBody.position.z,
            },
            quaternion: {
                x: this.carBody.quaternion.x,
                y: this.carBody.quaternion.y,
                z: this.carBody.quaternion.z,
                w: this.carBody.quaternion.w,
            },
            velocity: {
                x: this.carBody.velocity.x,
                y: this.carBody.velocity.y,
                z: this.carBody.velocity.z,
            },
            angularVelocity: {
                x: this.carBody.angularVelocity.x,
                y: this.carBody.angularVelocity.y,
                z: this.carBody.angularVelocity.z,
            },
        };
    }
}
