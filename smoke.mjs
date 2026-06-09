// Framework-free cross-runtime smoke test. Uses only node:assert and top-level
// await (no describe/test), so it runs identically on Node, Bun and Deno —
// unlike the node:test suite, which Bun cannot run (oven-sh/bun#5090).
//
// Exercises the built artifact (dist): the type coercions, the prototype
// patches (Symbol.toPrimitive / inspect), the Cache, the framework-agnostic
// matchers, and — when MONGO_URI is set — a full Connection/Collection round
// trip against a live MongoDB.
//
//   node smoke.mjs   |   bun smoke.mjs   |   deno run -A smoke.mjs
import assert from 'node:assert/strict'
import {
  Binary,
  Cache,
  Collection,
  Connection,
  Decimal128,
  NotFoundError,
  ObjectId,
  UUID,
  generateUUID,
  toBinary,
  toDecimal128,
  toObjectId,
  toUUID,
} from './dist/src/index.js'
import * as matchers from './dist/src/matcher/core.js'

const runtime =
  typeof globalThis.Bun !== 'undefined'
    ? 'bun'
    : typeof globalThis.Deno !== 'undefined'
      ? 'deno'
      : 'node'

// types / coercions
assert.ok(toUUID('60456314-8bf5-48a1-b51b-726037a6e8b9') instanceof UUID)
assert.ok(toObjectId('658e77fb9d2dd4679b004398') instanceof ObjectId)
assert.ok(toBinary('foobar') instanceof Binary)
assert.ok(toDecimal128('123.45') instanceof Decimal128)
assert.throws(() => toDecimal128('foobar'))

// toX() is strict: null/undefined throws (use new UUID()/new ObjectId() to
// mint a fresh id, or toXOrNil() to tolerate nullish)
assert.throws(() => toUUID(), TypeError)
assert.throws(() => toObjectId(null), TypeError)
assert.throws(() => toBinary(undefined), TypeError)
assert.ok(new UUID() instanceof UUID)
assert.ok(new ObjectId() instanceof ObjectId)

// a plain Uint8Array is accepted as raw bytes on every runtime
const bytes = new Uint8Array([104, 105])
assert.deepEqual([...toBinary(bytes).value()], [104, 105])
assert.ok(toUUID(new Uint8Array(new UUID().buffer)) instanceof UUID)

// prototype patches: Symbol.toPrimitive / JSON serialization
assert.equal(`${toDecimal128('1.5')}`, '1.5')
assert.equal(JSON.stringify({ d: toDecimal128('1.5') }), '{"d":"1.5"}')
const uuid = toUUID('60456314-8bf5-48a1-b51b-726037a6e8b9')
assert.equal(`${uuid}`, '60456314-8bf5-48a1-b51b-726037a6e8b9')

// Cache
const cache = new Cache({ capacity: 2 })
cache.set('a', 1)
cache.set('b', 2)
assert.equal(cache.get('a'), 1)
cache.set('c', 3) // evicts 'a' (least recently inserted)
assert.equal(cache.has('a'), false)
assert.equal(cache.size, 2)
cache.clear()
assert.equal(cache.size, 0)

// framework-agnostic matchers via a minimal jest-compatible context
const ctx = {
  isNot: false,
  promise: '',
  utils: {
    matcherHint: () => '',
    printReceived: (v) => String(v),
    printExpected: (v) => String(v),
  },
}
const id = new UUID()
assert.equal(matchers.toBeUUID.call(ctx, id).pass, true)
assert.equal(matchers.toEqualUUID.call(ctx, id, id.toString()).pass, true)
assert.equal(matchers.toBeDecimal128.call(ctx, toDecimal128('1')).pass, true)

// Connection / Collection — only when a live MongoDB is reachable
const { MONGO_URI } = globalThis.process?.env ?? {}
if (MONGO_URI) {
  const connection = new Connection(MONGO_URI)
  await connection.connect()
  const name = `smoke_${runtime}_${Date.now()}`
  try {
    await connection.migrate({
      name,
      indexes: {
        key_unique: { keys: { key: 1 }, options: { unique: true } },
      },
    })

    const coll = new Collection({
      name,
      connection,
      generate: generateUUID,
      cache: { capacity: 100, ttl: 60_000 },
    })

    // insert + generated UUID _id + cache
    const doc = await coll.insertOne({ key: String(new UUID()), value: 1 })
    assert.ok(doc._id instanceof UUID)
    assert.equal(coll.cache.has(doc._id), true)

    // findOne / findOneById (from cache)
    const found = await coll.findOne({ _id: doc._id })
    assert.ok(found._id.equals(doc._id))
    assert.equal(found.key, doc.key)

    // NotFoundError
    await assert.rejects(coll.findOne({ _id: new UUID() }), NotFoundError)

    // transaction
    const value = String(new UUID())
    await connection.transaction(async (options) => {
      await coll.insertOne({ key: String(new UUID()), value }, options)
      await coll.insertOne({ key: String(new UUID()), value }, options)
    })
    assert.equal((await coll.findMany({ value })).length, 2)

    // update
    const updated = await coll.updateOne(
      { _id: doc._id },
      { $set: { value: 2 } },
    )
    assert.equal(updated.value, 2)

    // delete
    await coll.deleteOne({ _id: doc._id })
    assert.equal(await coll.queryOne({ _id: doc._id }), undefined)
  } finally {
    await connection.db.dropCollection(name).catch(() => {})
    await connection.disconnect()
  }
  console.log(`SMOKE OK (${runtime}, with MongoDB)`)
} else {
  console.log(`SMOKE OK (${runtime}, no MONGO_URI — DB round trip skipped)`)
}
