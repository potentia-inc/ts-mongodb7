import assert from 'node:assert'
import { Cache, Options as CacheOptions } from './cache.js'
import { Connection, isDuplicationError } from './connection.js'
import { ConflictError, NotFoundError, UnacknowledgedError } from './error.js'
import {
  AggregateOptions,
  AggregationCursor,
  BulkWriteOptions,
  ChangeStream,
  ChangeStreamOptions,
  Collection as MongoCollection,
  DeleteOptions,
  Document,
  Filter,
  FindCursor,
  FindOneAndUpdateOptions,
  FindOptions,
  InsertOneOptions,
  OptionalId,
  OptionalUnlessRequiredId,
  Sort,
  UpdateFilter,
  UpdateOptions,
  WithId,
} from './mongo.js'
import { ObjectId, toObjectId } from './type.js'
import { isNil } from './util.js'

export { generateUUID, generateUUID as generateUuid } from './core.js'

// XXX deprecated, use @mongodb6/type instead
export {
  AggregateOptions,
  AggregationCursor,
  BulkWriteOptions,
  ChangeStream,
  ChangeStreamOptions,
  Collection as MongoCollection,
  CommandOperationOptions,
  DeleteOptions,
  Document,
  Filter,
  FindCursor,
  FindOneAndUpdateOptions,
  FindOptions,
  InsertOneOptions,
  OptionalId,
  OptionalUnlessRequiredId,
  Sort,
  UpdateFilter,
  UpdateOptions,
  WithId,
} from 'mongodb'

export type CollectionOptions<Doc extends Document> = {
  connection: Connection
  name: string
  generate?: (id?: Doc['_id']) => Doc['_id']
  cache?: CacheOptions
}

export class Collection<Doc extends Document> {
  generate: (id?: Doc['_id']) => Doc['_id']
  name: string
  connection: Connection
  cache?: Cache<Doc['_id'], Doc>

  get collection(): MongoCollection<Doc> {
    return this.connection.db.collection<Doc>(this.name)
  }

  constructor(options: CollectionOptions<Doc>) {
    this.connection = options.connection
    this.name = options.name
    this.generate = options.generate ?? generate
    if (!isNil(options.cache))
      this.cache = new Cache<Doc['_id'], Doc>(options.cache)
  }

  cacheOne(doc: Doc): Doc {
    this.cache?.set(doc._id, doc)
    return doc
  }

  cacheMany(docs: Doc[]): Doc[] {
    docs.forEach((doc) => this.cacheOne(doc))
    return docs
  }

  uncacheOne(id: Doc['_id']): boolean {
    return this.cache?.delete(id) ?? false
  }

  uncacheAll(): boolean {
    if ((this.cache?.size ?? 0) === 0) return false
    this.cache?.clear()
    return true
  }

  aggregate<T extends Document>(
    pipeline: Document[] = [],
    options: AggregateOptions = {},
  ): AggregationCursor<T> {
    return this.collection.aggregate(pipeline, options)
  }

  watch<Local extends Document, Change extends Document>(
    pipeline: Document[] = [],
    options: ChangeStreamOptions = {},
  ): ChangeStream<Local, Change> {
    return this.collection.watch(pipeline, options)
  }

  find(
    filter: Filter<Doc>,
    options: FindOptions = {},
  ): FindCursor<WithId<Doc>> {
    return this.collection.find(filter, options)
  }

  async findOneById(
    id: Doc['_id'],
    cache = true,
    options: FindOptions = {},
  ): Promise<Doc> {
    return (
      (cache ? this.cache?.get(id) : undefined) ??
      (await this.findOne({ _id: id }, options))
    )
  }

  async findOne(filter: Filter<Doc>, options: FindOptions = {}): Promise<Doc> {
    const doc = await this.collection.findOne(filter, options)
    if (isNil(doc)) throw new NotFoundError(`Not Found: ${this.name}`)
    return this.cacheOne(doc as Doc)
  }

