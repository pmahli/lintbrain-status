export const STAMP_FILE = '.lintbrain'
export const DEFAULT_STALE_DAYS = 7

const DAY_MS = 86_400_000
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** What the stamp file says: no file, a file that holds no date, or a day count. */
export type Reading =
  | { kind: 'never' }
  | { kind: 'unknown' }
  | { kind: 'ago'; days: number }

/**
 * The calendar day a stamp names, as whole days since 1970-01-01, or undefined
 * when the first non-blank line is no real ISO date (`2026-02-31` is none).
 */
export function parseStamp(text: string): number | undefined {
  const line = text
    .split(/\r?\n/)
    .map(part => part.trim())
    .find(part => part !== '')
  const match = line === undefined ? null : ISO_DATE.exec(line)

  if (match === null) return undefined

  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const ms = Date.UTC(year, month - 1, day)
  const date = new Date(ms)
  // Date.UTC rolls an impossible day over into the next month; a real one round-trips.
  const isReal =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day

  return isReal ? ms / DAY_MS : undefined
}

/** A moment's local calendar day, as whole days since 1970-01-01. */
export function dayNumber(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS
}

/**
 * `text` is the stamp file's content, undefined when the file does not exist;
 * `today` a `dayNumber`. A stamp in the future (clock skew) counts as today.
 */
export function readStamp(text: string | undefined, today: number): Reading {
  if (text === undefined) return { kind: 'never' }

  const day = parseStamp(text)

  return day === undefined ? { kind: 'unknown' } : { kind: 'ago', days: Math.max(0, today - day) }
}

export function formatAge(days: number): string {
  if (days === 0) return 'today'

  return days === 1 ? '1 day ago' : `${days} days ago`
}

/** The footer text. The /LintBrain hint follows a stamp older than `staleAfterDays`. */
export function describe(reading: Reading, staleAfterDays: number): string {
  switch (reading.kind) {
    case 'never':
      return '🧹 Lint: never'
    case 'unknown':
      return '🧹 Lint: unknown — /LintBrain'
    case 'ago':
      return reading.days > staleAfterDays
        ? `🧹 Lint: ${formatAge(reading.days)} — /LintBrain`
        : `🧹 Lint: ${formatAge(reading.days)}`
  }
}

/** The configured threshold when it is a usable number of days, else the default. */
export function staleAfter(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : DEFAULT_STALE_DAYS
}

/** Expands a leading `~`; `home` is undefined where the environment has none. */
export function expandHome(path: string, home: string | undefined): string {
  if (home === undefined || home === '') return path
  if (path === '~') return home

  return path.startsWith('~/') ? `${home.replace(/\/+$/, '')}${path.slice(1)}` : path
}

/** The stamp file inside a vault folder. */
export function stampPath(vault: string): string {
  return `${vault.replace(/\/+$/, '')}/${STAMP_FILE}`
}
