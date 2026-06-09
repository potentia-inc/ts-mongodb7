import { describe, expect, test } from 'bun:test'
import * as matchers from '../src/matcher/bun.js'
import {
  ObjectId,
  UUID,
  toBinary,
  toBuffer,
  toDecimal128,
} from '../src/type.js'

expect.extend(matchers)

describe('bun matchers', () => {
  test('Binary', () => {
    const a = toBinary('foobar')
    expect(a).toBeBinary()
    expect('foobar').not.toBeBinary()
    expect(a).toEqualBinary(a)
    expect(a).toEqualBinary('foobar')
    expect(a).toEqualBinary(Buffer.from('foobar', 'base64'))
    expect(a).not.toEqualBinary('foo')
    const bytes = new Uint8Array([104, 105])
    expect(toBinary(bytes)).toEqualBinary(bytes)
    // toBe*(value) is identical to toEqual*(value)
    expect(a).toBeBinary('foobar')
    expect(a).not.toBeBinary('foo')
  })

  test('Buffer', () => {
    const a = toBuffer('foobar')
    expect(a).toBeBuffer()
    expect('foobar').not.toBeBuffer()
    expect(a).toEqualBuffer(a)
    expect(a).toEqualBuffer('foobar')
    expect(a).not.toEqualBuffer('foo')
    const bytes = new Uint8Array([104, 105])
    expect(toBuffer(bytes)).toEqualBuffer(bytes)
  })

  test('Decimal128', () => {
    const a = toDecimal128('123.45')
    expect(a).toBeDecimal128()
    expect('123.45').not.toBeDecimal128()
    expect(a).toEqualDecimal128(123.45)
    expect(a).toEqualDecimal128('123.45')
    expect(a).not.toEqualDecimal128(234.56)
    expect(toDecimal128(NaN)).toBeDecimal128NaN()
    expect(toDecimal128(NaN)).not.toEqualDecimal128(NaN)
  })

  test('ObjectId', () => {
    const a = new ObjectId()
    expect(a).toBeObjectId()
    expect('foobar').not.toBeObjectId()
    expect(a).toEqualObjectId(a)
    expect(a).toEqualObjectId(a.toString())
    expect(a).not.toEqualObjectId(new ObjectId())
    expect(a.toString()).toBeObjectIdString()
    expect('foobar').not.toBeObjectIdString()
    expect(a.toString()).toEqualObjectIdString(a)
  })

  test('UUID', () => {
    const a = new UUID()
    expect(a).toBeUUID()
    expect('foobar').not.toBeUUID()
    expect(a).toEqualUUID(a)
    expect(a).toEqualUUID(a.toString())
    expect(a).not.toEqualUUID(new UUID())
    expect(a.toString()).toBeUUIDString()
    expect('foobar').not.toBeUUIDString()
    expect(a.toString()).toEqualUUIDString(a)

    // Uuid aliases
    expect(a).toBeUuid()
    expect(a).toEqualUuid(a)
    expect(a.toString()).toBeUuidString()
    expect(a.toString()).toEqualUuidString(a)
  })
})
