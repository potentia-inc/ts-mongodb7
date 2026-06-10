declare const inspect: unique symbol;
declare module 'mongodb' {
    interface ObjectId {
        [inspect]: () => string;
    }
}
export {};
