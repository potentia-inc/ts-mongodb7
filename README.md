# @potentia/mongodb7

Utilities for [mongodb](https://github.com/mongodb/node-mongodb-native) `^7.0.0`

 - [types](#types): utilities for `Binary`, `Decimal128`, `UUID` and `ObjectId`
 - [jest matchers](#jest-matchers): [jest](https://jestjs.io) matchers for types
 - [connection](#connection): `MongoClient` wrapper for connection management
 - [collection](#collection): mongodb `Collection` wrapper for CRUD operaitons
 - [error](#error): errors

Note: [bignumber.js](https://github.com/MikeMcl/bignumber.js) is required for
jest matcher

### Types

Utilities for `Binary`, `Decimal128`, `UUID` and `ObjectId`

```typescript
import {
  Binary,
  Decimal128,
  ObjectId,
  UUID,
  Uuid, // alias of UUID
  toBinary,
  toBinaryOrNil,
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

toBinary('foobar') // create a new Binary from the given string
toBinary(Buffer.from('foobar', 'base64')) // create a new Binary from the given Buffer
toBianryOrNil() // undefined

toDecimal128('123.45') // 123.45
toDecimal128('123.45') // 123.45
toDecimal128(Infinity)) // infinity
toDecimal128(-Infinity)) // -infinity
toDecimal128(NaN) // NaN
toDecimal128('foobar') // Error thrown
toDecimal128() // Error thrown
toDecimal128OrNil() // undefined

const uuid = 'f4653fea-ef09-4e84-b3c8-9bc66d99b5bb'
toUUID() // generate a new UUID
toUUID(uuid) // create a new UUID from the given string representation
toUUID('foobar') // Error thrown
toUUIDOrNil() // undefined

const objectid = '658cd87dcad575d87adc87bc'
toObjectId() // generate a new ObjectId
toObjectId(objectid) // create a new ObjectId from the given string representation
toObjectId('foobar') // Error thrown
toObjectIdOrNil() // undefined
```

## Jest matchers

[jest](https://jestjs.io) matchers for `Binary`, `Decimal128`, `UUID` and
`ObjectId`

```typescript
import * as matchers from '@potentia/bignumber/jest'
expect.extend(matchers)

expect(toBinary('foobar')).toBeBinary()
expect('foobar').not.toBeBinary()
expect(toBinary('foobar')).toEqualBinary('foobar')
expect(toBinary('foobar')).toEqualBinary(Buffer.from('foobar', 'base64'))

expect(toDecimal128('123.45')).toBeDecimal128()
expect(toDecimal128('123.45')).toEqualDecimal128(123.45)
expect(toDecimal128('123.45')).toEqualDecimal128('123.45')
expect(toDecimal128(Infinity)).toEqualDecimal128(Infinity)
expect(toDecimal128(-Infinity)).toEqualDecimal128(-Infinity)
expect(toDecimal128(NaN)).not.toEqualDecimal128(NaN)
expect(toDecimal128(NaN)).toBeDecimal128NaN()

const uuid = toUUID()
expect(uuid).toBeUUID()
expect('foobar').not.toBeUUID()
expect(uuid).toEqualUUID(uuid)
expect(uuid).not.toEqualUUID(toUUID())

expect(uuid.toString()).toBeUUIDString()
expect(uuid.toString()).toEqualUUIDString(uuid)

const objectId = toObjectId()
expect(objectId).toBeObjectId()
expect('foobar').not.toBeObjectId()
expect(objectId).toEqualObjectId(objectId)
expect(objectId).not.toEqualObjectId(toObjectId())

expect(objectId.toString()).toBeObjectIdString()
expect(objectId.toString()).toEqualObjectIdString(objectId)
```

### Connection

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
  // to db operaitons here with options
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

// you can get the monogdb MongoClient object to do low-level operations
connection.client // get the mongodb MongoClient object
connection.client.startSession() // start a new ClientSession

// you can get the mongodb Db object to do low-level operations
connection.db // get the mongodb Db object
connection.db.collections() // get all collections
```

### Collection

Mongodb `Collection` wrapper for CRUD operaitons

```typescript
import { Connection, UUID, toUUID } from '@potentia/mongodb7'
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

      findOneById(id, false, options) // load the document from db forcely

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
  _id: toUUID(),
  key: 'bar',
  value: 345,
}) // the _id can also be specified explicitly

// Note: generateObjectId() is also provided to generate a new ObjectId _id

await connection.disconnect()
```

### Error

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
