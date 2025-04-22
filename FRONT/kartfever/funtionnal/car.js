import CANNON from 'https://cdn.jsdelivr.net/npm/cannon@0.6.2/+esm';
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
import { GLTFLoader } from '../lib/GLTFLoader.js';

export class Car{
    constructor(world,scene,options = {}){
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
        
        // Create car body visual
        //this.carGeometry = new THREE.BoxGeometry(2, 1, 4);
        this.carMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x0066ff,
            roughness: 0.5,
            metalness: 0.3
        });
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
            frictionSlip: 5,
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

    control(keysPressed){
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
    }

    update(){
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
    }

    carPosition = () => {
        return this.carMesh.position;
    }

    speed = () => {
        return (this.carBody.velocity.length() * 3.6).toFixed(1);
    }
}
