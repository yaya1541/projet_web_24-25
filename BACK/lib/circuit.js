import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
import CANNON from 'https://cdn.jsdelivr.net/npm/cannon@0.6.2/+esm';

export class Circuit {
    constructor(scene, world, options = {}) {
        this.scene = scene;
        this.world = world; // Cannon.js world
        this.options = {
            turnNumber: 10,
            turnAmplitude: 90, //in deg
            origin: new THREE.Vector3(0, 0, 0),
            minDistance: 10,
            roadWidth: 10,
            roadHeight: 0.5, // Thickness of the road
            ...options
        }

        this.pathNodes = [];
        this.pathPoints = [];
        this.roadSegments = []; // Store road segments for physics
        if (world){
            this.makePoints();
            this.makePath();
            this.makeRoad();
        }
    }


    makePoints() {
        const deg_to_rad = (deg) => { return (deg * Math.PI) / 180 };
        const N = this.options.turnNumber;
        let currentPosition = this.options.origin;
        
        // Create main points as before
        for (let index = 0; index < this.options.turnNumber; index++) {
          // create visual node
          const node = new THREE.Mesh(
            new THREE.SphereGeometry(2),
            new THREE.MeshBasicMaterial({ color: 0xff0000 + index * 10 })
          );
          node.position.copy(currentPosition);
          node.position.y = 10;
          if (index != 0) {
            let rd = Math.random() * N + this.options.minDistance; // random distance
            let rr = Math.random() * deg_to_rad(this.options.turnAmplitude) + Math.PI / N * index * 1.5; // random angle
            node.translateOnAxis(
                new THREE.Vector3(
                    Math.cos(rr),
                    0,
                    Math.sin(rr)
                ),
                rd
                );
          }
          currentPosition = node.position;
          this.pathNodes.push(node);
          this.pathPoints.push(new THREE.Vector2(currentPosition.x, currentPosition.z));
          if (this.scene){
                this.scene.add(node);
          }
          
        }
        
        // Round the junction between the last and first point
        this.roundPathJunction();
    }
      
    roundPathJunction() {
        if (this.pathPoints.length < 3) return;
        
        const firstPoint = this.pathPoints[0];
        const lastPoint = this.pathPoints[this.pathPoints.length - 1];
        const beforeLastPoint = this.pathPoints[this.pathPoints.length - 2];
        const secondPoint = this.pathPoints[1];
        
        // Calculate control points for a Bezier curve
        const controlPoint1 = new THREE.Vector2().lerpVectors(
            lastPoint, 
            beforeLastPoint, 
            -0.3 // Extrapolate in the direction from beforeLastPoint to lastPoint
        );
        
        const controlPoint2 = new THREE.Vector2().lerpVectors(
            firstPoint,
            secondPoint,
            -0.3 // Extrapolate in the direction from secondPoint to firstPoint
        );
        
        // Create a cubic Bezier curve
        const curve = new THREE.CubicBezierCurve(
            lastPoint,
            controlPoint1,
            controlPoint2,
            firstPoint
        );
        
        // Get points along the curve
        const points = curve.getPoints(8);
        
        // Add these points to your path
        for (let i = 1; i < points.length; i++) {
            this.pathPoints.push(points[i]);
            
            // Optional: Visualize these points
            const node = new THREE.Mesh(
                new THREE.SphereGeometry(1),
                new THREE.MeshBasicMaterial({ color: 0x0000ff })
            );
            node.position.set(points[i].x, 0, points[i].y);
            if (this.scene){
                this.scene.add(node);
            }
        }
    }

