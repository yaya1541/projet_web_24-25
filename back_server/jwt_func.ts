import { decodeJwt, JWTPayload, jwtVerify, SignJWT } from 'npm:jose@5.9.6';
import * as jwt from 'https://deno.land/x/djwt@v2.8/mod.ts';

import process from 'node:process';

const secret = new TextEncoder().encode(process.env.SECRET);

async function createJWT(
    duration: string,
    payload: JWTPayload,
): Promise<string> {
    const jwt = await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(duration)
        .sign(secret);
    return jwt;
}

async function verifyJWT(token: string): Promise<JWTPayload | null> {
    try {
        const { payload } = await jwtVerify(token, secret);
        //console.log("JWT is valid:", payload);
        //console.log("       ",payload);
        return payload;
    } catch (_e) {
        return null;
    }
}

export { createJWT };
export { verifyJWT };
export { decodeJwt };
