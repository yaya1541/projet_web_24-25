import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
import * as defaults from 'https://cdn.jsdelivr.net/npm/cannon@0.6.2/+esm';
import { cars } from './script.js';
const CANNON = defaults.default;

// CHANGE 3: Modify handlePlayerCarUpdate for smoother client-server reconciliation
export function handlePlayerCarUpdate(
    id,
    serverPos,
    serverQuat,
    serverVelocity,
) {
    // Calculate difference between predicted and actual position
    //console.log("Handling player");

    const posDiff = new THREE.Vector3(
        serverPos.x - cars[id].carMesh.position.x,
        serverPos.y - cars[id].carMesh.position.y,
        serverPos.z - cars[id].carMesh.position.z,
    );

    // CHANGED: Use gentler correction for smoother experience
    if (posDiff.length() > 10) {
        console.log('posdiff > 5');

        // Strong correction if very out of sync
        cars[id].carBody.position.set(serverPos.x, serverPos.y, serverPos.z);
        cars[id].carBody.quaternion.set(
            serverQuat.x,
            serverQuat.y,
            serverQuat.z,
            serverQuat.w,
        );

        // Also reset velocity if provided
        if (serverVelocity) {
            cars[id].carBody.velocity.set(
                serverVelocity.x,
                serverVelocity.y,
                serverVelocity.z,
            );
        }
    } else {
        // CHANGED: Gentler correction for normal situations
        // Apply only 5% correction instead of 10-20% for smoother experience
        cars[id].carBody.position.x += posDiff.x * 0.05;
        cars[id].carBody.position.y += posDiff.y * 0.05;
        cars[id].carBody.position.z += posDiff.z * 0.05;

        // Also correct quaternion with minimal interpolation
        const targetQuat = new CANNON.Quaternion(
            serverQuat.x,
            serverQuat.y,
            serverQuat.z,
            serverQuat.w,
        );

        cars[id].carBody.quaternion.copy(targetQuat);

        // Adjust velocity with minimal correction
        if (serverVelocity) {
            cars[id].carBody.velocity.x = cars[id].carBody.velocity.x * 0.95 +
                serverVelocity.x * 0.05;
            cars[id].carBody.velocity.y = cars[id].carBody.velocity.y * 0.95 +
                serverVelocity.y * 0.05;
            cars[id].carBody.velocity.z = cars[id].carBody.velocity.z * 0.95 +
                serverVelocity.z * 0.05;
        }
    }
}

// Fixed export syntax - this was causing a critical error
export function handleOtherCarUpdate(
    id,
    serverPos,
    serverQuat,
    serverVelocity,
    now,
) {
    // Store server position for prediction
    cars[id].lastServerPosition = new THREE.Vector3(
        serverPos.x,
        serverPos.y,
        serverPos.z,
    );

    cars[id].lastServerQuaternion = new THREE.Quaternion(
        serverQuat.x,
        serverQuat.y,
        serverQuat.z,
        serverQuat.w,
    );

    // Update velocity for prediction
    if (serverVelocity) {
        cars[id].velocity = new THREE.Vector3(
            serverVelocity.x,
            serverVelocity.y,
            serverVelocity.z,
        );
    }

    // Calculate angular velocity (if we have previous quaternion data)
    if (cars[id].previousServerQuaternion) {
        // Calculate quaternion difference
        const diffQuat = cars[id].lastServerQuaternion.clone().conjugate()
            .multiply(cars[id].previousServerQuaternion);

        // Extract axis and angle
        let angle = 2 * Math.acos(diffQuat.w);
        const s = Math.sqrt(1 - diffQuat.w * diffQuat.w);

        // Calculate angular velocity components (axis * angle / time)
        if (s > 0.001 && cars[id].lastUpdateTime) {
            const timeDiff = (now - cars[id].lastUpdateTime) / 1000;
            if (timeDiff > 0) {
                const x = diffQuat.x / s;
                const y = diffQuat.y / s;
                const z = diffQuat.z / s;

                // If angle is too large, it likely wrapped around, so correct it
                if (angle > Math.PI) {
                    angle = 2 * Math.PI - angle;
                }

                // Set angular velocity
                cars[id].angularVelocity.set(
                    (x * angle) / timeDiff,
                    (y * angle) / timeDiff,
                    (z * angle) / timeDiff,
                );
            }
        }
    }

    // Store current quaternion for next update
    cars[id].previousServerQuaternion = cars[id].lastServerQuaternion.clone();
    cars[id].lastUpdateTime = now;

    // Apply immediate but smooth update
    cars[id].carMesh.position.lerp(cars[id].lastServerPosition, 0.3);
    cars[id].carMesh.quaternion.slerp(cars[id].lastServerQuaternion, 0.3);
}
