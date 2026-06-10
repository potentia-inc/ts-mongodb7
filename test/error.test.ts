import { strict as assert } from 'node:assert'
import { describe, test } from 'node:test'
import {
  ConflictError,
  DbError,
  DisconnectedError,
  NotFoundError,
  TransactionError,
  UnacknowledgedError,
} from '../src/error.js'

describe('error', () => {
  test('DbError base class', () => {
    const e = new DbError()
    assert.ok(e instanceof DbError)
    assert.ok(e instanceof Error)
    assert.equal(e.message, 'Unknown DB Error') // default message
    assert.equal(new DbError('boom').message, 'boom') // custom message
  })

  test('subclasses: default + custom message, instanceof chain', () => {
    const cases: Array<[new (m?: string) => DbError, string]> = [
      [DisconnectedError, 'Disconnected'],
      [NotFoundError, 'Not Found'],
      [ConflictError, 'Conflict'],
      [TransactionError, 'Transaction Error'],
      [UnacknowledgedError, 'Unacknowledged'],
    ]
    for (const [Cls, defaultMessage] of cases) {
      const e = new Cls()
      assert.ok(e instanceof Cls)
      assert.ok(e instanceof DbError)
      assert.ok(e instanceof Error)
      assert.equal(e.message, defaultMessage)
      assert.equal(new Cls('custom').message, 'custom')
    }
  })
})
