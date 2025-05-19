import { Context, Status } from 'https://deno.land/x/oak@v17.1.4/mod.ts';
import { createJWT, decodeJwt, verifyJWT } from './jwt_func.ts';
import { Token } from './interfaces.ts';
import * as db from './rest.ts';

// Authorization middleware
async function authorizationMiddleware(
    ctx: Context,
    next: () => Promise<unknown>,
) {
    try {
        // Get access token and refresh token from cookies
        const token = await ctx.cookies.get('accessToken');

        if (!token) {
            ctx.response.status = Status.Unauthorized;
            ctx.response.body = { data: 'Unauthorized: No token provided' };
            return;
        }

        // Verify access token
        let payload = await verifyJWT(token);
        const currentTime = Math.floor(Date.now() / 1000);

        // Check if token is valid and not expired
        if (payload && (!payload.exp || payload.exp >= currentTime)) {
            //ctx.state.user = { username: payload.username };
            ctx.state.userId = payload.userId;
            await next();
            return;
        } else {
            payload = await decodeJwt(token);
        }

        // At this point, token is either invalid or expired
        let refreshToken = null;
        if (payload) {
            refreshToken = await db.getUserRefresh(payload.userId as number);
        }
        // Try to use refresh token
        if (!refreshToken) {
            ctx.response.status = Status.Unauthorized;
            ctx.response.body = {
                data: 'Unauthorized: No refresh token provided',
            };
            return;
        }

        // Verify refresh token directly

        const refreshPayload = await verifyJWT(refreshToken);
        if (!refreshPayload) {
            ctx.response.status = Status.Unauthorized;
            ctx.response.body = { data: 'Unauthorized: Invalid refresh token' };
            return;
        }

        // Generate new access token directly
        const newAccessToken = await generateAccessToken(
            '10s',
            (refreshPayload as Token).userId,
        );
        const expiresIn = 3600; // 1 hour in seconds (adjust as needed)

        // Set new access token in cookies
        await ctx.cookies.set('accessToken', newAccessToken, {
            httpOnly: true,
            secure: Deno.env.get('ENV') === 'production',
            sameSite: 'lax',
            //expires: new Date(Date.now() + expiresIn * 1000),
            path: '/',
        });

        // Set user data
        console.log('       last payload :', refreshPayload);

        ctx.state.user = { username: refreshPayload.username };
        ctx.state.userId = refreshPayload.userId;
        await next();
    } catch (error) {
        console.error('Authorization middleware error:', error);
        ctx.response.status = Status.InternalServerError;
        ctx.response.body = { data: 'Internal server error' };
    }
}

// Middleware de vérification du rôle admin
export const adminMiddleware = async (
    ctx: Context,
    next: () => Promise<unknown>,
) => {
    try {
        const userId = ctx.state.userId;
        const isAdmin = await db.hasRole(userId, 1); // 1 = ADMIN

        if (!isAdmin) {
            ctx.response.status = 403;
            ctx.response.body = {
                message: 'Forbidden: Admin privileges required',
            };
            return;
        }

        await next();
    } catch (err) {
        ctx.response.status = 500;
        ctx.response.body = { message: 'Server error: ' + err };
    }
};

// Helper function to generate a new access token
function generateAccessToken(
    duration: string,
    username: number,
): Promise<string> {
    // Create JWT with appropriate expiration time
    const expirationTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    // Replace with your actual JWT creation logic
    return createJWT(duration, {
        userId: username,
        exp: expirationTime,
    });
}

export { authorizationMiddleware };
