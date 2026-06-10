import { Decimal128 } from '../../mongo.js'

// Opt-in: `Decimal128` coerces via Symbol.toPrimitive — a number for the number
// hint, otherwise its string form.
//
//   import '@potentia/mongodb7/patch/decimal128/primitive'

declare module 'mongodb' {
  interface Decimal128 {
    [Symbol.toPrimitive]: (hint: string) => number | string
  }
}

Decimal128.prototype[Symbol.toPrimitive] = function (
  hint: string,
): number | string {
  return hint === 'number' ? Number(this.toString()) : this.toString()
}
