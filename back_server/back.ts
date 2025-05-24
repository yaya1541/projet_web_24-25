import { Application, Router } from 'https://deno.land/x/oak@v17.1.4/mod.ts';
import { oakCors } from 'https://deno.land/x/cors@v1.2.2/mod.ts';
import { createJWT, verifyJWT } from './jwt_func.ts';
import { authorizationMiddleware } from './middlewares.ts';

//import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
import * as db from './rest.ts'; // Importez les fonctions de la base de données
import { Token } from './interfaces.ts';
import { authRouter } from './router/authRoutes.ts';
import { adminRoutes } from './router/adminRoutes.ts';
import { imgRoutes } from './router/imgRoutes.ts';
import { msgRoutes } from './router/msgRoutes.ts';
import { userRoutes } from './router/userRoutes.ts';
import { partyRouter } from './router/partyRoutes.ts';
import { settingRouter } from './router/settingsRoutes.ts';

const router = new Router();
export const app = new Application();

app.use(oakCors({
    origin: [`${Deno.env.get('SERVER')}`, `${Deno.env.get('DOMAIN')}`],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
    ],
    credentials: true,
}));

//const tokens = {};
// TODO : Store token on login
export const connections = new Map<number, WebSocket>();

//
// MODULES
//
router.get('/api/lib/:module', authorizationMiddleware, async (ctx) => {
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
router.get('/api/src/:module', async (ctx) => {
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
export function notifyAllUsers(from: WebSocket, json: object) {
    connections.forEach((client) => {
        if (client != from) {
            client.send(JSON.stringify(json));
        }
    });
    console.log('sent Message !');
}

//
// API
//

/*
router.get("/api/stats/",(ctx)=>{})
router.get("/api/stats/:user",(ctx)=>{})
*/

router.get('/api/users/getdata', authorizationMiddleware, async (ctx) => {
    ctx.response.status = 200;
    ctx.response.body = {
        id: ctx.state.userId,
        user: await db.getUserById(ctx.state.userId),
    };
});

router.use(authRouter.routes());
router.use(adminRoutes.routes());
router.use(imgRoutes.routes());
router.use(msgRoutes.routes());
router.use(userRoutes.routes());
router.use(partyRouter.routes());
router.use(settingRouter.routes());

const certPath = '../certs/fullcert.pem'; // Update to your certificate path
const keyPath = '../certs/private.key'; // Update to your private key path

const options = {
    port: 3000,
    cert: await Deno.readTextFile(certPath),
    key: await Deno.readTextFile(keyPath),
};

console.log(`Oak back server running on port ${options.port}`);

app.use(router.routes());
app.use(router.allowedMethods());

app.listen(options);
