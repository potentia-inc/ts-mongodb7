import { strict as assert } from 'node:assert'
import { describe, test } from 'node:test'
import { inspect } from 'node:util'
import '../src/patch/decimal128/json.js'
import { toDecimal128, toObjectId } from '../src/type.js'

// The finest grain: a single patch in isolation.

describe('patch/decimal128/json (a single patch)', () => {
  test('applies only the Decimal128 toJSON patch', () => {
    assert.equal(JSON.stringify(toDecimal128('1.5')), '"1.5"')
  })

  test('leaves the other Decimal128 patches and other types untouched', () => {
    // inspect not applied: Decimal128 does not render as Decimal128(1.5)
    assert.notEqual(inspect(toDecimal128('1.5')), 'Decimal128(1.5)')
    // primitive not applied: an ObjectId number hint is NaN, not a thrown error
    assert.ok(Number.isNaN(Number(toObjectId('658e77fb9d2dd4679b004398'))))
  })
})
