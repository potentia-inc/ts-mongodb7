// vitest adapter: re-exports the shared matchers and augments vitest's types.
//
//   import * as matchers from '@potentia/mongodb7/matcher/vitest'
//   expect.extend(matchers)
//
// Requires vitest in the consuming project; this package does not depend on it.
import type { CustomMatchers } from './core.js'
// Type-only reference so TS can resolve the 'vitest' module for augmentation;
// fully erased at runtime, so the shipped vitest.js has no vitest dependency.
import type {} from 'vitest'

export * from './core.js'

declare module 'vitest' {
  /* eslint-disable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-explicit-any */
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
  /* eslint-enable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-explicit-any */
}
