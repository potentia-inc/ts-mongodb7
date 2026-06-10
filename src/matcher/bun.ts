// bun:test adapter: re-exports the shared matchers and augments bun:test's
// types.
//
//   import * as matchers from '@potentia/mongodb7/matcher/bun'
//   expect.extend(matchers)
//
// Requires bun in the consuming project; this package does not depend on it.
import type { CustomMatchers } from './core.js'

export * from './core.js'

declare module 'bun:test' {
  /* eslint-disable @typescript-eslint/no-empty-object-type */
  interface Matchers<T> extends CustomMatchers<T> {}
  interface AsymmetricMatchers extends CustomMatchers {}
  /* eslint-enable @typescript-eslint/no-empty-object-type */
}
