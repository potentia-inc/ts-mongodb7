declare const inspect: unique symbol;
declare module 'mongodb' {
    interface UUID {
        [inspect]: () => string;
    }
}
export {};
