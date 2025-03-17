import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
import {Brush,Evaluator,SUBTRACTION} from 'https://cdn.jsdelivr.net/npm/three-bvh-csg@0.0.16/+esm';
import { addRectangle,addQuad } from './mapUtils/Geometry.js';
import { Door } from './mapUtils/Door.js';

const gameObjects = [];
const thirdPartyObject = [];

const room = new THREE.Object3D();

const floorGeometry = new THREE.PlaneGeometry(500, 500); 
const floorMaterial = new THREE.MeshBasicMaterial({ 
    side : THREE.DoubleSide
});
const floorShadow = new THREE.ShadowMaterial({
	opacity : 0.5 , 
	color: 0xbbbbbb,
    side : THREE.DoubleSide
});


const floor = new THREE.Mesh(floorGeometry, floorMaterial);
const ground= new THREE.Mesh(floorGeometry,floorShadow);

floor.rotation.x = -Math.PI/2;

ground.rotation.x = -Math.PI/2;
ground.position.y +=.01;
ground.receiveShadow = true;

const ceilGeometry = new THREE.PlaneGeometry(500, 500); 
const ceilMaterial = new THREE.MeshBasicMaterial({ 
    side : THREE.DoubleSide
});

const ceil = new THREE.Mesh(ceilGeometry, ceilMaterial);

ceil.rotation.x = Math.PI / 2;
ceil.position.y = 7;


//
// WALLS
//
const mainShape = new THREE.Shape();
mainShape.holesGeom = [];

addRectangle(mainShape,-10,-10,20,20);
addRectangle(mainShape,-20,10,40,30);
addRectangle(mainShape,20,-20,40,40);
addQuad(mainShape,-20,20,15,15,.5,.5);

const extrudeSettings = {
    steps: 1,
    depth: 7,
    bevelEnabled: false,
    bevelThickness: 1,
    bevelSize: 1,
    bevelOffset: 0,
    bevelSegments: 1
};

const geometry = new THREE.ExtrudeGeometry( mainShape, extrudeSettings );
//geometry.rotateX(-Math.PI/2);
//console.log(geometry.parameters.shapes);
const material = new THREE.MeshBasicMaterial( { 
    side : THREE.DoubleSide
});

let mesh = new THREE.Mesh( geometry, material ) ;
mesh.geometry.rotateX(-Math.PI/2);

function makeHoles(mesh){
    let meshBrush = new Brush(mesh.geometry,mesh.material); 
    const ev = new Evaluator();
    mesh.geometry.parameters.shapes.holesGeom.forEach(element => {
        const tmpBrush = new Brush(element,material);
        console.log(element.pos);

        meshBrush.position.z = element.pos[1];
        meshBrush = ev.evaluate(meshBrush,tmpBrush,SUBTRACTION);
        //room.add(tmpBrush);
    });
    mesh.geometry.parameters.shapes.holesGeom.forEach(element => {
        const tmpBrush = new Brush(element,material);
        console.log(element.pos);

        meshBrush.position.z = element.pos[1];
        meshBrush = ev.evaluate(meshBrush,tmpBrush,SUBTRACTION);
        //room.add(tmpBrush);
    });
    return meshBrush;
}

mesh = makeHoles(mesh);


function addDoor(obj,x,z,horizontal = true){
    
    const d = new Door(x, 0, z,horizontal);
    gameObjects.push(d.object);
    const db = new Brush(d.object.geometry,new THREE.MeshBasicMaterial({color:0x00FF00}));

    //room.add(db);
    const gb = new Brush(obj.geometry,obj.material); // Directly use the object for CSG
    //room.add(gb)
    const e = new Evaluator();
    const intersection = e.evaluate(gb, db, SUBTRACTION);
    console.log(intersection); // Debug the intersection result
    return intersection;  // Return the intersection result
    
}

mesh = addDoor(mesh,0,-10);
mesh = addDoor(mesh,14.5,20,false,false);
//
//
//

room.add( mesh );
room.is_wall = true;
///
/// game objects
///
floor.material = new THREE.MeshBasicMaterial({color:0xffff0f});
thirdPartyObject.push(floor);
thirdPartyObject.push(ceil);
//thirdPartyObject.push(ground);

gameObjects.push(mesh);
/*
gameObjects.push(new THREE.Mesh(
    new THREE.BoxGeometry(5,5,5),
    new THREE.MeshBasicMaterial({color:0x00ff00})
))
*/
function serializeObject(object) {
    // Ensure the object's matrix is updated
    object.updateMatrixWorld();

    // Serialize the object
    const json = object.toJSON();
    return JSON.stringify(json);
}
gameObjects.forEach((elt)=>{
    serializeObject(elt);
})
thirdPartyObject.forEach((elt)=>{
    serializeObject(elt);
})


export {gameObjects,thirdPartyObject};
