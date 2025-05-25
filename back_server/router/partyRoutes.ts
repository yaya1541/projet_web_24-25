import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
import { Router } from 'https://deno.land/x/oak@v17.1.4/mod.ts';
import { authorizationMiddleware } from '../middlewares.ts';
import * as db from '../rest.ts';
import { connections, notifyAllUsers } from '../back.ts';
import { activeGames, generateGameCode } from '../partyUtils';
import {
    bodies,
    createWorld,
    handleClientConnection,
    inputs,
    Worlds,
} from '../script.js';
import { Bodies, Inputs, User } from '../interfaces.ts';
import { Circuit } from '../lib/circuit.js';
import { Car } from '../lib/car.js';

// Define interfaces for game state management
interface KartPlayerState {
    id: string; // User ID (from JWT)
    name: string; // Username (from JWT)
    ws: WebSocket;
    currentLap: number;
    lastCheckpoint: number; // Index of the last checkpoint passed
    checkpointServerTime: number; // Server timestamp of the last checkpoint pass
    raceStartTime?: number; // Server timestamp when this player's race effectively started
    finishTimeMs?: number; // Duration in ms from raceStartTime to finish
    isFinished: boolean;
}

interface KartCircuitData {
    pathNodes: Array<THREE.Vector2>; // z is often y for client's 2D representation
    pathPoints: Array<THREE.Vector2>; // 2D path points for the circuit
    circuitWidth: number; // Width of the circuit
    checkpointCount: number;
    totalLaps: number;
    roadWidth?: number;
}

interface KartGameState {
    players: Map<string, KartPlayerState>; // Keyed by player id (userId)
    circuit: KartCircuitData;
    raceStatus: 'waiting' | 'countdown' | 'racing' | 'finished';
    raceStartEpoch?: number; // Server timestamp when the 'racing' state officially began for the room
    // gameOptions: any; // Potentially for future settings
}

interface KartRoom {
    id: string; // roomId
    // clients: Set<WebSocket>; // Redundant if all players are in gameState.players
    gameState: KartGameState;
    hostId?: string;
}

// Global map to store all active game rooms
export const kartRooms: Map<string, KartRoom> = new Map();

// Router handler for WebSocket connections
export const partyRouter = new Router();

function formatRaceTimeForLeaderboard(ms: number | undefined): string {
    if (ms === undefined || ms === null || ms < 0) return '--:--.---';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = ms % 1000;
    return `${String(minutes).padStart(2, '0')}:${
        String(seconds).padStart(2, '0')
    }.${String(milliseconds).padStart(3, '0')}`;
}

// Function to broadcast leaderboard to all players in a room
function broadcastLeaderboard(roomId: string) {
    const room = kartRooms.get(roomId);
    if (!room || room.gameState.players.size === 0) {
        // console.log(`[${roomId}] No players or room to broadcast leaderboard.`);
        return;
    }

    const { players, raceStartEpoch, circuit } = room.gameState;
    const leaderboard: {
        name: string;
        carId: string; // Using player.id as carId, client expects this
        lap: number;
        lastCheckpoint: number;
        totalTimeStr: string;
    }[] = [];

    Array.from(players.values()).forEach((player) => {
        let totalTimeMs: number | undefined;
        if (player.isFinished && player.finishTimeMs !== undefined) {
            totalTimeMs = player.finishTimeMs;
        } else if (
            room.gameState.raceStatus === 'racing' && player.raceStartTime
        ) {
            totalTimeMs = Date.now() - player.raceStartTime;
        }

        leaderboard.push({
            name: player.name,
            carId: player.id, // Using player.id as carId, client expects this
            lap: player.currentLap,
            lastCheckpoint: player.lastCheckpoint,
            totalTimeStr: formatRaceTimeForLeaderboard(totalTimeMs),
        });
    });

    // Sort leaderboard:
    // 1. isFinished (finished players might be listed differently or based on finishTimeMs)
    // For active racers:
    //    a. Laps (descending)
    //    b. Last Checkpoint (descending)
    //    c. Checkpoint Server Time (ascending)
    leaderboard.sort((a, b) => {
        const playerA = players.get(a.carId)!;
        const playerB = players.get(b.carId)!;

        if (playerA.isFinished && !playerB.isFinished) return -1; // Finished players first
        if (!playerA.isFinished && playerB.isFinished) return 1;
        if (playerA.isFinished && playerB.isFinished) {
            return (playerA.finishTimeMs ?? Infinity) -
                (playerB.finishTimeMs ?? Infinity);
        }

        // For non-finished players
        if (b.lap !== a.lap) return b.lap - a.lap;
        if (b.lastCheckpoint !== a.lastCheckpoint) {
            return b.lastCheckpoint - a.lastCheckpoint;
        }
        return playerA.checkpointServerTime - playerB.checkpointServerTime;
    });

    const message = JSON.stringify({ type: 6, leaderboard });
    room.gameState.players.forEach((p) => {
        if (p.ws.readyState === WebSocket.OPEN) {
            p.ws.send(message);
        }
    });
    // console.log(`[${roomId}] Broadcasted leaderboard:`, leaderboard);
}

