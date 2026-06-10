import assert from 'node:assert'
import { ObjectId } from '../../mongo.js'

// Opt-in: `ObjectId` coerces to its hex string via Symbol.toPrimitive; a number
// hint is rejected.
//
//   import '@potentia/mongodb7/patch/objectid/primitive'

declare module 'mongodb' {
  interface ObjectId {
    [Symbol.toPrimitive]: (hint: string) => string
  }
}

ObjectId.prototype[Symbol.toPrimitive] = function (hint: string): string {
  assert(hint !== 'number')
  return this.toString()
}
