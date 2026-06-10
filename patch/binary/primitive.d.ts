declare module 'mongodb' {
    interface Binary {
        [Symbol.toPrimitive]: (hint: string) => string;
    }
}
export {};