export function broadcastToRoom(
    roomId: string,
    message: string,
    excludePlayerId?: string,
) {
    const room = kartRooms.get(roomId);
    if (!room) return;
    room.gameState.players.forEach((player) => {
        if (
            player.id !== excludePlayerId &&
            player.ws.readyState === WebSocket.OPEN
        ) {
            player.ws.send(message);
        }
    });
}

// Kartfever Game Endpoint
partyRouter.get('/api/kartfever/game', authorizationMiddleware, async (ctx) => {
    const roomId = ctx.request.url.searchParams.get('roomId');

    if (!roomId) {
        ctx.response.status = 400;
        ctx.response.body = { error: 'Room ID is required' };
        return;
    }

    const userId = ctx.state.userId;
    const username = (await db.getUserById(userId) as User).userName;

    if (!ctx.isUpgradable) {
        // HTTP GET request to fetch room details (called by client's initializeUser)
        const room = kartRooms.get(roomId);
        if (!room) {
            return;
        }

        const otherPlayers = Array.from(room.gameState.players.values())
            .filter((p) => p.id !== userId) // Don't include self in "other users"
            .map((p) => ({ id: p.id, name: p.name }));

        ctx.response.body = {
            user: userId,
            data: {
                circuit: {
                    CircuitNodes: room.gameState.circuit.pathNodes,
                    CircuitPoints: room.gameState.circuit.pathPoints, // <-- Add this line!
                    CircuitWitdh: room.gameState.circuit.roadWidth,
                    totalLaps: room.gameState.circuit.totalLaps,
                },
                users: otherPlayers,
                roomName: roomId,
                raceStartEpoch: room.gameState.raceStartEpoch ?? null, // <-- Add this
            },
        };
        return;
    }

    // WebSocket upgrade
    const socket = await ctx.upgrade();
    connections.set(userId, socket);

    const playerRoomId = roomId; // Capture roomId for this connection

    console.log(
        `[${playerRoomId}] Player ${username} (${userId}) attempting to connect via WebSocket.`,
    );

    socket.onopen = () => {
        console.log(
            `[${playerRoomId}] WebSocket connected for ${username} (${userId})`,
        );
        const room = kartRooms.get(playerRoomId);

        if (!room) {
            // This case should ideally be handled by the HTTP GET creating the room first.
            // If a WS connects to a non-existent room, it's an issue.
            console.error(
                `[${playerRoomId}] Critical: WS connected but room does not exist. Closing socket.`,
            );
            socket.close(1011, 'Room not found or initialized.');
            return;
        }
        // Check if player already in room (e.g. reconnect with same userId)
        if (room.gameState.players.has(userId!)) {
            const existingPlayer = room.gameState.players.get(userId!)!;
            console.log(
                `[${playerRoomId}] Player ${username} (${userId}) reconnected or already present. Updating WebSocket.`,
            );
            existingPlayer.ws = socket; // Update WebSocket object
            // Potentially send current full state to this reconnected player
        } else {
            const newPlayer: KartPlayerState = {
                id: userId!,
                name: username!,
                ws: socket,
                currentLap: 0, // Lap 0, not yet passed checkpoint 0 for lap 1
                lastCheckpoint: -1, // Hasn't passed any checkpoint yet
                checkpointServerTime: Date.now(),
                isFinished: false,
                raceStartTime: room.gameState.raceStartEpoch, // If race already started, use that
            };
            handleClientConnection(userId, roomId);
            room.gameState.players.set(userId!, newPlayer);
            console.log(
                `[${playerRoomId}] Player ${username} (${userId}) added to game state.`,
            );
        }

        // If this is the first player or a certain condition is met, start the race
        if (
            room.gameState.raceStatus === 'waiting' &&
            room.gameState.players.size > 2
        ) {
            console.log(
                `[${playerRoomId}] First player joined or conditions met, transitioning race to 'racing'.`,
            );
            room.gameState.raceStatus = 'racing'; // Or 'countdown' then 'racing'
            room.gameState.raceStartEpoch = Date.now();
            // Initialize raceStartTime for all players currently in the room
            room.gameState.players.forEach((p) => {
                if (!p.raceStartTime) {
                    p.raceStartTime = room.gameState.raceStartEpoch;
                }
            });
        } else if (
            room.gameState.raceStatus === 'racing' &&
            room.gameState.players.has(userId!)
        ) {
            // If player joins mid-race, set their raceStartTime
            const player = room.gameState.players.get(userId!)!;
            if (!player.raceStartTime) {
                player.raceStartTime = room.gameState.raceStartEpoch ||
                    Date.now(); // Use room start or now
            }
        }

        // Notify other players about the new connection
        const newPlayerInfo = { id: userId, name: username };
        broadcastToRoom(
            playerRoomId,
            JSON.stringify({ type: 4, users: [newPlayerInfo] }),
            userId,
        );

        // Send initial leaderboard to everyone including new player
        broadcastLeaderboard(playerRoomId);
    };

    socket.onmessage = (e) => {
        try {
            console.log(
                `[${playerRoomId}] Message received from ${username} (${userId}):`,
                e.data,
            );

            const data = JSON.parse(e.data as string);
            const room = kartRooms.get(playerRoomId);

            if (!room) {
                console.error(
                    `[${playerRoomId}] Message received but room not found for player ${userId}.`,
                );
                return;
            }
            const player = room.gameState.players.get(userId!);
            if (!player) {
                console.error(
                    `[${playerRoomId}] Message received but player ${userId} not found in game state.`,
                );
                return;
            }

            switch (data.type) {
                case 1: { // Position update from client { type: 1, user: { [carId]: { position, quaternion, ... } } }
                    // Client actually sends its own ID as user property in value like: {type: 1, user: userId, value: {pos, rot, vel, angVel, wheels}}
                    // The old server code was: rooms[roomId][data.user] = data.value;
                    // The new client sends: { type: 1, position, quaternion, velocity, angularVelocity, wheels } (no outer user wrapper for the data itself)
                    // For now, let's assume the client sends data for ITSELF, and server broadcasts to others.
                    // The server should receive { type:1, dataForMyCar } and then broadcast {type:1, user: { [senderUserId]: dataForMyCar } }

                    // Let's adapt to the client's current broadcast of its state directly
                    // Client sends: { type:1, user (sender's ID), position, quaternion, velocity, angularVelocity, wheels }
                    // Server should repackage and broadcast: { type:1, user: { [sender_id]: { position, ... } } }
                    const messageToBroadcast = {
                        type: 1,
                        user: { // This 'user' object is a map of carId to its state
                            [player.id]: { // Key is the sender's ID (carId)
                                position: data.position,
                                quaternion: data.quaternion,
                                velocity: data.velocity,
                                angularVelocity: data.angularVelocity,
                                wheels: data.wheels,
                            },
                        },
                    };
                    broadcastToRoom(
                        playerRoomId,
                        JSON.stringify(messageToBroadcast),
                        player.id,
                    );
                    player.lastKnownPosition = data.position; // Store for reference if needed
                    break;
                }
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
                case 5: { // Checkpoint Pass from client { type: 5, user: userId, checkpoint: idx, lap: num, timestamp: clientTime }
                    if (
                        player.isFinished ||
                        room.gameState.raceStatus !== 'racing'
                    ) {
                        break; // Ignore if player finished or race not active
                    }

                    const { checkpoint: clientCheckpointIdx, lap: clientLap } =
                        data;
                    const { circuit } = room.gameState;
                    const expectedNextCheckpoint = (player.lastCheckpoint + 1) %
                        circuit.checkpointCount;

                    // Basic validation
                    if (clientCheckpointIdx !== expectedNextCheckpoint) {
                        console.warn(
                            `[${playerRoomId}] Invalid checkpoint for ${player.name}. Expected ${expectedNextCheckpoint}, got ${clientCheckpointIdx}. CurrentLap: ${player.currentLap}, ClientLap: ${clientLap}`,
                        );
                        // Potentially penalize or ignore
                        break;
                    }

                    let serverCalculatedLap = player.currentLap;
                    if (
                        clientCheckpointIdx === 0 &&
                        player.lastCheckpoint === circuit.checkpointCount - 1
                    ) {
                        // Just crossed the start/finish line to complete a lap
                        serverCalculatedLap = player.currentLap + 1;
                    }

                    // Validate client's lap number against server's calculation
                    if (clientLap !== serverCalculatedLap) {
                        console.warn(
                            `[${playerRoomId}] Lap mismatch for ${player.name}. Client: ${clientLap}, Server expected: ${serverCalculatedLap}.`,
                        );
                        // Server authoritative for lap count
                    }

                    player.lastCheckpoint = clientCheckpointIdx;
                    player.currentLap = serverCalculatedLap; // Use server's calculation
                    player.checkpointServerTime = Date.now(); // Use server time

                    // console.log(`[${playerRoomId}] Player ${player.name} passed CP ${player.lastCheckpoint}, Lap ${player.currentLap}`);

                    if (
                        player.currentLap >= circuit.totalLaps &&
                        player.lastCheckpoint ===
                            (circuit.pathNodes.findIndex((p) =>
                                p.x === 0 && p.y === 0
                            ))
                    ) { // Assuming CP0 is finish line
                        // Final lap completed by passing the finish line checkpoint (usually CP0)
                        if (!player.isFinished) {
                            player.isFinished = true;
                            player.finishTimeMs = player.checkpointServerTime -
                                (player.raceStartTime ||
                                    room.gameState.raceStartEpoch!);
                            console.log(
                                `[${playerRoomId}] Player ${player.name} FINISHED the race in ${
                                    formatRaceTimeForLeaderboard(
                                        player.finishTimeMs,
                                    )
                                }!`,
                            );
                        }
                    }
                    broadcastLeaderboard(playerRoomId);
                    break;
                }
                case 'disconnect': // Custom message from client onbeforeunload
                    console.log(
                        `[${playerRoomId}] Player ${player.name} sent 'disconnect' message.`,
                    );
                    // Fall through to onclose logic essentially
                    socket.close(); // This will trigger onclose
                    break;

                default:
                    console.log(
                        `[${playerRoomId}] Unknown message type from ${player.name}:`,
                        data.type,
                    );
            }
        } catch (err) {
            console.error(
                `[${playerRoomId}] Failed to process message from ${userId}:`,
                err,
                e.data,
            );
        }
    };

    socket.onclose = () => {
        console.log(
            `[${playerRoomId}] WebSocket closed for ${username} (${userId})`,
        );
        const room = kartRooms.get(playerRoomId);
        if (room && room.gameState.players.has(userId!)) {
            room.gameState.players.delete(userId!);
            console.log(
                `[${playerRoomId}] Player ${username} (${userId}) removed from game state.`,
            );

            // Notify other players
            broadcastToRoom(
                playerRoomId,
                JSON.stringify({ type: 'player_disconnected', user: userId }),
            );
            broadcastLeaderboard(playerRoomId); // Update leaderboard

            if (room.gameState.players.size === 0) {
                console.log(
                    `[${playerRoomId}] Room is now empty. Removing room.`,
                );
                kartRooms.delete(playerRoomId);
            }
        }
    };

    socket.onerror = (e) => {
        console.error(
            `[${playerRoomId}] WebSocket error for ${username} (${userId}):`,
            e,
        );
    };
});

