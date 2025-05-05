import { Context, Status } from "https://deno.land/x/oak@v17.1.4/mod.ts";
import { createJWT, verifyJWT } from "./jwt_func.ts";
import { Token } from "./interfaces.ts";

// Authorization middleware
async function authorizationMiddleware(
  ctx: Context,
  next: () => Promise<unknown>,
) {
  try {
    // Get access token and refresh token from cookies
    const token = await ctx.cookies.get("accessToken");
    const refreshToken = await ctx.cookies.get("refreshToken");

    if (!token) {
      ctx.response.status = Status.Unauthorized;
      ctx.response.body = { data: "Unauthorized: No token provided" };
      return;
    }

    // Verify access token
    const payload = await verifyJWT(token);
    const currentTime = Math.floor(Date.now() / 1000);

    // Check if token is valid and not expired
    if (payload && (!payload.exp || payload.exp >= currentTime)) {
      ctx.state.user = { username: payload.username };
      await next();
      return;
    }

    // At this point, token is either invalid or expired
    // Try to use refresh token
    if (!refreshToken) {
      ctx.response.status = Status.Unauthorized;
      ctx.response.body = { data: "Unauthorized: No refresh token provided" };
      return;
    }

    // Verify refresh token directly

    const refreshPayload = await verifyJWT(refreshToken);
    if (!refreshPayload) {
      ctx.response.status = Status.Unauthorized;
      ctx.response.body = { data: "Unauthorized: Invalid refresh token" };
      return;
    }

    // Generate new access token directly
    const newAccessToken = await generateAccessToken(
      "10s",
      (refreshPayload as Token).username,
    );
    const expiresIn = 3600; // 1 hour in seconds (adjust as needed)

    // Set new access token in cookies
    await ctx.cookies.set("accessToken", newAccessToken, {
      httpOnly: true,
      secure: Deno.env.get("ENV") === "production",
      sameSite: "lax",
      expires: new Date(Date.now() + expiresIn * 1000),
      path: "/",
    });

    // Set user data
    ctx.state.user = { username: refreshPayload.username };
    await next();
  } catch (error) {
    console.error("Authorization middleware error:", error);
    ctx.response.status = Status.InternalServerError;
    ctx.response.body = { data: "Internal server error" };
  }
}

// Helper function to generate a new access token
function generateAccessToken(
  duration: string,
  username: string,
): Promise<string> {
  // Create JWT with appropriate expiration time
  const expirationTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
  // Replace with your actual JWT creation logic
  return createJWT(duration, {
    username: username,
    exp: expirationTime,
  });
}

export { authorizationMiddleware };
