import { strict as assert } from 'node:assert'
import { after, before, describe, test } from 'node:test'
import {
  Collection,
  generate,
  generateObjectId,
  generateUUID,
} from '../src/collection.js'
import type {
  BulkWriteOptions,
  Filter,
  FindOneAndUpdateOptions,
  InsertOneOptions,
  UpdateFilter,
  UpdateOptions,
} from '../src/mongo.js'
import { Connection } from '../src/connection.js'
import {
  ConflictError,
  DisconnectedError,
  NotFoundError,
  TransactionError,
  UnacknowledgedError,
} from '../src/error.js'
import { ObjectId, UUID } from '../src/type.js'

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

before(
  async () => {
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
  },
  { timeout: 30000 },
)

describe('collection', () => {
  const connection = new Connection(MONGO_URI)
  const tests = new Tests({
    name: schema.name,
    connection,
    generate: generateUUID,
    cache: { capacity: 1024, ttl: 60_000 },
  })

  before(() => connection.connect())
  after(() => connection.disconnect())

  test('transaction()', async () => {
    const value = rand()
    await connection.transaction(async (options) => {
      await tests.insertOne({ key: rand(), value }, options)
      await tests.insertOne({ key: rand(), value }, options)
    })
    assert.equal((await tests.findMany({ value })).length, 2)
  })

  test('transaction() with ConflictError thrown', async () => {
    const key = rand()
    const value = rand()
    await assert.rejects(
      connection.transaction(async (options) => {
        await tests.insertOne({ key, value }, options)
        await tests.insertOne({ key, value }, options)
      }),
      ConflictError,
    )
    assert.equal((await tests.findMany({ value })).length, 0)
  })

  test('transaction() with TransactionError thrown', async () => {
    const value = rand()
    await assert.rejects(
      connection.transaction(async (options) => {
        await tests.insertOne({ key: rand(), value }, options)
        await tests.insertOne({ key: rand(), value }, options)
        throw new TransactionError()
      }),
      TransactionError,
    )
    assert.equal((await tests.findMany({ value })).length, 0)
  })

  test('insertOne()', async () => {
    const key = rand()
    const value = rand()
    const doc = await tests.insertOne({ key, value })
    assert.ok(doc._id instanceof UUID)
    assert.equal(doc.key, key)
    assert.equal(doc.value, value)
    assert.ok(doc.created_at instanceof Date)
    assert.ok(Date.now() - doc.created_at.getTime() < 1000)
    assert.equal(doc.updated_at, undefined)
    assert.ok(tests.cache?.has(doc._id))
  })

  test('insertOne() with validation error thrown', async () => {
    await assert.rejects(
      tests.insertOne({ key: 123 as unknown as string }),
      /Document failed validation/, // MongoServerError
    )
  })

  test('insertOne() with ConflictError thrown', async () => {
    const key = rand()
    await tests.insertOne({ key })
    await assert.rejects(tests.insertOne({ key }), ConflictError)
  })

  test('insertMany()', async () => {
    const value = rand()
    const docs = await tests.insertMany([
      { key: rand(), value },
      { key: rand(), value },
    ])
    for (const doc of docs) {
      assert.ok(doc._id instanceof UUID)
      assert.equal(doc.value, value)
      assert.ok(doc.created_at instanceof Date)
      assert.ok(Date.now() - doc.created_at.getTime() < 1000)
      assert.equal(doc.updated_at, undefined)
      assert.ok(tests.cache?.has(doc._id))
    }
    assert.equal(docs[0].created_at.getTime(), docs[1].created_at.getTime())
  })

  test('findOne()', async () => {
    const key = rand()
    const value = rand()
    const { _id } = await tests.insertOne({ key, value })
    const found = await tests.findOne({ _id })
    assert.ok(found._id.equals(_id))
    assert.equal(found.key, key)
    assert.equal(found.value, value)

    assert.ok(tests.cache?.has(found._id))

    const docs = await tests.find({ _id }).toArray()
    assert.equal(docs.length, 1)
    assert.ok(docs[0]._id.equals(_id))

    const aggregations = await tests.aggregate([{ $match: { _id } }]).toArray()
    assert.equal(aggregations.length, 1)
    assert.ok((aggregations[0]._id as UUID).equals(_id))
  })

  test('findOne() with NotFound thrown', async () => {
    await assert.rejects(tests.findOne({ _id: new UUID() }), NotFoundError)
  })

  test('queryOne()', async () => {
    const key = rand()
    const value = rand()
    const { _id } = await tests.insertOne({ key, value })
    check(await tests.queryOne({ _id }))
    check(await tests.queryOne({ value }))

    function check(doc?: Test) {
      assert(doc !== undefined)
      assert.ok(doc._id.equals(_id))
      assert.equal(doc.key, key)
      assert.equal(doc.value, value)
      assert.ok(tests.cache?.has(doc._id))
    }
  })

  test('findMany()', async () => {
    const value = rand()
    const docs = await tests.insertMany([
      { key: rand(), value },
      { key: rand(), value },
    ])
    const queried = await tests.findMany({ value })
    assert.equal(docs.length, queried.length)
    for (let i = 0; i < docs.length; ++i) {
      const d = docs[i]
      const q = queried[i]
      assert(d !== undefined && q !== undefined)
      assert.ok(q._id.equals(d._id))
      assert.equal(q.value, value)
      assert.equal(q.created_at.getTime(), d.created_at.getTime())
      assert.equal(q.updated_at, undefined)
      assert.ok(tests.cache?.has(d._id))
    }
  })

  test('updateOne()', async () => {
    const { _id } = await tests.insertOne({ key: rand() })

    const key = rand()
    const updated = await tests.updateOne({ _id }, { $set: { key } })
    assert.ok(updated._id.equals(_id))
    assert.equal(updated.key, key)
    assert.ok(updated.updated_at instanceof Date)
    assert(updated.updated_at !== undefined)
    assert.ok(Date.now() - updated.updated_at.getTime() < 1000)
    assert.equal(tests.cache?.get(updated._id), updated)
  })

  test('updateOne() with upsert, case 1', async () => {
    const inserted = await tests.updateOne(
      { key: rand() },
      {},
      { upsert: true },
    )
    assert.ok(inserted._id instanceof UUID)
    assert.equal(tests.cache?.get(inserted._id), inserted)
  })

  test('updateOne() with upsert, case 2', async () => {
    const id1 = new UUID()
    const inserted = await tests.updateOne(
      { _id: id1, key: rand() },
      {},
      { upsert: true },
    )
    assert.ok(inserted._id.equals(id1))
    assert.equal(tests.cache?.get(inserted._id), inserted)
  })

  test('updateOne() with upsert, case 3', async () => {
    const id2 = new UUID()
    const inserted = await tests.updateOne(
      { key: rand() },
      { $setOnInsert: { _id: id2 } },
      { upsert: true },
    )
    assert.ok(inserted._id.equals(id2))
    assert.equal(tests.cache?.get(inserted._id), inserted)
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
    assert.equal(updated, docs.length)
    for (const doc of docs) {
      // the old values are cached without updating
      assert.equal(tests.cache?.get(doc._id)?.value, value)

      const updated = await tests.findOne({ _id: doc._id })
      assert.ok(updated._id.equals(doc._id))
      assert.equal(updated.value, value2)
      assert.equal(updated.created_at.getTime(), doc.created_at.getTime())
      assert.ok(updated.updated_at instanceof Date)
      assert(updated.updated_at !== undefined)
      assert.ok(Date.now() - updated.updated_at.getTime() < 1000)
    }
  })

  test('deleteOne()', async () => {
    const { _id } = await tests.insertOne({ key: rand() })
    await tests.deleteOne({ _id })
    const deleted = await tests.queryOne({ _id })
    assert.equal(deleted, undefined)

    // the old values are cached without invalidating
    assert.ok(tests.cache?.has(_id))
  })

  test('deleteMany()', async () => {
    const value = rand()
    const docs = await tests.insertMany([
      { key: rand(), value },
      { key: rand(), value },
    ])
    assert.equal(docs.length, 2)
    await tests.deleteMany({ value })
    const deleted = await tests.findMany({ value })
    assert.equal(deleted.length, 0)

    // the old values are cached without invalidating
    for (const { _id } of docs) {
      assert.ok(tests.cache?.has(_id))
    }
  })

  test('uncacheOne() and uncacheAll()', async () => {
    const { _id } = await tests.insertOne({ key: rand() })
    assert.ok(tests.cache?.has(_id))
    assert.equal(tests.uncacheOne(_id), true) // removed
    assert.equal(tests.uncacheOne(_id), false) // already gone
    assert.ok(!tests.cache?.has(_id))

    await tests.insertOne({ key: rand() })
    assert.ok((tests.cache?.size ?? 0) > 0)
    assert.equal(tests.uncacheAll(), true)
    assert.equal(tests.cache?.size, 0)
    assert.equal(tests.uncacheAll(), false) // already empty
  })

  test('insertMany() with ConflictError thrown', async () => {
    const key = rand()
    await assert.rejects(
      tests.insertMany([{ key }, { key }]), // duplicate unique key
      ConflictError,
    )
  })

  test('insertOne()/insertMany() throw UnacknowledgedError (w: 0)', async () => {
    await assert.rejects(
      tests.insertOne({ key: rand() }, { writeConcern: { w: 0 } }),
      UnacknowledgedError,
    )
    await assert.rejects(
      tests.insertMany([{ key: rand() }], { writeConcern: { w: 0 } }),
      UnacknowledgedError,
    )
  })

  test('updateOne() with NotFound thrown', async () => {
    await assert.rejects(
      tests.updateOne({ _id: new UUID() }, { $set: { key: rand() } }),
      NotFoundError,
    )
  })

  test('updateOne() upsert generates _id when no $setOnInsert is given', async () => {
    // a bare Collection (no Tests overrides) passes values without a
    // $setOnInsert, exercising the generated-_id branch
    const plain = new Collection<{ _id: UUID; key: string }>({
      name: 'plain',
      connection,
      generate: generateUUID,
    })
    const key = rand()
    const doc = await plain.updateOne(
      { key },
      { $set: { key } },
      { upsert: true },
    )
    assert.ok(doc._id instanceof UUID)
    await plain.deleteOne({ _id: doc._id })
  })

  test('watch() returns a change stream', async () => {
    const stream = tests.watch()
    assert.ok(stream)
    await stream.close()
  })
})

