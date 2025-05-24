import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
import * as defaults from 'https://cdn.jsdelivr.net/npm/cannon@0.6.2/+esm';
const CANNON = defaults.default;

export class CarPredictionSystem {
    constructor() {
        this.carStates = new Map(); // carId -> state
    }

    initializeCarState(carId) {
        this.carStates.set(carId, {
            lastServerPosition: null,
            lastServerQuaternion: null,
            lastServerVelocity: null,
            lastServerAngularVelocity: null,
            lastServerWheels: [],
            lastUpdateTime: 0,
            quaternionHistory: [], // Initialize empty array
        });
    }

    handlePlayerCarUpdate(
        car,
        serverPos,
        serverQuat,
        serverVelocity,
        serverAngularVelocity,
        serverWheels,
    ) {
        if (!car || !car.carBody) return;

        const posError = new CANNON.Vec3(
            serverPos.x - car.carBody.position.x,
            serverPos.y - car.carBody.position.y,
            serverPos.z - car.carBody.position.z,
        );

        const posErrorMagnitude = posError.length();

        const serverQuatObj = new CANNON.Quaternion(
            serverQuat.x,
            serverQuat.y,
            serverQuat.z,
            serverQuat.w,
        );
        const quatDiff = serverQuatObj.mult(car.carBody.quaternion.inverse());
        const angle = 2 * Math.acos(Math.abs(quatDiff.w));

        // Correction factors
        const hardSnapThreshold = 10.0;
        const hardSnapAngle = Math.PI / 2;
        const softSnapThreshold = 0.2;
        const softSnapAngle = Math.PI / 32;
        const correctionFactor = 0.18;

        if (posErrorMagnitude > hardSnapThreshold || angle > hardSnapAngle) {
            car.carBody.position.copy(serverPos);
            car.carBody.quaternion.copy(serverQuatObj);
            if (serverVelocity) car.carBody.velocity.copy(serverVelocity);
            if (serverAngularVelocity) {
                car.carBody.angularVelocity.copy(serverAngularVelocity);
            }
        } else if (
            posErrorMagnitude > softSnapThreshold || angle > softSnapAngle
        ) {
            car.carBody.position.x += posError.x * correctionFactor;
            car.carBody.position.y += posError.y * correctionFactor;
            car.carBody.position.z += posError.z * correctionFactor;
            // Use custom slerpCannonQuaternion for Cannon.js quaternion interpolation
            const interpolatedQuat = slerpCannonQuaternion(
                car.carBody.quaternion,
                serverQuatObj,
                correctionFactor,
            );
            car.carBody.quaternion.copy(interpolatedQuat);
            if (serverVelocity) {
                car.carBody.velocity.x =
                    car.carBody.velocity.x * (1 - correctionFactor) +
                    serverVelocity.x * correctionFactor;
                car.carBody.velocity.y =
                    car.carBody.velocity.y * (1 - correctionFactor) +
                    serverVelocity.y * correctionFactor;
                car.carBody.velocity.z =
                    car.carBody.velocity.z * (1 - correctionFactor) +
                    serverVelocity.z * correctionFactor;
            }
        }

        // Visual smoothing
        car.carMesh.position.lerp(
            new THREE.Vector3(
                car.carBody.position.x,
                car.carBody.position.y - (car.yOffset || 0),
                car.carBody.position.z,
            ),
            0.3,
        );
        car.carMesh.quaternion.slerp(
            new THREE.Quaternion(
                car.carBody.quaternion.x,
                car.carBody.quaternion.y,
                car.carBody.quaternion.z,
                car.carBody.quaternion.w,
            ),
            0.3,
        );

        if (serverWheels && car.setWheelStatesFromServer) {
            car.setWheelStatesFromServer(serverWheels);
        }
    }

