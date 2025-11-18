import assert from 'node:assert';
import { Cache } from './cache.js';
import { isDuplicationError } from './connection.js';
import { ConflictError, NotFoundError, UnacknowledgedError } from './error.js';
import { toObjectId } from './type.js';
import { isNil } from './util.js';
export { generateUUID, generateUUID as generateUuid } from './core.js';
// XXX deprecated, use @mongodb6/type instead
export { AggregationCursor, ChangeStream, Collection as MongoCollection, FindCursor, } from 'mongodb';
export class Collection {
    generate;
    name;
    connection;
    cache;
    get collection() {
        return this.connection.db.collection(this.name);
    }
    constructor(options) {
        this.connection = options.connection;
        this.name = options.name;
        this.generate = options.generate ?? generate;
        if (!isNil(options.cache))
            this.cache = new Cache(options.cache);
    }
    cacheOne(doc) {
        this.cache?.set(doc._id, doc);
        return doc;
    }
    cacheMany(docs) {
        docs.forEach((doc) => this.cacheOne(doc));
        return docs;
    }
    uncacheOne(id) {
        return this.cache?.delete(id) ?? false;
    }
    uncacheAll() {
        if ((this.cache?.size ?? 0) === 0)
            return false;
        this.cache?.clear();
        return true;
    }
    aggregate(pipeline = [], options = {}) {
        return this.collection.aggregate(pipeline, options);
    }
    watch(pipeline = [], options = {}) {
        return this.collection.watch(pipeline, options);
    }
    find(filter, options = {}) {
        return this.collection.find(filter, options);
    }
    async findOneById(id, cache = true, options = {}) {
        return ((cache ? this.cache?.get(id) : undefined) ??
            (await this.findOne({ _id: id }, options)));
    }
    async findOne(filter, options = {}) {
        const doc = await this.collection.findOne(filter, options);
        if (isNil(doc))
            throw new NotFoundError(`Not Found: ${this.name}`);
        return this.cacheOne(doc);
    }
    async queryOne(filter, options = {}) {
        const doc = await this.collection.findOne(filter, options);
        if (isNil(doc))
            return undefined;
        return this.cacheOne(doc);
    }
    async findMany(filter, sort = {}, options = {}) {
        const found = (await this.collection
            .find(filter, options)
            .sort(sort)
            .toArray());
        return this.cacheMany(found);
    }
    async insertOne(doc, options = {}) {
        try {
            const created = {
                ...doc,
                _id: this.generate(doc._id),
            };
            const { acknowledged } = await this.collection.insertOne(created, options);
            if (acknowledged)
                return this.cacheOne(created);
        }
        catch (err) {
            throw isDuplicationError(err)
                ? new ConflictError(`Conflict: ${this.name}`)
                : err;
        }
        throw new UnacknowledgedError();
    }
    async insertMany(docs, options = {}) {
        if (docs.length === 0)
            return [];
        try {
            const created = docs.map((x) => ({
                ...x,
                _id: this.generate(x._id),
            }));
            const { acknowledged } = await this.collection.insertMany(created, options);
            if (acknowledged)
                return this.cacheMany(created);
        }
        catch (err) {
            throw isDuplicationError(err)
                ? new ConflictError(`Conflict: ${this.name}`)
                : err;
        }
        throw new UnacknowledgedError();
    }
    async updateOne(filter, values, options = {}) {
        const update = (() => {
            if (options.upsert !== true ||
                !isNil(filter._id) ||
                !isNil(values.$setOnInsert?._id)) {
                return values;
            }
            if (!isNil(values.$setOnInsert)) {
                return {
                    ...values,
                    $setOnInsert: { ...values.$setOnInsert, _id: this.generate() },
                };
            }
            return { ...values, $setOnInsert: { _id: this.generate() } };
        })();
        const updated = await this.collection.findOneAndUpdate(filter, update, {
            returnDocument: 'after',
            ...options,
        });
        if (!isNil(updated))
            return this.cacheOne(updated);
        throw new NotFoundError(`Not Found: ${this.name}`);
    }
    async updateMany(filter, update, options = {}) {
        const { modifiedCount } = await this.collection.updateMany(filter, update, options);
        return modifiedCount;
    }
    async deleteOne(filter, options = {}) {
        const { deletedCount } = await this.collection.deleteOne(filter, options);
        if (deletedCount !== 1)
            throw new NotFoundError(`Not Found: ${this.name}`);
    }
    async deleteMany(filter, options = {}) {
        const { deletedCount } = await this.collection.deleteMany(filter, options);
        return deletedCount;
    }
}
export function generate(id) {
    assert(!isNil(id));
    return id;
}
export function generateObjectId(id) {
    return id ?? toObjectId();
}
//# sourceMappingURL=collection.js.map