import { describe, it, expect } from 'vitest'
import { compileMdx } from '../processors/mdx-compiler'

describe('compileMdx', () => {
  describe('frontmatter extraction', () => {
    it('extracts title and tags from YAML frontmatter', () => {
      const source = '---\ntitle: "Hello"\ntags: [a, b]\n---\nbody'
      const result = compileMdx(source)

      expect(result.frontmatter.title).toBe('Hello')
      expect(result.frontmatter.tags).toEqual(['a', 'b'])
    })

    it('extracts boolean and number values', () => {
      const source = '---\ndraft: true\norder: 5\n---\ncontent'
      const result = compileMdx(source)

      expect(result.frontmatter.draft).toBe(true)
      expect(result.frontmatter.order).toBe(5)
    })

    it('handles list-style YAML arrays', () => {
      const source = '---\ntags:\n- alpha\n- beta\n---\ncontent'
      const result = compileMdx(source)

      expect(result.frontmatter.tags).toEqual(['alpha', 'beta'])
    })
  })

  describe('body without frontmatter', () => {
    it('returns empty frontmatter for plain text', () => {
      const result = compileMdx('Just some text')

      expect(result.frontmatter).toEqual({})
      expect(result.html).toContain('Just some text')
    })
  })

  describe('wikilink extraction', () => {
    it('extracts simple wikilinks', () => {
      const result = compileMdx('Check [[my-page]] here')

      expect(result.wikilinks).toEqual(['my-page'])
      expect(result.html).toContain('<a href="/my-page"')
      expect(result.html).toContain('class="wikilink"')
    })

    it('extracts wikilinks with display text', () => {
      const result = compileMdx('See [[other|Other Page]]')

      expect(result.wikilinks).toEqual(['other'])
      expect(result.html).toContain('<a href="/other"')
      expect(result.html).toContain('Other Page</a>')
    })

    it('extracts multiple wikilinks from one source', () => {
      const result = compileMdx('Check [[my-page]] and [[other|Other Page]]')

      expect(result.wikilinks).toEqual(['my-page', 'other'])
      expect(result.html).toContain('<a href="/my-page"')
      expect(result.html).toContain('<a href="/other"')
    })

    it('normalizes slugs to lowercase with hyphens', () => {
      const result = compileMdx('See [[My Cool Page]]')

      expect(result.wikilinks).toEqual(['my-cool-page'])
      expect(result.html).toContain('href="/my-cool-page"')
    })
  })

  describe('wikilink with custom basePath', () => {
    it('uses the provided basePath in hrefs', () => {
      const result = compileMdx('Link to [[my-page]]', { basePath: '/docs/' })

      expect(result.html).toContain('href="/docs/my-page"')
    })

    it('defaults to / when no basePath given', () => {
      const result = compileMdx('Link to [[my-page]]')

      expect(result.html).toContain('href="/my-page"')
    })
  })

  describe('block syntax - tldr', () => {
    it('renders tldr block with correct class', () => {
      const source = '::tldr\nSummary here\n::'
      const result = compileMdx(source)

      expect(result.html).toContain('<div class="ink-tldr">')
      expect(result.html).toContain('Summary here')
    })
  })

  describe('block syntax - callout', () => {
    it('renders callout with warning type', () => {
      const source = '::callout[warning]\nBe careful\n::'
      const result = compileMdx(source)

      expect(result.html).toContain('<div class="ink-callout ink-callout-warning">')
      expect(result.html).toContain('Be careful')
    })

    it('defaults to info for unknown callout types', () => {
      const source = '::callout[unknown]\nSomething\n::'
      const result = compileMdx(source)

      expect(result.html).toContain('ink-callout-info')
    })
  })

  describe('block syntax - metric', () => {
    it('renders metric with value, label, and trend', () => {
      const source = '::metric{value="42" label="Score" trend="up"}'
      const result = compileMdx(source)

      expect(result.html).toContain('<div class="ink-metric">')
      expect(result.html).toContain('42')
      expect(result.html).toContain('Score')
      expect(result.html).toContain('ink-metric-trend--up')
    })
  })

  describe('block syntax - pullquote', () => {
    it('renders pullquote as blockquote', () => {
      const source = '::pullquote\nA wise saying\n::'
      const result = compileMdx(source)

      expect(result.html).toContain('<blockquote class="ink-pullquote">')
      expect(result.html).toContain('A wise saying')
    })
  })

  describe('combined content', () => {
    it('handles frontmatter + wikilinks + blocks together', () => {
      const source = [
        '---',
        'title: "Combined Test"',
        'tags: [test]',
        '---',
        'Check [[some-page]] for details.',
        '::tldr',
        'This is the summary',
        '::',
        '::metric{value="99" label="Coverage" trend="up"}',
      ].join('\n')

      const result = compileMdx(source)

      expect(result.frontmatter.title).toBe('Combined Test')
      expect(result.frontmatter.tags).toEqual(['test'])
      expect(result.wikilinks).toEqual(['some-page'])
      expect(result.html).toContain('<a href="/some-page"')
      expect(result.html).toContain('<div class="ink-tldr">')
      expect(result.html).toContain('<div class="ink-metric">')
    })
  })

  describe('empty source', () => {
    it('returns empty html, wikilinks, and frontmatter', () => {
      const result = compileMdx('')

      expect(result.html).toBe('')
      expect(result.wikilinks).toEqual([])
      expect(result.frontmatter).toEqual({})
    })
  })

  describe('HTML escaping', () => {
    it('escapes special characters in wikilink display text', () => {
      const result = compileMdx('See [[page|A <b>bold</b> link]]')

      expect(result.html).toContain('&lt;b&gt;bold&lt;/b&gt;')
      expect(result.html).not.toContain('<b>bold</b>')
    })
  })
})
