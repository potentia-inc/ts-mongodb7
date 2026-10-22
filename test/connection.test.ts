import { strict as assert } from 'node:assert'
import { describe, test } from 'node:test'
import {
  MongoClient,
  MongoNetworkError,
  MongoServerError,
  MongoServerSelectionError,
} from 'mongodb'
import type { ServerDescriptionChangedEvent } from 'mongodb'
import type { ConnectionOptions, RebuiltEvent } from '../src/connection.js'
import { Connection, isTopologyError } from '../src/connection.js'
import { DisconnectedError } from '../src/error.js'

const { MONGO_URI } = process.env
assert(MONGO_URI !== undefined)

const NOT_PRIMARY = () =>
  new MongoServerError({
    ok: 0,
    code: 13435,
    errmsg: 'not primary and secondaryOk=false',
  })

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function withConnection(
  options: ConnectionOptions,
  fn: (connection: Connection) => Promise<void>,
) {
  const connection = new Connection(MONGO_URI!, options)
  await connection.connect()
  try {
    await fn(connection)
  } finally {
    await connection.disconnect()
  }
}

// simulate the driver marking a server unknown after a topology error
function emitServerError(client: MongoClient, error: unknown) {
  const event = { newDescription: { error } } as ServerDescriptionChangedEvent
  client.emit('serverDescriptionChanged', event)
}

describe('isTopologyError', () => {
  test('topology errors', () => {
    for (const code of [10107, 13435, 13436, 11600, 11602, 189, 91]) {
      assert.ok(
        isTopologyError(new MongoServerError({ ok: 0, code })),
        `${code}`,
      )
    }
    assert.ok(
      isTopologyError(new MongoServerSelectionError('timeout', {} as never)),
    )
  })

  test('other errors', () => {
    assert.ok(!isTopologyError(new MongoServerError({ ok: 0, code: 11000 })))
    assert.ok(!isTopologyError(new MongoNetworkError('reset')))
    assert.ok(!isTopologyError(new Error('foobar')))
    assert.ok(!isTopologyError(undefined))
  })
})

