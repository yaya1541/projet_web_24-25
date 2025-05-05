import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";
import { CSS2DRenderer } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/renderers/CSS2DRenderer.js";

export const gameObj = {
  "box": new THREE.Mesh(
    new THREE.BoxGeometry(2, 0.1, 2),
    new THREE.MeshBasicMaterial({ color: 0x00ff00 }),
  ),
  "cylinder1": new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x0000ff }),
  ),
  "cylinder2": new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x0000ff }),
  ),
  "cylinder3": new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x0000ff }),
  ),
  "cylinder4": new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x0000ff }),
  ),
};

export class Game {
  constructor(player) {
    this.player = player;
    this.camera = player.camera;

    this.scene = new THREE.Scene();

    const axesHelper = new THREE.AxesHelper(10);
    axesHelper.layers.enableAll();
    this.scene.add(axesHelper);

    this.init_renderers();

    this.ambientLight = new THREE.AmbientLight(0x404040, 1);
    this.scene.add(this.ambientLight);

    this.directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    this.directionalLight.position.set(5, 5, 5);
    this.directionalLight.castShadow = true;
    this.scene.add(this.directionalLight);

    this.pointLight = new THREE.PointLight(0xff0000, 1, 100);
    this.pointLight.position.set(0, 5, 0);
    this.scene.add(this.pointLight);

    this.scene.add(this.player.object);

    this.camera.position.set(0, 2, 5);
    this.camera.rotation.x = -Math.PI / 32;

    this.loadScene(gameObj);

    this.animate = this.animate.bind(this);
    this.animate();
  }

  gameLoop() {
    this.player.update();
  }

  loadScene(objs) {
    for (const [_, value] of Object.entries(objs)) {
      console.log(value);
      this.scene.add(value);
    }
  }

  animate() {
    requestAnimationFrame(this.animate);
    this.gameLoop();
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  }

  init_renderers() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(globalThis.innerWidth, globalThis.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.5;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(globalThis.innerWidth, globalThis.innerHeight);
    this.labelRenderer.domElement.style.position = "absolute";
    this.labelRenderer.domElement.style.top = "0px";

    document.body.appendChild(this.renderer.domElement);
    document.body.appendChild(this.labelRenderer.domElement);
  }
}
