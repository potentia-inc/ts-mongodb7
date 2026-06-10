import type { CustomMatchers } from './core.js';
export * from './core.js';
declare module 'vitest' {
    interface Assertion<T = any> extends CustomMatchers<T> {
    }
    interface AsymmetricMatchersContaining extends CustomMatchers {
    }
}
