import assert from 'node:assert'
import {
  BulkWriteOptions,
  Filter,
  FindOneAndUpdateOptions,
  InsertOneOptions,
  UpdateFilter,
  Collection,
  UpdateOptions,
  generateUUID,
} from '../src/collection.js'
import { Connection } from '../src/connection.js'
import {
  ConflictError,
  DisconnectedError,
  NotFoundError,
  TransactionError,
} from '../src/error.js'
import * as matchers from '../src/jest.js'
import { UUID, toUUID } from '../src/type.js'

expect.extend(matchers)

const { MONGO_URI } = process.env
assert(MONGO_URI !== undefined)

type Test = {
  _id: UUID
  key: string
  value?: string
  created_at: Date
  updated_at?: Date
}

class Tests extends Collection<Test> {
  async insertOne(
    doc: {
      _id?: UUID
      key: string
      value?: string
    },
    options: InsertOneOptions = {},
  ): Promise<Test> {
    return await super.insertOne({ ...doc, created_at: new Date() }, options)
  }

  async insertMany(
    values: Array<{
      key: string
      value?: string
    }>,
    options: BulkWriteOptions = {},
  ): Promise<Test[]> {
    const now = new Date()
    const docs = values.map((x) => ({ ...x, created_at: now }))
    return await super.insertMany(docs, options)
  }

  async updateOne(
    filter: Filter<Test>,
    values: UpdateFilter<Test>,
    options: FindOneAndUpdateOptions = {},
  ): Promise<Test> {
    return await super.updateOne(
      filter,
      {
        ...values,
        $currentDate: { updated_at: true },
        $setOnInsert: {
          ...(options.upsert === true ? { created_at: new Date() } : {}),
          ...values.$setOnInsert,
        },
      },
      { returnDocument: 'after', ...options },
    )
  }

  async updateMany(
    filter: Filter<Test>,
    update: UpdateFilter<Test>,
    options: UpdateOptions = {},
  ): Promise<number> {
    return await super.updateMany(
      filter,
      { ...update, $currentDate: { updated_at: true } },
      options,
    )
  }
}

const schema = {
  name: 'tests',
  validator: {
    $jsonSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['_id', 'key', 'created_at'],
      properties: {
        _id: { bsonType: 'binData' },
        key: { type: 'string' },
        value: { type: 'string' },
        created_at: { bsonType: 'date' },
        updated_at: { bsonType: 'date' },
      },
    },
  },
  indexes: {
    key_unique: { keys: { key: 1 }, options: { unique: true } },
    value_index: { keys: { value: 1 } },
  },
}

beforeAll(async () => {
  const connection = new Connection(MONGO_URI)
  await connection.connect()
  await connection.migrate({
    ...schema,
    indexes: {
      value_index: { keys: { _id: 1, value: 1 }, options: { unique: 1 } },
    },
  })
  await connection.migrate(schema)
  await connection.disconnect()
}, 30000)

