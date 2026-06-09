import { strict as assert } from 'node:assert'
import { describe, test } from 'node:test'
import { BigNumber } from 'bignumber.js'
import {
  Binary,
  BUFFER_ENCODINGS,
  Decimal128,
  ObjectId,
  UUID,
  toBinary,
  toBinaryOrNil,
  toBuffer,
  toBufferOrNil,
  toDecimal128,
  toDecimal128OrNil,
  toObjectId,
  toObjectIdOrNil,
  toUUID,
  toUuid,
  toUUIDOrNil,
  toUuidOrNil,
} from '../src/type.js'

function equalBinary(a: Binary, b: unknown): boolean {
  const c = toBinary(b)
  return Buffer.from(a.value()).equals(Buffer.from(c.value()))
}

function equalDecimal128(a: Decimal128, b: unknown): boolean {
  return new BigNumber(a.toString()).eq(new BigNumber(String(b)))
}

describe('Binary', () => {
  test('toBinary()', () => {
    const a = toBinary('foobar')
    assert.ok(a instanceof Binary)
    assert.ok(equalBinary(a, a))
    assert.ok(equalBinary(a, Buffer.from('foobar', 'base64')))
    assert.ok(equalBinary(a, 'foobar'))
    assert.ok(!equalBinary(a, 'foo'))
    // strict: nullish throws rather than producing garbage bytes
    assert.throws(() => toBinary(), TypeError)
    assert.throws(() => toBinary(null), TypeError)
  })

  test('toBinary() from a plain Uint8Array', () => {
    const bytes = new Uint8Array([104, 105]) // 'hi'
    const a = toBinary(bytes)
    assert.ok(a instanceof Binary)
    assert.deepEqual([...a.value()], [104, 105])
    assert.ok(equalBinary(a, bytes))
    assert.ok(equalBinary(a, Buffer.from(bytes)))
  })

  test('toBinaryOrNil()', () => {
    assert.equal(toBinaryOrNil(null), undefined)
    assert.equal(toBinaryOrNil(undefined), undefined)
    assert.ok(toBinaryOrNil('foobar') instanceof Binary)
  })
})

describe('Buffer', () => {
  test('toBuffer()', () => {
    const a = toBuffer('foobar')
    assert.ok(Buffer.isBuffer(a))
    for (const encoding of BUFFER_ENCODINGS) {
      assert.ok(Buffer.isBuffer(toBuffer(a.toString(encoding))))
    }
    assert.ok(a.equals(toBuffer(a)))
    assert.ok(a.equals(toBuffer('foobar')))
    assert.ok(!a.equals(toBuffer('foo')))
    // strict: nullish throws rather than producing garbage bytes
    assert.throws(() => toBuffer(), TypeError)
    assert.throws(() => toBuffer(null), TypeError)
  })

  test('toBuffer() from a plain Uint8Array', () => {
    const bytes = new Uint8Array([104, 105]) // 'hi'
    const buf = toBuffer(bytes)
    assert.ok(Buffer.isBuffer(buf))
    assert.deepEqual([...buf], [104, 105])
    // a byte view with a non-zero offset is copied by its logical bytes
    const view = new Uint8Array([0, 104, 105, 0]).subarray(1, 3)
    assert.deepEqual([...toBuffer(view)], [104, 105])
  })

  test('toBufferOrNil()', () => {
    assert.equal(toBufferOrNil(null), undefined)
    assert.equal(toBufferOrNil(undefined), undefined)
    assert.ok(Buffer.isBuffer(toBufferOrNil('foobar')))
  })
})

describe('Decimal128', () => {
  test('toDecimal128()', () => {
    const a = toDecimal128(123.45)
    assert.ok(a instanceof Decimal128)
    assert.ok(equalDecimal128(a, 123.45))
    assert.ok(equalDecimal128(a, '123.45'))
    assert.ok(!equalDecimal128(a, 234.56))

    assert.ok(equalDecimal128(toDecimal128(Infinity), Infinity))
    assert.ok(equalDecimal128(toDecimal128(-Infinity), -Infinity))
    assert.ok(new BigNumber(toDecimal128(NaN).toString()).isNaN())
    assert.throws(() => toDecimal128('foobar'), /valid/)
    // strict: nullish throws a TypeError (not a BSONError)
    assert.throws(() => toDecimal128(), TypeError)
    assert.throws(() => toDecimal128(null), TypeError)
  })

  test('toDecimal128OrNil()', () => {
    assert.equal(toDecimal128OrNil(null), undefined)
    assert.equal(toDecimal128OrNil(undefined), undefined)
    assert.ok(toDecimal128OrNil('1.234') instanceof Decimal128)
  })
})

describe('ObjectId', () => {
  test('toObjectId()', () => {
    const a = new ObjectId()
    assert.ok(toObjectId(a) instanceof ObjectId)
    assert.ok(a.equals(toObjectId(a)))
    assert.ok(a.equals(toObjectId(a.toString())))
    assert.ok(!a.equals(toObjectId(new ObjectId())))
    // a plain Uint8Array of the 12 raw id bytes round-trips
    assert.ok(a.equals(toObjectId(new Uint8Array(a.id))))
    // strict: nullish throws (use `new ObjectId()` to mint a new id)
    assert.throws(() => toObjectId(), TypeError)
    assert.throws(() => toObjectId(null), TypeError)
  })

  test('toObjectIdOrNil()', () => {
    assert.equal(toObjectIdOrNil(null), undefined)
    assert.equal(toObjectIdOrNil(undefined), undefined)
    assert.ok(toObjectIdOrNil('658e77fb9d2dd4679b004398') instanceof ObjectId)
  })
})

describe('UUID', () => {
  test('toUUID()', () => {
    const a = new UUID()
    assert.ok(toUUID(a) instanceof UUID)
    assert.ok(toUUID({ toString: () => a.toString() }) instanceof UUID)
    assert.ok(toUUID(new UUID().toBinary()) instanceof UUID)
    assert.ok(a.equals(toUUID(a)))
    assert.ok(a.equals(toUUID(a.toString())))
    assert.ok(!a.equals(toUUID(new UUID())))
    // a plain Uint8Array of the 16 raw id bytes round-trips
    assert.ok(a.equals(toUUID(new Uint8Array(a.buffer))))
    // strict: nullish throws (use `new UUID()` to mint a new id)
    assert.throws(() => toUUID(), TypeError)
    assert.throws(() => toUUID(null), TypeError)
  })

  test('toUUIDOrNil()', () => {
    assert.equal(toUUIDOrNil(null), undefined)
    assert.equal(toUUIDOrNil(undefined), undefined)
    assert.ok(
      toUUIDOrNil('60456314-8bf5-48a1-b51b-726037a6e8b9') instanceof UUID,
    )
  })

  test('toUuid() alias', () => {
    assert.ok(toUuid(new UUID()) instanceof UUID)
    assert.equal(toUuid, toUUID)
    assert.equal(toUuidOrNil, toUUIDOrNil)
    assert.equal(toUuidOrNil(null), undefined)
  })
})
