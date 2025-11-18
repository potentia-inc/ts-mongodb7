import assert from 'node:assert';
import { isNil } from './util.js';
export class Cache {
    capacity;
    ttl;
    interval;
    last;
    map = new Map();
    count = new Map();
    list = [];
    constructor({ ttl, capacity, interval }) {
        assert(capacity > 0);
        this.ttl = ttl ?? Infinity;
        this.capacity = capacity;
        this.interval = interval ?? 10000;
    }
    get size() {
        return this.map.size;
    }
    has(key, time) {
        return !isNil(this.get(key, time));
    }
    set(key, value, time) {
        const now = time ?? new Date();
        this.scrub(now);
        if (this.isFull() && !this.has(key, now))
            this.evict();
        const expiration = now.valueOf() + this.ttl;
        this.map.set(key, [expiration, value]);
        this.count.set(key, (this.count.get(key) ?? 0) + 1);
        this.list.push([expiration, key]);
        return this;
    }
    get(key, time) {
        const now = time ?? new Date();
        this.scrub(now);
        const item = this.map.get(key);
        if (!isNil(item)) {
            if (item[0] > now.valueOf())
                return item[1];
            this.map.delete(key); // expire the item
        }
        return undefined;
    }
    delete(key) {
        return this.map.delete(key);
    }
    clear() {
        this.map.clear();
        this.list.splice(0, this.list.length);
    }
    isFull() {
        return this.size >= this.capacity;
    }
    isEmpty() {
        return this.size == 0;
    }
    scrub(time) {
        const now = time ?? new Date();
        const timestamp = now.valueOf();
        if (timestamp - (this.last?.valueOf() ?? 0) < this.interval)
            return;
        let size = 0;
        for (; size < this.list.length; ++size) {
            const item = this.list[size];
            assert(!isNil(item));
            const [expiration, key] = item;
            if (expiration > timestamp)
                break;
            if ((this.map.get(key)?.[0] ?? Infinity) <= timestamp)
                this.map.delete(key);
            this.count.set(key, (this.count.get(key) ?? 0) - 1);
        }
        this.list.splice(0, size);
        this.last = now;
    }
    evict() {
        let size = 0;
        for (; this.isFull(); ++size) {
            const item = this.list[size];
            assert(!isNil(item));
            const [, key] = item;
            if (this.count.get(key) === 1) {
                this.map.delete(key);
                this.count.delete(key);
            }
            else
                this.count.set(key, (this.count.get(key) ?? 0) - 1);
        }
        this.list.splice(0, size);
    }
}
//# sourceMappingURL=cache.js.map