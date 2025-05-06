// Completed Car class with full prediction support
import CANNON from 'https://cdn.jsdelivr.net/npm/cannon@0.6.2/+esm';
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
import { GLTFLoader } from './GLTFLoader.js';

// Simple function to replace ALL materials in your model
function replaceAllMaterials(scene) {
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
    // Add constructor modifications
    constructor(world, scene, id, options = {}) {
        this.world = world;
        this.scene = scene;
        this.id = id;
        this.options = {
            position: new CANNON.Vec3(0, 1, 0),
            dimensions: { width: 2, height: 1, length: 4 },
            color: 0x0066ff,
            mass: 500,
            yOffset: 0.5, // CHANGED: Reduced from 4 to 0.5 to raise the car above ground
            ...options,
        };

        // Max steer, engine force values
        this.maxSteerVal = 0.5;
        this.maxForce = 1000;
        this.brakeForce = 20;

        // Improved deceleration and steering
        this.decelerationRate = 1000; // Higher value = faster deceleration
        this.steeringSmoothing = 0.05; // Lower value = smoother steering (0-1)
        this.currentSteering = 0.0;

        // Drift properties
        this.isDrifting = false;
        this.driftFactor = 0.25; // Lower value = more sideways sliding
        this.normalFrictionSlip = 5;
        this.driftFrictionSlip = 1.5; // Lower friction when drifting
        this.driftRecoveryRate = 0.5;
        this.driftTimer = 0;

        // FIXED: Set yOffset from options
        this.yOffset = this.options.yOffset;

        // Client prediction variables
        this.lastServerPosition = null;
        this.lastServerQuaternion = null;
        this.previousServerQuaternion = null; // ADDED: Initialize this property
        this.lastUpdateTime = Date.now();
        this.velocity = new THREE.Vector3();
        this.angularVelocity = new THREE.Vector3();
        this.interpolationFactor = 0.3; // For smooth corrections

        // Create physics body if world is provided (server or client with prediction)
        if (world) {
            this.createPhysicBody();
            this.createPhysicWheels();
        }

        // Create visual elements if scene is provided
        if (scene) {
            // If no physics world, create a temporary object to hold position/rotation
            if (!world) {
                this.carBody = {
                    position: new CANNON.Vec3(0, 1, 0),
                    quaternion: new CANNON.Quaternion(0, 0, 0, 1), // FIXED: Added w component
                    velocity: new CANNON.Vec3(0, 0, 0),
                    angularVelocity: new CANNON.Vec3(0, 0, 0),
                };
            }

            this.createBody();
            this.createWheels();
            this.loadModel();
        }
    }

    loadModel() {
        const loader = new GLTFLoader();
        // Configure le gestionnaire de requêtes
        loader.withCredentials = true;
        loader.load(
            'https://localhost:3000/src/racing_kart.glb',
            (obj) => {
                if (this.carMesh) {
                    this.scene.remove(this.carMesh);
                }

                const object = obj.scene;
                this.wheelMeshes = [];
                this.carMesh = object;
                replaceAllMaterials(object);

                // Center and scale model
                const box = new THREE.Box3().setFromObject(object);
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                const scale = 5 / maxDim;

                // CHANGED: Only adjust X and Z, preserve Y to maintain height
                object.position.x -= center.x;
                // object.position.y -= center.y; // Commented out to prevent sinking
                object.position.z -= center.z;

                // ADDED: Raise the model slightly to ensure it's above ground
                object.position.y += 1.0;

                object.scale.set(scale, scale, scale);
                this.scene.add(object);
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
        const carBodyShape = new CANNON.Box(new CANNON.Vec3(3, 1, 5));
        this.carBody = new CANNON.Body({ mass: 500 });
        this.carBody.addShape(carBodyShape);
        this.carBody.position.set(0, 1, 0);
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

        const wheelOptions = {
            directionLocal: new CANNON.Vec3(0, -1, 0),
            suspensionStiffness: 30,
            suspensionRestLength: 0.3,
            frictionSlip: this.normalFrictionSlip,
            dampingRelaxation: 2.3,
            dampingCompression: 4.4,
            maxSuspensionForce: 100000,
            rollInfluence: 0.01,
            axleLocal: new CANNON.Vec3(1, 0, 0),
            chassisConnectionPointLocal: new CANNON.Vec3(),
            maxSuspensionTravel: 0.3,
            customSlidingRotationalSpeed: -30,
            useCustomSlidingRotationalSpeed: true,
        };

        const frontWheelOptions = {
            radius: 0.4,
            ...wheelOptions,
        };
        const backWheelOptions = {
            radius: 0.4,
            ...wheelOptions,
        };

        // Front left wheel
        wheelOptions.chassisConnectionPointLocal.set(-1.5, -0.8, 1.7);
        this.vehicle.addWheel(frontWheelOptions);

        // Front right wheel
        wheelOptions.chassisConnectionPointLocal.set(1.5, -0.8, 1.7);
        this.vehicle.addWheel(frontWheelOptions);

        // Rear left wheel
        wheelOptions.chassisConnectionPointLocal.set(-1.5, -0.8, -1.7);
        this.vehicle.addWheel(backWheelOptions);

        // Rear right wheel
        wheelOptions.chassisConnectionPointLocal.set(1.5, -0.8, -1.7);
        this.vehicle.addWheel(backWheelOptions);

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

    // Update state from server and reconcile differences with predicted state
    updateFromServerState(
        serverPosition,
        serverQuaternion,
        serverVelocity,
        serverAngularVelocity,
    ) {
        if (!this.world) {
            // For other cars (without physics), just update visual position
            this.carMesh.position.lerp(
                new THREE.Vector3(
                    serverPosition.x,
                    serverPosition.y,
                    serverPosition.z,
                ),
                this.interpolationFactor,
            );

            this.carMesh.quaternion.slerp(
                new THREE.Quaternion(
                    serverQuaternion.x,
                    serverQuaternion.y,
                    serverQuaternion.z,
                    serverQuaternion.w,
                ),
                this.interpolationFactor,
            );

            // Store server position and velocity for prediction
            this.lastServerPosition = new THREE.Vector3(
                serverPosition.x,
                serverPosition.y,
                serverPosition.z,
            );
            this.lastServerQuaternion = new THREE.Quaternion(
                serverQuaternion.x,
                serverQuaternion.y,
                serverQuaternion.z,
                serverQuaternion.w,
            );

            // Update velocity for prediction
            if (serverVelocity) {
                this.velocity.set(
                    serverVelocity.x,
                    serverVelocity.y,
                    serverVelocity.z,
                );
            }

            if (serverAngularVelocity) {
                this.angularVelocity.set(
                    serverAngularVelocity.x,
                    serverAngularVelocity.y,
                    serverAngularVelocity.z,
                );
            }

            this.lastUpdateTime = Date.now();
        } else {
            // For player car (with physics), reconcile with server state
            const currentPos = this.carBody.position;
            const currentQuat = this.carBody.quaternion;

            // Calculate position error
            const posError = new CANNON.Vec3(
                serverPosition.x - currentPos.x,
                serverPosition.y - currentPos.y,
                serverPosition.z - currentPos.z,
            );

            const posErrorMagnitude = posError.length();

            // Calculate quaternion error (as angle)
            const serverQuat = new CANNON.Quaternion(
                serverQuaternion.x,
                serverQuaternion.y,
                serverQuaternion.z,
                serverQuaternion.w,
            );
            const quatDiff = serverQuat.mult(currentQuat.inverse());
            const angle = 2 * Math.acos(Math.abs(quatDiff.w));

            // If error is large, snap to server position
            if (posErrorMagnitude > 5.0 || angle > Math.PI / 4) {
                // Major correction needed - snap position
                this.carBody.position.copy(serverPosition);
                this.carBody.quaternion.copy(serverQuat);

                if (serverVelocity) {
                    this.carBody.velocity.set(
                        serverVelocity.x,
                        serverVelocity.y,
                        serverVelocity.z,
                    );
                }

                if (serverAngularVelocity) {
                    this.carBody.angularVelocity.set(
                        serverAngularVelocity.x,
                        serverAngularVelocity.y,
                        serverAngularVelocity.z,
                    );
                }
            } // Medium error - stronger interpolation
            else if (posErrorMagnitude > 1.0 || angle > Math.PI / 8) {
                // Apply a stronger correction (20%)
                this.carBody.position.x += posError.x * 0.2;
                this.carBody.position.y += posError.y * 0.2;
                this.carBody.position.z += posError.z * 0.2;

                // Interpolate rotation
                this.carBody.quaternion.slerp(serverQuat, 0.2);

                // Adjust velocity if provided
                if (serverVelocity) {
                    this.carBody.velocity.x = this.carBody.velocity.x * 0.8 +
                        serverVelocity.x * 0.2;
                    this.carBody.velocity.y = this.carBody.velocity.y * 0.8 +
                        serverVelocity.y * 0.2;
                    this.carBody.velocity.z = this.carBody.velocity.z * 0.8 +
                        serverVelocity.z * 0.2;
                }
            } // Small error - gentle correction
            else if (posErrorMagnitude > 0.1 || angle > Math.PI / 16) {
                // Apply a gentle correction (10%)
                this.carBody.position.x += posError.x * 0.1;
                this.carBody.position.y += posError.y * 0.1;
                this.carBody.position.z += posError.z * 0.1;

                // Gentle rotation correction
                this.carBody.quaternion.slerp(serverQuat, 0.1);
            }

            // Update timestamp for future predictions
            this.lastUpdateTime = Date.now();
        }
    }

    // Predict position for remote cars
    predictPosition(deltaTime) {
        if (!this.world && this.lastServerPosition && this.velocity) {
            // Only predict for other cars without physics
            const predictedPos = new THREE.Vector3(
                this.lastServerPosition.x + this.velocity.x * deltaTime,
                this.lastServerPosition.y + this.velocity.y * deltaTime,
                this.lastServerPosition.z + this.velocity.z * deltaTime,
            );

            // Apply prediction to visual mesh
            this.carMesh.position.copy(predictedPos);

            // Predict rotation using angular velocity if available
            if (this.lastServerQuaternion && this.angularVelocity) {
                // Convert angular velocity (radians/sec) to quaternion change
                const angularSpeed = this.angularVelocity.length();

                if (angularSpeed > 0.001) {
                    const axis = this.angularVelocity.clone().divideScalar(
                        angularSpeed,
                    );
                    const rotationQuaternion = new THREE.Quaternion();
                    rotationQuaternion.setFromAxisAngle(
                        axis,
                        angularSpeed * deltaTime,
                    );

                    // Apply rotation to last server quaternion
                    const newQuaternion = this.lastServerQuaternion.clone()
                        .multiply(rotationQuaternion);
                    this.carMesh.quaternion.copy(newQuaternion);
                }
            }
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

    update() {
        if (!this.carMesh) return;

        if (this.world) {
            // CHANGED: Adjusted Y position calculation
            this.carMesh.position.set(
                this.carBody.position.x,
                this.carBody.position.y - this.options.yOffset,
                this.carBody.position.z,
            );
            this.carMesh.quaternion.copy(this.carBody.quaternion);

            this.checkWrongPosition();

            // Update wheel meshes with corrected position
            for (let i = 0; i < Math.min(4, this.wheelMeshes.length); i++) {
                if (this.vehicle) {
                    this.vehicle.updateWheelTransform(i);
                    const transform = this.vehicle.wheelInfos[i].worldTransform;
                    this.wheelMeshes[i].position.copy(transform.position);
                    this.wheelMeshes[i].position.y -= this.options.yOffset;
                    this.wheelMeshes[i].quaternion.copy(transform.quaternion);
                }
            }
        }
    }

    checkWrongPosition() {
        if (this.carBody && this.carBody.position.y < -10) {
            // Reset car if it falls off the world
            this.carBody.position.set(0, 5, 0);
            this.carBody.velocity.set(0, 0, 0);
            this.carBody.angularVelocity.set(0, 0, 0);
            this.carBody.quaternion.set(0, 0, 0, 1);
        }
    }

    carPosition() {
        return this.carMesh ? this.carMesh.position : new THREE.Vector3();
    }

    speed() {
        if (!this.carBody || !this.carBody.velocity) return 0;
        return (this.carBody.velocity.length() * 3.6).toFixed(1);
    }
}
