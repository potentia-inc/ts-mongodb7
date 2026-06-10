import { UUID } from '../../mongo.js'

// Opt-in: `UUID` renders as `UUID(value)` under util.inspect.
//
//   import '@potentia/mongodb7/patch/uuid/inspect'

const inspect = Symbol.for('nodejs.util.inspect.custom')

declare module 'mongodb' {
  interface UUID {
    [inspect]: () => string
  }
}

UUID.prototype[inspect] = function (): string {
  return `UUID(${this.toString()})`
}
