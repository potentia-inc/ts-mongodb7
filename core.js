import assert from 'node:assert';
import { Binary, UUID } from './mongo.js';
import { isNil } from './util.js';
export { UUID } from './mongo.js';
export function toUUID(x) {
    if (x instanceof UUID)
        return x;
    if (x instanceof Binary) {
        assert(x.sub_type === Binary.SUBTYPE_UUID);
        return x.toUUID();
    }
    if (isNil(x) || Buffer.isBuffer(x) || typeof x === 'string') {
        return new UUID(x);
    }
    return new UUID(String(x));
}
export function toUUIDOrNil(x) {
    return isNil(x) ? undefined : toUUID(x);
}
export function generateUUID(id) {
    return id ?? toUUID();
}
export class DbError extends Error {
    constructor(message) {
        super(message ?? 'Unknown DB Error');
    }
}
//# sourceMappingURL=core.js.map