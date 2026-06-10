declare module 'mongodb' {
    interface Decimal128 {
        [Symbol.toPrimitive]: (hint: string) => number | string;
    }
}
export {};
