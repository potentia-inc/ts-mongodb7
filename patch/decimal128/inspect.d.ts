declare const inspect: unique symbol;
declare module 'mongodb' {
    interface Decimal128 {
        [inspect]: () => string;
    }
}
export {};
