import { describe, expect, test } from 'claude-code/testing'

import {
  dayNumber,
  describe as describeReading,
  expandHome,
  formatAge,
  parseStamp,
  readStamp,
  stampPath,
  staleAfter,
} from '../hooks/lint'

const TODAY = parseStamp('2026-10-14') as number

describe('stamp parsing', () => {
  test('reads one ISO date, with or without a trailing newline', () => {
    expect(parseStamp('2026-10-07')).toBe(TODAY - 7)
    expect(parseStamp('2026-10-07\n')).toBe(TODAY - 7)
    expect(parseStamp('2026-10-07\r\n')).toBe(TODAY - 7)
    expect(parseStamp('\n  2026-10-07  \n')).toBe(TODAY - 7)
  })

  test('rejects what is no real date', () => {
    expect(parseStamp('')).toBeUndefined()
    expect(parseStamp('yesterday')).toBeUndefined()
    expect(parseStamp('2026-10-7')).toBeUndefined()
    expect(parseStamp('2026-02-31')).toBeUndefined()
    expect(parseStamp('2026-13-01')).toBeUndefined()
    expect(parseStamp('2026-10-07 and more')).toBeUndefined()
  })

  test('counts days across a month and a year boundary', () => {
    expect(parseStamp('2026-03-01')! - parseStamp('2026-02-28')!).toBe(1)
    expect(parseStamp('2027-01-01')! - parseStamp('2026-12-31')!).toBe(1)
  })

  test('dayNumber is the local calendar day', () => {
    expect(dayNumber(new Date(2026, 9, 14, 23, 59))).toBe(TODAY)
    expect(dayNumber(new Date(2026, 9, 15, 0, 1))).toBe(TODAY + 1)
  })
})

describe('footer text', () => {
  const text = (stamp: string | undefined, staleAfterDays = 7) =>
    describeReading(readStamp(stamp, TODAY), staleAfterDays)

  test('no file means never run', () => {
    expect(text(undefined)).toBe('🧹 Lint: never')
  })

  test('up to 7 days old: no hint', () => {
    expect(text('2026-10-14')).toBe('🧹 Lint: today')
    expect(text('2026-10-13')).toBe('🧹 Lint: 1 day ago')
    expect(text('2026-10-07')).toBe('🧹 Lint: 7 days ago')
  })

  test('older than 7 days: adds the /LintBrain hint', () => {
    expect(text('2026-10-06')).toBe('🧹 Lint: 8 days ago — /LintBrain')
    expect(text('2026-09-14')).toBe('🧹 Lint: 30 days ago — /LintBrain')
  })

  test('a file without a date asks for a run', () => {
    expect(text('not a date')).toBe('🧹 Lint: unknown — /LintBrain')
  })

  test('a stamp in the future counts as today', () => {
    expect(text('2026-10-20')).toBe('🧹 Lint: today')
  })

  test('the threshold is configurable', () => {
    expect(text('2026-10-11', 2)).toBe('🧹 Lint: 3 days ago — /LintBrain')
    expect(text('2026-10-12', 2)).toBe('🧹 Lint: 2 days ago')
  })

  test('formatAge', () => {
    expect(formatAge(0)).toBe('today')
    expect(formatAge(1)).toBe('1 day ago')
    expect(formatAge(2)).toBe('2 days ago')
  })

  test('an unusable threshold falls back to 7', () => {
    expect(staleAfter(undefined)).toBe(7)
    expect(staleAfter('3')).toBe(7)
    expect(staleAfter(-1)).toBe(7)
    expect(staleAfter(Number.NaN)).toBe(7)
    expect(staleAfter(0)).toBe(0)
    expect(staleAfter(14)).toBe(14)
  })
})

describe('paths', () => {
  test('expands a leading ~ only', () => {
    expect(expandHome('~/Brain', '/home/me')).toBe('/home/me/Brain')
    expect(expandHome('~', '/home/me')).toBe('/home/me')
    expect(expandHome('/srv/~/Brain', '/home/me')).toBe('/srv/~/Brain')
    expect(expandHome('~/Brain', undefined)).toBe('~/Brain')
  })

  test('joins the stamp file once', () => {
    expect(stampPath('/v/Brain')).toBe('/v/Brain/.lintbrain')
    expect(stampPath('/v/Brain/')).toBe('/v/Brain/.lintbrain')
  })
})
