import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";
import { Constant } from "./const.js";

export class Player {
  constructor(name) {
    this.name = name;
    //this.id = localStorage.getItem("id");
    this.camera = new THREE.PerspectiveCamera(
      90,
      globalThis.innerWidth / globalThis.innerHeight,
      0.1,
      1000,
    );
    this.object = new THREE.Mesh(
      new THREE.BoxGeometry(1, .5, 1),
      new THREE.MeshBasicMaterial({ color: 0xff0000 }),
    );
    //this.collider = new collisionHandler();
    this.acceleration = 0;
    this.accelerating = false;
    this.forward = false;
    this.backward = false;

    document.addEventListener("keydown", (event) => {
      if (event.key == "z") {
        if (!this.accelerating) {
          this.forward = true;
          this.accelerating = true;
          this.accelerate();
        }
      }
      if (event.key == "s") {
        if (!this.accelerating) {
          this.accelerating = true;
          this.backward = true;
          this.accelerate();
        }
      }
    });
    document.addEventListener("keyup", (event) => {
      if (event.key == "z") {
        this.accelerating = false;
        this.decelerate();
      }
      if (event.key == "s") {
        this.accelerating = false;
        this.decelerate();
      }
    });
  }

  /** */
  accelerate() {
    console.log("accelerating");
    console.log("acce : " + this.acceleration);
    if (this.acceleration >= 1 || this.accelerating == false) {
      return;
    } else {
      this.acceleration += 0.05;
      this.accelerationTimeout = setTimeout(() => this.accelerate(), 500);
    }
  }

  /** */
  decelerate() {
    console.log("dece :" + this.acceleration);
    if (this.acceleration <= 0) {
      this.forward = false;
      this.backward = false;
      return;
    } else {
      this.acceleration -= 0.05;
      this.decelerationTimeout = setTimeout(() => this.decelerate(), 100);
    }
  }

  /** */
  move() {
    if (this.forward) {
      this.object.position.z -= this.acceleration * Constant.SPEED;
      this.camera.position.z -= this.acceleration * Constant.SPEED;
    }
    if (this.backward) {
      this.object.position.z += this.acceleration * Constant.SPEED;
      this.camera.position.z += this.acceleration * Constant.SPEED;
    }
  }

  /** */
  update() {
    this.move();
  }
}
