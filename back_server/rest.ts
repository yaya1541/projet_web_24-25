import { Client } from 'https://deno.land/x/mysql@v2.12.1/mod.ts';
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts';
import { v4 as uuid } from 'https://deno.land/std@0.138.0/uuid/mod.ts';
import { createJWT } from './jwt_func.ts';
import { ImageStore, Message, Settings, User } from './interfaces.ts';

// Connexion à la base de données
export const dbClient = await new Client().connect({
    hostname: '127.0.0.1',
    username: 'netUser',
    db: 'projetWeb2425',
    password: `${Deno.env.get('NET_DATABASE_PASS')}`,
    port: 3306,
});

// Fonctions d'authentification et utilisateurs
export const userExist = async (userName: string): Promise<boolean> => {
    const result = await dbClient.execute(
        `SELECT COUNT(*) as count FROM User WHERE userName = ?`,
        [userName],
    );
    return result.rows![0].count > 0;
};

export const emailExist = async (email: string): Promise<boolean> => {
    const result = await dbClient.execute(
        `SELECT COUNT(*) as count FROM User WHERE email = ?`,
        [email],
    );
    return result.rows![0].count > 0;
};

export const validatePassword = async (
    userName: string,
    password: string,
): Promise<boolean> => {
    const result = await dbClient.execute(
        `SELECT userPassword, userSalt FROM User WHERE userName = ?`,
        [userName],
    );

    if (result.rows?.length === 0) return false;

    const storedHash = result.rows![0].userPassword;
    return await bcrypt.compare(password, storedHash);
};

export const hashPassword = async (
    password: string,
): Promise<{ hash: string; salt: string }> => {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    return { hash, salt };
};

