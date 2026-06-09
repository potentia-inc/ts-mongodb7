# @potentia/mongodb7

Cross-runtime utilities for
[mongodb](https://github.com/mongodb/node-mongodb-native) `^7.0.0`, running on
Node.js, [Bun](https://bun.sh) and [Deno](https://deno.com).

- [types](#types): coercions for `Binary`, `Buffer`, `Decimal128`, `UUID` and
  `ObjectId`
- [matchers](#matchers): [jest](https://jestjs.io),
  [bun:test](https://bun.sh/docs/cli/test) and [vitest](https://vitest.dev)
  matchers for the types
- [connection](#connection): `MongoClient` wrapper for connection management
- [collection](#collection): mongodb `Collection` wrapper for CRUD operations
- [cache](#cache): a small in-memory TTL + LRU cache (used by `Collection`)
- [error](#error): error classes for db operations

## Runtime support

Works on **Node.js (>= 24)**, **Bun** and **Deno (>= 2)**. The published package
ships compiled JavaScript plus type declarations, and is pure ESM.

`mongodb` and [bignumber.js](https://github.com/MikeMcl/bignumber.js) are peer
dependencies — install them in your own project. `bignumber.js` is only needed
for the matchers. The `./matcher/jest`, `./matcher/bun` and `./matcher/vitest`
entry points additionally require the corresponding test framework, but the rest
of the package does not depend on any of them.

```sh
npm install @potentia/mongodb7 mongodb bignumber.js
# or: bun add @potentia/mongodb7 mongodb bignumber.js
# or: deno add npm:@potentia/mongodb7 npm:mongodb npm:bignumber.js
```

> **Breaking changes in 2.0.0:**
>
> - The matcher entry point moved from `@potentia/mongodb7/jest` to
>   `@potentia/mongodb7/matcher/jest`, and bun:test and vitest matchers were
>   added at `@potentia/mongodb7/matcher/{bun,vitest}`. Each matcher now also
>   accepts the expected value directly — `toBeUUID(id)` is identical to
>   `toEqualUUID(id)`.
> - The `toX()` coercions are now **strict**: they throw on `null`/`undefined`.
>   In particular `toUUID()` / `toObjectId()` no longer mint a new id — use
>   `new UUID()` / `new ObjectId()` for that, or `toXOrNil()` to tolerate nullish
>   input.

## Types

Coercions for `Binary`, `Buffer`, `Decimal128`, `UUID` and `ObjectId`. Every
`toX()` is **strict** — it throws on `null`/`undefined` or any un-coercible
value (it never silently generates or fabricates a value). The `toXOrNil()`
variant returns `undefined` for `null`/`undefined`, but still throws on an
invalid value. To mint a new id, construct one directly with `new UUID()` /
`new ObjectId()`.

```typescript
import {
  Binary,
  Decimal128,
  ObjectId,
  UUID,
  Uuid, // alias of UUID
  toBinary,
  toBinaryOrNil,
  toBuffer,
  toBufferOrNil,
  toDecimal128,
  toDecimal128OrNil,
  toObjectId,
  toObjectIdOrNil,
  toUUID,
  toUuid, // alias of toUUID
  toUUIDOrNil,
  toUuidOrNil, // alias of toUUIDOrNil
} from '@potentia/mongodb7'
// or import { toBinary, ... } from '@potentia/mongodb7/type'

// note: all other mongodb symbols are re-exported from '@potentia/mongodb7/mongo'

toBinary('foobar') // create a new Binary from the given base64-encoded string
toBinary(Buffer.from('foobar', 'base64')) // create a new Binary from the given Buffer
toBinary(new Uint8Array([1, 2, 3])) // create a new Binary from raw bytes
toBinaryOrNil() // undefined

toBuffer('Zm9vYmFy') // decode a base64 string to a Buffer
toBuffer(new Uint8Array([1, 2, 3])) // copy the raw bytes into a Buffer
toBuffer(toBinary('foobar')) // the bytes of a Binary
toBufferOrNil() // undefined
// note: toBuffer() tries each encoding in BUFFER_ENCODINGS in order
//       (base64, base64url, hex, then the text encodings)

toDecimal128('123.45') // 123.45
toDecimal128(Infinity) // infinity
toDecimal128(-Infinity) // -infinity
toDecimal128(NaN) // NaN
toDecimal128('foobar') // Error thrown
toDecimal128() // Error thrown
toDecimal128OrNil() // undefined

const uuid = 'f4653fea-ef09-4e84-b3c8-9bc66d99b5bb'
toUUID(uuid) // create a new UUID from the given string representation
toUUID('foobar') // Error thrown
toUUID() // Error thrown (use `new UUID()` to mint a new UUID)
toUUIDOrNil() // undefined
toUuid(uuid) // toUuid/toUuidOrNil are aliases of toUUID/toUUIDOrNil

const objectid = '658cd87dcad575d87adc87bc'
toObjectId(objectid) // create a new ObjectId from the given string representation
toObjectId('foobar') // Error thrown
toObjectId() // Error thrown (use `new ObjectId()` to mint a new ObjectId)
toObjectIdOrNil() // undefined
```

`new UUID()` mints a random **version 4** UUID. If you need a specific UUID
version (v1, v5, v7, …), generate it with a dedicated package such as
[`uuid`](https://www.npmjs.com/package/uuid) and pass the string to `toUUID()`:

```typescript
import { v7 as uuidv7 } from 'uuid'

toUUID(uuidv7()) // a time-ordered (version 7) UUID
```

`toBinary`, `toBuffer`, `toUUID` and `toObjectId` accept a plain `Uint8Array`
(e.g. from Web Crypto or `fetch().bytes()`) as raw bytes, not just a Node
`Buffer` — the results are still `Buffer`/`Binary` (a `Buffer` is itself a
`Uint8Array`), and `toBuffer` remains the portable base64/hex/utf8 codec across
Node, Bun and Deno.

## Matchers

Custom matchers for `Binary`, `Buffer`, `Decimal128`, `ObjectId` and `UUID`,
available for jest, bun:test and vitest. The implementation is shared; only the
import path differs.

Each matcher checks the **type** when called with no argument, or the type
**and value** when given one (the expected value is coerced automatically, e.g.
with `toBinary`/`toUUID`). `toBe*` and `toEqual*` are the same matcher under two
names — use `toBe*` throughout, or follow the jest convention (`toBe*` for the
type, `toEqual*` for equality).

`ObjectId` and `UUID` additionally have `*String` matchers that check the string
form, `Decimal128` has `toBeDecimal128NaN()` (since `NaN` never equals `NaN`),
and every `UUID` matcher has a `Uuid` alias (`toBeUuid`, `toEqualUuid`,
`toBeUuidString`, `toEqualUuidString`).

```typescript
// jest:   import * as matchers from '@potentia/mongodb7/matcher/jest'
// bun:    import * as matchers from '@potentia/mongodb7/matcher/bun'
// vitest: import * as matchers from '@potentia/mongodb7/matcher/vitest'
import * as matchers from '@potentia/mongodb7/matcher/jest'
expect.extend(matchers)

// Binary
const bytes = new Uint8Array([1, 2, 3])
expect(toBinary('foobar')).toBeBinary() // type
expect('foobar').not.toBeBinary()
expect(toBinary('foobar')).toBeBinary('foobar') // type and value, via toBe
expect(toBinary('foobar')).toEqualBinary('foobar') // same, jest-style
expect(toBinary('foobar')).toEqualBinary(Buffer.from('foobar', 'base64'))
expect(toBinary(bytes)).toEqualBinary(bytes) // raw Uint8Array bytes

// Buffer
expect(toBuffer('foobar')).toBeBuffer() // type
expect('foobar').not.toBeBuffer()
expect(toBuffer('foobar')).toBeBuffer('foobar') // type and value
expect(toBuffer('foobar')).toEqualBuffer('foobar')

// Decimal128
expect(toDecimal128('123.45')).toBeDecimal128() // type
expect(toDecimal128('123.45')).toBeDecimal128(123.45) // type and value
expect(toDecimal128('123.45')).toEqualDecimal128('123.45')
expect(toDecimal128(Infinity)).toEqualDecimal128(Infinity)
expect(toDecimal128(-Infinity)).toEqualDecimal128(-Infinity)
expect(toDecimal128(NaN)).toBeDecimal128NaN()
expect(toDecimal128(NaN)).not.toEqualDecimal128(NaN) // NaN never equals NaN

// ObjectId
const objectId = new ObjectId()
expect(objectId).toBeObjectId() // type
expect('foobar').not.toBeObjectId()
expect(objectId).toBeObjectId(objectId) // type and value
expect(objectId).toEqualObjectId(objectId.toString())
expect(objectId).not.toEqualObjectId(new ObjectId())
expect(objectId.toString()).toBeObjectIdString() // a valid ObjectId string
expect(objectId.toString()).toEqualObjectIdString(objectId)

// UUID (with toBeUuid / toEqualUuid / *Uuid* aliases)
const uuid = new UUID()
expect(uuid).toBeUUID() // type
expect('foobar').not.toBeUUID()
expect(uuid).toBeUUID(uuid) // type and value
expect(uuid).toEqualUUID(uuid.toString())
expect(uuid).not.toEqualUUID(new UUID())
expect(uuid.toString()).toBeUUIDString() // a valid UUID string
expect(uuid.toString()).toEqualUUIDString(uuid)
expect(uuid).toBeUuid(uuid) // alias of toBeUUID
```

## Connection

`MongoClient` wrapper for connection management

```typescript
import { Connection } from '@potentia/mongodb7'
// or import { Connection } from '@potentia/mongodb7/connection'

const connection = new Connection(
  'mongodb://...',
  { /* other MongoClient options */ },
)
await connection.connect() // connect to the mongodb
await connection.disconnect() // disconnect to the mongodb
await connection.transaction(async (options) => {
  // ClientSession object is included in options
  // to db operations here with options
})
await connection.migrate({
  name: 'collections',
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      additionalProperties: false,
      required: ['_id', 'key'],
      properties: {
        _id: { type: 'binData' },
        key: { type: 'string' },
        value: { type: 'number' },
      },
    },
  },
  indexes: {
    key_unique: { keys: { key: 1 }, options: { unique: true } },
    value_index: { keys: { value: 1 } },
  },
})

// you can get the mongodb MongoClient object to do low-level operations
connection.client // get the mongodb MongoClient object
connection.client.startSession() // start a new ClientSession

// you can get the mongodb Db object to do low-level operations
connection.db // get the mongodb Db object
connection.db.collections() // get all collections
```

## Collection

Mongodb `Collection` wrapper for CRUD operations

```typescript
import { Connection, ObjectId, UUID } from '@potentia/mongodb7'
import { Collection, generateUUID } from '@potentia/mongodb7'
// or import { Collection, generateUUID } from '@potentia/mongodb7/collection'

// a connection can be shared for all collections
const connection = new Connection('mongodb://...')
await connection.connect()

// example for _id is of type number
type Foo = {
  _id: number
  key: string
  value?: number
}
const foos = new Collection<Foo>({
  name: 'foos', // mongodb collection name
  connection,
  cache: { // optional cache options
    capacity: 100, // cache at most 100 items
    ttl: 60000, // time-to-live in milliseconds for cached items,
                // default to infinity if unspecified
  },
})
// insert a new doc, the _id should be specified explicitly
await foos.insertOne({ _id: 0, key: 'foo0', value: 234 })
await foos.insertMany([
  { _id: 1, key: 'foo1', value: 345 },
  { _id: 2, key: 'foo2', value: 456 },
  ...
])
await foos.findOneById(...) // get a doc by ID or throw NotFoundError
await foos.findOne({ ... }) // get a doc or throw NotFoundError
await foos.findMany({ ... }, { key: 1 }) // get docs sorted by key ascendingly
await foos.queryOne({ ... }) // get a doc or undefined
await foos.updateOne({ ... }, { ... }) // update a doc or throw NotFoundError
await foos.updateMany({ ... }, { ... }) // update docs
await foos.deleteOne({ ... })) // delete a doc or throw NotFoundError
await foos.deleteMany({ ... }) // delete docs
await foos.aggregate([...]) // aggregate operation
await foos.watch([...]) // watch operation

// cache handling (effective if cache is enabled)
await foos.cacheOne(document) // cache a document
await foos.cacheMany(documents) // cache documents
await foos.uncacheOne(id) // invalidate the cache if exists
await foos.uncacheAll() // invalidate all cache

/*
Note about the cache:
  - findOneById() will try to load the docuement from the cache if possible.
    You can still disable the cache by providing the second argument as false:

      findOneById(id, false, options) // load the document from db forcibly

  - queryOne(), findOne(), and findMany() will NOT load the document from the cache,
    but the loaded documents will be cached automatically if the cache is enabled.

  - insertOne(), insertMany(), and updateOne() will cache the inserted/updated
    document automatically if cache is enabled.

  - For updateMany(), deleteOne(), and deleteMany(), you should handle the cache manually.
*/

// you can also get the mongodb Collection object to do low-level operations
foos.collection // get the mongodb Collection object
foos.collection.listIndexes() // call the listIndexes()

// example for _id is of type UUID
type Bar = {
  _id: UUID
  key: string
  value?: number
}
const bars = new Collection<Bar>({
  name: 'bars',
  connection,
  generate: generateUUID, // generate a new UUID _id if necessary
})
await bars.insertOne({
  key: 'foo',
  value: 234,
}) // a new UUID _id is generated automatically
await bars.insertOne({
  _id: new UUID(),
  key: 'bar',
  value: 345,
}) // the _id can also be specified explicitly

// `generate: generateUUID` above is the id-or-generate callback: generateUUID(id)
// returns the given id, or `new UUID()` when none is provided. generateObjectId
// is the equivalent for ObjectId ids. To mint a one-off id elsewhere, just use
// the constructors directly:
new UUID() // a new UUID
new ObjectId() // a new ObjectId

await connection.disconnect()
```

## Cache

A small in-memory cache with per-entry TTL and capacity-bounded eviction. A
`Collection` creates one when given the `cache` option (see above), but it can
also be used standalone via `@potentia/mongodb7/cache`.

```typescript
import { Cache } from '@potentia/mongodb7'
// or import { Cache } from '@potentia/mongodb7/cache'

const cache = new Cache<string, number>({
  capacity: 100, // evict the oldest entries once more than 100 are held
  ttl: 60000, // optional time-to-live in ms (default: infinity, never expires)
  interval: 10000, // optional scrub interval in ms for expired entries (default: 10000)
})

cache.set('a', 1) // cache a value
cache.get('a') // 1, or undefined if missing/expired
cache.has('a') // true
cache.size // number of live entries
cache.isFull() // size >= capacity
cache.isEmpty() // size === 0
cache.delete('a') // remove one entry, returns whether it existed
cache.clear() // remove all entries
```

## Error

Errors for mongodb operations

```typescript
import assert from 'node:assert'
import {
  DBError, // base class for other errors
  DbError, // alias of DBError
  DisconnectedError, // the connection is disconnected
  NotFoundError, // the document is not found
  ConflictError, // the document is duplicated
  TransactionError, // the transaction is failed
  UnacknowledgedError, // the writes are not acknowledged
} from '@potentia/mongodb7' // or '@potentia/mongodb7/error'

const err = new NotFoundError()
assert(err instanceof NotFoundError)
assert(err instanceof DBError)
assert(err instanceof Error)
```
