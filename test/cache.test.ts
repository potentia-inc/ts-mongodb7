import { strict as assert } from 'node:assert'
import { describe, test } from 'node:test'
import { Cache } from '../src/cache.js'
import { sleep } from '../src/util.js'

describe('cache', () => {
  test('set() and get()', () => {
    const cache = new Cache<string, number>({ ttl: 60_000, capacity: 1000 })
    assert.equal(cache.size, 0)
    assert.ok(!cache.isFull())
    assert.ok(cache.isEmpty())
    cache.set('a', 1)
    cache.set('b', 2)
    assert.equal(cache.get('a'), 1)
    assert.equal(cache.get('b'), 2)
    assert.ok(!cache.has('c'))
    assert.equal(cache.size, 2)
    assert.ok(!cache.isFull())
    assert.ok(!cache.isEmpty())
  })

  test('get() when expired', async () => {
    const cache = new Cache<string, number>({ ttl: 1, capacity: 1000 })
    cache.set('a', 1)
    cache.set('b', 2)
    assert.equal(cache.size, 2)
    assert.ok(!cache.isFull())
    assert.ok(!cache.isEmpty())
    await sleep(10)
    assert.ok(!cache.has('a'))
    assert.ok(!cache.has('b'))
    assert.ok(!cache.has('c'))
    assert.equal(cache.size, 0)
    assert.ok(!cache.isFull())
    assert.ok(cache.isEmpty())
  })

  test('set() with full', () => {
    const cache = new Cache<string, number>({ ttl: 60_000, capacity: 3 })
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3)
    assert.equal(cache.size, 3)
    assert.ok(cache.isFull())
    assert.ok(!cache.isEmpty())
    cache.set('d', 4)
    cache.set('a', 5)
    assert.equal(cache.size, 3)
    assert.ok(cache.isFull())
    assert.ok(!cache.isEmpty())
    assert.equal(cache.get('a'), 5)
    assert.ok(!cache.has('b'))
    assert.equal(cache.get('c'), 3)
    assert.equal(cache.get('d'), 4)
    assert.ok(!cache.has('e'))
  })

  test('delete()', () => {
    const cache = new Cache<string, number>({ ttl: 60_000, capacity: 3 })
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3)
    assert.equal(cache.size, 3)
    assert.ok(cache.isFull())
    assert.ok(!cache.isEmpty())
    assert.equal(cache.get('a'), 1)
    assert.equal(cache.get('b'), 2)
    assert.equal(cache.get('c'), 3)
    cache.delete('b')
    assert.equal(cache.size, 2)
    assert.ok(!cache.isFull())
    assert.ok(!cache.isEmpty())
    assert.equal(cache.get('a'), 1)
    assert.ok(!cache.has('b'))
    assert.equal(cache.get('c'), 3)
  })

  test('clear()', () => {
    const cache = new Cache<string, number>({ ttl: 60_000, capacity: 3 })
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3)
    assert.equal(cache.size, 3)
    assert.ok(cache.isFull())
    assert.ok(!cache.isEmpty())
    assert.equal(cache.get('a'), 1)
    assert.equal(cache.get('b'), 2)
    assert.equal(cache.get('c'), 3)
    cache.clear()
    assert.equal(cache.size, 0)
    assert.ok(!cache.isFull())
    assert.ok(cache.isEmpty())
    assert.ok(!cache.has('a'))
    assert.ok(!cache.has('b'))
    assert.ok(!cache.has('c'))
  })

  test('set() with full and no expiration', () => {
    const cache = new Cache<string, number>({ capacity: 3 })
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3)
    assert.equal(cache.size, 3)
    assert.ok(cache.isFull())
    assert.ok(!cache.isEmpty())

    cache.set('d', 4)
    cache.set('a', 5)
    assert.equal(cache.size, 3)
    assert.ok(cache.isFull())
    assert.ok(!cache.isEmpty())
    assert.equal(cache.get('a'), 5)
    assert.ok(!cache.has('b'))
    assert.equal(cache.get('c'), 3)
    assert.equal(cache.get('d'), 4)
    assert.ok(!cache.has('e'))
  })

  test('scrub() reclaims expired entries once the interval elapses', () => {
    // explicit `time` arguments make the periodic scrub deterministic
    const cache = new Cache<string, number>({
      capacity: 10,
      ttl: 100,
      interval: 50,
    })
    cache.set('a', 1, new Date(0))
    cache.set('b', 2, new Date(0))
    // a read past the interval but before expiry runs scrub without dropping anything
    assert.equal(cache.get('a', new Date(60)), 1)
    assert.equal(cache.size, 2)
    // a read past expiry scrubs the stale entries out of the backing list
    assert.equal(cache.get('a', new Date(150)), undefined)
    assert.equal(cache.size, 0)
    assert.equal(cache.list.length, 0)
  })

  test('evict() keeps a key that still has another live reference', () => {
    const cache = new Cache<string, number>({ capacity: 2 })
    cache.set('a', 1)
    cache.set('a', 2) // 'a' now occupies two list slots (count 2)
    cache.set('b', 3) // full: a, b
    cache.set('c', 4) // evicts the oldest key ('a') across both of its slots
    assert.equal(cache.size, 2)
    assert.ok(!cache.has('a'))
    assert.equal(cache.get('b'), 3)
    assert.equal(cache.get('c'), 4)
  })
})
