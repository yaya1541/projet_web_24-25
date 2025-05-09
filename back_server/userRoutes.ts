import { Router } from 'https://deno.land/x/oak@v17.1.4/router.ts';
import { authorizationMiddleware } from './middlewares.ts';
import { User } from './interfaces.ts';
import * as db from './rest.ts';

export const userRoutes = new Router()

userRoutes.get('/api/users/me', authorizationMiddleware, async (ctx) => {
    try {
        const userId = ctx.state.userId;
        console.log("User id : ",userId);
        
        const success = await db.getUserById(userId);
        if (!success) {
            ctx.response.status = 400;
            ctx.response.body = { message: 'Failed to get user' };
            return;
        }

        ctx.response.status = 200;
        ctx.response.body = { user : success, message: 'User data successfully fetched' };
    } catch (err) {
        ctx.response.status = 500;
        ctx.response.body = { message: 'Server error: ' + err };
    }
});

userRoutes.put('/api/users/me', authorizationMiddleware, async (ctx) => {
    try {
        const userId = ctx.state.userId;
        const body = await ctx.request.body.json();

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
});

userRoutes.delete('/api/users/me', authorizationMiddleware, async (ctx) => {
    try {
        const userId = ctx.state.userId;

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
});