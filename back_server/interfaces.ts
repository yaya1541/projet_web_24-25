import { JWTPayload } from 'npm:jose@5.9.6';
import { Car } from './lib/car.js';

export interface Bodies {
    [key: string]: Car;
}

export interface InputMessage {
    type: number;
    user: string;
    value: string;
}

export interface Inputs {
    [key: string]: {
        [key: string]: boolean;
    };
}

export interface Token extends JWTPayload {
    userId: number;
}

export interface User {
    id?: number;
    userName: string;
    userPassword: string;
    userSalt?: string;
    userLastConnection?: Date;
    userDateOfCreation?: Date;
    email?: string;
    image_id: number;
}

export interface Role {
    role_id: number;
    user_id: number;
}

export interface RefreshToken {
    token: string;
    userId: number;
}

export interface Message {
    id?: number;
    sender: number;
    receiver: number;
    content: string;
    sentAt?: Date;
}

export interface Settings {
    user_id: number;
    theme: boolean;
    email_notification: boolean;
}

export interface ImageStore {
    id?: number;
    image_name: string;
    image_data: Uint8Array;
}
