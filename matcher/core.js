import { BigNumber } from 'bignumber.js';
import { Binary, Decimal128, ObjectId, UUID, toBinary, toBuffer, toObjectId, toUUID, } from '../type.js';
// Sentinel for "no expected argument was passed" — distinct from `undefined`,
// which is a real value to compare against (so toBeBinary() is a type check but
// toBeBinary(undefined) is an equality check that fails).
const TYPE_ONLY = Symbol('type-only');
// Validate the argument count once (shared by every matcher) and report the
// mode: TYPE_ONLY when no argument was passed, else the expected value.
function expected(name, rest) {
    if (rest.length > 1)
        throw new Error(`${name}: expected at most one argument`);
    return rest.length === 0 ? TYPE_ONLY : rest[0];
}
function build(ctx, name, comment, pass, received, shown) {
    const { isNot, promise, utils } = ctx;
    const hint = utils.matcherHint(name, undefined, undefined, {
        comment,
        isNot,
        promise,
    });
    const not = pass ? 'not ' : '';
    return {
        pass,
        message: () => `${hint}\n\nExpected: ${not}${utils.printExpected(shown)}\n` +
            `Received: ${utils.printReceived(received)}`,
    };
}
// Build a matcher that checks `isType` alone (no argument) or type plus value
// equality (one argument). `convert` turns the expected argument into the value
// compared; `show` renders it for the failure message. A conversion that throws
// (e.g. an undefined or unparseable expected) counts as "not equal" rather than
// erroring.
function combined(name, label, isType, convert, equals, show) {
    return function (received, ...rest) {
        const arg = expected(name, rest);
        if (arg === TYPE_ONLY) {
            return build(this, name, `${label} type`, isType(received), received, label);
        }
        let pass = false;
        let shown = arg;
        try {
            const converted = convert(arg);
            shown = show(converted);
            pass = isType(received) && equals(received, converted);
        }
        catch {
            pass = false;
        }
        return build(this, name, `${label} equality`, pass, received, shown);
    };
}
function isObjectIdString(x) {
    try {
        if (typeof x === 'string') {
            toObjectId(x);
            return true;
        }
    }
    catch {
        // suppress all errors
    }
    return false;
}
function isUUIDString(x) {
    try {
        if (typeof x === 'string') {
            toUUID(x);
            return true;
        }
    }
    catch {
        // suppress all errors
    }
    return false;
}
// Binary
export const toBeBinary = combined('toBeBinary', 'Binary', (received) => received instanceof Binary, (expected) => toBinary(expected), (received, expected) => {
    const a = received;
    return (a.length() === expected.length() &&
        Buffer.from(a.value()).compare(Buffer.from(expected.value())) === 0);
}, (expected) => expected.toString('base64'));
export const toEqualBinary = toBeBinary;
// Buffer
export const toBeBuffer = combined('toBeBuffer', 'Buffer', (received) => Buffer.isBuffer(received), (expected) => toBuffer(expected), (received, expected) => received.compare(expected) === 0, (expected) => expected.toString('base64'));
export const toEqualBuffer = toBeBuffer;
// Decimal128
export const toBeDecimal128 = combined('toBeDecimal128', 'Decimal128', (received) => received instanceof Decimal128, (expected) => new BigNumber(String(expected)), (received, expected) => new BigNumber(received.toString()).eq(expected), (expected) => expected.toString());
export const toEqualDecimal128 = toBeDecimal128;
export function toBeDecimal128NaN(received) {
    const pass = received instanceof Decimal128 && new BigNumber(received.toString()).isNaN();
    return build(this, 'toBeDecimal128NaN', 'Decimal128 NaN', pass, received, NaN);
}
// ObjectId
export const toBeObjectId = combined('toBeObjectId', 'ObjectId', (received) => received instanceof ObjectId, (expected) => toObjectId(expected), (received, expected) => received.equals(expected), (expected) => expected.toString());
export const toEqualObjectId = toBeObjectId;
export const toBeObjectIdString = combined('toBeObjectIdString', 'ObjectId string', isObjectIdString, (expected) => toObjectId(expected), (received, expected) => toObjectId(received).equals(expected), (expected) => expected.toString());
export const toEqualObjectIdString = toBeObjectIdString;
// UUID
export const toBeUUID = combined('toBeUUID', 'UUID', (received) => received instanceof UUID, (expected) => toUUID(expected), (received, expected) => received.equals(expected), (expected) => expected.toString());
export const toEqualUUID = toBeUUID;
export const toBeUUIDString = combined('toBeUUIDString', 'UUID string', isUUIDString, (expected) => toUUID(expected), (received, expected) => toUUID(received).equals(expected), (expected) => expected.toString());
export const toEqualUUIDString = toBeUUIDString;
// Uuid aliases
export const toBeUuid = toBeUUID;
export const toEqualUuid = toBeUUID;
export const toBeUuidString = toBeUUIDString;
export const toEqualUuidString = toBeUUIDString;
