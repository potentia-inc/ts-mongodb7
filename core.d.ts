import { UUID } from './mongo.js';
export { UUID } from './mongo.js';
export declare function toUUID(x?: unknown): UUID;
export declare function toUUIDOrNil(x?: unknown): UUID | undefined;
export declare function generateUUID(id?: UUID): UUID;
export declare class DbError extends Error {
    constructor(message?: string);
}
