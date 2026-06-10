import assert from 'node:assert'
import { UUID } from '../../mongo.js'

// Opt-in: `UUID` coerces to its string form via Symbol.toPrimitive; a number
// hint is rejected.
//
//   import '@potentia/mongodb7/patch/uuid/primitive'

declare module 'mongodb' {
  interface UUID {
    [Symbol.toPrimitive]: (hint: string) => string
  }
}

UUID.prototype[Symbol.toPrimitive] = function (hint: string): string {
  assert(hint !== 'number')
  return this.toString()
}
