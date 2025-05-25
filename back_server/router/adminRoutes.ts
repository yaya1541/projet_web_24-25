import { Router } from 'https://deno.land/x/oak@v17.1.4/mod.ts';
import { adminMiddleware, authorizationMiddleware } from '../middlewares.ts';
import { User } from '../interfaces.ts';
import * as db from '../rest.ts';

export const adminRoutes = new Router();

// Routes admin pour la gestion des utilisateurs
adminRoutes.get(
    '/api/admin/users',
    authorizationMiddleware,
    adminMiddleware,
    async (ctx) => {
        try {
            // Récupérer tous les utilisateurs
            const result = await db.dbClient.execute(
                `SELECT * 
                FROM User,Roles,Role WHERE User.id = Role.user_id AND Roles.id = Role.role_id`,
            );

            ctx.response.status = 200;
            ctx.response.body = { users: result.rows };
        } catch (err) {
            ctx.response.status = 500;
            ctx.response.body = { message: 'Server error: ' + err };
        }
    },
);

adminRoutes.get(
    '/api/admin/users/:id',
    authorizationMiddleware,
    adminMiddleware,
    async (ctx) => {
        try {
            const userId = parseInt(ctx.params.id!);

            const user = await db.getUserById(userId);
            if (!user) {
                ctx.response.status = 404;
                ctx.response.body = { message: 'User not found' };
                return;
            }

            // Récupérer les rôles
            const roles = await db.getUserRoles(userId);

            // Récupérer les préférences
            const settings = await db.getUserSettings(userId);

            ctx.response.status = 200;
            ctx.response.body = {
                id: user.id,
                userName: user.userName,
                email: user.email,
                lastConnection: user.userLastConnection,
                createdAt: user.userDateOfCreation,
                roles,
                settings,
            };
        } catch (err) {
            ctx.response.status = 500;
            ctx.response.body = { message: 'Server error: ' + err };
        }
    },
);

adminRoutes.put(
    '/api/admin/users/:id',
    authorizationMiddleware,
    adminMiddleware,
    async (ctx) => {
        try {
            const userId = parseInt(ctx.params.id!);
            const body = await ctx.request.body.json();

            // Vérifier si l'utilisateur existe
            const user = await db.getUserById(userId);
            if (!user) {
                ctx.response.status = 404;
                ctx.response.body = { message: 'User not found' };
                return;
            }

            const updateData: Partial<User> = {};

            if (body.userName) updateData.userName = body.userName;
            if (body.userPassword) updateData.userPassword = body.userPassword;
            if (body.email) {
                if (!db.isValidEmail(body.email)) {
                    ctx.response.status = 400;
                    ctx.response.body = { message: 'Invalid email format' };
                    return;
                }
                updateData.email = body.email;
            }

            const success = await db.updateUser(userId, updateData);
            if (!success) {
                ctx.response.status = 400;
                ctx.response.body = { message: 'Failed to update user' };
                return;
            }

            ctx.response.status = 200;
            ctx.response.body = { message: 'User updated successfully' };
        } catch (err) {
            ctx.response.status = 500;
            ctx.response.body = { message: 'Server error: ' + err };
        }
    },
);

adminRoutes.delete(
    '/api/admin/users/:id',
    authorizationMiddleware,
    adminMiddleware,
    async (ctx) => {
        try {
            const userId = parseInt(ctx.params.id!);

            // Vérifier si l'utilisateur existe
            const user = await db.getUserById(userId);
            if (!user) {
                ctx.response.status = 404;
                ctx.response.body = { message: 'User not found' };
                return;
            }

            const success = await db.deleteUser(userId);
            if (!success) {
                ctx.response.status = 400;
                ctx.response.body = { message: 'Failed to delete user' };
                return;
            }

            ctx.response.status = 200;
            ctx.response.body = { message: 'User deleted successfully' };
        } catch (err) {
            ctx.response.status = 500;
            ctx.response.body = { message: 'Server error: ' + err };
        }
    },
);
