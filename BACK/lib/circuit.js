import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";
import CANNON from "https://cdn.jsdelivr.net/npm/cannon@0.6.2/+esm";

export class Circuit {
    constructor(scene, world, options = {}) {
        this.scene = scene;
        this.world = world; // Cannon.js world
        this.options = {
            turnNumber: 10,
            turnAmplitude: 90, //in deg
            origin: new THREE.Vector3(0, 0, 0),
            minDistance: 20,
            roadWidth: 20,
            roadHeight: 0.5, // Thickness of the road
            ...options,
        };

        this.pathNodes = [];
        this.pathPoints = [];
        this.roadSegments = []; // Store road segments for physics
        if (world) {
            this.makePoints();
            this.makePath();
            this.makeRoad();
        }
    }

    makePoints() {
        const deg_to_rad = (deg) => {
            return (deg * Math.PI) / 180;
        };
        const N = this.options.turnNumber;
        let currentPosition = this.options.origin;

        // Create main points as before
        for (let index = 0; index < this.options.turnNumber; index++) {
            // create visual node
            const node = new THREE.Mesh(
                new THREE.SphereGeometry(2),
                new THREE.MeshBasicMaterial({ color: 0xff0000 + index * 10 }),
            );
            node.position.copy(currentPosition);
            node.position.y = 10;
            if (index != 0) {
                const rd = Math.random() * N + this.options.minDistance; // random distance
                const rr =
                    Math.random() * deg_to_rad(this.options.turnAmplitude) +
                    Math.PI / N * index * 1.5; // random angle
                node.translateOnAxis(
                    new THREE.Vector3(
                        Math.cos(rr),
                        0,
                        Math.sin(rr),
                    ),
                    rd,
                );
            }
            currentPosition = node.position;
            this.pathNodes.push(node);
            this.pathPoints.push(
                new THREE.Vector2(currentPosition.x, currentPosition.z),
            );
            if (this.scene) {
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
            -1, // Extrapolate in the direction from beforeLastPoint to lastPoint
        );

        const controlPoint2 = new THREE.Vector2().lerpVectors(
            firstPoint,
            secondPoint,
            -1, // Extrapolate in the direction from secondPoint to firstPoint
        );

        // Create a cubic Bezier curve
        const curve = new THREE.CubicBezierCurve(
            lastPoint,
            controlPoint1,
            controlPoint2,
            firstPoint,
        );

        // Get points along the curve
        const points = curve.getPoints(10);

        // Add these points to your path
        for (let i = 1; i < points.length; i++) {
            this.pathPoints.push(points[i]);

            // Optional: Visualize these points
            const node = new THREE.Mesh(
                new THREE.SphereGeometry(1),
                new THREE.MeshBasicMaterial({ color: 0x323739 }),
            );
            node.position.set(points[i].x, 0, points[i].y);
            if (this.scene) {
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
        line.rotateX(Math.PI / 2);

        this.path = path;
        if (this.scene) {
            this.scene.add(line);
        }
    }

    makeRoad() {
        // Modified path_to_catmullrom3 function
        const path_to_catmullrom3 = (path) => {
            const vec3Points = [];

            // Convert 2D path points to 3D Vector3 points
            path.getPoints().forEach((element) => {
                // Make sure all values are valid numbers
                const x = isNaN(element.x) ? 0 : element.x;
                const y = 0; // Height
                const z = isNaN(element.y) ? 0 : element.y;

                vec3Points.push(new THREE.Vector3(x, y, z));
            });

            // Only process if we have enough points
            if (vec3Points.length < 2) {
                console.error("Not enough points to create a curve");
                // Return a simple line as fallback
                return new THREE.CatmullRomCurve3([
                    new THREE.Vector3(-10, 0, 0),
                    new THREE.Vector3(10, 0, 0),
                ]);
            }

            // For better closure, but simplified to avoid NaN issues
            //const firstPoint = vec3Points[0];
            //const lastPoint = vec3Points[vec3Points.length - 1];

            // Don't create the curve as closed to avoid issues
            return new THREE.CatmullRomCurve3(vec3Points, false, "catmullrom");
        };

        const cmrc3 = path_to_catmullrom3(this.path);

        if (this.world) {
            // Create road segments for physics
            this.createPhysicalRoadSegments(cmrc3);
        }

        if (this.scene) {
            // Visual representation of the road
            this.createVisualRoad(cmrc3);
        }
    }

    // And in createVisualRoad, modify the shape:
    createVisualRoad(curve) {
        // Check if the curve has valid points
        if (!curve || curve.points.length < 2) {
            console.error("Invalid curve for extrusion");
            return;
        }

        const extrudeSettings = {
            steps: 1000,
            bevelEnabled: false,
            extrudePath: curve,
        };

        // Define a simpler rectangle shape for the road cross-section
        console.log("roadWidth", this.options.roadWidth / 2);

        const halfWidth = this.options.roadWidth / 2 || 10; // Default if undefined
        const shape = new THREE.Shape();
        shape.moveTo(0, -halfWidth);
        shape.lineTo(0, halfWidth);
        shape.lineTo(0.5, halfWidth); // Small height
        shape.lineTo(0.5, -halfWidth);
        shape.closePath();

        try {
            const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

            // Validate geometry before creating mesh
            if (geometry.attributes.position) {
                const positions = geometry.attributes.position.array;
                let hasNaN = false;
                for (let i = 0; i < positions.length; i++) {
                    if (isNaN(positions[i])) {
                        hasNaN = true;
                        positions[i] = 0; // Replace NaN with 0
                    }
                }
                if (hasNaN) {
                    console.warn("Fixed NaN values in geometry positions");
                    geometry.attributes.position.needsUpdate = true;
                }
            }

            // Compute properly
            geometry.computeVertexNormals();
            geometry.computeBoundingSphere();

            const material = new THREE.MeshStandardMaterial({
                color: 0xff3333,
                emissive: 0x222222,
                roughness: 0.5,
                metalness: 0.2,
                side: THREE.DoubleSide,
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.receiveShadow = true;
            this.roadMesh = mesh;

            if (this.scene) {
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
            const midpoint = new THREE.Vector3().addVectors(start, end)
                .multiplyScalar(0.5);

            // Create physical body for this segment
            const roadShape = new CANNON.Box(
                new CANNON.Vec3(
                    this.options.roadWidth * 2, // half-width
                    this.options.roadHeight, // half-height
                    length * 2, // half-length
                ),
            );

            const roadBody = new CANNON.Body({
                mass: 0, // Static body
                position: new CANNON.Vec3(midpoint.x, 0, midpoint.z),
                shape: roadShape,
                material: new CANNON.Material("road"),
            });

            // For the road
            roadBody.shapes.forEach((shape) => {
                shape.collisionFilterGroup = 2; // Road group
                shape.collisionFilterMask = 1; // Car group
            });

            // Calculate rotation to align with segment direction
            if (i > 0) {
                const direction = new THREE.Vector3().subVectors(end, start)
                    .normalize();
                const defaultDirection = new THREE.Vector3(0, 0, 1); // Default forward direction
                const quaternion = new THREE.Quaternion().setFromUnitVectors(
                    defaultDirection,
                    direction,
                );

                // Convert THREE.Quaternion to CANNON.Quaternion
                roadBody.quaternion.set(
                    quaternion.x,
                    quaternion.y,
                    quaternion.z,
                    quaternion.w,
                );
            }

            // Add to world and store reference
            this.world.addBody(roadBody);
            this.roadSegments.push(roadBody);

            // Optional: Debug visualization
            if (this.options.debugPhysics) {
                this.addDebugBox(
                    midpoint,
                    this.options.roadWidth,
                    this.options.roadHeight,
                    length,
                    roadBody.quaternion,
                );
            }
        }
    }

    // Helper method for debugging physics bodies
    addDebugBox(position, width, height, length, quaternion) {
        const geometry = new THREE.BoxGeometry(width * 2, height, length * 2);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            wireframe: true,
            opacity: 0.5,
            transparent: true,
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);
        mesh.quaternion.copy(quaternion);
        if (this.scene) {
            this.scene.add(mesh);
        }
    }

    remove() {
        if (this.world) {
            this.roadSegments.forEach((elt) => this.world.removeBody(elt));
        }
        if (this.scene) {
            // TODO : Remove THREE.js elements
            return;
        }
    }

    reload() {
        this.makePoints();
        this.makePath();
        this.makeRoad();
        this.createPhysicalRoadSegments();
        this.createVisualRoad();
    }
}
