import { Context } from "https://deno.land/x/oak@v17.1.4/mod.ts";
import {verifyJWT,createJWT} from "./jwt_func.ts"


async function authorizationMiddleware(ctx: Context, next: () => Promise<unknown>) {
    /*const authHeader = ctx.request.headers.get("Authorization");
    console.log(authHeader);
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      ctx.response.status = 401;
      ctx.response.body = { message: "Unauthorized: Missing or invalid Authorization header" };
      return;
    }
  
    let token = authHeader.substring(7);
    */
    const token = String(ctx.request.url.searchParams.get('token'));
    
    const payload = await verifyJWT(token);
  
    if (payload) {
      console.log("Token verified:", payload);
      await next(); // Proceed to the next middleware or route handler
    } else {
      console.error("Token verification failed");
      ctx.response.status = 401;
      ctx.response.body = { message: "Unauthorized: Invalid token" };
      return;
    }
}

async function JWTHandlerMiddleware(ctx:Context,next : () => Promise<unknown>){

}

export {authorizationMiddleware,JWTHandlerMiddleware}