    handleRemoteCarUpdate(
        carId,
        car,
        serverPos,
        serverQuat,
        serverVelocity,
        serverAngularVelocity,
        serverWheels,
        now,
    ) {
        if (!car || !car.carMesh) return;
        if (!this.carStates.has(carId)) this.initializeCarState(carId);

        const state = this.carStates.get(carId);

        state.lastServerPosition = new THREE.Vector3(
            serverPos.x,
            serverPos.y,
            serverPos.z,
        );
        state.lastServerQuaternion = new THREE.Quaternion(
            serverQuat.x,
            serverQuat.y,
            serverQuat.z,
            serverQuat.w,
        );
        state.lastServerVelocity = serverVelocity
            ? new THREE.Vector3(
                serverVelocity.x,
                serverVelocity.y,
                serverVelocity.z,
            )
            : new THREE.Vector3();
        state.lastServerAngularVelocity = serverAngularVelocity
            ? new THREE.Vector3(
                serverAngularVelocity.x,
                serverAngularVelocity.y,
                serverAngularVelocity.z,
            )
            : new THREE.Vector3();
        state.lastServerWheels = serverWheels || [];
        state.lastUpdateTime = now;

        // Initialize quaternionHistory if it doesn't exist
        if (!state.quaternionHistory) {
            state.quaternionHistory = [];
        }

        // Add to quaternion history
        state.quaternionHistory.push({
            time: now,
            quat: state.lastServerQuaternion.clone(),
        });

        // Keep history size manageable
        if (state.quaternionHistory.length > 5) {
            state.quaternionHistory.shift();
        }

        const timeSinceUpdate = (Date.now() - state.lastUpdateTime) / 1000;
        const adaptiveFactor = Math.min(1, timeSinceUpdate * 4);

        // Position update
        car.carMesh.position.lerp(
            new THREE.Vector3(
                state.lastServerPosition.x,
                state.lastServerPosition.y - (car.yOffset || 0),
                state.lastServerPosition.z,
            ),
            adaptiveFactor,
        );

        // Rotation update with history smoothing
        if (state.quaternionHistory.length >= 2) {
            const [q1, q2] = state.quaternionHistory.slice(-2);
            const t = (now - q1.time) / (q2.time - q1.time);
            const smoothQuat = q1.quat.clone().slerp(q2.quat, t);
            car.carMesh.quaternion.copy(smoothQuat);
        } else {
            car.carMesh.quaternion.slerp(
                state.lastServerQuaternion,
                adaptiveFactor,
            );
        }

        if (car.setWheelStatesFromServer) {
            car.setWheelStatesFromServer(state.lastServerWheels);
        }
    }

    extrapolateRemoteCars(cars, deltaTime) {
        const now = Date.now();
        for (const [carId, car] of Object.entries(cars)) {
            if (car.world) continue; // Skip local player car
            const state = this.carStates.get(carId);
            if (
                !state || !state.lastServerPosition || !state.lastServerVelocity
            ) continue;

            const timeSinceUpdate = (now - state.lastUpdateTime) / 1000;
            const damping = Math.exp(-timeSinceUpdate);
            const predictedPos = state.lastServerPosition.clone().add(
                state.lastServerVelocity.clone().multiplyScalar(
                    timeSinceUpdate * damping,
                ),
            );
            const adaptiveFactor = Math.min(1, timeSinceUpdate * 4);

            car.carMesh.position.lerp(
                new THREE.Vector3(
                    predictedPos.x,
                    predictedPos.y - (car.yOffset || 0),
                    predictedPos.z,
                ),
                adaptiveFactor,
            );

            if (state.lastServerAngularVelocity && state.lastServerQuaternion) {
                const angVel = state.lastServerAngularVelocity;
                const angle = angVel.length() * timeSinceUpdate;
                if (angle > 0.0001) {
                    const axis = angVel.clone().normalize();
                    const deltaQuat = new THREE.Quaternion().setFromAxisAngle(
                        axis,
                        angle,
                    );
                    const predictedQuat = state.lastServerQuaternion.clone()
                        .multiply(deltaQuat);
                    car.carMesh.quaternion.slerp(predictedQuat, adaptiveFactor);
                }
            }

            if (car.setWheelStatesFromServer) {
                car.setWheelStatesFromServer(state.lastServerWheels);
            }
        }
    }
}

// Custom SLERP for Cannon.js quaternions
function slerpCannonQuaternion(q1, q2, t) {
    // Compute the cosine of the angle between the two vectors.
    let cosHalfTheta = q1.w * q2.w + q1.x * q2.x + q1.y * q2.y + q1.z * q2.z;

    // If q1 and q2 are the same, return q1
    if (Math.abs(cosHalfTheta) >= 1.0) {
        return new CANNON.Quaternion(q1.x, q1.y, q1.z, q1.w);
    }

    // If the dot product is negative, slerp won't take
    // the shorter path. So we'll invert one quaternion
    if (cosHalfTheta < 0.0) {
        q2 = new CANNON.Quaternion(-q2.x, -q2.y, -q2.z, -q2.w);
        cosHalfTheta = -cosHalfTheta;
    }

    const halfTheta = Math.acos(cosHalfTheta);
    const sinHalfTheta = Math.sqrt(1.0 - cosHalfTheta * cosHalfTheta);

    // If theta = 180 degrees, result is not fully defined
    if (Math.abs(sinHalfTheta) < 0.001) {
        return new CANNON.Quaternion(
            0.5 * (q1.x + q2.x),
            0.5 * (q1.y + q2.y),
            0.5 * (q1.z + q2.z),
            0.5 * (q1.w + q2.w),
        );
    }

    const ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta;
    const ratioB = Math.sin(t * halfTheta) / sinHalfTheta;

    return new CANNON.Quaternion(
        q1.x * ratioA + q2.x * ratioB,
        q1.y * ratioA + q2.y * ratioB,
        q1.z * ratioA + q2.z * ratioB,
        q1.w * ratioA + q2.w * ratioB,
    );
}
