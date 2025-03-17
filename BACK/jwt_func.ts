import { JWTPayload, jwtVerify, SignJWT } from "npm:jose@5.9.6";

const secret = new TextEncoder().encode("$2a$10$QICMY5DbenbYKPQksBBw3.");

async function createJWT(payload: JWTPayload): Promise<string> {
    const jwt = await new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(secret);
  
    return jwt;
}

async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    console.log("JWT is valid:", payload);
    return payload;
  } catch (error) {
    console.error("Invalid JWT:", error);
    return null;
  }
}

export {createJWT};
export {verifyJWT};