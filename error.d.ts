import { DbError } from './core.js';
export { DbError, DbError as DBError } from './core.js';
export declare class DisconnectedError extends DbError {
    constructor(message?: string);
}
export declare class NotFoundError extends DbError {
    constructor(message?: string);
}
export declare class ConflictError extends DbError {
    constructor(message?: string);
}
export declare class TransactionError extends DbError {
    constructor(message?: string);
}
export declare class UnacknowledgedError extends DbError {
    constructor(message?: string);
}
