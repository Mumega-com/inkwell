import { describe, it, expect, vi } from 'vitest'
import { D1DatabaseAdapter } from '../adapters/d1'

function mockD1() {
  const stmt = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn(),
    all: vi.fn(),
    run: vi.fn(),
  }
  const db = {
    prepare: vi.fn().mockReturnValue(stmt),
    batch: vi.fn().mockResolvedValue([]),
  }
  return { db, stmt }
}

describe('D1DatabaseAdapter', () => {
  describe('query', () => {
    it('returns results array from .all()', async () => {
      const { db, stmt } = mockD1()
      stmt.all.mockResolvedValue({ results: [{ id: 1 }, { id: 2 }] })

      const adapter = new D1DatabaseAdapter(db)
      const result = await adapter.query('SELECT * FROM users')

      expect(db.prepare).toHaveBeenCalledWith('SELECT * FROM users')
      expect(stmt.bind).not.toHaveBeenCalled()
      expect(result).toEqual([{ id: 1 }, { id: 2 }])
    })

    it('binds params when provided', async () => {
      const { db, stmt } = mockD1()
      stmt.all.mockResolvedValue({ results: [{ id: 1 }] })

      const adapter = new D1DatabaseAdapter(db)
      await adapter.query('SELECT * FROM users WHERE id = ?', [1])

      expect(stmt.bind).toHaveBeenCalledWith(1)
    })

    it('skips bind for empty params', async () => {
      const { db, stmt } = mockD1()
      stmt.all.mockResolvedValue({ results: [] })

      const adapter = new D1DatabaseAdapter(db)
      await adapter.query('SELECT 1', [])

      expect(stmt.bind).not.toHaveBeenCalled()
    })
  })

  describe('queryOne', () => {
    it('returns first row from .first()', async () => {
      const { db, stmt } = mockD1()
      stmt.first.mockResolvedValue({ id: 1, name: 'Alice' })

      const adapter = new D1DatabaseAdapter(db)
      const result = await adapter.queryOne('SELECT * FROM users WHERE id = ?', [1])

      expect(stmt.bind).toHaveBeenCalledWith(1)
      expect(result).toEqual({ id: 1, name: 'Alice' })
    })

    it('returns null when no rows', async () => {
      const { db, stmt } = mockD1()
      stmt.first.mockResolvedValue(null)

      const adapter = new D1DatabaseAdapter(db)
      const result = await adapter.queryOne('SELECT * FROM users WHERE id = ?', [999])

      expect(result).toBeNull()
    })
  })

  describe('execute', () => {
    it('returns changes count from .run()', async () => {
      const { db, stmt } = mockD1()
      stmt.run.mockResolvedValue({ meta: { changes: 3 } })

      const adapter = new D1DatabaseAdapter(db)
      const result = await adapter.execute('DELETE FROM users WHERE active = ?', [false])

      expect(result).toEqual({ changes: 3 })
    })
  })

  describe('batch', () => {
    it('prepares and binds all statements', async () => {
      const stmts = [
        { bind: vi.fn().mockReturnThis() },
        { bind: vi.fn().mockReturnThis() },
      ]
      const db = {
        prepare: vi.fn()
          .mockReturnValueOnce(stmts[0])
          .mockReturnValueOnce(stmts[1]),
        batch: vi.fn().mockResolvedValue([]),
      }

      const adapter = new D1DatabaseAdapter(db as any)
      await adapter.batch([
        { sql: 'INSERT INTO a VALUES (?)', params: [1] },
        { sql: 'INSERT INTO b VALUES (?)', params: [2] },
      ])

      expect(db.prepare).toHaveBeenCalledTimes(2)
      expect(stmts[0].bind).toHaveBeenCalledWith(1)
      expect(stmts[1].bind).toHaveBeenCalledWith(2)
      expect(db.batch).toHaveBeenCalledWith(stmts)
    })
  })
})
