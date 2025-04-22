import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
import { Game, gameObj } from "./public/game.js";
import { Player } from "./public/player.js";

const player = new Player('yanis');
const _game = new Game(player);
const ws = new WebSocket("wss://localhost:3000/game");

ws.onmessage = (ctx) => {
    const data = JSON.parse(ctx.data);
    console.log("Received data:", data); // Add this line for logging

    for (const id in data) {
        if (gameObj[id]) {
            gameObj[id].position.set(
                data[id].position.x,
                data[id].position.y,
                data[id].position.z
            );
            gameObj[id].setRotationFromQuaternion(new THREE.Quaternion(
                data[id].quaternion.x,
                data[id].quaternion.y,
                data[id].quaternion.z,
                data[id].quaternion.w
            ));
        }
    }
};


document.addEventListener("keydown",(event)=>{
  if (event.key == "r"){
    ws.send("restart");
  }
})
