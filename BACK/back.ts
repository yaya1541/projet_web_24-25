import { Application, Router } from "https://deno.land/x/oak@v17.1.4/mod.ts";
import { oakCors } from "https://deno.land/x/cors/mod.ts";
import {verifyJWT,createJWT} from "../BACK/jwt_func.ts"
import { authorizationMiddleware } from "../BACK/middlewares.ts";

//import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
import { bodies, world, circuit,inputs, connectedUsers } from "./script.js";

import { Car } from "./lib/car.js";
import { InsertUser, UserExist, UserPassword } from "./rest.ts";
import { Bodies,Inputs,InputMessage,Token} from "./interfaces.ts"; 
  

const router = new Router();
const app = new Application();

app.use(oakCors({
    origin: "https://localhost:8080",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization","getsetcookie","setcookie"],
    optionsSuccessStatus : 200,
    credentials: true,
}));

const tokens = {};
export const connections : WebSocket[] =[];

//
// MODULES
//
router.get("/lib/:module",authorizationMiddleware, async (ctx) => {
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

// resource loader

router.get("/src/:module", authorizationMiddleware, async (ctx) => {
  console.log("Trying to retrieve Resource");
  const { module } = ctx.params;
  console.log(`Sending: ${module}`);
  const path = `./src/${module}`;
  
  try {
    // Determine the file extension
    const fileExtension = (module.split('.').pop() as string).toLowerCase();
    
    // Set the appropriate Content-Type based on the file extension
    switch (fileExtension) {
      case 'gltf':
      case 'glb':
        ctx.response.headers.set("Content-Type", "model/gltf-binary");
        break;
      case 'svg':
        ctx.response.headers.set("Content-Type", "image/svg+xml");
        break;
      case 'png':
        ctx.response.headers.set("Content-Type", "image/png");
        break;
      case 'jpg':
      case 'jpeg':
        ctx.response.headers.set("Content-Type", "image/jpeg");
        break;
      case 'css':
        ctx.response.headers.set("Content-Type", "text/css");
        break;
      default:
        ctx.response.headers.set("Content-Type", "application/octet-stream");
    }
    
    // Serve the file
    ctx.response.body = await Deno.readFile(path);
  } catch (e) {
    console.error(`Error serving ${module}:`, e);
    ctx.response.status = 404;
    ctx.response.body = `Resource ${module} not found`;
  }
});

//router.get("/");
export function notifyAllUsers(json: Object) {
  connections.forEach((client) => {
    client.send(JSON.stringify(json));
  });
  console.log("sent Message !");
  
}

router.get("/game/kartfever",authorizationMiddleware,(ctx)=>{
  console.log("Request recieved");
  try{
    const ws = ctx.upgrade();
    connections.push(ws);
    ws.onopen =async (event)=>{
      console.log(`New connection opened (${connections.length})`);
      const user = (await ctx.cookies.get("user") as string);
      console.log("user : ",user);
      if (connectedUsers.indexOf(user)== -1){
        connectedUsers.push(user);
      }
      ws.send(JSON.stringify({
        type : 0, // Type 0 initialization
        CircuitNodes : circuit.pathNodes,
        CircuitPoints : circuit.pathPoints,
        CircuitWitdh : circuit.options.roadWidth
      }));
      if (!(bodies as Bodies)[user]){
        (bodies as Bodies)[user] = new Car(world, null, user);
        (bodies as Bodies)[user].carBody!.position.y = 3;
        (inputs as Inputs)[user]={};
        console.log("I : ",inputs);
        notifyAllUsers({ type :4, users : Object.keys(bodies)});
      }
    }
    ws.onclose = (event)=>{
      console.log("Connections closed");
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
    ws.onmessage = (event) => {
      const data = (JSON.parse(event.data) as InputMessage);
      console.log("Message recieved",data);
      switch (data.type) {
        case 2:
          (inputs as Inputs)[data.user][data.value] = true;
          break;
        case 3:
          (inputs as Inputs)[data.user][data.value] = false;
          break;
        default:
          break;
      }
    }
  }catch{
    ctx.response.status = 501;
    ctx.response.body = { message : "Unable to establish Websocket"}
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
router.get("/api/stats/",(ctx)=>{})
router.get("/api/stats/:user",(ctx)=>{})
*/

router.get("/api/user/getdata",authorizationMiddleware,async (ctx)=>{
  const token = (await ctx.cookies.get("refreshToken") as string) ;
  const payload = (await verifyJWT(token) as Token);
  console.log(payload);
  ctx.response.status = 200;
  ctx.response.body = {
    user : payload.username,
    others : connectedUsers
  }
});

router.post("/api/login",async (ctx)=>{
  const {user,pass} =await ctx.request.body.json();
  console.log(user,pass);
  try {
    if (await UserExist(user)){
      console.log(await UserPassword(user));
      
      if (await UserPassword(user) == pass){
        ctx.response.status = 200;
        ctx.cookies.set("refreshToken",await createJWT("30d",{username:user,date:new Date()}),{httpOnly:true});
        ctx.cookies.set("user",user);
        ctx.response.headers.set("Set-Login","logged-in");
      }else {
        ctx.response.status = 401;
      }
      //
    }else{
      ctx.response.status = 401;
      console.log("User with this name already entered");
      
    }
    ctx.response.body = { message: "User registered successfully" };
  } catch (error) {
    console.error(error);
    ctx.response.status = 500;
    ctx.response.body = { message: "Internal server error" };
  }
})

router.get("/api/oauth",authorizationMiddleware,(ctx)=>{
  ctx.response.status = 200;
});

router.post("/api/register", async (ctx) => {
    const data = await ctx.request.body.json();
    const user = data.user;
    const pass = data.pass;
  
    try {
      ctx.response.status = 200;
      if (!(await UserExist(user))){
        InsertUser(user,pass);
        ctx.response.status = 201;
      }else{
        console.log("User with this name already registered");
      }
      ctx.response.body = { message: "User registered successfully" };
    } catch (error) {
      console.error(error);
      ctx.response.status = 500;
     ctx.response.body = { message: "Internal server error" };
     }
  });
  

let session : number = 0;

router.post("/api/startsession", async (ctx) => {
  console.log("Protocol:", ctx.request.url.protocol);
  console.log("Headers:", ctx.request.headers);
  console.log("Cookies:", ctx.cookies);

  const expiration = new Date()
  expiration.setDate(expiration.getDate()+1);
  console.log(expiration);
  
  session++;
  try {
    ctx.cookies.set("sessionId", await createJWT("1d",{session:session}), {
      httpOnly: true,
      secure: ctx.request.secure// Only set secure if the request is actually secure
    });
    console.log("Cookie set successfully");
  } catch (error) {
    console.error("Error setting cookie:", error);
  }
});


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
