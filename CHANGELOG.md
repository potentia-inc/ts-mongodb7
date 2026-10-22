# Change log

## [2.1.0] - 2026-10-22

### Added

- `Connection` can rebuild its `MongoClient` when the driver's view of the
  replica set goes stale (operations keep failing with
  `not primary and secondaryOk=false` until a restart, seen on Cloud Run with
  request-based billing):
  - `connection.rebuild(reason?)` replaces the client; concurrent calls share
    one rebuild, no rebuild is attempted within the cooldown of connecting or
    of the previous attempt (failed, aborted or not), and the replaced client
    is closed after a grace period.
  - Automatic rebuild when an operation fails with a topology error (observed
    via the driver's `serverDescriptionChanged` event); disable with
    `$rebuild: false`.
  - `connection.retry(fn, { retries = 1 })` rebuilds and runs `fn` again on a
    topology error.
  - `connection.generation` counts the clients created.
  - `isTopologyError(err)` and `TOPOLOGY_ERROR_CODES`.
- `Connection` options accept `$`-prefixed settings, removed before the options
  reach `MongoClient`:
  - `$onConnecting(client, generation)` and
    `$onConnected(client, generation, error?)` are called for every client
    before and after it connects.
  - `$rebuild` configures the rebuild with
    `{ cooldown, grace, onRebuilding, onRebuilt }` (defaults: 30s cooldown, 30s
    grace), or `false` to disable the automatic rebuild.
  - Hooks come in pairs: `onXxxing` runs before the action and aborts it by
    throwing; `onXxxed` runs after it, succeeded or failed (with the error),
    and an error it throws is logged. Hooks are synchronous; a returned
    promise is not awaited and its rejection is logged.

### Changed

- `connect()` creates the client with `new MongoClient()` + `client.connect()`
  (instead of `MongoClient.connect()`) so `$onConnecting` runs before
  connecting, and closes the client if connecting fails. Concurrent `connect()`
  calls share one client (previously each created one and the extras were
  closed), and a `disconnect()` meanwhile makes them reject with
  `DisconnectedError` instead of leaving a client connected.
- `disconnect()` also closes clients replaced by a rebuild that are still in
  their grace period, and clients still connecting, and settles once every
  close has finished (rejecting with the first close error, if any).
- Unpin `bson` (`~7.2.0` -> `^7.0.0`) and upgrade the dev dependencies within
  their ranges, including `mongodb` 7.7.0, which requires `bson` >= 7.3.2. The
  pin never reached consumers (`mongodb` is a peer dependency). `bson` >= 7.3
  still crashes on import under older Bun (1.3.14 crashes, 1.4.3 works): under
  an affected Bun, upgrade Bun, or stay on `mongodb` <= 7.6 and pin `bson`
  below 7.3 (see the README "Bun and bson" note).

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
