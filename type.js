import assert from 'node:assert';
import { toUUID } from './core.js';
import { Binary, Decimal128, ObjectId, UUID } from './mongo.js';
import { isNil } from './util.js';
export { UUID, UUID as Uuid, toUUID, toUUID as toUuid, toUUIDOrNil, toUUIDOrNil as toUuidOrNil, } from './core.js';
export { Binary, Decimal128, ObjectId } from './mongo.js';
// The `Binary`/`Decimal128`/`ObjectId`/`UUID` prototype patches (Symbol.toPrimitive,
// util.inspect.custom, Decimal128 toJSON) are opt-in side effects — import them
// from '@potentia/mongodb7/patch' (or the granular ./patch/{primitive,inspect,json}).
const UUID_HEX_RE = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|[0-9a-f]{12}4[0-9a-f]{3}[89ab][0-9a-f]{15})$/i;
export function toBinary(x) {
    if (isNil(x)) {
        throw new TypeError('cannot convert null or undefined to a Binary');
    }
    if (x instanceof Binary)
        return x;
    if (x instanceof UUID)
        return x.toBinary();
    if (Buffer.isBuffer(x))
        return new Binary(x, Binary.SUBTYPE_BYTE_ARRAY);
    // any plain Uint8Array (Web Crypto, fetch().bytes(), other runtimes) — bytes
    if (x instanceof Uint8Array)
        return new Binary(Buffer.from(x), Binary.SUBTYPE_BYTE_ARRAY);
    if (typeof x === 'string') {
        if (UUID_HEX_RE.test(x))
            return toBinary(toUUID(x));
        return toBinary(toBuffer(x));
    }
    return toBinary(String(x));
}
export function toBinaryOrNil(x) {
    return isNil(x) ? undefined : toBinary(x);
}
export const BUFFER_ENCODINGS = [
    'base64',
    'base64url',
    'hex',
    'utf8',
    'utf-8',
    'utf16le',
    'ucs2',
    'ucs-2',
    'ascii',
    'latin1',
    'binary',
];
// `Buffer.from(str, encoding)` never throws: for base64/base64url/hex it
// silently drops characters outside the alphabet instead of failing, so a bare
// try/catch can never fall through to the next encoding. Validate the alphabet
// explicitly so non-matching strings (e.g. containing spaces) fall back to the
// text encodings rather than being silently corrupted.
const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/;
const BASE64URL_RE = /^[A-Za-z0-9_-]*={0,2}$/;
const HEX_RE = /^(?:[0-9a-fA-F]{2})*$/;
function isDecodable(x, encoding) {
    switch (encoding) {
        case 'base64':
            return BASE64_RE.test(x);
        case 'base64url':
            return BASE64URL_RE.test(x);
        case 'hex':
            return HEX_RE.test(x);
        default:
            return true; // text encodings can represent any string
    }
}
export function toBuffer(x) {
    if (isNil(x)) {
        throw new TypeError('cannot convert null or undefined to a Buffer');
    }
    if (Buffer.isBuffer(x))
        return x;
    if (x instanceof Binary)
        return Buffer.from(x.value());
    // any plain Uint8Array (Web Crypto, fetch().bytes(), other runtimes) — copy
    // the raw bytes rather than falling through to String(x)
    if (x instanceof Uint8Array)
        return Buffer.from(x);
    if (typeof x === 'string') {
        for (const encoding of BUFFER_ENCODINGS) {
            if (isDecodable(x, encoding))
                return Buffer.from(x, encoding);
        }
        assert(false, `failed to decode ${x} for toBuffer()`);
    }
    return toBuffer(String(x));
}
export function toBufferOrNil(x) {
    return isNil(x) ? undefined : toBuffer(x);
}
export function toDecimal128(x, round = true) {
    if (isNil(x)) {
        throw new TypeError('cannot convert null or undefined to a Decimal128');
    }
    if (x instanceof Decimal128)
        return x;
    return round
        ? Decimal128.fromStringWithRounding(String(x))
        : Decimal128.fromString(String(x));
}
export function toDecimal128OrNil(x) {
    return isNil(x) ? undefined : toDecimal128(x);
}
export function toObjectId(x) {
    // strict coercion: nullish throws (use `new ObjectId()` to mint a new one,
    // or toObjectIdOrNil() to tolerate null/undefined)
    if (isNil(x)) {
        throw new TypeError('cannot convert null or undefined to an ObjectId');
    }
    if (x instanceof ObjectId)
        return x;
    if (typeof x === 'string' || Buffer.isBuffer(x))
        return new ObjectId(x);
    // any plain Uint8Array — the 12 raw id bytes
    if (x instanceof Uint8Array)
        return new ObjectId(Buffer.from(x));
    return new ObjectId(String(x));
}
export function toObjectIdOrNil(x) {
    return isNil(x) ? undefined : toObjectId(x);
}
