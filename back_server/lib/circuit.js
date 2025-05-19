import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
import CANNON from 'https://cdn.jsdelivr.net/npm/cannon@0.6.2/+esm';

export class Circuit {
    constructor(scene, world, options = {}) {
        this.scene = scene;
        this.world = world; // Cannon.js world
        this.options = {
            turnNumber: 10,
            turnAmplitude: 90, // in deg
            origin: new THREE.Vector3(0, 0, 0),
            minDistance: 20,
            roadWidth: 20,
            roadHeight: 0.5, // Thickness of the road
            roadColor: 0x333333, // Default road color, can be overridden
            debugPhysics: false,
            ...options,
        };

        this.pathNodes = [];
        this.pathPoints = [];
        this.roadSegments = []; // Store road segments for physics
        this.roadMesh = null;
        this.path = null;

        if (world) {
            this.makePoints();
            this.makePath();
            this.makeRoad();
        }
    }

    makePoints() {
        const deg_to_rad = (deg) => (deg * Math.PI) / 180;
        const N = this.options.turnNumber;
        let currentPosition = this.options.origin.clone();

        this.pathNodes = [];
        this.pathPoints = [];

        for (let index = 0; index < N; index++) {
            const node = new THREE.Mesh(
                new THREE.SphereGeometry(2),
                new THREE.MeshBasicMaterial({ color: 0xff0000 + index * 10 }),
            );
            node.position.copy(currentPosition);
            node.position.y = 10;
            if (index !== 0) {
                const rd = Math.random() * N + this.options.minDistance; // random distance
                const rr =
                    Math.random() * deg_to_rad(this.options.turnAmplitude) +
                    (Math.PI / N) * index * 1.5; // random angle
                node.translateOnAxis(
                    new THREE.Vector3(
                        Math.cos(rr),
                        0,
                        Math.sin(rr),
                    ),
                    rd,
                );
            }
            currentPosition = node.position.clone();
            this.pathNodes.push(node);
            this.pathPoints.push(
                new THREE.Vector2(currentPosition.x, currentPosition.z),
            );
            if (this.scene) {
                this.scene.add(node);
            }
        }

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
            -1,
        );
        const controlPoint2 = new THREE.Vector2().lerpVectors(
            firstPoint,
            secondPoint,
            -1,
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
            if (this.scene) {
                const node = new THREE.Mesh(
                    new THREE.SphereGeometry(1),
                    new THREE.MeshBasicMaterial({ color: 0x323739 }),
                );
                node.position.set(points[i].x, 0, points[i].y);
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
        const path_to_catmullrom3 = (path) => {
            const vec3Points = path.getPoints().map((element) =>
                new THREE.Vector3(
                    isNaN(element.x) ? 0 : element.x,
                    0,
                    isNaN(element.y) ? 0 : element.y,
                )
            );
            if (vec3Points.length < 2) {
                console.error('Not enough points to create a curve');
                return new THREE.CatmullRomCurve3([
                    new THREE.Vector3(-10, 0, 0),
                    new THREE.Vector3(10, 0, 0),
                ]);
            }
            return new THREE.CatmullRomCurve3(vec3Points, true, 'catmullrom');
        };

        const cmrc3 = path_to_catmullrom3(this.path);

        if (this.world) {
            this.createPhysicalRoadSegments(cmrc3);
        }
        if (this.scene) {
            this.createVisualRoad(cmrc3);
        }
    }

    createVisualRoad(curve) {
        if (!curve || curve.points.length < 2) {
            console.error('Invalid curve for extrusion');
            return;
        }

        const extrudeSettings = {
            steps: 1000,
            bevelEnabled: false,
            extrudePath: curve,
        };

        const halfWidth = this.options.roadWidth / 2 || 10;
        const shape = new THREE.Shape();
        shape.moveTo(0, -halfWidth);
        shape.lineTo(0, halfWidth);
        shape.lineTo(0.5, halfWidth);
        shape.lineTo(0.5, -halfWidth);
        shape.closePath();

        try {
            const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

            // Fix NaN values in geometry positions
            if (geometry.attributes.position) {
                const positions = geometry.attributes.position.array;
                let hasNaN = false;
                for (let i = 0; i < positions.length; i++) {
                    if (isNaN(positions[i])) {
                        hasNaN = true;
                        positions[i] = 0;
                    }
                }
                if (hasNaN) {
                    console.warn('Fixed NaN values in geometry positions');
                    geometry.attributes.position.needsUpdate = true;
                }
            }

            geometry.computeVertexNormals();
            geometry.computeBoundingSphere();

            const material = new THREE.MeshStandardMaterial({
                color: this.options.roadColor, // Use customizable road color
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
            console.error('Error creating road geometry:', error);
        }
    }

    createPhysicalRoadSegments(curve) {
        const numSegments = 40;
        const points = curve.getPoints(numSegments);

        for (let i = 0; i < points.length - 1; i++) {
            const start = points[i];
            const end = points[i + 1];
            const segmentVec = new THREE.Vector3().subVectors(end, start);
            const length = segmentVec.length();
            const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

            const roadShape = new CANNON.Box(
                new CANNON.Vec3(
                    this.options.roadWidth,
                    this.options.roadHeight,
                    length,
                ),
            );

            const roadBody = new CANNON.Body({
                mass: 0,
                position: new CANNON.Vec3(midpoint.x, 0, midpoint.z),
                shape: roadShape,
                material: new CANNON.Material('road'),
            });

            roadBody.shapes.forEach((shape) => {
                shape.collisionFilterGroup = 2;
                shape.collisionFilterMask = 1;
            });

            if (i > 0) {
                const direction = new THREE.Vector3().subVectors(end, start).normalize();
                const defaultDirection = new THREE.Vector3(0, 0, 1);
                const quaternion = new THREE.Quaternion().setFromUnitVectors(
                    defaultDirection,
                    direction,
                );
                roadBody.quaternion.set(
                    quaternion.x,
                    quaternion.y,
                    quaternion.z,
                    quaternion.w,
                );
            }

            this.world.addBody(roadBody);
            this.roadSegments.push(roadBody);

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
            this.roadSegments = [];
        }
        if (this.scene) {
            if (this.roadMesh) {
                this.scene.remove(this.roadMesh);
                this.roadMesh = null;
            }
            this.pathNodes.forEach(node => this.scene.remove(node));
            this.pathNodes = [];
        }
    }

    reload() {
        this.remove();
        this.makePoints();
        this.makePath();
        this.makeRoad();
    }
}