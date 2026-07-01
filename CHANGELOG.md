# Change log

## [2.0.1] - 2026-07-01

- Require Node.js >= 24 again (2.0.0 had temporarily lowered it to 22), in sync
  with the `@tsconfig/node24` build config. All consumers already run Node >= 24
  or Bun.
- Pin `bson` to `~7.2.0`: `bson` >= 7.3.0 crashes on import under Bun (a Bun
  limitation) and `mongodb` imports `bson` at load. Node.js and Deno are
  unaffected; Bun users should pin `bson` below 7.3.0 in their own
  `package.json` (see the README "Bun and bson" note).
- Build with TypeScript 6 (dev toolchain only). No API or runtime changes.

## [2.0.0] - 2026-06-10

Cross-runtime release: the package now runs on Node.js (>= 22), Bun and
Deno (>= 2). `mongodb` and `bignumber.js` remain peer dependencies
(`bignumber.js` is only needed for the matchers).

### Breaking changes

- The matcher entry point moved from `@potentia/mongodb7/jest` to
  `@potentia/mongodb7/matcher/jest`; `@potentia/mongodb7/matcher/bun` and
  `@potentia/mongodb7/matcher/vitest` were added.
- `toBe*` and `toEqual*` are now the same matcher under two names — `toBeUUID(id)`
  is identical to `toEqualUUID(id)`. With no argument a matcher checks the type;
  with one it checks the type and the (coerced) value.
- The `toX()` coercions are strict: `toBinary`, `toBuffer`, `toDecimal128`,
  `toObjectId` and `toUUID` throw a `TypeError` on `null`/`undefined` instead of
  silently generating a value (`toUUID()` / `toObjectId()`) or producing garbage
  bytes (`toBinary()` / `toBuffer()`). Mint a new id with `new UUID()` /
  `new ObjectId()`; use the `toXOrNil()` variant to tolerate nullish input.
- The `Binary`/`Decimal128`/`ObjectId`/`UUID` prototype patches
  (`Symbol.toPrimitive`, `util.inspect`, `Decimal128` `toJSON`) are now opt-in
  side effects and are no longer applied by importing the package — see Added.
- Removed the deprecated mongodb type re-exports from
  `@potentia/mongodb7/collection` (`AggregateOptions`, `BulkWriteOptions`,
  `Filter`, `WithId`, `CommandOperationOptions`, …); import them from
  `@potentia/mongodb7/mongo` instead.
- Removed the `DBError` alias; use `DbError`.

### Added

- Bun and Deno support. The types, matchers, cache, errors and the
  `Connection`/`Collection` DB layer all run on the three runtimes, verified by a
  framework-free `smoke.mjs` (run on each) and a CI matrix.
- `bun:test` and `vitest` matchers alongside jest. The implementation is shared
  in a framework-agnostic core that relies only on the jest-compatible
  `this.utils`, so it has no test-framework dependency.
- Opt-in prototype patches under `@potentia/mongodb7/patch`, exposed at the
  finest grain — one type × one concern (e.g. `…/patch/decimal128/json`) — with
  `…/patch/<type>` and `…/patch` composing them. The `…/decimal128/json` patch
  changes `Decimal128` serialization process-wide (it breaks Extended JSON), so
  it can now be opted into in isolation.
- `toBinary`, `toBuffer`, `toUUID` and `toObjectId` (and therefore the `toEqual*`
  matchers) accept a plain `Uint8Array` as raw bytes — useful for Web Crypto /
  `fetch().bytes()` / edge callers. Results stay `Buffer`/`Binary`, and
  `toBuffer` remains the portable base64/hex/utf8 codec.
- The published `exports` declare `types` for every entry point.

### Fixed

- `Cache.clear()` and `Cache.delete()` left the internal `count` map out of sync,
  leaking entries and corrupting LRU eviction.
- `toBuffer()` decoded non-base64 strings as base64 (the encoding fallback was
  unreachable), silently corrupting input such as `"hello world"`.

### Internal

- Tests restructured to `node:test` suites (run on Node and Deno) plus
  per-framework matcher suites under `jest/`, `bun/` and `vitest/`, with
  near-complete coverage.

## [1.0.0] - 2025-11-18

The first release
