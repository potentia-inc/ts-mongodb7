import { strict as assert } from 'node:assert'
import { describe, test } from 'node:test'
import { inspect } from 'node:util'
import '../src/patch/index.js'
import { toBinary, toDecimal128, toObjectId, toUUID } from '../src/type.js'

// `/patch` applies every patch. node:test runs each file in its own process, so
// this file exercises the whole tree without leaking into the granular suites.

describe('patch (everything)', () => {
  test('Binary: toPrimitive + inspect', () => {
    const b = toBinary('foobar') // a byte-array Binary
    assert.equal(`${b}`, Buffer.from(b.value()).toString('base64'))
    assert.equal(inspect(b), `Binary(${b.toJSON()})`)
    assert.throws(() => Number(b))

    // a UUID-subtype Binary renders as the UUID
    const ub = toUUID('60456314-8bf5-48a1-b51b-726037a6e8b9').toBinary()
    assert.equal(`${ub}`, '60456314-8bf5-48a1-b51b-726037a6e8b9')
    assert.equal(inspect(ub), 'UUID(60456314-8bf5-48a1-b51b-726037a6e8b9)')
  })

  test('Decimal128: toPrimitive + inspect + json', () => {
    const d = toDecimal128('1.5')
    assert.equal(`${d}`, '1.5')
    assert.equal(Number(d), 1.5)
    assert.equal(inspect(d), 'Decimal128(1.5)')
    assert.equal(JSON.stringify({ d }), '{"d":"1.5"}')
  })

  test('ObjectId: toPrimitive + inspect', () => {
    const o = toObjectId('658e77fb9d2dd4679b004398')
    assert.equal(`${o}`, '658e77fb9d2dd4679b004398')
    assert.equal(inspect(o), 'ObjectId(658e77fb9d2dd4679b004398)')
    assert.throws(() => Number(o))
  })

  test('UUID: toPrimitive + inspect', () => {
    const u = toUUID('60456314-8bf5-48a1-b51b-726037a6e8b9')
    assert.equal(`${u}`, '60456314-8bf5-48a1-b51b-726037a6e8b9')
    assert.equal(inspect(u), 'UUID(60456314-8bf5-48a1-b51b-726037a6e8b9)')
    assert.throws(() => Number(u))
  })
})
