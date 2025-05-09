import { authorizationMiddleware,adminMiddleware } from '../middlewares.ts';
import { Router } from 'https://deno.land/x/oak@v17.1.4/mod.ts';
import * as db from "../rest.ts"

export const settingRouter = new Router();

// Routes pour les rôles
settingRouter.post(
    '/api/admin/users/:id/roles',
    authorizationMiddleware,
    adminMiddleware,
    async (ctx) => {
        try {
            const userId = parseInt(ctx.params.id!);
            const body = await ctx.request.body().value;

            if (!body.roleId) {
                ctx.response.status = 400;
                ctx.response.body = { message: 'Role ID is required' };
                return;
            }

            // Vérifier si l'utilisateur existe
            const user = await db.getUserById(userId);
            if (!user) {
                ctx.response.status = 404;
                ctx.response.body = { message: 'User not found' };
                return;
            }

            const success = await db.assignRoleToUser(userId, body.roleId);
            if (!success) {
                ctx.response.status = 400;
                ctx.response.body = { message: 'Failed to assign role' };
                return;
            }

            ctx.response.status = 200;
            ctx.response.body = { message: 'Role assigned successfully' };
        } catch (err) {
            ctx.response.status = 500;
            ctx.response.body = { message: 'Server error: ' + err.message };
        }
    },
);

settingRouter.delete(
    '/api/admin/users/:id/roles/:roleId',
    authorizationMiddleware,
    adminMiddleware,
    async (ctx) => {
        try {
            const userId = parseInt(ctx.params.id!);
            const roleId = parseInt(ctx.params.roleId!);

            // Vérifier si l'utilisateur existe
            const user = await db.getUserById(userId);
            if (!user) {
                ctx.response.status = 404;
                ctx.response.body = { message: 'User not found' };
                return;
            }

            const success = await db.removeRoleFromUser(userId, roleId);
            if (!success) {
                ctx.response.status = 400;
                ctx.response.body = { message: 'Failed to remove role' };
                return;
            }

            ctx.response.status = 200;
            ctx.response.body = { message: 'Role removed successfully' };
        } catch (err) {
            ctx.response.status = 500;
            ctx.response.body = { message: 'Server error: ' + err.message };
        }
    },
);



// Routes pour les paramètres utilisateur
settingRouter.get('/api/settings', authorizationMiddleware, async (ctx) => {
    try {
        const userId = ctx.state.userId;

        const settings = await db.getUserSettings(userId);
        if (!settings) {
            // Créer des paramètres par défaut si non existants
            await db.createUserSettings({
                user_id: userId,
                theme: true,
                email_notification: true,
            });

            ctx.response.status = 200;
            ctx.response.body = {
                theme: true,
                email_notification: true,
            };
            return;
        }

        ctx.response.status = 200;
        ctx.response.body = {
            theme: settings.theme,
            email_notification: settings.email_notification,
        };
    } catch (err) {
        ctx.response.status = 500;
        ctx.response.body = { message: 'Server error: ' + err.message };
    }
});

settingRouter.put('/api/settings', authorizationMiddleware, async (ctx) => {
    try {
        const userId = ctx.state.userId;
        const body = await ctx.request.body().value;

        const updateData: Partial<db.Settings> = {};

        if (body.theme !== undefined) updateData.theme = body.theme;
        if (body.email_notification !== undefined) {
            updateData.email_notification = body.email_notification;
        }

        // Vérifier si les paramètres existent
        const settings = await db.getUserSettings(userId);

        if (!settings) {
            // Créer les paramètres
            await db.createUserSettings({
                user_id: userId,
                theme: body.theme !== undefined ? body.theme : true,
                email_notification: body.email_notification !== undefined
                    ? body.email_notification
                    : true,
            });
        } else {
            // Mettre à jour les paramètres
            await db.updateUserSettings(userId, updateData);
        }

        ctx.response.status = 200;
        ctx.response.body = { message: 'Settings updated successfully' };
    } catch (err) {
        ctx.response.status = 500;
        ctx.response.body = { message: 'Server error: ' + err.message };
    }
});

settingRouter.get(
    '/api/stats',
    authorizationMiddleware,
    adminMiddleware,
    async (ctx) => {
        try {
            // Récupérer les statistiques
            const usersCount = (await db.dbClient.execute(
                `SELECT COUNT(*) as count FROM User`,
            )).rows![0].count;
            const messagesCount = (await db.dbClient.execute(
                `SELECT COUNT(*) as count FROM Message`,
            )).rows![0].count;
            const imagesCount = (await db.dbClient.execute(
                `SELECT COUNT(*) as count FROM ImageStore`,
            )).rows![0].count;

            // Récupérer les utilisateurs récemment actifs
            const activeUsers = (await db.dbClient.execute(
                `SELECT id, userName, userLastConnection FROM User ORDER BY userLastConnection DESC LIMIT 10`,
            )).rows;

            ctx.response.status = 200;
            ctx.response.body = {
                users: {
                    total: usersCount,
                    active: activeUsers,
                },
                messages: {
                    total: messagesCount,
                },
                images: {
                    total: imagesCount,
                },
            };
        } catch (err) {
            ctx.response.status = 500;
            ctx.response.body = { message: 'Server error: ' + err.message };
        }
    },
);
