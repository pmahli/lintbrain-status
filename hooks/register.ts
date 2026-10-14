import { atom, read, update } from 'claude-code'
import type { EngineInterface, PluginOptions, Register } from 'claude-code'

import type { LintLabel } from '../types'
import {
  dayNumber,
  describe,
  expandHome,
  readStamp,
  stampPath,
  staleAfter,
} from './lint'
import type { Reading } from './lint'

const lint = atom({ plugin: 'lintbrain-status', key: 'label' } as const, null)

// The vault folder: the option, else EXTENDED_BRAIN_PATH, with `~` expanded.
// Empty when neither names one.
async function vaultFolder($: EngineInterface, options: PluginOptions): Promise<string> {
  const option = typeof options.vaultPath === 'string' ? options.vaultPath.trim() : ''
  const raw = option !== '' ? option : ((await $.env.get('EXTENDED_BRAIN_PATH')) ?? '').trim()

  return raw === '' ? '' : expandHome(raw, await $.env.get('HOME'))
}

async function readFooter($: EngineInterface, options: PluginOptions): Promise<LintLabel> {
  const vault = await vaultFolder($, options)

  if (vault === '') {
    $.ui.toast('lintbrain-status: set the vaultPath option (or EXTENDED_BRAIN_PATH) to show the last lint run.')
    return null
  }

  if (!(await $.fs.exists(vault))) {
    $.ui.toast(`lintbrain-status: vault folder not found: ${vault}`)
    return null
  }

  const file = stampPath(vault)
  let reading: Reading

  if (!(await $.fs.exists(file))) {
    reading = { kind: 'never' }
  } else {
    try {
      const today = dayNumber(new Date(await $.clock.now()))
      reading = readStamp(await $.fs.read(file), today)
    } catch {
      // The file is there but cannot be read (a cloud file not downloaded yet, say).
      reading = { kind: 'unknown' }
    }
  }

  return describe(reading, staleAfter(options.staleAfterDays))
}

export const register: Register = (on, options) => {
  // Read once per session; the stamp only changes when the lint skill runs.
  on('session.start', async ($, e, next) => {
    const footer = await readFooter($, options)
    await update($, lint, () => footer)

    return next(e)
  })

  // The footer's dim mode labels sit at the right of the prompt.
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const footer = await read($, lint)

    return footer === null
      ? next(e)
      : next({ ...e, props: { ...e.props, modes: [...e.props.modes, footer] } })
  })
}
