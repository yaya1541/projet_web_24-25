import { Application, Router } from "https://deno.land/x/oak@v17.1.4/mod.ts";
import { oakCors } from "https://deno.land/x/cors/mod.ts";
import {verifyJWT,createJWT} from "../BACK/jwt_func.ts"
import { authorizationMiddleware } from "../BACK/middlewares.ts";

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
import { gameObjects, thirdPartyObject } from "./level1.js";


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
const connections : WebSocket[] =[];

//router.get("/");
function notifyAllUsers(json: any) {
  connections.forEach((client) => {
    client.send(json);
  });
}

router.get("/game",async (ctx)=>{
  const ws = ctx.upgrade();
  connections.push(ws);
  console.log(`+ websocket connected (${connections.length})`);
  ws.onopen = (event) => {
    console.log("connection opened");
    console.log(event);
    
  };
  ws.onerror = (_error) => {};
  ws.onmessage = (event) => {
    console.log(event.data);
    notifyAllUsers(event.data);
  };
  ws.onclose = (event) => {};

  //ctx.response.body = gameObjects;
});

//
// API
//

router.get("/api/map-data",(ctx)=>{
  ctx.response.body = JSON.stringify({
    game:gameObjects,
    third:thirdPartyObject});
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
