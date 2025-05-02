import { Context } from "https://deno.land/x/oak@v17.1.4/mod.ts";
import {verifyJWT,createJWT} from "./jwt_func.ts"


async function authorizationMiddleware(ctx: Context, next: () => Promise<unknown>) {
    const token = await ctx.cookies.get('refreshToken');
    //console.log(token);
    if (token){
      const payload = await verifyJWT(token!);
    
      if (payload) {
        //console.log("Token verified:", payload);
        ctx.response.body = {user : payload.username};
        await next(); // Proceed to the next middleware or route handler
      } else {
        console.error("Token verification failed");
        ctx.response.status = 401;
        ctx.response.body = { data : "Unauthorized: Invalid token" };
        return;
      }
    }else{
      console.error("No Token Provided");
      ctx.response.status = 401;
      ctx.response.body = { data : "Unauthorized: No token provided" };
      return;
    }
}

async function JWTHandlerMiddleware(ctx:Context,next : () => Promise<unknown>){

}

export {authorizationMiddleware,JWTHandlerMiddleware}