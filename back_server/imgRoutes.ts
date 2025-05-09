import { Router } from 'https://deno.land/x/oak@v17.1.4/mod.ts';
import { authorizationMiddleware } from './middlewares.ts';
import * as db from './rest.ts';

export const imgRoutes = new Router();

// Routes pour les images
imgRoutes.post('/api/images', authorizationMiddleware, async (ctx) => {
    try {
        const formData = await ctx.request.body.json();

        if (!formData.files || formData.files.length === 0) {
            ctx.response.status = 400;
            ctx.response.body = { message: 'No image file provided' };
            return;
        }

        const file = formData.files[0];

        if (!file.contentType || !file.contentType.startsWith('image/')) {
            ctx.response.status = 400;
            ctx.response.body = { message: 'Uploaded file is not an image' };
            return;
        }

        // Lire le contenu du fichier
        const imageData = file.content;

        // Enregistrer l'image
        const imageId = await db.storeImage({
            image_name: file.filename || 'unnamed',
            image_data: imageData,
        });

        ctx.response.status = 201;
        ctx.response.body = { message: 'Image uploaded successfully', imageId };
    } catch (err) {
        ctx.response.status = 500;
        ctx.response.body = { message: 'Server error: ' + err };
    }
});

imgRoutes.get('/api/images/:id', async (ctx) => {
    try {
        const imageId = parseInt(ctx.params.id!);

        const image = await db.getImageById(imageId);
        if (!image) {
            ctx.response.status = 404;
            ctx.response.body = { message: 'Image not found' };
            return;
        }

        // Déterminer le type de contenu
        const contentType = image.image_name.endsWith('.png')
            ? 'image/png'
            : image.image_name.endsWith('.jpg') ||
                    image.image_name.endsWith('.jpeg')
            ? 'image/jpeg'
            : image.image_name.endsWith('.gif')
            ? 'image/gif'
            : 'application/octet-stream';

        ctx.response.headers.set('Content-Type', contentType);
        ctx.response.body = image.image_data;
    } catch (err) {
        ctx.response.status = 500;
        ctx.response.body = { message: 'Server error: ' + err };
    }
});

imgRoutes.put('/api/users/me/image', authorizationMiddleware, async (ctx) => {
    try {
        const userId = ctx.state.userId;
        const formData = await ctx.request.body.json();

        if (!formData.files || formData.files.length === 0) {
            ctx.response.status = 400;
            ctx.response.body = { message: 'No image file provided' };
            return;
        }

        const file = formData.files[0];

        if (!file.contentType || !file.contentType.startsWith('image/')) {
            ctx.response.status = 400;
            ctx.response.body = { message: 'Uploaded file is not an image' };
            return;
        }

        // Lire le contenu du fichier
        const imageData = file.content;

        // Enregistrer l'image
        const imageId = await db.storeImage({
            image_name: file.filename || 'profile',
            image_data: imageData,
        });

        // Mettre à jour l'image de l'utilisateur
        await db.updateUser(userId, { image_id: imageId });

        ctx.response.status = 200;
        ctx.response.body = {
            message: 'Profile image updated successfully',
            imageId,
        };
    } catch (err) {
        ctx.response.status = 500;
        ctx.response.body = { message: 'Server error: ' + err };
    }
});
