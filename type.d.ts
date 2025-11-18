import { Binary, Decimal128, ObjectId } from './mongo.js';
export { UUID, UUID as Uuid, toUUID, toUUID as toUuid, toUUIDOrNil, toUUIDOrNil as toUuidOrNil, } from './core.js';
export { Binary, Decimal128, ObjectId } from './mongo.js';
declare const inspect: unique symbol;
declare module 'mongodb' {
    interface Binary {
        [Symbol.toPrimitive]: (hint: string) => string;
        [inspect]: () => string;
    }
    interface Decimal128 {
        [Symbol.toPrimitive]: (hint: string) => number | string;
        [inspect]: () => string;
    }
    interface ObjectId {
        [Symbol.toPrimitive]: (hint: string) => string;
        [inspect]: () => string;
    }
    interface UUID {
        [Symbol.toPrimitive]: (hint: string) => string;
        [inspect]: () => string;
    }
}
export declare function toBinary(x: unknown): Binary;
export declare function toBinaryOrNil(x?: unknown): Binary | undefined;
export declare const BUFFER_ENCODINGS: BufferEncoding[];
export declare function toBuffer(x: unknown): Buffer;
export declare function toBufferOrNil(x?: unknown): Buffer | undefined;
export declare function toDecimal128(x: unknown, round?: boolean): Decimal128;
export declare function toDecimal128OrNil(x?: unknown): Decimal128 | undefined;
export declare function toObjectId(x?: unknown): ObjectId;
export declare function toObjectIdOrNil(x?: unknown): ObjectId | undefined;
