import { Cache, Options as CacheOptions } from './cache.js';
import { Connection } from './connection.js';
import { AggregateOptions, AggregationCursor, BulkWriteOptions, ChangeStream, ChangeStreamOptions, Collection as MongoCollection, DeleteOptions, Document, Filter, FindCursor, FindOneAndUpdateOptions, FindOptions, InsertOneOptions, OptionalId, Sort, UpdateFilter, UpdateOptions, WithId } from './mongo.js';
import { ObjectId } from './type.js';
export { generateUUID, generateUUID as generateUuid } from './core.js';
export { AggregateOptions, AggregationCursor, BulkWriteOptions, ChangeStream, ChangeStreamOptions, Collection as MongoCollection, CommandOperationOptions, DeleteOptions, Document, Filter, FindCursor, FindOneAndUpdateOptions, FindOptions, InsertOneOptions, OptionalId, OptionalUnlessRequiredId, Sort, UpdateFilter, UpdateOptions, WithId, } from 'mongodb';
export type CollectionOptions<Doc extends Document> = {
    connection: Connection;
    name: string;
    generate?: (id?: Doc['_id']) => Doc['_id'];
    cache?: CacheOptions;
};
export declare class Collection<Doc extends Document> {
    generate: (id?: Doc['_id']) => Doc['_id'];
    name: string;
    connection: Connection;
    cache?: Cache<Doc['_id'], Doc>;
    get collection(): MongoCollection<Doc>;
    constructor(options: CollectionOptions<Doc>);
    cacheOne(doc: Doc): Doc;
    cacheMany(docs: Doc[]): Doc[];
    uncacheOne(id: Doc['_id']): boolean;
    uncacheAll(): boolean;
    aggregate<T extends Document>(pipeline?: Document[], options?: AggregateOptions): AggregationCursor<T>;
    watch<Local extends Document, Change extends Document>(pipeline?: Document[], options?: ChangeStreamOptions): ChangeStream<Local, Change>;
    find(filter: Filter<Doc>, options?: FindOptions): FindCursor<WithId<Doc>>;
    findOneById(id: Doc['_id'], cache?: boolean, options?: FindOptions): Promise<Doc>;
    findOne(filter: Filter<Doc>, options?: FindOptions): Promise<Doc>;
    queryOne(filter: Filter<Doc>, options?: FindOptions): Promise<Doc | undefined>;
    findMany(filter: Filter<Doc>, sort?: Sort, options?: FindOptions): Promise<Doc[]>;
    insertOne(doc: OptionalId<Doc>, options?: InsertOneOptions): Promise<Doc>;
    insertMany(docs: OptionalId<Doc>[], options?: BulkWriteOptions): Promise<Doc[]>;
    updateOne(filter: Filter<Doc>, values: UpdateFilter<Doc>, options?: FindOneAndUpdateOptions): Promise<Doc>;
    updateMany(filter: Filter<Doc>, update: UpdateFilter<Doc>, options?: UpdateOptions): Promise<number>;
    deleteOne(filter: Filter<Doc>, options?: DeleteOptions): Promise<void>;
    deleteMany(filter: Filter<Doc>, options?: DeleteOptions): Promise<number>;
}
export declare function generate<T>(id?: T): T;
export declare function generateObjectId(id?: ObjectId): ObjectId;
