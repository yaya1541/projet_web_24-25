import { Application, Router } from "https://deno.land/x/oak@v17.1.4/mod.ts";
import { oakCors } from "https://deno.land/x/cors/mod.ts";
import {verifyJWT,createJWT} from "../BACK/jwt_func.ts"
import { authorizationMiddleware } from "../BACK/middlewares.ts";

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
import { stateL,bodies, world, circuit } from "./script.js";


import { Client } from "https://deno.land/x/mysql/mod.ts";
const dbClient = await new Client().connect({
  hostname: "127.0.0.1",
  username: "root",
  db: "projetWeb2425",
  password: process.env.DATABASE_PASS,
}).finally(()=>
  console.log("sucessfully connected to DataBase")
);

const router = new Router();
const app = new Application();

app.use(oakCors({
    origin: "https://localhost:8080",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus : 200,
    credentials: true,
}));

const tokens = {};
export const connections : WebSocket[] =[];

//
// MODULES
//
router.get("/lib/:module", async (ctx) => {
  console.log("Trying to retrieve module");
  
  const { module } = ctx.params;
  console.log(`Sending : ${module}`);
  
  const path = `./lib/${module}`;
  
  try {
    // Set the correct MIME type for JavaScript files
    ctx.response.headers.set("Content-Type", "application/javascript");
    
    // Serve the file
    ctx.response.body = await Deno.readTextFile(path);
  } catch (e) {
    ctx.response.status = 404;
    ctx.response.body = `Module ${module}.js not found`;
  }
});

//router.get("/");
export function notifyAllUsers(json: any) {
  connections.forEach((client) => {
    client.send(json);
  });
}

/*
router.get("/game",async (ctx)=>{
  const ws = ctx.upgrade();
  connections.push(ws);
  console.log(`+ websocket connected (${connections.length})`);
  ws.onopen = (event) => {
    console.log("connection opened");
    //console.log(event);
    //console.log(stateL);
  };  
  ws.onerror = (_error) => {};
  ws.onmessage = (event) => {
    console.log(event.data);
    
    if (event.data == "restart"){
      bodies.box.position.y +=5;
      bodies.cylinder1.position.y +=5;
      bodies.cylinder2.position.y +=5;
      bodies.cylinder3.position.y +=5;
      bodies.cylinder4.position.y +=5;
    }
    //console.log(event.data);
    //notifyAllUsers(event.data);
  };
  ws.onclose = (event) => {};
  //ctx.response.body = gameObjects;
});
*/

router.get("/game/kartfever",authorizationMiddleware,(ctx)=>{
  console.log("Request recieved");
  try{
    const ws = ctx.upgrade();
    connections.push(ws);
    ws.onopen = (event)=>{
      console.log("New connection opened");
      console.log(connections);
      ws.send(JSON.stringify({
        CircuitNodes : circuit.pathNodes,
        CircuitPoints : circuit.pathPoints
      })
      )
    }
    ws.onclose = (event)=>{
      "Connections closed"
      function removeValue(value:WebSocket, index:number, arr:WebSocket[]) {
        // If the value at the current array index matches the specified value (2)
        if (value === ws) {
        // Removes the value from the original array
            arr.splice(index, 1);
            return true;
        }
        return false;
      }
    
      // Pass the removeValue function into the filter function to return the specified value
      connections.filter(removeValue);
    
    }
  }catch{
    ctx.response.status = 501;
  }
})

router.get("/game/kartfever/reload",(ctx)=>{
  circuit.remove();
  circuit.reload();
  ctx.response.status = 200;
})

//
// API
//

/*
router.get("/api/login",(ctx)=>{})

router.get("/api/stats/",(ctx)=>{})
router.get("/api/stats/:user",(ctx)=>{})

*/
router.get("/api/register",(ctx)=>{
})


/*
//user login
router.post("/signin");
router.post("/login");

router.get("/oauth/refresh");
*/

const certPath = "../certs/server.crt"; // Update to your certificate path
const keyPath = "../certs/server.key";   // Update to your private key path

const options = {
  port : 3000,
  cert:await Deno.readTextFile(certPath),
  key: await Deno.readTextFile(keyPath),
};

console.log(`Oak back server running on port ${options.port}`);

app.use(router.routes());
app.use(router.allowedMethods());

app.listen(options);
