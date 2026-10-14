# lintbrain-status

A [Claude Code](https://claude.com/claude-code) mod that shows in the prompt footer when your Extended Brain vault was last linted, and tells you when it is time to run `/LintBrain` again.

```
focus & 🧹 Lint: 3 days ago
focus & 🧹 Lint: 12 days ago — /LintBrain
focus & 🧹 Lint: never
```

The entry sits with the dim mode labels at the right of the prompt (`focus`, `memory paused`, ...). It adds to them and never replaces one.

## What it shows

| Stamp file | Footer |
| --- | --- |
| Holds today's date | `🧹 Lint: today` |
| 1 to 7 days old (the limit, see `staleAfterDays`) | `🧹 Lint: 1 day ago`, `🧹 Lint: 5 days ago`, ... |
| Older than the limit | `🧹 Lint: 12 days ago — /LintBrain` |
| Does not exist (never linted) | `🧹 Lint: never` |
| Exists, but holds no valid date or cannot be read | `🧹 Lint: unknown — /LintBrain` |

The `— /LintBrain` part is the hint that the lint skill should run. A stamp dated in the future counts as today.

The stamp is read **once, when the session starts**. There is no polling: the value only changes when the lint skill runs, which is rare inside a session. Start a new session (or reload the mod) to see a fresh value.

## The stamp file

The mod reads one file, `.lintbrain`, in the root of your vault. It holds a single line with an ISO date:

```
2026-10-07
```

Your lint skill writes it at the end of every successful run, with the vault folder as the working directory:

```bash
date +%Y-%m-%d > .lintbrain
```

The mod ships no lint skill. Any tool that writes that file works. Keep the file out of version control if you do not want a commit per run; it is local state.

## Settings

| Option | Default | Meaning |
| --- | --- | --- |
| `vaultPath` | empty | Absolute path of your vault, the folder that holds `.lintbrain`. A leading `~` is expanded. |
| `staleAfterDays` | `7` | From how many days without a run the footer adds `— /LintBrain`. |

Left empty, `vaultPath` falls back to the `EXTENDED_BRAIN_PATH` environment variable. If neither is set, or the folder does not exist, the footer stays as it was and a toast says why.

## Install

In a terminal session:

```
/plugin install lintbrain-status --marketplace pmahli/lintbrain-status
```

Answer `y` to add the marketplace, pick the user scope, then fill in `vaultPath` on the settings screen.

The `/plugin` command is not available in the Code tab of the desktop app, but a mod installed from a terminal at the user scope also loads there.

## Develop

```
claude plugin validate .
claude plugin test .
```

`hooks/lint.ts` holds the pure helpers (date parsing, footer text), `hooks/register.ts` the two hooks: `session.start` reads the stamp into the session's `$.state`, and a `ui.render` hook on `SessionMode` appends the label.

## License

[MIT](LICENSE)
