import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';

export class Door {
    constructor(x, y, z,horizontal = true,needKey=false) {
        const geom = new THREE.BoxGeometry(7, 5, 1.5);

        let mat = new THREE.MeshBasicMaterial({ color:0xff0000 });
        if (needKey){
            mat = new THREE.MeshBasicMaterial({ color:0xff00ff });
        }

        this.object = new THREE.Mesh(
            geom,
            mat
        );
        this.object.position.set(x,y+2.5,z)
        this.object.receiveShadow = true;

        this.object.is_door = true;
        this.object.parentclass = this;
        this.isOpen = false;
        this.openAmount = 0; // Tracks how much the door is open

        if (!horizontal){
            this.object.geometry.rotateY(Math.PI/2);
        }
        this.needKey = needKey;

    }

    update() {
        //console.log('Door update called. Is open:', this.isOpen, 'Open amount:', this.openAmount);
        if (!this.needKey){
            if (this.isOpen) {
                this.open();
            } else {
                this.close();
            }
        }
    }

    open() {
        if (this.openAmount < 1) {
            this.openAmount += 0.01;
            this.object.position.y = 7 * this.openAmount;
            //console.log('Opening door. New position:', this.object.position.y);
            if (this.openAmount >= 1) {
                setTimeout(()=>{this.isOpen = false;},1000);
            }
        }
    }

    close() {
        if (this.openAmount > 0) {
            this.openAmount -= 0.01;
            this.object.position.y = 7 * this.openAmount;
            //console.log('Closing door. New position:', this.object.position.y);
        }
    }
}