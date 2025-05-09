import { Router } from 'https://deno.land/x/oak@v17.1.4/mod.ts';
import { authorizationMiddleware } from '../middlewares.ts';
import * as db from '../rest.ts';
import { connections, notifyAllUsers } from '../back.ts';
import { activeGames } from '../partyUtils';
import { inputs } from '../script.js';
import { Inputs } from '../interfaces.ts';

// Router handler for WebSocket connections
export const partyRouter = new Router();

interface roomId extends URLSearchParams {
    roomId: string;
}

partyRouter.get('kartfever/game', authorizationMiddleware, (ctx) => {
    console.log('Request received');
    const user = ctx.state.userId;
    const { roomId } = ctx.request.url.searchParams as roomId;
    try {
        const ws = ctx.upgrade();
        if (!connections.has(user)) {
            connections.set(user, ws);
        }
        ws.onopen = (_event) => {
            console.log(`New connection opened (${connections.size})`);
            console.log('user : ', user);
            /*
            if (connectedUsers.indexOf(user) == -1) {
                connectedUsers.push(user);
            }
            ws.send(JSON.stringify({
                type: 0, // Type 0 initialization
                CircuitNodes: circuit.pathNodes,
                CircuitPoints: circuit.pathPoints,
                CircuitWitdh: circuit.options.roadWidth,
            }));
            // FIXED: Add debug output for player initialization
            if (!bodies[user]) {
                console.log(`Initializing new player: ${user}`);
                bodies[user] = new Car(world, null, user);
                bodies[user].carBody.position.set(0, 3, 0); // FIXED: Raised initial position
                inputs[user] = {};
                console.log(
                    `Player initialized: ${user} at position y=${
                        bodies[user].carBody.position.y
                    }`,
                );
                notifyAllUsers({ type: 4, users: Object.keys(bodies) });
            }*/
        };
        ws.onclose = (_event) => {
            console.log('Connection closed');

            // Remove this connection from the connections array
            connections.delete(user);
        };
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            //console.log('Message received', data);
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
        };
    } catch (error) {
        console.error('WebSocket error:', error);
        ctx.response.status = 501;
        ctx.response.body = { message: 'Unable to establish WebSocket' };
    }
});
/*
// TODO : Add rest create party.
// TODO : complete game api request.
partyRouter.post("/kartfever/game",authorizationMiddleware,(ctx)=>{
    ctx.response.status = 200;
    const partyCode = db.
    ctx.response.body = {
        party :
    }
})
*/
