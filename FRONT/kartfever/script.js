import { Game } from "./public/game.js";
import { Player } from "./public/player.js";

const player = new Player('yanis');
const _game = new Game(player);
/*
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';

class Game {
    constructor() {
      this.scene = new THREE.Scene();
      this.renderer = new THREE.WebGLRenderer({ antialias: true });
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      document.body.appendChild(this.renderer.domElement);
  
      this.player = new Player(this.scene);
  
      this.animate = this.animate.bind(this);
      this.animate();
    }
  
    animate() {
      requestAnimationFrame(this.animate);
      this.player.update();
      this.renderer.render(this.scene, this.player.camera);
    }
  }
  
  class Player {
    constructor(scene) {
      this.camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
      );
      this.camera.position.z = 5;
  
      // Add a simple cube to the scene
      const geometry = new THREE.BoxGeometry();
      const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
      this.cube = new THREE.Mesh(geometry, material);
      scene.add(this.cube);
    }
  
    update() {
      // Rotate the cube for some simple animation
      this.cube.rotation.x += 0.01;
      this.cube.rotation.y += 0.01;
    }
  }
  
  // Initialize the game
  const game = new Game();
*/