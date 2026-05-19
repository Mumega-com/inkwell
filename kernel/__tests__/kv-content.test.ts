import { describe, it, expect, vi } from 'vitest'
import { KVContentAdapter } from '../adapters/kv-content'

function mockKV() {
  return {
    get: vi.fn(),
    put: vi.fn().mockResolvedValue(undefined),
    list: vi.fn(),
  }
}

describe('KVContentAdapter', () => {
  it('getPage returns content for existing key', async () => {
    const kv = mockKV()
    kv.get.mockResolvedValue('<html>hello</html>')
    const adapter = new KVContentAdapter(kv)

    const result = await adapter.getPage('tenant:page:index.html')
    expect(kv.get).toHaveBeenCalledWith('tenant:page:index.html')
    expect(result).toBe('<html>hello</html>')
  })

  it('getPage returns null for missing key', async () => {
    const kv = mockKV()
    kv.get.mockResolvedValue(null)
    const adapter = new KVContentAdapter(kv)

    expect(await adapter.getPage('missing')).toBeNull()
  })

  it('putPage stores HTML content', async () => {
    const kv = mockKV()
    const adapter = new KVContentAdapter(kv)

    await adapter.putPage('key', '<html>test</html>')
    expect(kv.put).toHaveBeenCalledWith('key', '<html>test</html>')
  })

  it('listPages returns key names matching prefix', async () => {
    const kv = mockKV()
    kv.list.mockResolvedValue({
      keys: [
        { name: 'tenant:page:index.html' },
        { name: 'tenant:page:about.html' },
      ],
    })
    const adapter = new KVContentAdapter(kv)

    const result = await adapter.listPages('tenant:page:')
    expect(kv.list).toHaveBeenCalledWith({ prefix: 'tenant:page:' })
    expect(result).toEqual(['tenant:page:index.html', 'tenant:page:about.html'])
  })
})
