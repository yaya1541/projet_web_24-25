import { JWTPayload } from "npm:jose@5.9.6";
import { Car } from "./lib/car.js";

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
  username: string;
}
