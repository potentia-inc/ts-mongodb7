import { strict as assert } from 'node:assert'
import { describe, test } from 'node:test'
import { inspect } from 'node:util'
import '../src/patch/decimal128/index.js'
import { toDecimal128, toObjectId } from '../src/type.js'

// A per-type aggregator: every Decimal128 patch, and nothing for other types.

describe('patch/decimal128 (one type, all concerns)', () => {
  test('applies every Decimal128 patch', () => {
    const d = toDecimal128('1.5')
    assert.equal(Number(d), 1.5) // primitive
    assert.equal(inspect(d), 'Decimal128(1.5)') // inspect
    assert.equal(JSON.stringify(d), '"1.5"') // json
  })

  test('does not patch other types', () => {
    // ObjectId is untouched: a number hint coerces to NaN rather than throwing
    assert.ok(Number.isNaN(Number(toObjectId('658e77fb9d2dd4679b004398'))))
  })
})
