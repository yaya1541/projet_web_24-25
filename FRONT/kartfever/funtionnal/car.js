import CANNON from 'https://cdn.jsdelivr.net/npm/cannon@0.6.2/+esm';
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
import { GLTFLoader } from '../lib/GLTFLoader.js';

export class Car{
    constructor(world, scene, options = {}){
        this.world = world;
        this.scene = scene;
        this.options = {
            position : new CANNON.Vec3(0,1,0),
            dimensions : {width : 2, height : 1, length : 4},
            color : 0x0066ff,
            mass : 500,
            ...options
        }
        // Max steer, engine force values
        this.maxSteerVal = 0.5;
        this.maxForce = 1000;
        this.brakeForce = 500;

        // Drift properties
        this.isDrifting = false;
        this.driftFactor = 0.3; // Lower value = more sideways sliding
        this.normalFrictionSlip = 4;
        this.driftFrictionSlip = 1.5; // Lower friction when drifting
        this.driftRecoveryRate = 0.5;
        this.driftTimer = 0;
        this.driftParticles = [];

        this.createBody(); 
        this.loadModel();
        this.createWheels();
    }

    loadModel(){
        const positionOffset = {
            x:0,
            y:0,
            z:0
        }
        const loader = new GLTFLoader();
        loader.load('./kartfever/funtionnal/Kart/Kart.glb',(obj)=>{
            if (this.carMesh){
                this.scene.remove(this.carMesh);
            }
            let object = obj.scene;
            this.carMesh = object;

            const box = new THREE.Box3().setFromObject(object);
            const center = box.getCenter(new THREE.Vector3());
            
            object.position.set(0, 0, 0);
            object.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    // Apply the original centering
                    child.geometry.translate(-center.x, -center.y, -center.z);
                    
                    // Then apply additional position offset
                    child.geometry.translate(
                        positionOffset.x, 
                        positionOffset.y, 
                        positionOffset.z
                    );
                    child.geometry.rotateY(-Math.PI/2);
                }
            });

            object.rotation.y = -Math.PI/2;
            object.castShadow = true;
            object.updateMatrix();

