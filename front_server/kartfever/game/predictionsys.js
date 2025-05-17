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
            lastUpdateTime: Date.now(),
            quaternionHistory: [],
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

        if (posErrorMagnitude > 10.0 || angle > Math.PI / 2) {
            car.carBody.position.copy(serverPos);
            car.carBody.quaternion.copy(serverQuatObj);
            if (serverVelocity) car.carBody.velocity.copy(serverVelocity);
            if (serverAngularVelocity) {
                car.carBody.angularVelocity.copy(serverAngularVelocity);
            }
        } else if (posErrorMagnitude > 0.2 || angle > Math.PI / 32) {
            car.carBody.position.x += posError.x * 0.05;
            car.carBody.position.y += posError.y * 0.05;
            car.carBody.position.z += posError.z * 0.05;
            car.carBody.quaternion.slerp(serverQuatObj, 0.05);
            if (serverVelocity) {
                car.carBody.velocity.x = car.carBody.velocity.x * 0.95 +
                    serverVelocity.x * 0.05;
                car.carBody.velocity.y = car.carBody.velocity.y * 0.95 +
                    serverVelocity.y * 0.05;
                car.carBody.velocity.z = car.carBody.velocity.z * 0.95 +
                    serverVelocity.z * 0.05;
            }
        }

        // Visual smoothing
        car.carMesh.position.lerp(car.carBody.position, 0.3);
        car.carMesh.quaternion.slerp(car.carBody.quaternion, 0.3);

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

        // Quaternion history for smoothing
        state.quaternionHistory.push({
            time: now,
            quat: state.lastServerQuaternion.clone(),
        });
        if (state.quaternionHistory.length > 5) state.quaternionHistory.shift();

        const timeSinceUpdate = (Date.now() - state.lastUpdateTime) / 1000;
        const adaptiveFactor = Math.min(1, timeSinceUpdate * 4);

        car.carMesh.position.lerp(state.lastServerPosition, adaptiveFactor);

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
            if (car.world) continue;
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
            car.carMesh.position.lerp(predictedPos, adaptiveFactor);

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
