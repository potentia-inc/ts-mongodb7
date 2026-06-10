import assert from 'node:assert';
import { Binary, UUID } from './mongo.js';
import { isNil } from './util.js';
export { UUID } from './mongo.js';
export function toUUID(x) {
    // strict coercion: nullish throws (use `new UUID()` to mint a new one, or
    // toUUIDOrNil() to tolerate null/undefined)
    if (isNil(x)) {
        throw new TypeError('cannot convert null or undefined to a UUID');
    }
    if (x instanceof UUID)
        return x;
    if (x instanceof Binary) {
        assert(x.sub_type === Binary.SUBTYPE_UUID);
        return x.toUUID();
    }
    if (Buffer.isBuffer(x) || typeof x === 'string')
        return new UUID(x);
    // any plain Uint8Array — the 16 raw id bytes
    if (x instanceof Uint8Array)
        return new UUID(Buffer.from(x));
    return new UUID(String(x));
}
export function toUUIDOrNil(x) {
    return isNil(x) ? undefined : toUUID(x);
}
export function generateUUID(id) {
    return id ?? new UUID();
}
export class DbError extends Error {
    constructor(message) {
        super(message ?? 'Unknown DB Error');
    }
}
