import CANNON from 'https://cdn.jsdelivr.net/npm/cannon@0.6.2/+esm';
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
import { GLTFLoader } from './GLTFLoader.js';

// Simple function to replace ALL materials in your model
// Add this to your existing code

function replaceAllMaterials(scene) {
    console.log("Replacing all materials with compatible ones");
    
    scene.traverse((object) => {

        if (object.isMesh) {
            // Get basic properties from the original material
            const originalMaterial = object.material;
            const _texture = null;
            const _color = 0xcccccc;
            const _transparent = false;
            const _opacity = 1.0;
            
            if (originalMaterial) {
            // Handle array of materials
            if (Array.isArray(originalMaterial)) {
                // Create an array of new materials to replace the old ones
                const newMaterials = originalMaterial.map(mat => {
                return createSimpleMaterial(mat);
                });
                
                // Replace with array of new materials
                object.material = newMaterials;
            } 
            // Handle single material
            else {
                object.material = createSimpleMaterial(originalMaterial);
            }
            }
        }
    });
    
    console.log("All materials replaced successfully");
  }
  
  // Helper function to create a compatible material
  function createSimpleMaterial(originalMaterial) {
    // Extract properties from original material
    const texture = originalMaterial.map || null;
    const color = originalMaterial.color ? originalMaterial.color.getHex() : 0xcccccc;
    const transparent = originalMaterial.transparent || false;
    const opacity = originalMaterial.opacity || 1.0;
    const normalMap = originalMaterial.normalMap || null;
    const emissive = originalMaterial.emissive ? originalMaterial.emissive.getHex() : 0x000000;
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
      side: originalMaterial.side || THREE.DoubleSide
    });
    
    // Copy name for debugging
    newMaterial.name = originalMaterial.name ? originalMaterial.name + "_fixed" : "fixed_material";
    
    return newMaterial;
  }

export class Car{
    constructor(world, scene, id, options = {}){
        this.world = world;
        this.scene = scene;
        this.id = id;
        this.options = {
            position : new CANNON.Vec3(0,1,0),
            dimensions : {width : 2, height : 1, length : 4},
            color : 0x0066ff,
            mass : 500,
            yOffset : -2,
            ...options
        }
        // Max steer, engine force values
        this.maxSteerVal = 0.5;
        this.maxForce = 1000;
        this.brakeForce = 15;

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

        this.yOffset = 5;

        if (world){
            this.createPhysicBody();
            this.createPhysicWheels();
        }
        if (scene){
            this.carBody = {
                position:new CANNON.Vec3(0,1,0),
                quaternion:new CANNON.Quaternion(0,0,0)
            }
            this.createBody(); 
            this.createWheels();
            this.loadModel();
        }
        
    }

    loadModel(){
        /*
        const positionOffset = {
            x:0,
            y:1,
            z:0
        }
        */
        const loader = new GLTFLoader();
        // Configure le gestionnaire de requêtes
        loader.withCredentials = true;
        loader.load('https://localhost:3000/src/racing_kart.glb',(obj)=>{
            if (this.carMesh){
                this.scene.remove(this.carMesh);
            }
            
            const object = obj.scene;
            //this.loadedWheelMeshes = [];
            this.wheelMeshes = [];
            console.log("Scene",obj.scene);
            this.carMesh = object;
            replaceAllMaterials(object);

            // Center and scale model if needed
            const box = new THREE.Box3().setFromObject(object);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 5 / maxDim;  // Scale to fit in view
            
            object.position.x -= center.x;
            object.position.y -= center.y;
            object.position.z -= center.z;
            object.scale.set(scale, scale, scale);
            this.scene.add(object);
            console.log(object);
            
        },
        // called while loading is progressing
        (xhr) => {
            console.log(`${xhr.loaded} sur ${xhr.total} octets chargés (${(xhr.loaded / xhr.total * 100).toFixed(2)}%)`);
            // Vérifiez si ces valeurs semblent correctes par rapport à la taille de votre fichier
        },
        // called when loading has errors
        function ( error ) {
            console.log( 'An error happened' );
            console.log(error);
            
        })
    }

    createPhysicBody(){
        const carBodyShape = new CANNON.Box(new CANNON.Vec3(3,1,5));
        this.carBody = new CANNON.Body({ mass: 500 });
        this.carBody.addShape(carBodyShape);
        this.carBody.position.set(0, 1, 0);
        this.carBody.angularDamping = 0.3;
        this.carBody.ccdSpeedThreshold = 1; // Set this lower than your car's top speed
        
        // For the car body
        this.carBody.shapes.forEach(shape => {
            shape.collisionFilterGroup = 1; // Car group
            shape.collisionFilterMask = 2;  // Road group
        });

        this.carMaterial = new CANNON.Material('car');
        this.carBody.material = this.carMaterial;

        this.world.addBody(this.carBody);
    }
    
    createBody(){
        // Create car body
        const carGeometry = new THREE.BoxGeometry(3, 1, 5);
        // Create car body visual
        this.carMesh = new THREE.Mesh(carGeometry, this.carMaterial);
        this.carMesh.castShadow = true;
        this.scene.add(this.carMesh);
    }

    createPhysicWheels(){
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
            directionLocal: new CANNON.Vec3(0, -1, 0),
            suspensionStiffness: 30,
            suspensionRestLength: 0.3,
            frictionSlip: this.normalFrictionSlip,
            dampingRelaxation: 2.3,
            dampingCompression: 4.4,
            maxSuspensionForce: 90000,
            rollInfluence: 0.01,
            axleLocal: new CANNON.Vec3(1, 0, 0),
            chassisConnectionPointLocal: new CANNON.Vec3(),
            maxSuspensionTravel: 0.3,
            customSlidingRotationalSpeed: -30,
            useCustomSlidingRotationalSpeed: true
        };

