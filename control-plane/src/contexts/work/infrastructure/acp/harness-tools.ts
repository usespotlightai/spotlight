import { Injectable } from '@nestjs/common';
import type { HarnessToolNamesPort } from '@work/application/ports/harness-tool-names.port';
import type { CallEnding } from '@work/domain/services/tool-attribution';
import { CalledTool } from '@work/domain/value-objects/called-tool.vo';

export interface HarnessTool {
  readonly server: string | null;
  readonly tool: string;
}

const PREFIXED = /^mcp__(\S+?)__(\S+)$/;

const TITLED = /^Tool: ([^\s/]+)\/(\S+)$/;

const BRIDGE_SERVER = 'mcp__acp__';

const BRIDGE_TOOLS = new Set(
  ['Read', 'Write', 'Edit', 'MultiEdit', 'Bash', 'BashOutput', 'KillShell'].map(
    (tool) => `${BRIDGE_SERVER}${tool}`,
  ),
);

const SKILL_TOOL = 'Skill';

const READING_KINDS = new Set(['read', 'search', 'execute']);

const COMMAND_KIND = 'execute';

const prefixed = (named: string): HarnessTool | null => {
  if (BRIDGE_TOOLS.has(named)) {
    return { server: null, tool: named.slice(BRIDGE_SERVER.length) };
  }

  const [, server, tool] = PREFIXED.exec(named) ?? [];

  return server && tool ? { server, tool } : null;
};

const titled = (title: string): HarnessTool | null => {
  const [, server, tool] = TITLED.exec(title) ?? [];

  return server && tool ? { server, tool } : null;
};

const fromTitle = (title: string, kind: string | null): HarnessTool | null =>
  kind === COMMAND_KIND ? null : (titled(title) ?? prefixed(title));

export const harnessToolOf = (
  named: string | null,
  title: string,
  kind: string | null,
): HarnessTool => {
  const trimmed = title.trim();

  if (named) {
    return prefixed(named.trim()) ?? { server: null, tool: named.trim() };
  }

  return fromTitle(trimmed, kind) ?? { server: null, tool: trimmed };
};

export const skillAskedFor = (
  tool: HarnessTool,
  input: string | null,
): string | null => {
  if (tool.server !== null || tool.tool !== SKILL_TOOL || !input) {
    return null;
  }

  try {
    const given = JSON.parse(input) as { skill?: unknown };

    return typeof given.skill === 'string' ? given.skill : null;
  } catch {
    return null;
  }
};

export const readingPaths = (
  tool: HarnessTool,
  kind: string | null,
  read: readonly (string | null)[],
): readonly string[] =>
  tool.server === null && kind !== null && READING_KINDS.has(kind)
    ? read.flatMap((each) => (each ? [each] : []))
    : [];

export const callEndingOf = (
  status: string | null,
  refused: boolean,
): CallEnding => {
  if (refused) {
    return 'refused';
  }
  if (status === 'completed') {
    return 'completed';
  }

  return status === 'failed' ? 'failed' : 'unfinished';
};

@Injectable()
export class AcpHarnessToolNames implements HarnessToolNamesPort {
  askedFor(title: string, kind: string): CalledTool | null {
    const named = fromTitle(title.trim(), kind);

    return named && named.server !== null ? CalledTool.of(named) : null;
  }
}
