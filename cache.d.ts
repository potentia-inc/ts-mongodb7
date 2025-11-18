export interface Options {
    capacity: number;
    ttl?: number;
    interval?: number;
}
export declare class Cache<Key, Value> {
    capacity: number;
    ttl: number;
    interval: number;
    last?: Date;
    map: Map<Key, [number, Value]>;
    count: Map<Key, number>;
    list: Array<[number, Key]>;
    constructor({ ttl, capacity, interval }: Options);
    get size(): number;
    has(key: Key, time?: Date): boolean;
    set(key: Key, value: Value, time?: Date): Cache<Key, Value>;
    get(key: Key, time?: Date): Value | undefined;
    delete(key: Key): boolean;
    clear(): void;
    isFull(): boolean;
    isEmpty(): boolean;
    scrub(time?: Date): void;
    evict(): void;
}
