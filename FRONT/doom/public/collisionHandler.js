import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';

export class collisionHandler {
    constructor(parent){
        this.parent = parent;
        this.directions = {
            "FRONT": new THREE.Vector2(0, 0),
            "BACK": new THREE.Vector2(0, -1),
            "LEFT": new THREE.Vector2(-1, 0),
            "RIGHT": new THREE.Vector2(1, 0)
        };
        this.raycaster = new THREE.Raycaster();
    }

    checkCollision(Objects) {

        for (const [side, direction] of Object.entries(this.directions)) {
            this.raycaster.setFromCamera(direction, this.parent.camera);
            const intersects = this.raycaster.intersectObjects(Objects);
    
            this.handleCollisions(intersects, side);
        }
        //console.log(canMove);
    }
    
    handleCollisions(objects, side) {
        let closestDistance = Infinity;
        let closestObject = null;
    
        objects.forEach(intersect => {
            if (intersect.distance < closestDistance) {
                closestDistance = intersect.distance;
                closestObject = intersect.object;
            }
        });
    
        if (closestObject) {
            if (closestDistance < 0.7) {
                //closestObject.material.color.set(0x0000ff); // Blue for collision
                this.setMove(side, false);
            } else if (closestDistance < 2) {
                if (closestObject.is_door) {
                    closestObject.parentclass.isOpen = true; // Set the door to open
                }
            } else {
                this.setMove(side, true);
            }
        }else{
            this.setMove(side, true);
        }
    }
    
    
    setMove(side, value) {
        this.parent.canMove[side] = value;
    }
}