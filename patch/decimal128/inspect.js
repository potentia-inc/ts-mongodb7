import { Decimal128 } from '../../mongo.js';
// Opt-in: `Decimal128` renders as `Decimal128(value)` under util.inspect.
//
//   import '@potentia/mongodb7/patch/decimal128/inspect'
const inspect = Symbol.for('nodejs.util.inspect.custom');
Decimal128.prototype[inspect] = function () {
    return `Decimal128(${this.toString()})`;
};
