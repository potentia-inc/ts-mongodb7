import assert from 'node:assert'
import { Binary } from '../../mongo.js'

// Opt-in: `Binary` coerces via Symbol.toPrimitive (base64, or the UUID string
// for a UUID subtype); a number hint is rejected.
//
//   import '@potentia/mongodb7/patch/binary/primitive'

declare module 'mongodb' {
  interface Binary {
    [Symbol.toPrimitive]: (hint: string) => string
  }
}

Binary.prototype[Symbol.toPrimitive] = function (hint: string): string {
  assert(hint !== 'number')
  return this.sub_type === Binary.SUBTYPE_UUID
    ? this.toUUID().toString()
    : this.toJSON() // base64 encoding
}
