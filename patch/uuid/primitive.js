import assert from 'node:assert';
import { UUID } from '../../mongo.js';
UUID.prototype[Symbol.toPrimitive] = function (hint) {
    assert(hint !== 'number');
    return this.toString();
};
