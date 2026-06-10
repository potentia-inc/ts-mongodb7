declare module 'mongodb' {
    interface UUID {
        [Symbol.toPrimitive]: (hint: string) => string;
    }
}
export {};
