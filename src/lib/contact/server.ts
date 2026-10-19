import "server-only";
import { readContactConfig } from "./model";

export const getContactConfig = () => readContactConfig(process.env);
