import {
  BUFFER_ENCODINGS,
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
import * as matchers from '../src/jest.js'

expect.extend(matchers)

describe('Binary', () => {
  test('toBeBinary() and toEqualBinary()', () => {
    const a = toBinary('foobar')
    expect(a).toBeBinary()
    expect('foobar').not.toBeBinary()

    expect(a).toEqualBinary(a)
    expect('foobar').not.toEqualBinary(a)
    expect(a).toEqualBinary(Buffer.from('foobar', 'base64'))
    expect(a).toEqualBinary('foobar')
    expect(a).not.toEqualBinary('foo')
    expect(a).not.toEqualBinary(Buffer.from('bar'))
  })

  test('toBinaryOrNil()', () => {
    expect(toBinaryOrNil(null)).toBeUndefined()
    expect(toBinaryOrNil(undefined)).toBeUndefined()
    expect(toBinaryOrNil('foobar')).toBeBinary()
  })
})

describe('Buffer', () => {
  test('toBuffer() and toEqualBuffer()', () => {
    const a = toBuffer('foobar')
    expect(a).toBeBuffer()
    expect('foobar').not.toBeBuffer()
    for (const encoding of BUFFER_ENCODINGS) {
      expect(toBuffer(a.toString(encoding))).toBeBuffer()
    }

    expect(a).toEqualBuffer(a)
    expect('foobar').not.toEqualBuffer(a)
    expect(a).toEqualBuffer('foobar')
    expect(a).not.toEqualBuffer('foo')
    expect(a).not.toEqualBuffer(Buffer.from('bar'))
  })

  test('toBufferOrNil()', () => {
    expect(toBufferOrNil(null)).toBeUndefined()
    expect(toBufferOrNil(undefined)).toBeUndefined()
    expect(toBufferOrNil('foobar')).toBeBuffer()
  })
})

describe('Decimal128', () => {
  test('toBeDecimal128() and toEqualDecimal128()', () => {
    const a = toDecimal128(123.45)
    expect(a).toBeDecimal128()
    expect('foobar').not.toBeDecimal128()

    expect(a).toEqualDecimal128(a)
    expect('foobar').not.toEqualDecimal128(a)
    expect(a).toEqualDecimal128(123.45)
    expect(a).toEqualDecimal128('123.45')
    expect(a).not.toEqualDecimal128(234.56)
    expect(a).not.toEqualDecimal128('234.56')
    expect(a).not.toBeDecimal128NaN()

    expect(toDecimal128(Infinity)).toEqualDecimal128(Infinity)
    expect(toDecimal128(-Infinity)).toEqualDecimal128(-Infinity)
    expect(toDecimal128(NaN)).not.toEqualDecimal128(NaN)
    expect(toDecimal128(NaN)).toBeDecimal128NaN()
    expect(() => toDecimal128('foobar')).toThrow(/valid/)
  })

  test('toDecimal128OrNil()', () => {
    expect(toDecimal128OrNil(null)).toBeUndefined()
    expect(toDecimal128OrNil(undefined)).toBeUndefined()
    expect(toDecimal128OrNil('1.234')).toBeDecimal128()
  })
})

describe('ObjectId', () => {
  test('toBeObjectId() and toEqualObjectId()', () => {
    const a = toObjectId()
    expect(a).toBeObjectId()
    expect('foobar').not.toBeObjectId()

    expect(a).toEqualObjectId(a)
    expect('foobar').not.toEqualObjectId(a)
    expect(a).toEqualObjectId(a.toString())
    expect(a).not.toEqualObjectId(toObjectId())
    expect(a).not.toEqualObjectId(toObjectId().toString())

    const astr = a.toString()
    expect(astr).toBeObjectIdString()
    expect(a).not.toBeObjectIdString()
    expect('foobar').not.toBeObjectIdString()

    expect(astr).toEqualObjectIdString(a)
    expect(a).not.toEqualObjectIdString(a)
    expect('foobar').not.toEqualObjectIdString(a)
    expect(astr).toEqualObjectIdString(a.toString())
    expect(astr).not.toEqualObjectIdString(toObjectId())
    expect(astr).not.toEqualObjectIdString(toObjectId().toString())
  })

  test('toObjectIdOrNil', () => {
    expect(toObjectIdOrNil(null)).toBeUndefined()
    expect(toObjectIdOrNil(undefined)).toBeUndefined()
    expect(toObjectIdOrNil('658e77fb9d2dd4679b004398')).toBeObjectId()
  })
})

describe('UUID', () => {
  test('toBeUUID() and toEqualUUID()', () => {
    const a = toUUID()
    expect(a).toBeUUID()
    expect('foobar').not.toBeUUID()
    expect(toUUID({ toString: () => a.toString() })).toBeUUID()
    expect(toUUID(toUUID().toBinary())).toBeUUID()

    expect(a).toEqualUUID(a)
    expect('foobar').not.toEqualUUID(a)
    expect(a).toEqualUUID(a.toString())
    expect(a).not.toEqualUUID(toUUID())
    expect(a).not.toEqualUUID(toUUID().toString())

    const astr = a.toString()
    expect(astr).toBeUUIDString()
    expect(a).not.toBeUUIDString()
    expect('foobar').not.toBeUUIDString()

    expect(astr).toEqualUUIDString(a)
    expect(a).not.toEqualUUIDString(a)
    expect('foobar').not.toEqualUUIDString(a)
    expect(astr).toEqualUUIDString(a.toString())
    expect(astr).not.toEqualUUIDString(toUUID())
    expect(astr).not.toEqualUUIDString(toUUID().toString())
  })

  test('toUUIDOrNil()', () => {
    expect(toUUIDOrNil(null)).toBeUndefined()
    expect(toUUIDOrNil(undefined)).toBeUndefined()
    expect(toUUIDOrNil('60456314-8bf5-48a1-b51b-726037a6e8b9')).toBeUUID()
  })

  test('toBeUuid() and toEqualUuid()', () => {
    const a = toUuid()
    expect(a).toBeUuid()
    expect('foobar').not.toBeUuid()
    expect(toUuid({ toString: () => a.toString() })).toBeUuid()
    expect(toUuid(toUuid().toBinary())).toBeUuid()

    expect(a).toEqualUuid(a)
    expect('foobar').not.toEqualUuid(a)
    expect(a).toEqualUuid(a.toString())
    expect(a).not.toEqualUuid(toUuid())
    expect(a).not.toEqualUuid(toUuid().toString())

    const astr = a.toString()
    expect(astr).toBeUuidString()
    expect(a).not.toBeUuidString()
    expect('foobar').not.toBeUuidString()

    expect(astr).toEqualUuidString(a)
    expect(a).not.toEqualUuidString(a)
    expect('foobar').not.toEqualUuidString(a)
    expect(astr).toEqualUuidString(a.toString())
    expect(astr).not.toEqualUuidString(toUuid())
    expect(astr).not.toEqualUuidString(toUuid().toString())
  })

  test('toUuidOrNil()', () => {
    expect(toUuidOrNil(null)).toBeUndefined()
    expect(toUuidOrNil(undefined)).toBeUndefined()
    expect(toUuidOrNil('60456314-8bf5-48a1-b51b-726037a6e8b9')).toBeUUID()
  })
})

describe('read examples', () => {
  test('Binary', () => {
    expect(toBinary('foobar')).toBeBinary()
    expect('foobar').not.toBeBinary()
    expect(toBinary('foobar')).toEqualBinary('foobar')
    expect(toBinary('foobar')).toEqualBinary(Buffer.from('foobar', 'base64'))
  })

  test('Decimal128', () => {
    expect(toDecimal128('123.45')).toBeDecimal128()
    expect(toDecimal128('123.45')).toEqualDecimal128(123.45)
    expect(toDecimal128('123.45')).toEqualDecimal128('123.45')
    expect(toDecimal128(Infinity)).toEqualDecimal128(Infinity)
    expect(toDecimal128(-Infinity)).toEqualDecimal128(-Infinity)
    expect(toDecimal128(NaN)).not.toEqualDecimal128(NaN)
    expect(toDecimal128(NaN)).toBeDecimal128NaN()
  })

  test('UUID', () => {
    const uuid = toUUID()
    expect(uuid).toBeUUID()
    expect('foobar').not.toBeUUID()
    expect(uuid).toEqualUUID(uuid)
    expect(uuid).not.toEqualUUID(toUUID())

    expect(uuid.toString()).toBeUUIDString()
    expect(uuid.toString()).toEqualUUIDString(uuid)
  })

  test('ObjectId', () => {
    const objectId = toObjectId()
    expect(objectId).toBeObjectId()
    expect('foobar').not.toBeObjectId()
    expect(objectId).toEqualObjectId(objectId)
    expect(objectId).not.toEqualObjectId(toObjectId())

    expect(objectId.toString()).toBeObjectIdString()
    expect(objectId.toString()).toEqualObjectIdString(objectId)
  })
})
