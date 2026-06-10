import { ObjectId } from '../../mongo.js';
// Opt-in: `ObjectId` renders as `ObjectId(value)` under util.inspect.
//
//   import '@potentia/mongodb7/patch/objectid/inspect'
const inspect = Symbol.for('nodejs.util.inspect.custom');
ObjectId.prototype[inspect] = function () {
    return `ObjectId(${this.toString()})`;
};
