export { setTimeout as sleep } from 'node:timers/promises'

export function isNil<T>(x: T): x is Extract<T, null | undefined> {
  return x === null || x === undefined
}