  async queryOne(
    filter: Filter<Doc>,
    options: FindOptions = {},
  ): Promise<Doc | undefined> {
    const doc = await this.collection.findOne(filter, options)
    if (isNil(doc)) return undefined
    return this.cacheOne(doc as Doc)
  }

  async findMany(
    filter: Filter<Doc>,
    sort: Sort = {},
    options: FindOptions = {},
  ): Promise<Doc[]> {
    const found = (await this.collection
      .find(filter, options)
      .sort(sort)
      .toArray()) as Doc[]
    return this.cacheMany(found as Doc[])
  }

  async insertOne(
    doc: OptionalId<Doc>,
    options: InsertOneOptions = {},
  ): Promise<Doc> {
    try {
      const created = {
        ...doc,
        _id: this.generate(doc._id as Doc['_id'] | undefined),
      }
      const { acknowledged } = await this.collection.insertOne(
        created as OptionalUnlessRequiredId<Doc>,
        options,
      )
      if (acknowledged) return this.cacheOne(created as Doc)
    } catch (err) {
      throw isDuplicationError(err)
        ? new ConflictError(`Conflict: ${this.name}`)
        : err
    }
    throw new UnacknowledgedError()
  }

  async insertMany(
    docs: OptionalId<Doc>[],
    options: BulkWriteOptions = {},
  ): Promise<Doc[]> {
    if (docs.length === 0) return []
    try {
      const created = docs.map((x) => ({
        ...x,
        _id: this.generate(x._id as Doc['_id'] | undefined),
      }))
      const { acknowledged } = await this.collection.insertMany(
        created as OptionalUnlessRequiredId<Doc>[],
        options,
      )
      if (acknowledged) return this.cacheMany(created as Doc[])
    } catch (err) {
      throw isDuplicationError(err)
        ? new ConflictError(`Conflict: ${this.name}`)
        : err
    }
    throw new UnacknowledgedError()
  }

  async updateOne(
    filter: Filter<Doc>,
    values: UpdateFilter<Doc>,
    options: FindOneAndUpdateOptions = {},
  ): Promise<Doc> {
    const update = (() => {
      if (
        options.upsert !== true ||
        !isNil(filter._id) ||
        !isNil(values.$setOnInsert?._id)
      ) {
        return values
      }
      if (!isNil(values.$setOnInsert)) {
        return {
          ...values,
          $setOnInsert: { ...values.$setOnInsert, _id: this.generate() },
        }
      }
      return { ...values, $setOnInsert: { _id: this.generate() } }
    })() as UpdateFilter<Doc>
    const updated = await this.collection.findOneAndUpdate(filter, update, {
      returnDocument: 'after',
      ...options,
    })
    if (!isNil(updated)) return this.cacheOne(updated as Doc)
    throw new NotFoundError(`Not Found: ${this.name}`)
  }

  async updateMany(
    filter: Filter<Doc>,
    update: UpdateFilter<Doc>,
    options: UpdateOptions = {},
  ): Promise<number> {
    const { modifiedCount } = await this.collection.updateMany(
      filter,
      update,
      options,
    )
    return modifiedCount
  }

  async deleteOne(
    filter: Filter<Doc>,
    options: DeleteOptions = {},
  ): Promise<void> {
    const { deletedCount } = await this.collection.deleteOne(filter, options)
    if (deletedCount !== 1) throw new NotFoundError(`Not Found: ${this.name}`)
  }

  async deleteMany(
    filter: Filter<Doc>,
    options: DeleteOptions = {},
  ): Promise<number> {
    const { deletedCount } = await this.collection.deleteMany(filter, options)
    return deletedCount
  }
}

export function generate<T>(id?: T): T {
  assert(!isNil(id))
  return id
}

export function generateObjectId(id?: ObjectId): ObjectId {
  return id ?? toObjectId()
}
