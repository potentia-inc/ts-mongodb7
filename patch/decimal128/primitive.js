import { Decimal128 } from '../../mongo.js';
Decimal128.prototype[Symbol.toPrimitive] = function (hint) {
    return hint === 'number' ? Number(this.toString()) : this.toString();
};