            object.position.copy(this.carBody.position);
            object.quaternion.copy(this.carBody.quaternion);
            this.scene.add(object);
            console.log(object);
            
        },
        // called while loading is progressing
        function ( xhr ) {
            console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );
        },
        // called when loading has errors
        function ( error ) {
            console.log( 'An error happened' );
        })
    }

    createBody(){
        // Create car body
        const carGeometry = new THREE.BoxGeometry(2, 1, 4);
        const carBodyShape = new CANNON.Box(new CANNON.Vec3(1, 0.5, 2));
        this.carBody = new CANNON.Body({ mass: 500 });
        this.carBody.addShape(carBodyShape);
        this.carBody.position.set(0, 1, 0);
        this.carBody.angularDamping = 0.3;
        this.world.addBody(this.carBody);

        this.carBody.ccdSpeedThreshold = 1; // Set this lower than your car's top speed
        
        // For the car body
        this.carBody.shapes.forEach(shape => {
            shape.collisionFilterGroup = 1; // Car group
            shape.collisionFilterMask = 2;  // Road group
        });

        this.carMaterial = new CANNON.Material('car');
        this.carBody.material = this.carMaterial;

        // Create car body visual
        

        this.carMesh = new THREE.Mesh(carGeometry, this.carMaterial);
        this.carMesh.castShadow = true;
        this.scene.add(this.carMesh);
    }

    createWheels(){
        // Create wheels
        this.wheelShape = new CANNON.Sphere(0.5);
        this.wheelMaterial = new CANNON.Material("wheel");
        
        // Vehicle properties
        this.vehicle = new CANNON.RaycastVehicle({
            chassisBody: this.carBody,
            indexForwardAxis: 2,
            indexRightAxis: 0,
            indexUpAxis: 1
        });
        
        const wheelOptions = {
            radius: 0.5,
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
            useCustomSlidingRotationalSpeed: true
        };
        
        // Front left wheel
        wheelOptions.chassisConnectionPointLocal.set(-1, 0, 1.5);
        this.vehicle.addWheel(wheelOptions);
        
        // Front right wheel
        wheelOptions.chassisConnectionPointLocal.set(1, 0, 1.5);
        this.vehicle.addWheel(wheelOptions);
        
        // Rear left wheel
        wheelOptions.chassisConnectionPointLocal.set(-1, 0, -1.5);
        this.vehicle.addWheel(wheelOptions);
        
        // Rear right wheel
        wheelOptions.chassisConnectionPointLocal.set(1, 0, -1.5);
        this.vehicle.addWheel(wheelOptions);
        
        this.vehicle.addToWorld(this.world);
        
        // Create wheel visuals
        this.wheelGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 32);
        this.wheelGeometry.rotateZ(Math.PI / 2);
        this.wheelMesh = new THREE.MeshStandardMaterial({ 
            color: 0x333333, 
            roughness: 0.7, 
            metalness: 0.2
        });
        this.wheelMeshes = [];
        
        for (let i = 0; i < 4; i++) {
            const cylinderMesh = new THREE.Mesh(this.wheelGeometry, this.wheelMesh);
            cylinderMesh.castShadow = true;
            this.scene.add(cylinderMesh);
            this.wheelMeshes.push(cylinderMesh);
        }
    }

    initDriftParticles() {
        // Optional: Create drift smoke particles
        const particleGeometry = new THREE.BufferGeometry();
        const particleCount = 200;
        
        const positions = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);
        
        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = 0;
            positions[i * 3 + 1] = 0;
            positions[i * 3 + 2] = 0;
            sizes[i] = 0;
        }
        
        particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        const particleMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.1,
            transparent: true,
            opacity: 0.6
        });
        
        const particles = new THREE.Points(particleGeometry, particleMaterial);
        this.scene.add(particles);
        
        return {
            mesh: particles,
            positions: positions,
            sizes: sizes,
            count: particleCount,
            active: new Array(particleCount).fill(false),
            lifetime: new Array(particleCount).fill(0)
        };
    }

    startDrift() {
        if (!this.isDrifting) {
            this.isDrifting = true;
            
            // Reduce tire friction on rear wheels for sliding
            for (let i = 2; i < 4; i++) {
                this.vehicle.wheelInfos[i].frictionSlip = this.driftFrictionSlip;
            }
            
            // Apply a slight sideways force to initiate the drift
            const forwardDir = new CANNON.Vec3();
            this.carBody.vectorToWorldFrame(new CANNON.Vec3(0, 0, 1), forwardDir);
            
            const rightDir = new CANNON.Vec3();
            this.carBody.vectorToWorldFrame(new CANNON.Vec3(1, 0, 0), rightDir);
            
            // Apply sideways impulse based on steering direction
            const steeringDir = this.vehicle.wheelInfos[0].steering > 0 ? 1 : -1;
            rightDir.scale(steeringDir * this.carBody.velocity.length() * 0.2, rightDir);
            this.carBody.applyImpulse(rightDir, new CANNON.Vec3());
        }
    }

    endDrift() {
        if (this.isDrifting) {
            this.isDrifting = false;
            this.driftTimer = 0;
            
            // Gradually restore normal friction values
            for (let i = 2; i < 4; i++) {
                this.vehicle.wheelInfos[i].frictionSlip = this.normalFrictionSlip;
            }
        }
    }

    updateDrift(deltaTime) {
        if (this.isDrifting) {
            this.driftTimer += deltaTime;
            
            // Get sideways velocity component for countersteer assist
            const forwardDir = new CANNON.Vec3();
            this.carBody.vectorToWorldFrame(new CANNON.Vec3(0, 0, 1), forwardDir);
            forwardDir.normalize();
            
            // Apply slight countersteer assistance to maintain drift
            const vel = this.carBody.velocity.clone();
            const forwardVel = forwardDir.scale(vel.dot(forwardDir), new CANNON.Vec3());
            const sideVel = vel.vsub(forwardVel);
            
            // Calculate drift angle for visualization or gameplay effects
            const driftAngle = Math.atan2(sideVel.length(), forwardVel.length());
            
            // Update drift particles if they exist
            if (this.driftParticles.length > 0) {
                this.updateDriftParticles(deltaTime, driftAngle);
            }
            
            // Gradually reduce drift effect over time if needed
            if (this.driftTimer > 5) { // Maximum drift time in seconds
                this.endDrift();
            }
        }
    }

    updateDriftParticles(deltaTime, driftAngle) {
        // Optional: Update drift smoke particles
        // This would be implemented if you added the visual particles
    }

    control(keysPressed, deltaTime = 1/60) {
        // Apply engine force on rear wheels
        if (keysPressed['z'] || keysPressed['arrowup']) {
            this.vehicle.applyEngineForce(-this.maxForce, 2);
            this.vehicle.applyEngineForce(-this.maxForce, 3);
        } else if (keysPressed['s'] || keysPressed['arrowdown']) {
            this.vehicle.applyEngineForce(this.maxForce, 2);
            this.vehicle.applyEngineForce(this.maxForce, 3);
        } else {
            this.vehicle.applyEngineForce(0, 2);
            this.vehicle.applyEngineForce(0, 3);
        }
        
        // Apply steering on front wheels
        if (keysPressed['q'] || keysPressed['arrowleft']) {
            this.vehicle.setSteeringValue(this.maxSteerVal, 0);
            this.vehicle.setSteeringValue(this.maxSteerVal, 1);
        } else if (keysPressed['d'] || keysPressed['arrowright']) {
            this.vehicle.setSteeringValue(-this.maxSteerVal, 0);
            this.vehicle.setSteeringValue(-this.maxSteerVal, 1);
        } else {
            this.vehicle.setSteeringValue(0, 0);
            this.vehicle.setSteeringValue(0, 1);
        }
        
        // Apply brake
        if (keysPressed[' ']) {  // Spacebar
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
        
        // Drift control - trigger with SHIFT key while turning
        const isTurning = keysPressed['q'] || keysPressed['arrowleft'] || keysPressed['d'] || keysPressed['arrowright'];
        const speed = this.speed();
        
        if (keysPressed['shift'] && isTurning && speed > 30) {
            this.startDrift();
        } else if (!keysPressed['shift'] || !isTurning || speed < 15) {
            this.endDrift();
        }
        
        // Update drift physics and effects
        this.updateDrift(deltaTime);
    }

    update(deltaTime = 1/60) {
        // Update car mesh position and rotation
        this.carMesh.position.copy(this.carBody.position);
        this.carMesh.quaternion.copy(this.carBody.quaternion);
        
        // Update wheel meshes
        for (let i = 0; i < 4; i++) {
            this.vehicle.updateWheelTransform(i);
            const transform = this.vehicle.wheelInfos[i].worldTransform;
            this.wheelMeshes[i].position.copy(transform.position);
            this.wheelMeshes[i].quaternion.copy(transform.quaternion);
        }
        
        // Update drift effects
        if (this.isDrifting) {
            this.updateDrift(deltaTime);
        }
    }

    carPosition = () => {
        return this.carMesh.position;
    }

    speed = () => {
        return (this.carBody.velocity.length() * 3.6).toFixed(1);
    }
    
    isDriftingNow = () => {
        return this.isDrifting;
    }
}