    makePath() {
        const path = new THREE.Path();
        path.splineThru(this.pathPoints);
        const points = path.getPoints();
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: 0x0044ff });
        const line = new THREE.Line(geometry, material);
        line.position.y = 5;
        line.rotateX(Math.PI/2);

        this.path = path;
        if (this.scene){
            this.scene.add(line);
        }
    }

    makeRoad() {
        const path_to_catmullrom3 = (path) => {
            const vec3Points = [];
            path.getPoints().forEach(element => {
                vec3Points.push(new THREE.Vector3(
                    element.x,
                    0,
                    element.y
                ));
            });

            // For better closure, add control points
            if (vec3Points.length > 3) {
                // Add the last point to the beginning
                const firstPoint = vec3Points[0].clone();
                const lastPoint = vec3Points[vec3Points.length - 1].clone();
                
                if (!firstPoint.equals(lastPoint)) {
                    // Make sure the curve is looped
                    vec3Points.push(firstPoint.clone());
                }
                
                // Additional smoothing at junctions
                const secondPoint = vec3Points[1].clone();
                const secondLastPoint = vec3Points[vec3Points.length - 2].clone();
                
                // Insert intermediate points
                vec3Points.unshift(lastPoint.clone().lerp(firstPoint, 0.5));
                vec3Points.push(firstPoint.clone().lerp(secondPoint, 0.5));
            }

            return new THREE.CatmullRomCurve3(vec3Points, true, 'catmullrom');
        };
        
        const cmrc3 = path_to_catmullrom3(this.path);
        
        if (this.world){
            // Create road segments for physics
            this.createPhysicalRoadSegments(cmrc3);
        }
        
        if (this.scene){
            // Visual representation of the road
            this.createVisualRoad(cmrc3);
        }
    }
    
    createVisualRoad(curve) {
        const extrudeSettings = {
            steps: 100,
            bevelEnabled: false,
            extrudePath: curve
        };
        
        // Define a triangle (base shape)
        const halfWidth = this.options.roadWidth / 2;
        const shape = new THREE.Shape();
        shape.moveTo(this.options.roadHeight, -halfWidth);  // Bottom left
        shape.lineTo(-this.options.roadHeight, -halfWidth);   // Bottom right
        shape.lineTo(-this.options.roadHeight, halfWidth);    // Top right
        shape.lineTo(this.options.roadHeight, halfWidth);   // Top left
        shape.closePath();
        try {
            const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
            const material = new THREE.MeshLambertMaterial({ 
                color: 0xb00000, 
                wireframe: false,
                side: THREE.DoubleSide 
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.receiveShadow = true;
            this.roadMesh = mesh;
            if (this.scene){
                this.scene.add(mesh);
            }
        } catch (error) {
            console.error("Error creating road geometry:", error);
        }
    }
    
    createPhysicalRoadSegments(curve) {
        // Create physical segments along the curve
        const numSegments = 40; // Adjust for performance vs. accuracy
        const points = curve.getPoints(numSegments);
        
        for (let i = 0; i < points.length - 1; i++) {
            const start = points[i];
            const end = points[i + 1];
            
            // Calculate segment length, direction and position
            const segmentVec = new THREE.Vector3().subVectors(end, start);
            const length = segmentVec.length();
            const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
            
            // Create physical body for this segment
            const roadShape = new CANNON.Box(
                new CANNON.Vec3(
                    this.options.roadWidth, // half-width
                    this.options.roadHeight, // half-height
                    length // half-length
                )
            );
            
            const roadBody = new CANNON.Body({
                mass: 0, // Static body
                position: new CANNON.Vec3(midpoint.x, 0, midpoint.z),
                shape: roadShape,
                material: new CANNON.Material('road')
            });
            
            // For the road
            roadBody.shapes.forEach(shape => {
                shape.collisionFilterGroup = 2; // Road group
                shape.collisionFilterMask = 1;  // Car group
            });

            // Calculate rotation to align with segment direction
            if (i > 0) {
                const direction = new THREE.Vector3().subVectors(end, start).normalize();
                const defaultDirection = new THREE.Vector3(0, 0, 1); // Default forward direction
                const quaternion = new THREE.Quaternion().setFromUnitVectors(
                    defaultDirection, 
                    direction
                );
                
                // Convert THREE.Quaternion to CANNON.Quaternion
                roadBody.quaternion.set(
                    quaternion.x,
                    quaternion.y,
                    quaternion.z,
                    quaternion.w
                );
            }
            
            // Add to world and store reference
            this.world.addBody(roadBody);
            this.roadSegments.push(roadBody);
            
            // Optional: Debug visualization
            if (this.options.debugPhysics) {
                this.addDebugBox(midpoint, this.options.roadWidth, this.options.roadHeight, length, roadBody.quaternion);
            }
        }
    }
    
    // Helper method for debugging physics bodies
    addDebugBox(position, width, height, length, quaternion) {
        const geometry = new THREE.BoxGeometry(width, height, length);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            wireframe: true,
            opacity: 0.5,
            transparent: true
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);
        mesh.quaternion.copy(quaternion);
        if (this.scene){
            this.scene.add(mesh);
        }
    }

    remove(){
        if (this.world){
            this.roadSegments.forEach((elt)=>this.world.removeBody(elt));
        }
        if (this.scene){

        }
    }

    reload(){
        this.makePoints()
        this.makePath();
        this.makeRoad();
        this.createPhysicalRoadSegments();
        this.createVisualRoad();
    }
}