describe('Connection', () => {
  test('$-options are not passed to MongoClient', async () => {
    // the driver throws on unsupported options
    await withConnection(
      {
        $onConnecting: () => undefined,
        $onConnected: () => undefined,
        $rebuild: { cooldown: 0, onRebuilding: () => undefined },
      },
      async (connection) => {
        assert.equal((await connection.db.command({ ping: 1 })).ok, 1)
      },
    )
  })

  test('$onConnecting/$onConnected are called for every client', async () => {
    const calls: string[] = []
    const changes = new Map<number, number>()
    await withConnection(
      {
        $onConnecting: (client, generation) => {
          calls.push(`connecting ${generation}`)
          // attached before connecting: the initial discovery is observed
          client.on('topologyDescriptionChanged', () =>
            changes.set(generation, (changes.get(generation) ?? 0) + 1),
          )
        },
        $onConnected: (_, generation) => {
          // after connecting: the discovery has already happened
          assert.ok((changes.get(generation) ?? 0) > 0)
          calls.push(`connected ${generation}`)
        },
        $rebuild: { cooldown: 0, grace: 0 },
      },
      async (connection) => {
        assert.equal(connection.generation, 1)
        assert.ok(await connection.rebuild())
        assert.equal(connection.generation, 2)
      },
    )
    assert.deepEqual(calls, [
      'connecting 1',
      'connected 1',
      'connecting 2',
      'connected 2',
    ])
    assert.ok((changes.get(1) ?? 0) > 0)
    assert.ok((changes.get(2) ?? 0) > 0)
  })

  test('rebuild() swaps the client', async () => {
    const events: RebuiltEvent[] = []
    await withConnection(
      {
        $rebuild: { cooldown: 0, grace: 200, onRebuilt: (e) => events.push(e) },
      },
      async (connection) => {
        const old = connection.client
        const collection = () => connection.db.collection('connection_tests')
        await collection().insertOne({ key: 'rebuild' })
        // an operation in flight on the old client finishes during the grace
        const inflight = collection().findOne({ key: 'rebuild' })
        assert.ok(await connection.rebuild('test'))
        assert.notEqual(connection.client, old)
        assert.equal((await inflight)?.key, 'rebuild')
        assert.equal(
          (await collection().findOne({ key: 'rebuild' }))?.key,
          'rebuild',
        )
        await collection().deleteMany({ key: 'rebuild' })
        // the old client is closed after the grace
        await sleep(400)
        await assert.rejects(old.db().command({ ping: 1 }))
      },
    )
    assert.deepEqual(events, [{ reason: 'test', generation: 2 }])
  })

  test('concurrent rebuilds share one', async () => {
    await withConnection(
      { $rebuild: { cooldown: 0, grace: 0 } },
      async (connection) => {
        const results = await Promise.all([
          connection.rebuild(),
          connection.rebuild(),
          connection.rebuild(),
        ])
        assert.deepEqual(results, [true, true, true])
        assert.equal(connection.generation, 2)
      },
    )
  })

  test('within the cooldown of connecting the client is kept', async () => {
    await withConnection(
      { $rebuild: { cooldown: 60_000 } },
      async (connection) => {
        const old = connection.client
        assert.equal(await connection.rebuild(), false)
        assert.equal(connection.client, old)
        assert.equal(connection.generation, 1)
      },
    )
  })

  test('a failed rebuild keeps the client and starts the cooldown', async () => {
    const events: RebuiltEvent[] = []
    const connected: number[] = []
    await withConnection(
      {
        $onConnecting: (_, generation) => {
          if (generation === 2) throw new Error('foobar')
        },
        // not called for an aborted connect
        $onConnected: (_, generation) => connected.push(generation),
        $rebuild: { cooldown: 200, onRebuilt: (e) => events.push(e) },
      },
      async (connection) => {
        await sleep(300)
        const old = connection.client
        await assert.rejects(connection.rebuild('test'), /foobar/)
        assert.equal(connection.client, old)
        assert.equal(events.length, 1)
        assert.equal(events[0].generation, 2)
        assert.match(String(events[0].error), /foobar/)
        // no attempt right after the failure
        assert.equal(await connection.rebuild(), false)
        assert.equal(connection.generation, 2)
        await sleep(300)
        assert.ok(await connection.rebuild())
        assert.equal(connection.generation, 3)
        assert.deepEqual(connected, [1, 3])
      },
    )
  })

  test('$onConnected is called when connecting fails', async () => {
    const calls: [number, unknown][] = []
    const connection = new Connection(
      'mongodb://127.0.0.1:1/?directConnection=true&serverSelectionTimeoutMS=100',
      {
        $onConnected: (_, generation, error) => calls.push([generation, error]),
      },
    )
    const error = await connection.connect().catch((err: unknown) => err)
    assert.ok(error instanceof Error)
    assert.deepEqual(calls, [[1, error]])
    assert.throws(() => connection.client, DisconnectedError)
  })

  test('a throwing after-hook does not fail the action', async () => {
    const fail = () => {
      throw new Error('foobar')
    }
    await withConnection(
      {
        $onConnected: fail,
        $rebuild: { cooldown: 0, grace: 0, onRebuilt: fail },
      },
      async (connection) => {
        const old = connection.client
        assert.ok(await connection.rebuild())
        assert.notEqual(connection.client, old)
      },
    )
  })

  test('a rejecting async hook is logged, not left unhandled', async () => {
    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown) => unhandled.push(reason)
    process.on('unhandledRejection', onUnhandled)
    const fail = async () => {
      throw new Error('foobar')
    }
    try {
      await withConnection(
        {
          $onConnecting: fail,
          $onConnected: fail,
          $rebuild: {
            cooldown: 0,
            grace: 0,
            onRebuilding: fail,
            onRebuilt: fail,
          },
        },
        async (connection) => {
          const old = connection.client
          // a rejecting async onRebuilding does not abort the rebuild
          assert.ok(await connection.rebuild())
          assert.notEqual(connection.client, old)
        },
      )
      await sleep(10)
    } finally {
      process.off('unhandledRejection', onUnhandled)
    }
    assert.deepEqual(unhandled, [])
  })

  test('a throwing onRebuilding aborts the rebuild', async () => {
    const events: RebuiltEvent[] = []
    const reasons: unknown[] = []
    await withConnection(
      {
        $rebuild: {
          cooldown: 200,
          onRebuilding: ({ reason }) => {
            reasons.push(reason)
            if (reason === 'abort') throw new Error('foobar')
          },
          onRebuilt: (e) => events.push(e),
        },
      },
      async (connection) => {
        await sleep(300)
        const old = connection.client
        // concurrent calls share the aborted rebuild
        const results = await Promise.allSettled([
          connection.rebuild('abort'),
          connection.rebuild('other'),
        ])
        assert.deepEqual(
          results.map(({ status }) => status),
          ['rejected', 'rejected'],
        )
        assert.equal(connection.client, old)
        assert.equal(connection.generation, 1)
        assert.deepEqual(events, [])
        // an aborted attempt starts the cooldown
        assert.equal(await connection.rebuild('test'), false)
        await sleep(300)
        assert.ok(await connection.rebuild('test'))
        assert.deepEqual(reasons, ['abort', 'test'])
        assert.deepEqual(events, [{ reason: 'test', generation: 2 }])
      },
    )
  })

  test('rebuild() requires a connection', async () => {
    const connection = new Connection(MONGO_URI)
    await assert.rejects(connection.rebuild(), DisconnectedError)
  })

  test('disconnect() closes replaced clients right away', async () => {
    const connection = new Connection(MONGO_URI, {
      $rebuild: { cooldown: 0, grace: 60_000 },
    })
    await connection.connect()
    const old = connection.client
    assert.ok(await connection.rebuild())
    await connection.disconnect()
    await assert.rejects(old.db().command({ ping: 1 }))
    assert.throws(() => connection.client, DisconnectedError)
  })

  test('disconnect() closes every client even if one fails', async () => {
    const created: MongoClient[] = []
    const connection = new Connection(MONGO_URI, {
      $onConnecting: (client, generation) => {
        created.push(client)
        if (generation !== 1) return
        const close = client.close.bind(client)
        client.close = async (force?: boolean) => {
          await close(force)
          throw new Error('foobar')
        }
      },
      $rebuild: { cooldown: 0, grace: 60_000 },
    })
    await connection.connect()
    assert.ok(await connection.rebuild())
    // the replaced client fails to close; the current one is still closed
    await assert.rejects(connection.disconnect(), /foobar/)
    assert.throws(() => connection.client, DisconnectedError)
    await assert.rejects(created[1].db().command({ ping: 1 }))
  })

  test('disconnect() during a rebuild drops the new client', async () => {
    const created: MongoClient[] = []
    const events: RebuiltEvent[] = []
    const connection = new Connection(MONGO_URI, {
      $onConnecting: (client) => created.push(client),
      $rebuild: { cooldown: 0, grace: 0, onRebuilt: (e) => events.push(e) },
    })
    await connection.connect()
    const rebuilding = connection.rebuild('test')
    await connection.disconnect()
    assert.equal(await rebuilding, false)
    assert.throws(() => connection.client, DisconnectedError)
    await assert.rejects(created[1].db().command({ ping: 1 }))
    // onRebuilt is still called after the attempt
    assert.equal(events.length, 1)
    assert.equal(events[0].reason, 'test')
    assert.equal(events[0].generation, 2)
    assert.ok(events[0].error instanceof DisconnectedError)
  })

  test('disconnect() during connect() abandons the connect', async () => {
    const created: MongoClient[] = []
    const connection = new Connection(MONGO_URI, {
      $onConnecting: (client) => created.push(client),
    })
    // asserted right away: the rejection must not go unhandled meanwhile
    const connecting = assert.rejects(connection.connect(), DisconnectedError)
    await connection.disconnect()
    await connecting
    assert.throws(() => connection.client, DisconnectedError)
    await assert.rejects(created[0].db().command({ ping: 1 }))
  })

  test('connect() after disconnect() during connect() starts afresh', async () => {
    const connection = new Connection(MONGO_URI)
    const connecting = assert.rejects(connection.connect(), DisconnectedError)
    const disconnecting = connection.disconnect()
    const client = await connection.connect()
    await disconnecting
    await connecting
    try {
      assert.equal(connection.client, client)
      assert.equal(connection.generation, 2)
      assert.equal((await connection.db.command({ ping: 1 })).ok, 1)
    } finally {
      await connection.disconnect()
    }
  })

  test('concurrent connects share one client', async () => {
    const connection = new Connection(MONGO_URI)
    try {
      const clients = await Promise.all([
        connection.connect(),
        connection.connect(),
      ])
      assert.equal(clients[0], clients[1])
      assert.equal(connection.client, clients[0])
      assert.equal(connection.generation, 1)
    } finally {
      await connection.disconnect()
    }
  })

  test('a topology error rebuilds automatically', async () => {
    const events: RebuiltEvent[] = []
    let rebuilt!: () => void
    const done = new Promise<void>((resolve) => (rebuilt = resolve))
    await withConnection(
      {
        $rebuild: {
          cooldown: 0,
          grace: 0,
          onRebuilt: (e) => {
            events.push(e)
            rebuilt()
          },
        },
      },
      async (connection) => {
        const error = NOT_PRIMARY()
        emitServerError(connection.client, error)
        emitServerError(connection.client, NOT_PRIMARY()) // shares the rebuild
        emitServerError(connection.client, new MongoNetworkError('reset'))
        await done
        assert.equal(connection.generation, 2)
        assert.equal(events.length, 1)
        assert.equal(events[0].reason, error)
        assert.equal(events[0].error, undefined)
      },
    )
  })

  test('$rebuild: false disables the automatic rebuild', async () => {
    await withConnection({ $rebuild: false }, async (connection) => {
      // observe the call itself: with the default cooldown a rebuild right
      // after connecting would not replace the client anyway
      const reasons: unknown[] = []
      connection.rebuild = async (reason?: unknown) => {
        reasons.push(reason)
        return false
      }
      emitServerError(connection.client, NOT_PRIMARY())
      await sleep(10)
      assert.deepEqual(reasons, [])
    })
  })

  test('the automatic rebuild ignores a replaced client', async () => {
    await withConnection(
      { $rebuild: { cooldown: 0, grace: 60_000 } },
      async (connection) => {
        const old = connection.client
        assert.ok(await connection.rebuild())
        const reasons: unknown[] = []
        connection.rebuild = async (reason?: unknown) => {
          reasons.push(reason)
          return false
        }
        // a late error on the client in its grace period
        emitServerError(old, NOT_PRIMARY())
        await sleep(10)
        assert.deepEqual(reasons, [])
        // the current client still triggers it
        const error = NOT_PRIMARY()
        emitServerError(connection.client, error)
        assert.deepEqual(reasons, [error])
      },
    )
  })

  test('retry() rebuilds and runs again on a topology error', async () => {
    await withConnection(
      { $rebuild: { cooldown: 0, grace: 0 } },
      async (connection) => {
        const clients: MongoClient[] = []
        const result = await connection.retry(async () => {
          clients.push(connection.client)
          if (clients.length === 1) throw NOT_PRIMARY()
          return (await connection.db.command({ ping: 1 })).ok
        })
        assert.equal(result, 1)
        assert.equal(clients.length, 2)
        assert.notEqual(clients[0], clients[1])
      },
    )
  })

  test('retry() gives up after the retries', async () => {
    await withConnection(
      { $rebuild: { cooldown: 0, grace: 0 } },
      async (connection) => {
        let calls = 0
        await assert.rejects(
          connection.retry(async () => {
            ++calls
            throw NOT_PRIMARY()
          }),
          MongoServerError,
        )
        assert.equal(calls, 2)
      },
    )
  })

  test('retry() does not retry other errors', async () => {
    await withConnection({}, async (connection) => {
      let calls = 0
      await assert.rejects(
        connection.retry(async () => {
          ++calls
          throw new Error('foobar')
        }),
        /foobar/,
      )
      assert.equal(calls, 1)
      assert.equal(connection.generation, 1)
    })
  })
})
