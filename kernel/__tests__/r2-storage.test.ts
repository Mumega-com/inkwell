import { describe, it, expect, vi } from 'vitest'
import { R2StorageAdapter } from '../adapters/r2-storage'

function mockR2() {
  return {
    get: vi.fn(),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    list: vi.fn(),
  }
}

describe('R2StorageAdapter', () => {
  it('get returns body and contentType for existing object', async () => {
    const r2 = mockR2()
    const stream = new ReadableStream()
    r2.get.mockResolvedValue({
      body: stream,
      httpMetadata: { contentType: 'image/png' },
    })
    const adapter = new R2StorageAdapter(r2)

    const result = await adapter.get('photos/cat.png')
    expect(result).toEqual({ body: stream, contentType: 'image/png' })
  })

  it('get returns null for missing object', async () => {
    const r2 = mockR2()
    r2.get.mockResolvedValue(null)
    const adapter = new R2StorageAdapter(r2)

    expect(await adapter.get('missing')).toBeNull()
  })

  it('get defaults contentType to application/octet-stream', async () => {
    const r2 = mockR2()
    r2.get.mockResolvedValue({ body: new ReadableStream() })
    const adapter = new R2StorageAdapter(r2)

    const result = await adapter.get('file.bin')
    expect(result?.contentType).toBe('application/octet-stream')
  })

  it('put passes contentType in httpMetadata', async () => {
    const r2 = mockR2()
    const adapter = new R2StorageAdapter(r2)

    await adapter.put('file.css', 'body{}', 'text/css')
    expect(r2.put).toHaveBeenCalledWith('file.css', 'body{}', { httpMetadata: { contentType: 'text/css' } })
  })

  it('put without contentType passes no options', async () => {
    const r2 = mockR2()
    const adapter = new R2StorageAdapter(r2)

    await adapter.put('file.bin', 'data')
    expect(r2.put).toHaveBeenCalledWith('file.bin', 'data', undefined)
  })

  it('delete delegates to r2.delete', async () => {
    const r2 = mockR2()
    const adapter = new R2StorageAdapter(r2)

    await adapter.delete('old-file.png')
    expect(r2.delete).toHaveBeenCalledWith('old-file.png')
  })

  it('list returns object keys', async () => {
    const r2 = mockR2()
    r2.list.mockResolvedValue({
      objects: [{ key: 'a.png' }, { key: 'b.jpg' }],
    })
    const adapter = new R2StorageAdapter(r2)

    const result = await adapter.list('photos/')
    expect(r2.list).toHaveBeenCalledWith({ prefix: 'photos/' })
    expect(result).toEqual(['a.png', 'b.jpg'])
  })
})
