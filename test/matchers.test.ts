import { strict as assert } from 'node:assert'
import { describe, test } from 'node:test'
import * as matchers from '../src/matcher/core.js'
import type { MatcherContext } from '../src/matcher/core.js'
import {
  ObjectId,
  UUID,
  toBinary,
  toBuffer,
  toDecimal128,
} from '../src/type.js'

// A minimal jest-compatible `this.utils` so the framework-agnostic matcher
// logic can be exercised on any runtime without a test framework installed.
const ctx: MatcherContext = {
  isNot: false,
  promise: '',
  utils: {
    matcherHint: () => '',
    printReceived: (v) => String(v),
    printExpected: (v) => String(v),
  },
}

describe('matchers (framework-agnostic core)', () => {
  test('Binary: type with no arg, equality with an arg', () => {
    const a = toBinary('foobar')
    // no argument -> type check
    assert.equal(matchers.toBeBinary.call(ctx, a).pass, true)
    assert.equal(matchers.toBeBinary.call(ctx, 'foobar').pass, false)
    // argument -> equality (toBe* and toEqual* are the same function)
    assert.equal(matchers.toBeBinary.call(ctx, a, a).pass, true)
    assert.equal(matchers.toBeBinary.call(ctx, a, 'foobar').pass, true)
    assert.equal(matchers.toEqualBinary.call(ctx, a, 'foobar').pass, true)
    assert.equal(
      matchers.toEqualBinary.call(ctx, a, Buffer.from('foobar', 'base64')).pass,
      true,
    )
    assert.equal(matchers.toEqualBinary.call(ctx, a, 'foo').pass, false)
    // an explicit undefined arg is an equality check that fails, not a type check
    assert.equal(matchers.toBeBinary.call(ctx, a, undefined).pass, false)
    // a plain Uint8Array expected
    const bytes = new Uint8Array([104, 105])
    assert.equal(
      matchers.toBeBinary.call(ctx, toBinary(bytes), bytes).pass,
      true,
    )
  })

  test('Buffer', () => {
    const a = toBuffer('foobar')
    assert.equal(matchers.toBeBuffer.call(ctx, a).pass, true)
    assert.equal(matchers.toBeBuffer.call(ctx, 'foobar').pass, false)
    assert.equal(matchers.toEqualBuffer.call(ctx, a, a).pass, true)
    assert.equal(matchers.toEqualBuffer.call(ctx, a, 'foobar').pass, true)
    assert.equal(matchers.toEqualBuffer.call(ctx, a, 'foo').pass, false)
    // a plain Uint8Array expected
    const bytes = new Uint8Array([104, 105])
    assert.equal(
      matchers.toEqualBuffer.call(ctx, toBuffer(bytes), bytes).pass,
      true,
    )
  })

  test('Decimal128', () => {
    const a = toDecimal128('123.45')
    assert.equal(matchers.toBeDecimal128.call(ctx, a).pass, true)
    assert.equal(matchers.toBeDecimal128.call(ctx, '123.45').pass, false)
    assert.equal(matchers.toEqualDecimal128.call(ctx, a, 123.45).pass, true)
    assert.equal(matchers.toEqualDecimal128.call(ctx, a, '123.45').pass, true)
    assert.equal(matchers.toEqualDecimal128.call(ctx, a, 234.56).pass, false)
    const nan = toDecimal128(NaN)
    assert.equal(matchers.toBeDecimal128NaN.call(ctx, nan).pass, true)
    assert.equal(matchers.toBeDecimal128NaN.call(ctx, a).pass, false)
    assert.equal(matchers.toEqualDecimal128.call(ctx, nan, NaN).pass, false)
  })

  test('ObjectId', () => {
    const a = new ObjectId()
    assert.equal(matchers.toBeObjectId.call(ctx, a).pass, true)
    assert.equal(matchers.toBeObjectId.call(ctx, 'foobar').pass, false)
    assert.equal(matchers.toEqualObjectId.call(ctx, a, a).pass, true)
    assert.equal(matchers.toEqualObjectId.call(ctx, a, a.toString()).pass, true)
    assert.equal(
      matchers.toEqualObjectId.call(ctx, a, new ObjectId()).pass,
      false,
    )
    assert.equal(matchers.toBeObjectIdString.call(ctx, a.toString()).pass, true)
    assert.equal(matchers.toBeObjectIdString.call(ctx, a).pass, false)
    assert.equal(matchers.toBeObjectIdString.call(ctx, 'foobar').pass, false)
    assert.equal(
      matchers.toEqualObjectIdString.call(ctx, a.toString(), a).pass,
      true,
    )
  })

  test('UUID', () => {
    const a = new UUID()
    assert.equal(matchers.toBeUUID.call(ctx, a).pass, true)
    assert.equal(matchers.toBeUUID.call(ctx, 'foobar').pass, false)
    assert.equal(matchers.toEqualUUID.call(ctx, a, a).pass, true)
    assert.equal(matchers.toEqualUUID.call(ctx, a, a.toString()).pass, true)
    assert.equal(matchers.toEqualUUID.call(ctx, a, new UUID()).pass, false)
    assert.equal(matchers.toBeUUIDString.call(ctx, a.toString()).pass, true)
    assert.equal(matchers.toBeUUIDString.call(ctx, a).pass, false)
    assert.equal(matchers.toBeUUIDString.call(ctx, 'foobar').pass, false)
    assert.equal(
      matchers.toEqualUUIDString.call(ctx, a.toString(), a).pass,
      true,
    )
  })

  test('toBe* and toEqual* are the same function (incl. Uuid aliases)', () => {
    assert.equal(matchers.toEqualBinary, matchers.toBeBinary)
    assert.equal(matchers.toEqualBuffer, matchers.toBeBuffer)
    assert.equal(matchers.toEqualDecimal128, matchers.toBeDecimal128)
    assert.equal(matchers.toEqualObjectId, matchers.toBeObjectId)
    assert.equal(matchers.toEqualObjectIdString, matchers.toBeObjectIdString)
    assert.equal(matchers.toEqualUUID, matchers.toBeUUID)
    assert.equal(matchers.toEqualUUIDString, matchers.toBeUUIDString)
    // Uuid aliases
    assert.equal(matchers.toBeUuid, matchers.toBeUUID)
    assert.equal(matchers.toEqualUuid, matchers.toBeUUID)
    assert.equal(matchers.toBeUuidString, matchers.toBeUUIDString)
    assert.equal(matchers.toEqualUuidString, matchers.toBeUUIDString)
  })

  test('throws when given more than one argument', () => {
    assert.throws(
      () => matchers.toBeUUID.call(ctx, new UUID(), 1, 2),
      /at most one/,
    )
  })

  test('message() renders a string', () => {
    assert.equal(typeof matchers.toBeBinary.call(ctx, 5).message(), 'string')
    assert.equal(
      typeof matchers.toEqualUUID.call(ctx, 5, new UUID()).message(),
      'string',
    )
  })
})
