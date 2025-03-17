/*
import { Player,link } from "../../BACK/builds/gameUtils/Player.js";
import { gameBuilder } from "../../BACK/builds/gameBuilder/game.js";
import { Enemy } from '../../BACK/builds/gameUtils/Enemy.js';

export const Game = new gameBuilder();

const player = new Player("yanis"+ new String(Math.floor(Math.random()*100)),Game);
export const Enemies = [new Enemy(Game.scene,player)];
Game.connect(player);

Game.animate();

const ws = new WebSocket("https://localhost:3000/doom");
link(player,ws);
ws.addEventListener("open", (ctx) => {
    const data = {
        player:player.name,
        event:"connection",
        value:player.name
    }
    ws.send(JSON.stringify(data));
    console.log(Game.players);
    
});

ws.onmessage =(ctx) => {
    console.log(ctx.data);
    
    const data = JSON.parse(ctx.data);
    console.log(data);
    
    if (data.event == "connection" && data.value != player.name){
        console.log("adding new player");
        Game.connect(new Player(data.value,Game));
    };
    for (const [name,elt] of Object.entries(Game.players)){
        //console.log(name,elt);
        if (name == data.player) {
            console.log(data.event);
            
            switch (data.event){
                case "move":
                    console.log(`moving ${name},${data.value}`);
                    elt.moveForward = data.value;
                    //console.log(elt);
                    
                    break;
                case "rotation":
                    elt.object.rotation.y = data.value;
                    elt.camera.rotation.y = data.value;
            }
        }
    }
};

const resume = document.getElementById("Resume");
    resume.addEventListener('click', function() {
        if (!player.parent.gameState.isLocked) {
            document.body.requestPointerLock();
            player.parent.gameState.isLocked = true;
        }
    });

const quit = document.getElementById("Quit");
quit.addEventListener('click', function() {
    document.location.href = "/home"
});
*/
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
import { CSS2DRenderer } from 'https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/renderers/CSS2DRenderer.js';


const back = "https://localhost:3000/"
const SPEED = 0.3

const diff = new THREE.TextureLoader().load( "src/textures/429.png" );
const _disp = new THREE.TextureLoader().load( "src/textures/peeling_painted_wall_disp_1k.png" );
diff.wrapS = THREE.RepeatWrapping;
diff.wrapT = THREE.RepeatWrapping;
diff.repeat.set( 1/5, 1/15 );

const ceilTexture = new THREE.TextureLoader().load("src/textures/082.png");
ceilTexture.wrapS = THREE.RepeatWrapping;
ceilTexture.wrapT = THREE.RepeatWrapping;
ceilTexture.repeat.set( 64, 64 );

const camera = new THREE.PerspectiveCamera(75, globalThis.innerWidth / globalThis.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();

let moving = false;
let isLocked = false;

async function init() {
    const scene = new THREE.Scene();
    const loader = new THREE.ObjectLoader();
    const _data = await fetch(back + 'api/map-data')
        .then(response => response.json())
        .then(data => {
            console.log(data);
            const output = [];
            for (const key in data){
                console.log(data[key]);
                data[key].forEach(element => {
                    output.push(loader.parse(element,(xhr)=>{
                        scene.add(xhr);
                        xhr.material.map = diff;
                        if (key == "third"){
                            xhr.material.map = ceilTexture;
                        }
                        console.log(xhr);
                    }));
                });
            }
            return output;
    });

    

    
    //camera.position.z = 5;
    camera.position.y = 3;
    
    const CAMERADEBUG = new THREE.PerspectiveCamera(75, globalThis.innerWidth / globalThis.innerHeight, 0.1, 1000);
    CAMERADEBUG.rotateX(-Math.PI / 2);
    CAMERADEBUG.position.y = 60;

    

    renderer.setSize(globalThis.innerWidth, globalThis.innerHeight);
    document.body.appendChild(renderer.domElement);

    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize( globalThis.innerWidth, globalThis.innerHeight );
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0px';

    document.body.appendChild( labelRenderer.domElement );
    function animate() {
        if (moving){
            move()
        }
        requestAnimationFrame(animate);

        labelRenderer.render(scene, camera);
        renderer.render(scene, camera);
    }

    animate();
}

function move(){
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    camera.position.add(direction.multiplyScalar(SPEED));
}

function handleMouseMove(event,camera) {
    if (isLocked){
        const deltaX = event.movementX;
        camera.rotation.y -= deltaX * 0.002; // Rotate on Y-axis (yaw)
    }
}

const socket = new WebSocket("https://localhost:3000/game");
//ws.onerror((ctx)=>console.log("no ws"));
socket.onopen = ()=>{
    init();
    document.addEventListener('keyup',()=>{
        socket.send("not moving");
        moving = false;
    })
    document.addEventListener('keydown',()=>{
        if (isLocked && !moving){
            socket.send("moving");
            //moving = true;
        }
    })

    document.addEventListener('mousemove',(event)=>{
        handleMouseMove(event,camera);
        //ws.send(JSON.stringify({player:player.name,"event":"rotation",value:player.camera.rotation.y}));
    })
    document.addEventListener('pointerlockchange', function() {
        isLocked = document.pointerLockElement === document.body;
        console.log(isLocked);
        
        if (ui.style.visibility == "hidden"){
            ui.style.visibility = "visible";
        }else{
            ui.style.visibility = "hidden";
        }
    });
}

socket.onmessage = (event)=>{
    console.log(event);
    
    if (event.data == "moving"){
        moving = true;
    }
    if (event.data == "not moving"){
        moving = false;
    }
}


/// UI

const ui = document.getElementById("ui");
const resume = ui.children[0];
resume.addEventListener("click", ()=>{
    //document.body.requestFullscreen();
    //renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.requestPointerLock();
})
console.log(ui.children);

