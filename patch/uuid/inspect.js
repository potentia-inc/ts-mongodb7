import { UUID } from '../../mongo.js';
// Opt-in: `UUID` renders as `UUID(value)` under util.inspect.
//
//   import '@potentia/mongodb7/patch/uuid/inspect'
const inspect = Symbol.for('nodejs.util.inspect.custom');
UUID.prototype[inspect] = function () {
    return `UUID(${this.toString()})`;
};
