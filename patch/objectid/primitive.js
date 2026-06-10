import assert from 'node:assert';
import { ObjectId } from '../../mongo.js';
ObjectId.prototype[Symbol.toPrimitive] = function (hint) {
    assert(hint !== 'number');
    return this.toString();
};
