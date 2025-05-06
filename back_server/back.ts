import { Application, Router } from 'https://deno.land/x/oak@v17.1.4/mod.ts';
import { oakCors } from 'https://deno.land/x/cors@v1.2.2/mod.ts';
import { createJWT, verifyJWT } from './jwt_func.ts';
import { authorizationMiddleware } from './middlewares.ts';

//import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
import { circuit, connectedUsers, setupGameRouter } from './script.js';
import { InsertUser, UserExist, UserPassword } from './rest.ts';
import { Token } from './interfaces.ts';

const router = new Router();
const app = new Application();

app.use(oakCors({
    origin: ['https://localhost:3000', 'https://localhost:8080'],
    methods: ['GET', 'POST'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'getsetcookie',
        'setcookie',
    ],
    optionsSuccessStatus: 200,
    credentials: true,
}));

//const tokens = {};
// TODO : Store token on login
export const connections: WebSocket[] = [];

//
// MODULES
//
router.get('/lib/:module', authorizationMiddleware, async (ctx) => {
    console.log('Trying to retrieve module');

    const { module } = ctx.params;
    console.log(`Sending : ${module}`);

    const path = `./lib/${module}`;

    try {
        // Set the correct MIME type for JavaScript files
        ctx.response.headers.set('Content-Type', 'application/javascript');

        // Serve the file
        ctx.response.body = await Deno.readTextFile(path);
    } catch (_e) {
        ctx.response.status = 404;
        ctx.response.body = `Module ${module}.js not found`;
    }
});

// resource loader
router.get('/src/:module', async (ctx) => {
    console.log('Trying to retrieve Resource');
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
                ctx.response.headers.set('Content-Type', 'model/gltf-binary');
                break;
            case 'svg':
                ctx.response.headers.set('Content-Type', 'image/svg+xml');
                break;
            case 'png':
                ctx.response.headers.set('Content-Type', 'image/png');
                break;
            case 'jpg':
            case 'jpeg':
                ctx.response.headers.set('Content-Type', 'image/jpeg');
                break;
            case 'css':
                ctx.response.headers.set('Content-Type', 'text/css');
                break;
            default:
                ctx.response.headers.set(
                    'Content-Type',
                    'application/octet-stream',
                );
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
export function notifyAllUsers(json: object) {
    connections.forEach((client) => {
        client.send(JSON.stringify(json));
    });
    console.log('sent Message !');
}

// Game
setupGameRouter(router, authorizationMiddleware);

router.get('/game/kartfever/reload', (ctx) => {
    circuit.remove();
    circuit.reload();
    ctx.response.status = 200;
});

//
// API
//

/*
router.get("/api/stats/",(ctx)=>{})
router.get("/api/stats/:user",(ctx)=>{})
*/

router.get('/api/user/getdata', authorizationMiddleware, async (ctx) => {
    const token = await ctx.cookies.get('refreshToken') as string;
    const payload = await verifyJWT(token) as Token;
    console.log(payload);
    ctx.response.status = 200;
    ctx.response.body = {
        user: payload.username,
        others: connectedUsers,
    };
});

router.post('/api/login', async (ctx) => {
    const { user, pass } = await ctx.request.body.json();
    console.log(user, pass);
    try {
        if (await UserExist(user)) {
            console.log(await UserPassword(user));

            if (await UserPassword(user) == pass) {
                ctx.response.status = 200;

                let expires = new Date();
                let expiresTime = expires.getTime() + 1000 * 60 * 60 * 24 * 14;
                expires.setTime(expiresTime);

                const refresh = await createJWT('14d', { username: user });

                ctx.cookies.set('refreshToken', refresh, {
                    httpOnly: true,
                    expires: expires,
                });

                expires = new Date();
                expiresTime = expires.getTime() + 1000 * 60 * 60;
                expires.setTime(expiresTime);

                ctx.cookies.set(
                    'accessToken',
                    await createJWT('10s', { username: user }),
                    { httpOnly: true, expires: expires },
                );
                ctx.cookies.set('user', user);
                ctx.response.headers.set('Set-Login', 'logged-in');
            } else {
                ctx.response.status = 401;
            }
            //
        } else {
            ctx.response.status = 401;
            console.log('User with this name already entered');
        }
        ctx.response.body = { message: 'User registered successfully' };
    } catch (error) {
        console.error(error);
        ctx.response.status = 500;
        ctx.response.body = { message: 'Internal server error' };
    }
});

router.post('/api/logout', authorizationMiddleware, (ctx) => {
    ctx.cookies.delete('accessToken');
    ctx.cookies.delete('refreshToken');
    ctx.cookies.delete('user');
    ctx.response.status = 200;
});

router.get('/api/oauth', authorizationMiddleware, (ctx) => {
    const { refreshToken } = ctx.params;
    console.log(refreshToken);
    ctx.response.status = 200;
});

router.post('/api/register', async (ctx) => {
    const data = await ctx.request.body.json();
    const user = data.user;
    const pass = data.pass;

    try {
        ctx.response.status = 200;
        if (!(await UserExist(user))) {
            InsertUser(user, pass);
            ctx.response.status = 201;
        } else {
            console.log('User with this name already registered');
        }
        ctx.response.body = { message: 'User registered successfully' };
    } catch (error) {
        console.error(error);
        ctx.response.status = 500;
        ctx.response.body = { message: 'Internal server error' };
    }
});

let session: number = 0;

router.post('/api/startsession', async (ctx) => {
    console.log('Protocol:', ctx.request.url.protocol);
    console.log('Headers:', ctx.request.headers);
    console.log('Cookies:', ctx.cookies);

    const expiration = new Date();
    expiration.setDate(expiration.getDate() + 1);
    console.log(expiration);

    session++;
    try {
        ctx.cookies.set(
            'sessionId',
            await createJWT('1d', { session: session }),
            {
                httpOnly: true,
                secure: ctx.request.secure, // Only set secure if the request is actually secure
            },
        );
        console.log('Cookie set successfully');
    } catch (error) {
        console.error('Error setting cookie:', error);
    }
});

/*
//user login
router.post("/signin");
router.post("/login");

router.get("/oauth/refresh");
*/

const certPath = '../certs/server.crt'; // Update to your certificate path
const keyPath = '../certs/server.key'; // Update to your private key path

const options = {
    port: 3000,
    cert: await Deno.readTextFile(certPath),
    key: await Deno.readTextFile(keyPath),
};

console.log(`Oak back server running on port ${options.port}`);

app.use(router.routes());
app.use(router.allowedMethods());

app.listen(options);
