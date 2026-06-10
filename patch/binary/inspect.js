import { Binary } from '../../mongo.js';
// Opt-in: `Binary` renders as `Binary(base64)` (or `UUID(...)` for a UUID
// subtype) under util.inspect (console.log, node:test diffs).
//
//   import '@potentia/mongodb7/patch/binary/inspect'
const inspect = Symbol.for('nodejs.util.inspect.custom');
Binary.prototype[inspect] = function () {
    return this.sub_type === Binary.SUBTYPE_UUID
        ? `UUID(${this.toUUID().toString()})`
        : `Binary(${this.toJSON()})`;
};