        const frontWheelOptions = {
            radius: 0.4,
            ...wheelOptions
        };
        const backWheelOptions = {
            radius: 0.4,
            ...wheelOptions
        }
        
        // Front left wheel
        wheelOptions.chassisConnectionPointLocal.set(-1.5, -2, 1.1);
        this.vehicle.addWheel(frontWheelOptions);
        
        // Front right wheel
        wheelOptions.chassisConnectionPointLocal.set(1.5, -2, 1.1);
        this.vehicle.addWheel(frontWheelOptions);
        
        // Rear left wheel
        wheelOptions.chassisConnectionPointLocal.set(-1.1, -2, -1.5);
        this.vehicle.addWheel(backWheelOptions);
        
        // Rear right wheel
        wheelOptions.chassisConnectionPointLocal.set(1.1, -2, -1.5);
        this.vehicle.addWheel(backWheelOptions);
        
        this.vehicle.addToWorld(this.world);
    }

    createWheels(){
        // Create wheel visuals
        this.frontWheelGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.3, 32);
        this.backWheelGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.5, 32);
        this.frontWheelGeometry.rotateZ(Math.PI / 2);
        this.backWheelGeometry.rotateZ(Math.PI / 2);
        this.wheelMesh = new THREE.MeshStandardMaterial({ 
            color: 0x333333, 
            roughness: 0.7, 
            metalness: 0.2
        });
        this.wheelMeshes = [];
        
        for (let i = 0; i < 2; i++) {
            const cylinderMesh = new THREE.Mesh(this.frontWheelGeometry, this.wheelMesh);
            cylinderMesh.castShadow = true;
            this.scene.add(cylinderMesh);
            this.wheelMeshes.push(cylinderMesh);
        }
        for (let i = 0; i < 2; i++) {
            const cylinderMesh = new THREE.Mesh(this.backWheelGeometry, this.wheelMesh);
            cylinderMesh.castShadow = true;
            this.scene.add(cylinderMesh);
            this.wheelMeshes.push(cylinderMesh);
        }
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
            const _driftAngle = Math.atan2(sideVel.length(), forwardVel.length());
            
            // Gradually reduce drift effect over time if needed
            if (this.driftTimer > 5) { // Maximum drift time in seconds
                this.endDrift();
            }
        }
    }

    // Apply natural deceleration to the car
    applyNaturalDeceleration(deltaTime) {
        // Get current velocity
        const velocity = this.carBody.velocity.clone();
        const speed = velocity.length()*3.6;
        
        // If the car is moving, apply deceleration
        if (speed > 0.1) {
            // Calculate deceleration force
            const decelForce = this.decelerationRate * deltaTime * 100;
            
            // Create normalized direction vector
            const direction = velocity.clone();
            direction.normalize();
            
            // Scale direction by deceleration force
            direction.scale(-Math.max(decelForce, speed), direction);
            //console.log(decelForce,speed);
            
            
            // Apply force to slow down the car
            this.carBody.applyLocalForce(direction, new CANNON.Vec3(0, 0, 0));
        }
    }

    // Apply smooth steering
    applySmoothSteering(targetSteeringValue, deltaTime) {
        // Interpolate between current and target steering value
        const steeringDiff = targetSteeringValue - this.currentSteering;
        this.currentSteering += steeringDiff * this.steeringSmoothing / deltaTime / 100;
        //sssssssssssssssssssssssssssssdddconsole.log(steeringDiff,targetSteeringValue,this.currentSteering,deltaTime);
        
        // Apply the smooth steering value to both front wheels
        this.vehicle.setSteeringValue(this.currentSteering, 0);
        this.vehicle.setSteeringValue(this.currentSteering, 1);
    }

    control(keysPressed, deltaTime = 1/60) {
        // Calculate target steering value
        deltaTime = deltaTime != 0 ? deltaTime : 0.01;
        let targetSteering = 0;
        if (keysPressed['q'] || keysPressed['arrowleft']) {
            targetSteering = this.maxSteerVal;
        } else if (keysPressed['d'] || keysPressed['arrowright']) {
            targetSteering = -this.maxSteerVal;
        }
        //console.log(targetSteering);
        
        // Apply smooth steering
        this.applySmoothSteering(targetSteering, deltaTime);
        
        // Apply engine force on rear wheels
        if (keysPressed['z'] || keysPressed['arrowup'] && this.speed()<130) {
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
        const isTurning = Math.abs(targetSteering) > 0.1;
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
        this.carMesh.position.set(
            this.carBody.position.x,
            this.carBody.position.y - this.options.yOffset,
            this.carBody.position.z
        );
        this.carMesh.quaternion.copy(this.carBody.quaternion);

        //console.log(this.currentSteering);
        this.checkWrongPosition();

        // Update wheel meshes
        for (let i = 0; i < 4; i++) {
            this.vehicle.updateWheelTransform(i);
            const transform = this.vehicle.wheelInfos[i].worldTransform;
            this.wheelMeshes[i].position.copy(transform.position);
            this.wheelMeshes[i].position.y -= this.options.yOffset;
            this.wheelMeshes[i].quaternion.copy(transform.quaternion);
        }
        
        // Update drift effects
        if (this.isDrifting) {
            this.updateDrift(deltaTime);
        }
    }

    checkWrongPosition(){
        if (this.carBody.position.y < 5){
            this.carBody.position.y = 1;
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
