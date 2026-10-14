/** The footer text for the last lint run, or null when there is nothing to show. */
export type LintLabel = string | null

declare module 'claude-code' {
  interface PluginState {
    'lintbrain-status': {
      /** Read once when the session starts; null hides the footer entry. */
      label: LintLabel
    }
  }
}
