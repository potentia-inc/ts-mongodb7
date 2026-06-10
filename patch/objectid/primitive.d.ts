declare module 'mongodb' {
    interface ObjectId {
        [Symbol.toPrimitive]: (hint: string) => string;
    }
}
export {};
