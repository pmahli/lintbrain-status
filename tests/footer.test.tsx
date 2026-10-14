import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { describe, expect, mock, test } from 'claude-code/testing'

// Noon UTC on 2026-10-14, a calendar day in every time zone the tests may run in.
const NOW = Date.UTC(2026, 9, 14, 12)
const VAULT = '/v/Brain'
const STAMP = `${VAULT}/.lintbrain`
const OPTIONS = { vaultPath: VAULT }

type World = {
  folders?: readonly string[]
  files?: Readonly<Record<string, string>>
  unreadable?: readonly string[]
  env?: Readonly<Record<string, string>>
}

// What the engine answers beneath the plugin: a world of folders, files and
// environment variables, and a footer that draws the modes it is handed.
// Returns the toasts the engine was asked for.
const engine = (on: On, world: World) => {
  const toasts: string[] = []
  const files = world.files ?? {}

  mock.clock(on, { now: NOW })
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('fs.exists', (_$, e) => ({
    value: (world.folders ?? []).includes(e.path) || e.path in files,
  }))
  on('fs.read', (_$, e) => {
    if ((world.unreadable ?? []).includes(e.path)) throw new Error('EAGAIN')
    return { value: files[e.path] ?? '' } as never
  })
  on('env.get', (_$, e) => ({ value: world.env?.[e.name] }))
  on('ui.toast', (_$, e) => {
    toasts.push(e.text)
    return { value: undefined } as never
  })
  on('ui.render', { component: 'SessionMode' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>{e.props.modes.join(' & ')}</Text>
  })

  return toasts
}

// Starts a session, then draws the footer with `modes` and returns its text.
const footer = async ($: Engine, modes: readonly string[] = ['focus']) => {
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({
    plugin: 'lintbrain-status',
    surface: 'terminal',
    component: 'SessionMode',
    props: { modes },
  })
  const drawn = await ui.drawn()
  await ui.unmount()

  return drawn.type === 'Text' ? (drawn.children ?? []).join('') : undefined
}

describe('session footer', () => {
  test('shows the age of the stamp after the existing modes', { options: OPTIONS }, async ($, on) => {
    const toasts = engine(on, { folders: [VAULT], files: { [STAMP]: '2026-10-09\n' } })

    expect(await footer($)).toBe('focus & 🧹 Lint: 5 days ago')
    expect(toasts).toEqual([])
  })

  test('stands alone when no other mode is shown', { options: OPTIONS }, async ($, on) => {
    engine(on, { folders: [VAULT], files: { [STAMP]: '2026-10-14' } })

    expect(await footer($, [])).toBe('🧹 Lint: today')
  })

  test('adds the /LintBrain hint after more than 7 days', { options: OPTIONS }, async ($, on) => {
    engine(on, { folders: [VAULT], files: { [STAMP]: '2026-10-06' } })

    expect(await footer($)).toBe('focus & 🧹 Lint: 8 days ago — /LintBrain')
  })

  test('a vault without a stamp file has never been linted', { options: OPTIONS }, async ($, on) => {
    engine(on, { folders: [VAULT] })

    expect(await footer($)).toBe('focus & 🧹 Lint: never')
  })

  test('a stamp that cannot be read asks for a run', { options: OPTIONS }, async ($, on) => {
    engine(on, { folders: [VAULT], files: { [STAMP]: '2026-10-09' }, unreadable: [STAMP] })

    expect(await footer($)).toBe('focus & 🧹 Lint: unknown — /LintBrain')
  })

  test('the threshold comes from the option', { options: { ...OPTIONS, staleAfterDays: 3 } }, async ($, on) => {
    engine(on, { folders: [VAULT], files: { [STAMP]: '2026-10-10' } })

    expect(await footer($)).toBe('focus & 🧹 Lint: 4 days ago — /LintBrain')
  })

  test('falls back to EXTENDED_BRAIN_PATH, with ~ expanded', async ($, on) => {
    engine(on, {
      folders: ['/home/me/Brain'],
      files: { '/home/me/Brain/.lintbrain': '2026-10-13' },
      env: { EXTENDED_BRAIN_PATH: '~/Brain', HOME: '/home/me' },
    })

    expect(await footer($)).toBe('focus & 🧹 Lint: 1 day ago')
  })

  test('the option wins over the environment', { options: OPTIONS }, async ($, on) => {
    engine(on, {
      folders: [VAULT, '/other'],
      files: { [STAMP]: '2026-10-14', '/other/.lintbrain': '2026-01-01' },
      env: { EXTENDED_BRAIN_PATH: '/other' },
    })

    expect(await footer($)).toBe('focus & 🧹 Lint: today')
  })

  test('without a vault the footer stays as it was, with one toast', async ($, on) => {
    const toasts = engine(on, {})

    expect(await footer($)).toBe('focus')
    expect(toasts).toHaveLength(1)
    expect(toasts[0]).toContain('vaultPath')
  })

  test('a vault folder that does not exist is said, not shown as never linted', { options: OPTIONS }, async ($, on) => {
    const toasts = engine(on, {})

    expect(await footer($)).toBe('focus')
    expect(toasts).toEqual([`lintbrain-status: vault folder not found: ${VAULT}`])
  })
})
