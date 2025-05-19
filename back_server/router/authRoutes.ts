import { Router } from 'https://deno.land/x/oak@v17.1.4/mod.ts';
import * as db from '../rest.ts';
import { createJWT } from '../jwt_func.ts';
import { authorizationMiddleware } from '../middlewares.ts';

export const authRouter = new Router();

// Routes d'authentification
authRouter.post('/api/auth/register', async (ctx) => {
    try {
        const body = await ctx.request.body.json();

        if (!body.userName || !body.userPassword) {
            ctx.response.status = 400;
            ctx.response.body = { message: 'Missing required fields' };
            return;
        }

        // Validation
        if (await db.userExist(body.userName)) {
            ctx.response.status = 409;
            ctx.response.body = { message: 'Username already exists' };
            return;
        }

        let userId;
        // Création de l'utilisateur
        if (body.email) {
            if (await db.emailExist(body.email)) {
                ctx.response.status = 409;
                ctx.response.body = { message: 'Email already in use' };
                return;
            }

            if (!db.isValidEmail(body.email)) {
                ctx.response.status = 400;
                ctx.response.body = { message: 'Invalid email format' };
                return;
            }
            userId = await db.createUser({
                userName: body.userName,
                userPassword: body.userPassword,
                email: body.email,
                image_id: 1, // Image par défaut
            });
        } else {
            userId = await db.createUser({
                userName: body.userName,
                userPassword: body.userPassword,
                image_id: 1, // Image par défaut
            });
        }

        // Assigner le rôle USER
        await db.assignRoleToUser(userId, 2); // 2 = USER

        // Créer les préférences par défaut
        await db.createUserSettings({
            user_id: userId,
            theme: true, // dark theme by default.
            email_notification: true,
        });

        ctx.response.status = 201;
        ctx.response.body = { message: 'User created successfully', userId };
    } catch (err) {
        ctx.response.status = 500;
        ctx.response.body = { message: 'Server error: ' + err };
    }
});

authRouter.post('/api/auth/login', async (ctx) => {
    try {
        const body = await ctx.request.body.json();

        if (!body.userName || !body.userPassword) {
            ctx.response.status = 400;
            ctx.response.body = { message: 'Missing credentials' };
            return;
        }

        // Vérifier si l'utilisateur existe
        if (!await db.userExist(body.userName)) {
            ctx.response.status = 401;
            ctx.response.body = { message: 'Invalid credentials' };
            return;
        }

        // Vérifier le mot de passe
        const isValid = await db.validatePassword(
            body.userName,
            body.userPassword,
        );
        if (!isValid) {
            ctx.response.status = 401;
            ctx.response.body = { message: 'Invalid credentials' };
            return;
        }

        // Récupérer l'utilisateur
        const user = await db.getUserByName(body.userName);
        if (!user) {
            ctx.response.status = 500;
            ctx.response.body = { message: 'Server error: User not found' };
            return;
        }

        // Mettre à jour la dernière connexion
        await db.updateLastConnection(user.id!);

        const jwt = await createJWT('1h', { userId: user.id! });

        // Générer un token de rafraîchissement
        await db.createRefreshToken(user.id!);

        ctx.cookies.set('accessToken', jwt);
        //ctx.cookies.set('refreshToken', refreshToken);
        ctx.response.status = 200;
        ctx.response.body = {
            token: jwt,
            user: {
                id: user.id,
                userName: user.userName,
                email: user.email,
            },
        };
    } catch (err) {
        ctx.response.status = 500;
        ctx.response.body = { message: 'Server error: ' + err };
    }
});

authRouter.post('/api/auth/refresh', async (ctx) => {
    try {
        const body = await ctx.request.body.json();

        if (!body.refreshToken) {
            ctx.response.status = 400;
            ctx.response.body = { message: 'Refresh token is required' };
            return;
        }

        // Valider le refresh token
        const userId = await db.validateRefreshToken(body.refreshToken);
        if (!userId) {
            ctx.response.status = 401;
            ctx.response.body = { message: 'Invalid refresh token' };
            return;
        }

        // Récupérer l'utilisateur
        const user = await db.getUserById(userId);
        if (!user) {
            ctx.response.status = 500;
            ctx.response.body = { message: 'Server error: User not found' };
            return;
        }

        // Générer un nouveau JWT
        const jwt = await createJWT('1h', { username: user.userName });

        // Générer un nouveau token de rafraîchissement
        await db.deleteRefreshToken(body.refreshToken);
        const newRefreshToken = await db.createRefreshToken(user.id!);
        ctx.cookies.set('accessToken', jwt);
        ctx.response.status = 200;
        ctx.response.body = {
            token: jwt,
        };
    } catch (err) {
        ctx.response.status = 500;
        ctx.response.body = { message: 'Server error: ' + err };
    }
});

authRouter.post('/api/auth/logout', authorizationMiddleware, async (ctx) => {
    try {
        const refreshToken = await ctx.cookies.get('refreshToken');
        //const body = await ctx.request.body.json();

        if (refreshToken) {
            await db.deleteRefreshToken(refreshToken);
        }
        ctx.cookies.delete('accessToken');
        ctx.cookies.delete('refreshToken');
        ctx.cookies.delete('user');
        ctx.response.status = 200;
        ctx.response.body = { message: 'Logged out successfully' };
    } catch (err) {
        ctx.response.status = 500;
        ctx.response.body = { message: 'Server error: ' + err };
    }
});

authRouter.get('/api/auth/oauth', authorizationMiddleware, (ctx) => {
    ctx.response.status = 200;
});