// HTTP Route for creating a game (client POSTs here)
partyRouter.post(
    '/api/kartfever/game',
    authorizationMiddleware,
    async (ctx) => {
        const hostId = ctx.state.userId;
        const hostUsername = (await db.getUserById(hostId) as User).userName;

        const newRoomId = generateGameCode(6);
        createWorld(newRoomId); // Initialize the world for this room
        const selectedCircuit = new Circuit(null, Worlds.get(newRoomId)); // Or allow selection

        const newGameState: KartGameState = {
            players: new Map(),
            circuit: {
                pathPoints: selectedCircuit.pathPoints as Array<THREE.Vector2>,
                pathNodes: selectedCircuit.pathNodes as Array<THREE.Vector2>,
                circuitWidth: selectedCircuit.options.roadWidth,
                checkpointCount: selectedCircuit.pathPoints.length,
                totalLaps: 4,
            },
            raceStatus: 'waiting', // Race starts when first player fully joins via WebSocket
        };

        const newRoom: KartRoom = {
            id: newRoomId,
            gameState: newGameState,
            hostId: hostId,
        };
        kartRooms.set(newRoomId, newRoom);

        console.log(
            `[${newRoomId}] Game room created by ${hostUsername} (${hostId}).`,
        );
        ctx.response.body = {
            id: newRoomId,
            message: 'Game room created successfully',
        };
        ctx.response.status = 201;
    },
);