export const createUser = async (userData: User): Promise<number> => {
    const now = new Date();
    const { hash: hashedPassword, salt } = await hashPassword(
        userData.userPassword,
    );

    const result = await dbClient.execute(
        `INSERT INTO User (userName, userPassword, userSalt, userLastConnection, userDateOfCreation, email, image_id) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            userData.userName,
            hashedPassword,
            salt,
            now,
            now,
            userData.email || null,
            userData.image_id,
        ],
    );

    return result.lastInsertId!;
};

export const getUserById = async (id: number): Promise<User | null> => {
    const result = await dbClient.execute(
        `SELECT id, userName, userLastConnection, userDateOfCreation, email, image_id 
     FROM User WHERE id = ?`,
        [id],
    );

    if (result.rows?.length === 0) return null;
    return result.rows![0] as User;
};

export const getUserByName = async (userName: string): Promise<User | null> => {
    const result = await dbClient.execute(
        `SELECT id, userName, userLastConnection, userDateOfCreation, email, image_id 
     FROM User WHERE userName = ?`,
        [userName],
    );

    if (result.rows?.length === 0) return null;
    return result.rows![0] as User;
};

export const updateUser = async (
    userId: number,
    userData: Partial<User>,
): Promise<boolean> => {
    const fields = [];
    const values = [];

    if (userData.userName) {
        fields.push('userName = ?');
        values.push(userData.userName);
    }

    if (userData.userPassword) {
        const { hash, salt } = await hashPassword(userData.userPassword);
        fields.push('userPassword = ?');
        values.push(hash);
        fields.push('userSalt = ?');
        values.push(salt);
    }

    if (userData.email) {
        fields.push('email = ?');
        values.push(userData.email);
    }

    if (userData.image_id) {
        fields.push('image_id = ?');
        values.push(userData.image_id);
    }

    fields.push('userLastConnection = ?');
    values.push(new Date());

    if (fields.length === 0) return false;

    values.push(userId);

    const result = await dbClient.execute(
        `UPDATE User SET ${fields.join(', ')} WHERE id = ?`,
        values,
    );

    return result.affectedRows! > 0;
};

export const deleteUser = async (userId: number): Promise<boolean> => {
    // Supprimer d'abord les enregistrements dépendants
    await dbClient.execute(`DELETE FROM RefreshToken WHERE userId = ?`, [
        userId,
    ]);
    await dbClient.execute(`DELETE FROM Role WHERE user_id = ?`, [userId]);
    await dbClient.execute(`DELETE FROM Settings WHERE user_id = ?`, [userId]);

    // Supprimer les messages envoyés ou reçus
    await dbClient.execute(
        `DELETE FROM Message WHERE sender = ? OR receiver = ?`,
        [userId, userId],
    );

    // Enfin, supprimer l'utilisateur
    const result = await dbClient.execute(`DELETE FROM User WHERE id = ?`, [
        userId,
    ]);
    return result.affectedRows! > 0;
};

export const updateLastConnection = async (userId: number): Promise<void> => {
    await dbClient.execute(
        `UPDATE User SET userLastConnection = ? WHERE id = ?`,
        [new Date(), userId],
    );
};

// Gestion des rôles
export const assignRoleToUser = async (
    userId: number,
    roleId: number,
): Promise<boolean> => {
    try {
        await dbClient.execute(
            `INSERT INTO Role (role_id, user_id) VALUES (?, ?)`,
            [roleId, userId],
        );
        return true;
    } catch (error) {
        console.error('Error assigning role:', error);
        return false;
    }
};

export const removeRoleFromUser = async (
    userId: number,
    roleId: number,
): Promise<boolean> => {
    const result = await dbClient.execute(
        `DELETE FROM Role WHERE role_id = ? AND user_id = ?`,
        [roleId, userId],
    );
    return result.affectedRows! > 0;
};

export const getUserRoles = async (userId: number): Promise<number[]> => {
    const result = await dbClient.execute(
        `SELECT role_id FROM Role WHERE user_id = ?`,
        [userId],
    );
    return result.rows!.map((row) => row.role_id);
};

export const hasRole = async (
    userId: number,
    roleId: number,
): Promise<boolean> => {
    const result = await dbClient.execute(
        `SELECT COUNT(*) as count FROM Role WHERE user_id = ? AND role_id = ?`,
        [userId, roleId],
    );
    return result.rows![0].count > 0;
};

export const getUserRefresh = async (
    userId: number,
): Promise<string | null> => {
    const result = await dbClient.execute(
        `SELECT token FROM RefreshToken WHERE userId = ?`,
        [userId],
    );

    if (result.rows?.length === 0) return null;
    return result.rows![0].token;
};

// Gestion des tokens
export const createRefreshToken = async (userId: number): Promise<string> => {
    const token = await createJWT('14d', { userId: userId });
    await dbClient.execute(
        `INSERT INTO RefreshToken (token, userId) VALUES (?, ?)`,
        [token, userId],
    );
    return token;
};

export const validateRefreshToken = async (
    token: string,
): Promise<number | null> => {
    const result = await dbClient.execute(
        `SELECT userId FROM RefreshToken WHERE token = ?`,
        [token],
    );

    if (result.rows?.length === 0) return null;
    return result.rows![0].userId;
};

export const deleteRefreshToken = async (token: string): Promise<boolean> => {
    const result = await dbClient.execute(
        `DELETE FROM RefreshToken WHERE token = ?`,
        [token],
    );
    return result.affectedRows! > 0;
};

export const deleteAllUserRefreshTokens = async (
    userId: number,
): Promise<boolean> => {
    const result = await dbClient.execute(
        `DELETE FROM RefreshToken WHERE userId = ?`,
        [userId],
    );
    return result.affectedRows! > 0;
};

// Gestion des messages
export const sendMessage = async (message: Message): Promise<number> => {
    const now = new Date();
    const result = await dbClient.execute(
        `INSERT INTO Message (sender, receiver, content, sentAt) VALUES (?, ?, ?, ?)`,
        [message.sender, message.receiver, message.content, now],
    );
    return result.lastInsertId!;
};

export const getMessageById = async (
    messageId: number,
): Promise<Message | null> => {
    const result = await dbClient.execute(
        `SELECT * FROM Message WHERE id = ?`,
        [messageId],
    );

    if (result.rows?.length === 0) return null;
    return result.rows![0] as Message;
};

export const getUserConversation = async (
    userId1: number,
    userId2: number,
): Promise<Message[]> => {
    const result = await dbClient.execute(
        `SELECT * FROM Message 
     WHERE (sender = ? AND receiver = ?) OR (sender = ? AND receiver = ?)
     ORDER BY sentAt ASC`,
        [userId1, userId2, userId2, userId1],
    );
    return result.rows as Message[];
};

export const getUserInbox = async (userId: number): Promise<Message[]> => {
    const result = await dbClient.execute(
        `SELECT * FROM Message WHERE receiver = ? ORDER BY sentAt DESC`,
        [userId],
    );
    return result.rows as Message[];
};

export const getUserSentMessages = async (
    userId: number,
): Promise<Message[]> => {
    const result = await dbClient.execute(
        `SELECT * FROM Message WHERE sender = ? ORDER BY sentAt DESC`,
        [userId],
    );
    return result.rows as Message[];
};

export const getAllGlobalMessages = async (): Promise<Message[]> => {
    const result = await dbClient.execute(
        `SELECT * FROM Message WHERE receiver = 1 ORDER BY sentAt ASC`,
    );
    return result.rows as Message[];
};
/*
// TODO : get all messages from db.
// TODO : Separate rest into multiple file
getUserPrivateChats() select distincs receiver where sender = user id
*/

export const deleteMessage = async (messageId: number): Promise<boolean> => {
    const result = await dbClient.execute(
        `DELETE FROM Message WHERE id = ?`,
        [messageId],
    );
    return result.affectedRows! > 0;
};

// Gestion des préférences utilisateur
export const getUserSettings = async (
    userId: number,
): Promise<Settings | null> => {
    const result = await dbClient.execute(
        `SELECT * FROM Settings WHERE user_id = ?`,
        [userId],
    );

    if (result.rows?.length === 0) return null;
    return result.rows![0] as Settings;
};

export const createUserSettings = async (
    settings: Settings,
): Promise<boolean> => {
    try {
        await dbClient.execute(
            `INSERT INTO Settings (user_id, theme, email_notification) VALUES (?, ?, ?)`,
            [settings.user_id, settings.theme, settings.email_notification],
        );
        return true;
    } catch (error) {
        console.error('Error creating settings:', error);
        return false;
    }
};

export const updateUserSettings = async (
    userId: number,
    settings: Partial<Settings>,
): Promise<boolean> => {
    const fields = [];
    const values = [];

    if (settings.theme !== undefined) {
        fields.push('theme = ?');
        values.push(settings.theme);
    }

    if (settings.email_notification !== undefined) {
        fields.push('email_notification = ?');
        values.push(settings.email_notification);
    }

    if (fields.length === 0) return false;

    values.push(userId);

    const result = await dbClient.execute(
        `UPDATE Settings SET ${fields.join(', ')} WHERE user_id = ?`,
        values,
    );

    return result.affectedRows! > 0;
};

// Gestion des images
export const storeImage = async (image: ImageStore): Promise<number> => {
    const result = await dbClient.execute(
        `INSERT INTO ImageStore (image_name, image_data) VALUES (?, ?)`,
        [image.image_name, image.image_data],
    );
    return result.lastInsertId!;
};

export const getImageById = async (
    imageId: number,
): Promise<ImageStore | null> => {
    const result = await dbClient.execute(
        `SELECT * FROM ImageStore WHERE id = ?`,
        [imageId],
    );

    if (result.rows?.length === 0) return null;
    return result.rows![0] as ImageStore;
};

export const updateImage = async (
    imageId: number,
    imageData: Uint8Array,
    imageName?: string,
): Promise<boolean> => {
    const fields = ['image_data = ?'];
    const values = [imageData];

    if (imageName) {
        fields.push('image_name = ?');
        values.push(imageName);
    }

    values.push(imageId);

    const result = await dbClient.execute(
        `UPDATE ImageStore SET ${fields.join(', ')} WHERE id = ?`,
        values,
    );

    return result.affectedRows! > 0;
};

export const deleteImage = async (imageId: number): Promise<boolean> => {
    // Vérifier si l'image est utilisée par des utilisateurs
    const usersUsingImage = await dbClient.execute(
        `SELECT COUNT(*) as count FROM User WHERE image_id = ?`,
        [imageId],
    );

    // Ne pas supprimer si l'image est encore utilisée
    if (usersUsingImage.rows![0].count > 0) {
        return false;
    }

    const result = await dbClient.execute(
        `DELETE FROM ImageStore WHERE id = ?`,
        [imageId],
    );

    return result.affectedRows! > 0;
};

// Fonctions utilitaires
export const initializeDatabase = async (): Promise<void> => {
    // Créer une image par défaut si elle n'existe pas
    const defaultImageExists = await dbClient.execute(
        `SELECT COUNT(*) as count FROM ImageStore WHERE id = 1`,
    );

    if (defaultImageExists.rows![0].count === 0) {
        // Créer une image par défaut (un placeholder vide)
        await dbClient.execute(
            `INSERT INTO ImageStore (id, image_name, image_data) VALUES (1, 'default', ?);`,
            [new Uint8Array(0)],
        );
    }

    // Vérifier si les rôles existent, sinon les créer
    const rolesExist = await dbClient.execute(
        `SELECT COUNT(*) as count FROM Roles`,
    );

    if (rolesExist.rows![0].count === 0) {
        await dbClient.execute(
            `INSERT INTO Roles (id, name) VALUES (1, 'ADMIN')`,
        );
        await dbClient.execute(
            `INSERT INTO Roles (id, name) VALUES (2, 'USER')`,
        );
        await dbClient.execute(
            `INSERT INTO Roles (id, name) VALUES (3, 'HOST')`,
        );
    }

    // Créer un admin par défaut si aucun n'existe
    const adminExists = await dbClient.execute(
        `SELECT COUNT(*) as count FROM User u
     JOIN Role r ON u.id = r.user_id
     WHERE r.role_id = 1`,
    );

    if (adminExists.rows![0].count === 0) {
        // Créer un utilisateur admin par défaut
        const { hash, salt } = await hashPassword('admin');
        const now = new Date();

        await dbClient.execute(
            `INSERT INTO User (userName, userPassword, userSalt, userLastConnection, userDateOfCreation, email, image_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
            ['admin', hash, salt, now, now, 'admin@example.com', 1],
        );

        const adminId = (await dbClient.execute(
            `SELECT id FROM User WHERE userName = 'admin'`,
        )).rows![0].id;

        // Ajouter le rôle admin
        await dbClient.execute(
            `INSERT INTO Role (role_id, user_id) VALUES (?, ?)`,
            [1, adminId],
        );

        // Créer les paramètres par défaut
        await dbClient.execute(
            `INSERT INTO Settings (user_id, theme, email_notification) VALUES (?, ?, ?)`,
            [adminId, true, true],
        );
    }
};

// Validation d'email avec regex
export const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};
