// Opt-in: every `Decimal128` patch (Symbol.toPrimitive + util.inspect + toJSON).
// Includes the EJSON-changing `json` patch — see ./json.
//
//   import '@potentia/mongodb7/patch/decimal128'
import './primitive.js'
import './inspect.js'
import './json.js'
