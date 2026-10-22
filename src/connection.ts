import type {
  CommandOperationOptions,
  Db,
  Document,
  MongoClientOptions,
  ServerDescriptionChangedEvent,
} from 'mongodb'
import {
  MongoClient,
  MongoError,
  MongoServerError,
  MongoServerSelectionError,
} from 'mongodb'
import { ConflictError, DisconnectedError, TransactionError } from './error.js'

// Server error codes meaning the operation reached a node that is not (or no
// longer) in the state the driver believed: a stale view of the replica set,
// or a node stepping down / shutting down.
export const TOPOLOGY_ERROR_CODES: ReadonlySet<number> = new Set([
  10107, // NotWritablePrimary
  13435, // NotPrimaryNoSecondaryOk
  13436, // NotPrimaryOrSecondary
  11600, // InterruptedAtShutdown
  11602, // InterruptedDueToReplStateChange
  189, // PrimarySteppedDown
  91, // ShutdownInProgress
])

// Whether the error suggests the client's view of the replica set is wrong:
// one of TOPOLOGY_ERROR_CODES, or no suitable server could be selected.
// Network errors are excluded; the driver already retries and resets on them.
export function isTopologyError(err: unknown): boolean {
  if (err instanceof MongoServerSelectionError) return true
  return (
    err instanceof MongoServerError &&
    typeof err.code === 'number' &&
    TOPOLOGY_ERROR_CODES.has(err.code)
  )
}

// Hooks come in pairs: onXxxing runs before the action and can abort it by
// throwing (the action then fails with that error and onXxxed is not called);
// onXxxed runs after the action, whether it succeeded or failed (with the
// error), and an error it throws is logged and ignored. Hooks are synchronous:
// a promise returned by one (e.g. an async function) is not awaited, so it
// cannot abort the action, and its rejection is logged.

export type RebuildingEvent = {
  // what triggered the rebuild (e.g. the topology error)
  reason?: unknown
}

export type RebuiltEvent = {
  // what triggered the rebuild (e.g. the topology error)
  reason?: unknown
  // the generation of the new client (the one that failed if `error` is set)
  generation: number
  // set when the rebuild failed: the previous client is kept, or, with a
  // DisconnectedError, the connection was disconnected meanwhile
  error?: unknown
}

export type RebuildOptions = {
  // minimum time (ms) since connecting or the previous rebuild attempt
  // (successful, failed or aborted) before another rebuild
  cooldown?: number
  // delay (ms) before closing a replaced client, so in-flight ops can finish
  grace?: number
  // before a rebuild attempt; throw to abort it
  onRebuilding?: (event: RebuildingEvent) => void
  // after a rebuild attempt, whether it succeeded or failed
  onRebuilt?: (event: RebuiltEvent) => void
}

export type ConnectionOptions = MongoClientOptions & {
  // for every MongoClient created (on connect and on each rebuild), before it
  // connects, e.g. to attach monitoring listeners; throw to fail the connect
  $onConnecting?: (client: MongoClient, generation: number) => void
  // for every MongoClient created, after it connected or failed to connect
  // (`error` is set; a DisconnectedError if disconnect() was called meanwhile)
  $onConnected?: (
    client: MongoClient,
    generation: number,
    error?: unknown,
  ) => void
  // false disables the automatic rebuild; rebuild()/retry() still work
  $rebuild?: false | RebuildOptions
}

export class Connection {
  #client?: MongoClient = undefined
  #uri: string
  #options: MongoClientOptions
  #onConnecting: ConnectionOptions['$onConnecting']
  #onConnected: ConnectionOptions['$onConnected']
  #auto: boolean
  #cooldown: number
  #grace: number
  #onRebuilding: RebuildOptions['onRebuilding']
  #onRebuilt: RebuildOptions['onRebuilt']
  #generation = 0
  #attemptedAt = -Infinity
  #connecting?: Promise<MongoClient> = undefined
  #rebuilding?: Promise<boolean> = undefined
  #retiring = new Map<MongoClient, ReturnType<typeof setTimeout>>()
  // clients still connecting, closed right away by disconnect()
  #opening = new Set<MongoClient>()
  // disconnect() calls: a connect or rebuild that sees it change while waiting
  // drops its client instead of installing it
  #disconnects = 0

