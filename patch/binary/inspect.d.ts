declare const inspect: unique symbol;
declare module 'mongodb' {
    interface Binary {
        [inspect]: () => string;
    }
}
export {};
