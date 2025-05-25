import { Router } from 'https://deno.land/x/oak@v17.1.4/mod.ts';
import { authorizationMiddleware } from '../middlewares.ts';
import * as db from '../rest.ts';
import { connections, notifyAllUsers } from '../back.ts';
import { User } from '../interfaces.ts';

export const msgRoutes = new Router();

// Routes pour les messages
msgRoutes.post('/api/messages', authorizationMiddleware, async (ctx) => {
    try {
        const sender = ctx.state.userId;
        const body = await ctx.request.body.json();

        if (!body.content) {
            ctx.response.status = 400;
            ctx.response.body = {
                message: 'Receiver and content are required',
            };
            return;
        }

        if (body.receiver) {
            // Vérifier si le destinataire existe
            const receiver = await db.getUserById(body.receiver);
            if (!receiver) {
                ctx.response.status = 404;
                ctx.response.body = { message: 'Receiver not found' };
                return;
            }

            const messageId = await db.sendMessage({
                sender,
                receiver: body.receiver,
                content: body.content,
            });

            ctx.response.status = 201;
            ctx.response.body = {
                message: 'Message sent successfully',
                messageId,
            };
        } else {
            const messageId = await db.sendMessage({
                sender,
                receiver: 1,
                content: body.content,
            });

            ctx.response.status = 201;
            ctx.response.body = {
                message: 'Message sent successfully',
                messageId,
            };
        }
    } catch (err) {
        ctx.response.status = 500;
        ctx.response.body = { message: 'Server error: ' + err };
    }
});

msgRoutes.get('/api/messages/inbox', authorizationMiddleware, async (ctx) => {
    try {
        const userId = ctx.state.userId;

        const messages = await db.getUserInbox(userId);

        // Enrichir les messages avec les informations de l'expéditeur
        const enrichedMessages = await Promise.all(
            messages.map(async (message) => {
                const sender = await db.getUserById(message.sender);
                return {
                    ...message,
                    senderName: sender ? sender.userName : 'Unknown',
                };
            }),
        );

        ctx.response.status = 200;
        ctx.response.body = { messages: enrichedMessages };
    } catch (err) {
        ctx.response.status = 500;
        ctx.response.body = { message: 'Server error: ' + err };
    }
});

msgRoutes.get('/api/messages/sent', authorizationMiddleware, async (ctx) => {
    try {
        const userId = ctx.state.userId;

        const messages = await db.getUserSentMessages(userId);

        // Enrichir les messages avec les informations du destinataire
        const enrichedMessages = await Promise.all(
            messages.map(async (message) => {
                const receiver = await db.getUserById(message.receiver);
                return {
                    ...message,
                    receiverName: receiver ? receiver.userName : 'Unknown',
                };
            }),
        );

        ctx.response.status = 200;
        ctx.response.body = { messages: enrichedMessages };
    } catch (err) {
        ctx.response.status = 500;
        ctx.response.body = { message: 'Server error: ' + err };
    }
});

msgRoutes.get(
    '/api/messages/conversation/global',
    async (ctx) => {
        try {
            const messages = await db.getAllGlobalMessages();
            //console.log(messages);
            ctx.response.status = 200;
            ctx.response.body = {
                messages,
            };
        } catch (err) {
            ctx.response.status = 500;
            ctx.response.body = { message: 'Server error: ' + err };
        }
    },
);

msgRoutes.get(
    '/api/messages/conversation/:userId',
    authorizationMiddleware,
    async (ctx) => {
        try {
            const currentUserId = ctx.state.userId;
            const otherUserId = parseInt(ctx.params.userId!);

            // Vérifier si l'autre utilisateur existe
            const otherUser = await db.getUserById(otherUserId);
            if (!otherUser) {
                ctx.response.status = 404;
                ctx.response.body = { message: 'User not found' };
                return;
            }

            const messages = await db.getUserConversation(
                currentUserId,
                otherUserId,
            );

            ctx.response.status = 200;
            ctx.response.body = {
                messages,
                otherUser: {
                    id: otherUser.id,
                    userName: otherUser.userName,
                },
            };
        } catch (err) {
            ctx.response.status = 500;
            ctx.response.body = { message: 'Server error: ' + err };
        }
    },
);

msgRoutes.delete('/api/messages/:id', authorizationMiddleware, async (ctx) => {
    try {
        const userId = ctx.state.userId;
        const messageId = parseInt(ctx.params.id!);

        // Vérifier si le message existe et appartient à l'utilisateur
        const message = await db.getMessageById(messageId);
        if (!message) {
            ctx.response.status = 404;
            ctx.response.body = { message: 'Message not found' };
            return;
        }

        if (message.sender !== userId) {
            ctx.response.status = 403;
            ctx.response.body = {
                message: 'You can only delete your own messages',
            };
            return;
        }

        const success = await db.deleteMessage(messageId);
        if (!success) {
            ctx.response.status = 400;
            ctx.response.body = { message: 'Failed to delete message' };
            return;
        }

        ctx.response.status = 200;
        ctx.response.body = { message: 'Message deleted successfully' };
    } catch (err) {
        ctx.response.status = 500;
        ctx.response.body = { message: 'Server error: ' + err };
    }
});

msgRoutes.get('/api/chat', authorizationMiddleware, (ctx) => {
    const ws = ctx.upgrade();
    connections.set(ctx.state.userId, ws);

    ws.onopen = () => {
        console.log(`Chat connection opened for user ${ctx.state.userId}`);
    };

    ws.onmessage = async (ev) => {
        try {
            const data = JSON.parse(ev.data);
            console.log('Received message:', data);
            const id = data.sender;
            const messageId = await db.sendMessage(data);
            const user = (await db.getUserById(id) as User).userName;
            data.sender = user;
            notifyAllUsers(id, data);
        } catch (error) {
            console.error('Message handling error:', error);
        }
    };

    ws.onclose = () => {
        console.log(`Connection closed for user ${ctx.state.userId}`);
        connections.delete(ctx.state.userId);
    };

    ws.onerror = (error) => {
        console.error(`WebSocket error for user ${ctx.state.userId}:`, error);
        connections.delete(ctx.state.userId);
    };
});
