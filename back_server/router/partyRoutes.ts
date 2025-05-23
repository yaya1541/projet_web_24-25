import { Router } from 'https://deno.land/x/oak@v17.1.4/mod.ts';
import { authorizationMiddleware } from '../middlewares.ts';
import * as db from '../rest.ts';
import { connections, notifyAllUsers } from '../back.ts';
import { activeGames, generateGameCode } from '../partyUtils';
import { bodies, createWorld, inputs, Worlds } from '../script.js';
import { Bodies, Inputs } from '../interfaces.ts';
import { Circuit } from '../lib/circuit.js';
import { Car } from '../lib/car.js';

// Router handler for WebSocket connections
export const partyRouter = new Router();

export function sendParty(
    roomId: string,
    currentUser: number,
    stringified: string,
) {
    console.log(`sending to party as ${currentUser}`);

    (activeGames.get(roomId).users as number[]).forEach((elt) => {
        console.log(elt);
        if (elt != currentUser) {
            console.log(`sending to ${elt}`);
            console.log('Connections : ', connections.get(elt));
            connections.get(elt)?.send(stringified);
        }
    });

    console.log('End sending to party');
}

partyRouter.get('/api/kartfever/game', authorizationMiddleware, (ctx) => {
    console.log('   Party Request received');
    const user = ctx.state.userId;
    const roomId = <string> ctx.request.url.searchParams.get('roomId');
    console.log('   ', roomId);

    // If the request is a WebSocket upgrade
    if (ctx.request.headers.get('Upgrade') === 'websocket') {
        const ws = ctx.upgrade();
        connections.set(user, ws);
        ws.onopen = (_event) => {
            console.log(`   New connection opened (${connections.size})`);
            console.log('   user : ', user);
            //console.log(activeGames.get(roomId));
            if (!activeGames.get(roomId)) return;
            if (
                activeGames.get(roomId) &&
                !((activeGames.get(roomId).users as number[]).includes(
                    ctx.state.userId,
                ))
            ) {
                const car = new Car(Worlds.get(roomId), null, user);
                (bodies as Bodies)[ctx.state.userId] = car;
                //Worlds.get(roomId).addBody(car);
                (activeGames.get(roomId).users as number[]).push(
                    ctx.state.userId,
                );
                console.log('before sending', roomId);
                sendParty(
                    roomId,
                    ctx.state.userId,
                    JSON.stringify({
                        type: 4,
                        users: activeGames.get(roomId).users,
                    }),
                );
            }
            console.log(activeGames.get(roomId).users);
            // Handle WebSocket connection here
        };
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            //console.log('Message received', data);
            switch (data.type) {
                case 2:
                    if ((inputs as Inputs)[data.user]) {
                        (inputs as Inputs)[data.user][data.value] = true;
                    } else {
                        (inputs as Inputs)[data.user] = {};
                    }
                    break;
                case 3:
                    if ((inputs as Inputs)[data.user]) {
                        (inputs as Inputs)[data.user][data.value] = false;
                    } else {
                        (inputs as Inputs)[data.user] = {};
                    }
                    break;
                default:
                    break;
            }
        };

        return;
    }
    if (activeGames.has(roomId)) {
        // return room data if it exist
        ctx.response.body = {
            message: `Room ID: ${roomId}`,
            user: ctx.state.userId,
            data: activeGames.get(roomId),
        };
    } else {
        ctx.response.status = 404;
        ctx.response.body = {
            message: `room with code ${roomId} doesn't exist.`,
        };
    }
});

/*
// TODO : Add rest create party.
// TODO : complete game /api request.
*/
partyRouter.post('/api/kartfever/game', authorizationMiddleware, (ctx) => {
    ctx.response.status = 200;
    const roomId = generateGameCode(6);
    console.log(roomId);

    const user = ctx.state.userId;
    const world = createWorld();
    const car = new Car(world, null, user);
    (bodies as Bodies)[user] = car;
    const circuit = new Circuit(null, world, {
        turnNumber: 25,
        turnAmplitude: 95,
        roadWidth: 50,
    });
    activeGames.set(roomId, {
        circuit: {
            CircuitNodes: circuit.pathNodes,
            CircuitPoints: circuit.pathPoints,
            CircuitWitdh: circuit.options.roadWidth,
        },
        users: [ctx.state.userId],
    });
    console.log('creating world');
    Worlds.set(roomId, world);
    console.log(Worlds.keys());

    ctx.response.body = { id: roomId, ...activeGames.get(roomId), ...Worlds };
    //console.log(activeGames);
});
