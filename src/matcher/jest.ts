// Jest adapter: re-exports the shared matchers and augments jest's types.
//
//   import * as matchers from '@potentia/mongodb7/matcher/jest'
//   expect.extend(matchers)
//
// Requires jest in the consuming project; this package does not depend on it.
import type { CustomMatchers } from './core.js'

export * from './core.js'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    /* eslint-disable @typescript-eslint/no-empty-object-type */
    interface Expect extends CustomMatchers {}
    interface Matchers<R> extends CustomMatchers<R> {}
    interface InverseAsymmetricMatchers extends CustomMatchers {}
    /* eslint-enable @typescript-eslint/no-empty-object-type */
  }
}