describe('generate helpers', () => {
  test('generate() returns the id or asserts it is present', () => {
    assert.equal(generate(5), 5)
    assert.throws(() => generate())
  })

  test('generateObjectId() mints a new id or passes one through', () => {
    assert.ok(generateObjectId() instanceof ObjectId)
    const oid = new ObjectId()
    assert.equal(generateObjectId(oid), oid)
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
    await assert.rejects(tests.findOne({ _id }), DisconnectedError)
  })

  test('findOneById()', async () => {
    await connection.connect()
    const { _id } = await tests.insertOne({ key: rand() })
    await connection.disconnect()
    const cached = await tests.findOneById(_id) // find the doc from cache
    assert.ok(cached._id.equals(_id))
  })

  test('findOneById() without cache', async () => {
    await connection.connect()
    const { _id } = await tests.insertOne({ key: rand() })
    await connection.disconnect()
    const cached = await tests.findOneById(_id) // find the doc from cache
    assert.ok(cached._id.equals(_id))
    // without cache so got DisconnectedError
    await assert.rejects(tests.findOneById(_id, false), DisconnectedError)
  })
})

describe('connection', () => {
  test('client getter throws DisconnectedError before connect()', () => {
    const conn = new Connection(MONGO_URI)
    assert.throws(() => conn.client, DisconnectedError)
  })

  test('concurrent connect() settles on a single client', async () => {
    const conn = new Connection(MONGO_URI)
    // both calls pass the "not connected yet" guard before either resolves, so
    // two clients are opened and the redundant one is closed
    const [a, b] = await Promise.all([conn.connect(), conn.connect()])
    assert.equal(a, b)
    assert.equal(conn.client, a)
    await conn.disconnect()
    // disconnect() is idempotent
    await conn.disconnect()
  })
})

function rand(): string {
  return String(new UUID())
}