  get client(): MongoClient {
    if (this.#client === undefined) throw new DisconnectedError()
    return this.#client
  }

  get db(): Db {
    return this.client.db()
  }

  // increases by one for every MongoClient created
  get generation(): number {
    return this.#generation
  }

  constructor(uri: string, options: ConnectionOptions = {}) {
    const { $onConnecting, $onConnected, $rebuild, ...rest } = options
    this.#uri = uri
    this.#options = rest
    this.#onConnecting = $onConnecting
    this.#onConnected = $onConnected
    this.#auto = $rebuild !== false
    const {
      cooldown = 30_000,
      grace = 30_000,
      onRebuilding,
      onRebuilt,
    } = $rebuild || {}
    this.#cooldown = cooldown
    this.#grace = grace
    this.#onRebuilding = onRebuilding
    this.#onRebuilt = onRebuilt
  }

  // Concurrent calls share one client. Rejects with DisconnectedError if
  // disconnect() is called before it completes.
  async connect(): Promise<MongoClient> {
    if (this.#client !== undefined) return this.#client
    if (this.#connecting === undefined) {
      const connecting: Promise<MongoClient> = this.#connect().finally(() => {
        // a disconnect() meanwhile may have let a new connect() start
        if (this.#connecting === connecting) this.#connecting = undefined
      })
      this.#connecting = connecting
    }
    return await this.#connecting
  }

  async #connect(): Promise<MongoClient> {
    const disconnects = this.#disconnects
    const client = await this.#open(++this.#generation, disconnects)
    if (disconnects !== this.#disconnects) {
      await client.close().catch(console.error)
      throw new DisconnectedError()
    }
    this.#client = client
    this.#attemptedAt = Date.now()
    return client
  }