describe('collection', () => {
  const connection = new Connection(MONGO_URI)
  const tests = new Tests({
    name: schema.name,
    connection,
    generate: generateUUID,
    cache: { capacity: 1024, ttl: 60_000 },
  })

  beforeAll(() => connection.connect())
  afterAll(() => connection.disconnect())

  test('transaction()', async () => {
    const value = rand()
    await connection.transaction(async (options) => {
      await tests.insertOne({ key: rand(), value }, options)
      await tests.insertOne({ key: rand(), value }, options)
    })
    expect(await tests.findMany({ value })).toHaveLength(2)
  })

  test('transaction() with ConflictError thrown', async () => {
    const key = rand()
    const value = rand()
    await expect(
      connection.transaction(async (options) => {
        await tests.insertOne({ key, value }, options)
        await tests.insertOne({ key, value }, options)
      }),
    ).rejects.toThrow(ConflictError)
    expect(await tests.findMany({ value })).toHaveLength(0)
  })

  test('transaction() with TransactionError thrown', async () => {
    const value = rand()
    await expect(
      connection.transaction(async (options) => {
        await tests.insertOne({ key: rand(), value }, options)
        await tests.insertOne({ key: rand(), value }, options)
        throw new TransactionError()
      }),
    ).rejects.toThrow(TransactionError)
    expect(await tests.findMany({ value })).toHaveLength(0)
  })

  test('insertOne()', async () => {
    const key = rand()
    const value = rand()
    const doc = await tests.insertOne({ key, value })
    expect(doc._id).toBeUUID()
    expect(doc.key).toBe(key)
    expect(doc.value).toBe(value)
    expect(doc.created_at).toBeInstanceOf(Date)
    expect(Date.now() - doc.created_at.getTime() < 1000).toBeTruthy()
    expect(doc.updated_at).toBeUndefined()
    expect(tests.cache?.has(doc._id)).toBeTruthy()
  })

  test('insertOne() with validation error thrown', async () => {
    await expect(
      tests.insertOne({ key: 123 as unknown as string }),
    ).rejects.toThrow(/Document failed validation/) // MongoServerError
  })

  test('insertOne() with ConflictError thrown', async () => {
    const key = rand()
    await tests.insertOne({ key })
    await expect(tests.insertOne({ key })).rejects.toThrow(ConflictError)
  })

  test('insertMany()', async () => {
    const value = rand()
    const docs = await tests.insertMany([
      { key: rand(), value },
      { key: rand(), value },
    ])
    for (const doc of docs) {
      expect(doc._id).toBeUUID()
      expect(doc.value).toBe(value)
      expect(doc.created_at).toBeInstanceOf(Date)
      expect(Date.now() - doc.created_at.getTime() < 1000).toBeTruthy()
      expect(doc.updated_at).toBeUndefined()
      expect(tests.cache?.has(doc._id)).toBeTruthy()
    }
    expect(docs[0].created_at.getTime()).toBe(docs[1].created_at.getTime())
  })

  test('findOne()', async () => {
    const key = rand()
    const value = rand()
    const { _id } = await tests.insertOne({ key, value })
    const found = await tests.findOne({ _id })
    expect(found._id).toEqualUUID(_id)
    expect(found.key).toBe(key)
    expect(found.value).toBe(value)

    expect(tests.cache?.has(found._id)).toBeTruthy()

    const docs = await tests.find({ _id }).toArray()
    expect(docs.length).toBe(1)
    expect(docs[0]._id).toEqualUUID(_id)

    const aggregations = await tests.aggregate([{ $match: { _id } }]).toArray()
    expect(aggregations.length).toBe(1)
    expect(aggregations[0]._id).toEqualUUID(_id)
  })

  test('findOne() with NotFound thrown', async () => {
    await expect(tests.findOne({ _id: toUUID() })).rejects.toThrow(
      NotFoundError,
    )
  })

  test('queryOne()', async () => {
    const key = rand()
    const value = rand()
    const { _id } = await tests.insertOne({ key, value })
    check(await tests.queryOne({ _id }))
    check(await tests.queryOne({ value }))

    function check(doc?: Test) {
      assert(doc !== undefined)
      expect(doc._id).toEqualUUID(_id)
      expect(doc.key).toBe(key)
      expect(doc.value).toBe(value)
      expect(tests.cache?.has(doc._id)).toBeTruthy()
    }
  })

  test('findMany()', async () => {
    const value = rand()
    const docs = await tests.insertMany([
      { key: rand(), value },
      { key: rand(), value },
    ])
    const queried = await tests.findMany({ value })
    expect(docs.length).toBe(queried.length)
    for (let i = 0; i < docs.length; ++i) {
      const d = docs[i]
      const q = queried[i]
      assert(d !== undefined && q !== undefined)
      expect(q._id).toEqualUUID(d._id)
      expect(q.value).toBe(value)
      expect(q.created_at.getTime()).toBe(d.created_at.getTime())
      expect(q.updated_at).toBeUndefined()
      expect(tests.cache?.has(d._id)).toBeTruthy()
    }
  })

  test('updateOne()', async () => {
    const { _id } = await tests.insertOne({ key: rand() })

    const key = rand()
    const updated = await tests.updateOne({ _id }, { $set: { key } })
    expect(updated._id).toEqualUUID(_id)
    expect(updated.key).toBe(key)
    expect(updated.updated_at).toBeInstanceOf(Date)
    assert(updated.updated_at !== undefined)
    expect(Date.now() - updated.updated_at.getTime() < 1000).toBeTruthy()
    expect(tests.cache?.get(updated._id)).toBe(updated)
  })

  test('updateOne() with upsert, case 1', async () => {
    const inserted = await tests.updateOne(
      { key: rand() },
      {},
      { upsert: true },
    )
    expect(inserted._id).toBeUUID()
    expect(tests.cache?.get(inserted._id)).toBe(inserted)
  })

  test('updateOne() with upsert, case 2', async () => {
    const id1 = toUUID()
    const inserted = await tests.updateOne(
      { _id: id1, key: rand() },
      {},
      { upsert: true },
    )
    expect(inserted._id).toEqualUUID(id1)
    expect(tests.cache?.get(inserted._id)).toBe(inserted)
  })

  test('updateOne() with upsert, case 3', async () => {
    const id2 = toUUID()
    const inserted = await tests.updateOne(
      { key: rand() },
      { $setOnInsert: { _id: id2 } },
      { upsert: true },
    )
    expect(inserted._id).toEqualUUID(id2)
    expect(tests.cache?.get(inserted._id)).toBe(inserted)
  })

  test('updateMany()', async () => {
    const value = rand()
    const docs = await tests.insertMany([
      { key: rand(), value },
      { key: rand(), value },
    ])

    const value2 = rand()
    const updated = await tests.updateMany(
      { value },
      { $set: { value: value2 } },
    )
    expect(updated).toBe(docs.length)
    for (const doc of docs) {
      // the old values are cached without updating
      expect(tests.cache?.get(doc._id)?.value).toBe(value)

      const updated = await tests.findOne({ _id: doc._id })
      expect(updated._id).toEqualUUID(doc._id)
      expect(updated.value).toBe(value2)
      expect(updated.created_at.getTime()).toBe(doc.created_at.getTime())
      expect(updated.updated_at).toBeInstanceOf(Date)
      assert(updated.updated_at !== undefined)
      expect(Date.now() - updated.updated_at.getTime() < 1000).toBeTruthy()
    }
  })

  test('deleteOne()', async () => {
    const { _id } = await tests.insertOne({ key: rand() })
    await tests.deleteOne({ _id })
    const deleted = await tests.queryOne({ _id })
    expect(deleted).toBeUndefined()

    // the old values are cached without invalidating
    expect(tests.cache?.has(_id)).toBeTruthy()
  })

  test('deleteMany()', async () => {
    const value = rand()
    const docs = await tests.insertMany([
      { key: rand(), value },
      { key: rand(), value },
    ])
    expect(docs).toHaveLength(2)
    await tests.deleteMany({ value })
    const deleted = await tests.findMany({ value })
    expect(deleted).toHaveLength(0)

    // the old values are cached without invalidating
    for (const { _id } of docs) {
      expect(tests.cache?.has(_id)).toBeTruthy()
    }
  })
})

describe('collection with cache', () => {
  const connection = new Connection(MONGO_URI)
  const tests = new Tests({
    name: schema.name,
    connection,
    generate: generateUUID,
    cache: { capacity: 10, ttl: 60000 },
  })

  test('findOneById() with DisconnectedError thrown', async () => {
    await connection.connect()
    const { _id } = await tests.insertOne({ key: rand() })
    await connection.disconnect()
    await expect(tests.findOne({ _id })).rejects.toThrow(DisconnectedError)
  })

  test('findOneById()', async () => {
    await connection.connect()
    const { _id } = await tests.insertOne({ key: rand() })
    await connection.disconnect()
    const cached = await tests.findOneById(_id) // find the doc from cache
    expect(cached._id).toEqualUUID(_id)
  })

  test('findOneById() without cache', async () => {
    await connection.connect()
    const { _id } = await tests.insertOne({ key: rand() })
    await connection.disconnect()
    const cached = await tests.findOneById(_id) // find the doc from cache
    expect(cached._id).toEqualUUID(_id)
    // without cache so got DisconnectedError
    await expect(tests.findOneById(_id, false)).rejects.toThrow(
      DisconnectedError,
    )
  })
})

function rand(): string {
  return String(toUUID())
}
