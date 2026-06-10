export interface MatcherUtils {
    matcherHint: (name: string, received?: string, expected?: string, options?: {
        comment?: string;
        isNot?: boolean;
        promise?: string;
    }) => string;
    printReceived: (value: unknown) => string;
    printExpected: (value: unknown) => string;
}
export interface MatcherContext {
    isNot?: boolean;
    promise?: string;
    utils: MatcherUtils;
}
export interface MatcherResult {
    pass: boolean;
    message: () => string;
}
export interface CustomMatchers<R = unknown> {
    toBeBinary(expected?: unknown): R;
    toEqualBinary(expected: unknown): R;
    toBeBuffer(expected?: unknown): R;
    toEqualBuffer(expected: unknown): R;
    toBeDecimal128(expected?: unknown): R;
    toBeDecimal128NaN(): R;
    toEqualDecimal128(expected: unknown): R;
    toBeObjectId(expected?: unknown): R;
    toBeObjectIdString(expected?: unknown): R;
    toEqualObjectId(expected: unknown): R;
    toEqualObjectIdString(expected: unknown): R;
    toBeUUID(expected?: unknown): R;
    toBeUUIDString(expected?: unknown): R;
    toEqualUUID(expected: unknown): R;
    toEqualUUIDString(expected: unknown): R;
    toBeUuid(expected?: unknown): R;
    toBeUuidString(expected?: unknown): R;
    toEqualUuid(expected: unknown): R;
    toEqualUuidString(expected: unknown): R;
}
type Matcher = (this: MatcherContext, received: unknown, ...rest: unknown[]) => MatcherResult;
export declare const toBeBinary: Matcher;
export declare const toEqualBinary: Matcher;
export declare const toBeBuffer: Matcher;
export declare const toEqualBuffer: Matcher;
export declare const toBeDecimal128: Matcher;
export declare const toEqualDecimal128: Matcher;
export declare function toBeDecimal128NaN(this: MatcherContext, received: unknown): MatcherResult;
export declare const toBeObjectId: Matcher;
export declare const toEqualObjectId: Matcher;
export declare const toBeObjectIdString: Matcher;
export declare const toEqualObjectIdString: Matcher;
export declare const toBeUUID: Matcher;
export declare const toEqualUUID: Matcher;
export declare const toBeUUIDString: Matcher;
export declare const toEqualUUIDString: Matcher;
export declare const toBeUuid: Matcher;
export declare const toEqualUuid: Matcher;
export declare const toBeUuidString: Matcher;
export declare const toEqualUuidString: Matcher;
export {};
