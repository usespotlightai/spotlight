import { isObject } from '@runs/infrastructure/harnesses/profiles/profile-translator';

export const POST_TOOL_USE_COMMAND = 'spotlight hook post-tool-use';

const HOOK_TIMEOUT_SECONDS = 10;

const CLAUDE_PATH_TOOLS = 'Read|Edit|MultiEdit|Write|NotebookEdit|Grep|Glob';

type Json = Record<string, unknown>;

const command = {
  type: 'command',
  command: POST_TOOL_USE_COMMAND,
  timeout: HOOK_TIMEOUT_SECONDS,
};

const withPostToolUse = (settings: Json, entry: Json): Json => {
  const hooks = isObject(settings.hooks) ? settings.hooks : {};
  const existing: unknown[] = Array.isArray(hooks.PostToolUse)
    ? (hooks.PostToolUse as unknown[])
    : [];

  return {
    ...settings,
    hooks: { ...hooks, PostToolUse: [...existing, entry] },
  };
};

export const withClaudeMemoryHook = (settings: Json): Json =>
  withPostToolUse(settings, { matcher: CLAUDE_PATH_TOOLS, hooks: [command] });