  // Close every client: the current one, the replaced ones still in their
  // grace period, and the ones still connecting (their connect() or rebuild()
  // is abandoned). Settles once they are all closed, rejecting with the first
  // close error if any.
  async disconnect(force = false): Promise<void> {
    ++this.#disconnects
    const closing: Promise<unknown>[] = []
    for (const [client, timer] of this.#retiring) {
      clearTimeout(timer)
      closing.push(client.close(force))
    }
    this.#retiring.clear()
    for (const client of this.#opening) closing.push(client.close(force))
    if (this.#client !== undefined) {
      const client = this.#client
      this.#client = undefined
      closing.push(client.close(force))
    }
    // the abandoned connect / rebuild settle once their clients are closed
    // (a client closed before the driver created its topology, e.g. during
    // SRV resolution, still finishes connecting first); a later connect() or
    // rebuild() starts afresh
    for (const pending of [this.#connecting, this.#rebuilding]) {
      if (pending !== undefined) closing.push(pending.catch(() => undefined))
    }
    this.#connecting = undefined
    this.#rebuilding = undefined
    // wait for every close even if one fails
    const results = await Promise.allSettled(closing)
    for (const result of results) {
      if (result.status === 'rejected') throw result.reason
    }
  }

  // Replace the MongoClient with a new one. Collections resolve
  // `connection.db` on every call, so they use the new client right away;
  // the replaced client is closed after the grace period (cursors, change
  // streams and sessions still open on it then fail). Concurrent calls
  // share one rebuild, and within the cooldown of connecting or the previous
  // attempt the current client is kept.
  // Resolves to whether the client was replaced (false within the cooldown, or
  // if disconnect() is called meanwhile). Rejects with DisconnectedError when
  // not connected, or, keeping the current client, with the error thrown by
  // onRebuilding or the error of connecting the new client.
  async rebuild(reason?: unknown): Promise<boolean> {
    if (this.#client === undefined) throw new DisconnectedError()
    if (this.#rebuilding !== undefined) return await this.#rebuilding
    if (Date.now() - this.#attemptedAt < this.#cooldown) return false
    // a failed (or aborted) attempt also starts the cooldown, so an
    // unreachable deployment is not retried back to back
    this.#attemptedAt = Date.now()
    const rebuilding: Promise<boolean> = this.#rebuild(reason).finally(() => {
      if (this.#rebuilding === rebuilding) this.#rebuilding = undefined
    })
    this.#rebuilding = rebuilding
    return await rebuilding
  }

  // Run fn; if it fails with a topology error, rebuild the client and run it
  // again (up to `retries` times). fn must be safe to repeat and must resolve
  // `connection.db` / collections inside itself: sessions and cursors created
  // outside fn stay bound to the replaced client.
  async retry<T>(
    fn: () => Promise<T>,
    { retries = 1 }: { retries?: number } = {},
  ): Promise<T> {
    for (let attempt = 0; ; ++attempt) {
      try {
        return await fn()
      } catch (err) {
        if (attempt >= retries || !isTopologyError(err)) throw err
        // a failed or aborted rebuild keeps the current client: run fn on it
        await this.rebuild(err).catch(() => undefined)
      }
    }
  }

  async #rebuild(reason: unknown): Promise<boolean> {
    // throws to abort the rebuild before it is attempted
    unawaited(this.#onRebuilding?.({ reason }))
    const old = this.#client
    if (old === undefined) throw new DisconnectedError()
    // captured: a connect() after a disconnect() meanwhile creates a client too
    const generation = ++this.#generation
    const disconnects = this.#disconnects
    let client: MongoClient
    try {
      client = await this.#open(generation, disconnects)
      if (disconnects !== this.#disconnects) {
        await client.close().catch(console.error)
        throw new DisconnectedError()
      }
    } catch (error) {
      notify(this.#onRebuilt, { reason, generation, error })
      // disconnected meanwhile: the rebuild is abandoned, not failed
      if (disconnects !== this.#disconnects) return false
      throw error
    }
    this.#client = client
    const timer = setTimeout(() => {
      this.#retiring.delete(old)
      old.close().catch(console.error)
    }, this.#grace)
    ;(timer as { unref?: () => void }).unref?.()
    this.#retiring.set(old, timer)
    notify(this.#onRebuilt, { reason, generation })
    return true
  }

  // Create and connect a client. If disconnect() is called meanwhile
  // (`disconnects` changes) and that makes connecting fail, rejects with
  // DisconnectedError; if connecting succeeds anyway, the caller must check
  // `disconnects` itself.
  async #open(generation: number, disconnects: number): Promise<MongoClient> {
    const client = new MongoClient(this.#uri, this.#options)
    ;['error', 'timeout', 'parseError'].forEach((event) => {
      client.on(event as never, (...args: unknown[]) =>
        console.error(`db event ${event}: ${JSON.stringify(args)}`),
      )
    })
    if (this.#auto) {
      // The driver marks a server unknown, with the error, when an operation
      // fails with a state change error; rebuild if it is a topology error.
      client.on(
        'serverDescriptionChanged',
        ({ newDescription }: ServerDescriptionChangedEvent) => {
          if (this.#client !== client) return
          if (!isTopologyError(newDescription.error)) return
          this.rebuild(newDescription.error).catch(() => undefined)
        },
      )
    }
    try {
      unawaited(this.#onConnecting?.(client, generation))
    } catch (err) {
      // aborted before connecting: $onConnected is not called
      client.close().catch(() => undefined)
      throw err
    }
    this.#opening.add(client)
    try {
      await client.connect()
    } catch (err) {
      // even if disconnect() already closed it: a close before the driver
      // created its topology (e.g. during SRV resolution) releases nothing
      client.close().catch(() => undefined)
      const error =
        disconnects === this.#disconnects ? err : new DisconnectedError()
      notify(this.#onConnected, client, generation, error)
      throw error
    } finally {
      this.#opening.delete(client)
    }
    notify(this.#onConnected, client, generation)
    return client
  }

  async transaction<T>(
    fn: (options: CommandOperationOptions) => Promise<T>,
    options: CommandOperationOptions = {},
  ): Promise<T> {
    if (options?.session !== undefined) return await fn(options)
    const session = this.client.startSession()
    try {
      return await session.withTransaction(
        async (session) => await fn({ ...options, session }),
      )
    } catch (err) {
      if (isDuplicationError(err)) throw new ConflictError()
      if (isTransactionError(err)) throw new TransactionError()
      throw err
    } finally {
      await session.endSession()
    }
  }

  async migrate<Doc extends Document>({
    name,
    validator,
    indexes = {},
  }: {
    name: string
    validator?: Document
    indexes?: Document
  }): Promise<void> {
    const collection = await (async () => {
      try {
        return await this.db.createCollection<Doc>(name)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (err) {
        return this.db.collection<Doc>(name)
      }
    })()

    // drop the removed indexes
    const names = (await collection.listIndexes().toArray())
      .map(({ name }) => name)
      .filter((name) => !(name === '_id_' || name in indexes))
    for (const name of names) await collection.dropIndex(name)

    // create/update the current index
    for (const name of Object.keys(indexes)) {
      const { keys, options = {} } = indexes[name]
      try {
        // try to create the index
        await collection.createIndex(keys, { name, ...options })
      } catch (err) {
        // if fails, drop it and try it again
        console.warn('fail to create index:', err)
        try {
          await collection.dropIndex(name)
        } catch (err) {
          console.warn('fail to drop index:', err)
        }
        await collection.createIndex(keys, { name, ...options })
      }
    }

    // update the validator
    if (validator !== undefined) {
      await this.db.command({
        collMod: name,
        validator,
        validationLevel: 'strict',
        validationAction: 'error',
      })
    }
  }
}

// call an after-hook: it cannot change the outcome of the action, so an error
// it throws is logged instead of turning the action into a failure
function notify<A extends unknown[]>(
  hook: ((...args: A) => void) | undefined,
  ...args: A
): void {
  try {
    unawaited(hook?.(...args))
  } catch (err) {
    console.error(err)
  }
}

// a hook returning a promise is not awaited: log its rejection instead of
// leaving it unhandled (which would crash the process on Node by default).
// Any thenable counts, not only this realm's Promise (e.g. under jest's vm).
function unawaited(result: unknown): void {
  const then = (result as PromiseLike<unknown> | null | undefined)?.then
  if (typeof then === 'function') Promise.resolve(result).catch(console.error)
}

export function isTransactionError(err: unknown): boolean {
  return (
    err instanceof MongoError &&
    err.errorLabels !== undefined &&
    Array.isArray(err.errorLabels) &&
    err.errorLabels.includes('TransientTransactionError')
  )
}

export function isDuplicationError(err: unknown): boolean {
  return err instanceof MongoError && err.code === 11000
}
