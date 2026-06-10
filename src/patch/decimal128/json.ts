import type { Decimal128Extended } from 'bson'
import { Decimal128 } from '../../mongo.js'

// Opt-in: make `JSON.stringify` emit a bare numeric string for `Decimal128`
// instead of Extended JSON (`{ "$numberDecimal": ".." }`).
//
//   import '@potentia/mongodb7/patch/decimal128/json'
//
// NOTE: this changes Decimal128 serialization process-wide and breaks Extended
// JSON round-tripping. Opt in only when your application owns the output format.

Decimal128.prototype.toJSON = function (): Decimal128Extended {
  return this.toString() as unknown as Decimal128Extended
}
