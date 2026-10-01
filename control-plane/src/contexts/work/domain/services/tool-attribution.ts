import {
  areWords,
  WORDS,
} from '@shared-kernel/domain/value-objects/identifier-shapes';
import { LatencyHistogram } from '@shared-kernel/domain/value-objects/latency-histogram.vo';
import { BUILT_IN_SKILL_KEYS } from '@work/domain/services/built-in-skills';
import {
  type ServerCalls,
  ToolUse,
} from '@work/domain/value-objects/tool-use.vo';

export type CallEnding = 'completed' | 'failed' | 'unfinished' | 'refused';

export interface CalledStep {
  readonly server: string | null;
  readonly tool: string;
  readonly skillAskedFor: string | null;
  readonly paths: readonly string[];
  readonly ms: number | null;
  readonly ending: CallEnding;
}

const BUILT_IN = new Set(BUILT_IN_SKILL_KEYS.map((each) => each.value));

const escaped = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, (found) => `\\${found}`);

const teamSkill = (key: string): boolean => areWords(key) && !BUILT_IN.has(key);

const readUnder = (text: string, homes: readonly string[]): readonly string[] =>
  homes.flatMap((home) =>
    [
      ...text.matchAll(
        new RegExp(
          `(?:^|[\\s/"'=:])${escaped(home.replace(/\/+$/, ''))}/(${WORDS})/`,
          'g',
        ),
      ),
    ].flatMap((found) => (found[1] ? [found[1]] : [])),
  );

export const skillsReadBy = (
  step: CalledStep,
  homes: readonly string[],
): readonly string[] => [
  ...new Set(
    [
      ...(step.skillAskedFor ? [step.skillAskedFor] : []),
      ...step.paths.flatMap((text) => readUnder(text, homes)),
    ].filter(teamSkill),
  ),
];

const reachedServer = (
  step: CalledStep,
): step is CalledStep & {
  readonly server: string;
} => step.server !== null && step.ending !== 'refused';

export const toolUseOf = (
  steps: readonly CalledStep[],
  homes: readonly string[],
): ToolUse => {
  const servers = new Map<string, ServerCalls>();

  for (const step of steps.filter(reachedServer)) {
    const held = servers.get(step.server);
    const failed = step.ending !== 'completed';
    const latency = held?.latency ?? LatencyHistogram.EMPTY;

    servers.set(step.server, {
      server: step.server,
      calls: (held?.calls ?? 0) + 1,
      failed: (held?.failed ?? 0) + (failed ? 1 : 0),
      latency:
        step.ms === null || step.ending === 'unfinished'
          ? latency
          : latency.with(Math.max(0, Math.round(step.ms))),
      lastCallFailed: failed,
    });
  }

  return ToolUse.of({
    servers: [...servers.values()],
    skills: steps.flatMap((step) => skillsReadBy(step, homes)),
  });
};
