import assert from 'node:assert';
import { Binary } from '../../mongo.js';
Binary.prototype[Symbol.toPrimitive] = function (hint) {
    assert(hint !== 'number');
    return this.sub_type === Binary.SUBTYPE_UUID
        ? this.toUUID().toString()
        : this.toJSON(); // base64 encoding
};
