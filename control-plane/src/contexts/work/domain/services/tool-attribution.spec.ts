import { LatencyHistogram } from '@shared-kernel/domain/value-objects/latency-histogram.vo';
import {
  type CalledStep,
  skillsReadBy,
  toolUseOf,
} from '@work/domain/services/tool-attribution';
import { describe, expect, it } from 'vitest';

const HOMES = ['.claude/skills'];

const step = (over: Partial<CalledStep> = {}): CalledStep => ({
  server: null,
  tool: 'Read',
  requestedSkill: null,
  paths: [],
  ms: 100,
  ending: 'completed',
  ...over,
});

const mcp = (server: string, over: Partial<CalledStep> = {}): CalledStep =>
  step({ server, tool: 'call', ...over });

describe('skillsReadBy', () => {
  it('reads a skill from a step that read a file in the skill’s folder', () => {
    expect(
      skillsReadBy(
        step({ paths: ['/workspace/.claude/skills/our-migrations/SKILL.md'] }),
        HOMES,
      ),
    ).toEqual(['our-migrations']);
  });

  it('reads a skill from a command that names a file in its folder', () => {
    expect(
      skillsReadBy(
        step({
          paths: ['{"command":"cat .claude/skills/grafana/queries.md"}'],
        }),
        HOMES,
      ),
    ).toEqual(['grafana']);
  });

  it('reads a skill that the harness was told to load', () => {
    expect(
      skillsReadBy(step({ requestedSkill: 'our-migrations' }), HOMES),
    ).toEqual(['our-migrations']);
  });

  it('reads nothing from a file in the skills home that is not a skill’s folder', () => {
    expect(
      skillsReadBy(
        step({ paths: ['/workspace/.claude/skills/README.md'] }),
        HOMES,
      ),
    ).toEqual([]);
  });

  it('reads nothing from listing the skills home or a skill’s folder', () => {
    expect(
      skillsReadBy(
        step({ paths: ['{"command":"ls .claude/skills/"}'] }),
        HOMES,
      ),
    ).toEqual([]);
    expect(
      skillsReadBy(
        step({ paths: ['{"command":"ls .claude/skills/grafana"}'] }),
        HOMES,
      ),
    ).toEqual([]);
  });

  it('reads nothing from a folder elsewhere or a key that is not a skill’s', () => {
    expect(
      skillsReadBy(step({ paths: ['/workspace/docs/skills/notes.md'] }), HOMES),
    ).toEqual([]);
    expect(
      skillsReadBy(
        step({ paths: ['/workspace/my.claude/skills/x/SKILL.md'] }),
        HOMES,
      ),
    ).toEqual([]);
    expect(
      skillsReadBy(
        step({ paths: ['/workspace/.claude/skills/Our_Notes/SKILL.md'] }),
        HOMES,
      ),
    ).toEqual([]);
  });

  it('leaves out the skills Spotlight enables for every run', () => {
    expect(
      skillsReadBy(
        step({
          requestedSkill: 'spotlight-handover',
          paths: ['/workspace/.claude/skills/spotlight-review/SKILL.md'],
        }),
        HOMES,
      ),
    ).toEqual([]);
  });
});

describe('toolUseOf', () => {
  it('counts each server’s calls, failures and times, and whether its last call failed', () => {
    const use = toolUseOf(
      [
        mcp('linear', { ms: 300 }),
        mcp('linear', { ms: 900, ending: 'failed' }),
        mcp('sentry', { ms: 50, ending: 'failed' }),
        mcp('sentry', { ms: 70 }),
        step({ tool: 'Bash', ms: 10, ending: 'failed' }),
      ],
      HOMES,
    );

    expect(use.servers).toEqual([
      {
        server: 'linear',
        calls: 2,
        failed: 1,
        latency: LatencyHistogram.timing([300, 900]),
        lastCallFailed: true,
      },
      {
        server: 'sentry',
        calls: 2,
        failed: 1,
        latency: LatencyHistogram.timing([50, 70]),
        lastCallFailed: false,
      },
    ]);
  });

  it('counts a call that never finished as failed, without timing it', () => {
    const [linear] = toolUseOf(
      [
        mcp('linear', { ms: 300 }),
        mcp('linear', { ms: null, ending: 'unfinished' }),
      ],
      HOMES,
    ).servers;

    expect(linear).toMatchObject({ calls: 2, failed: 1, lastCallFailed: true });
    expect(linear?.latency.timed).toBe(1);
  });

  it('leaves a call refused permission out of the server’s calls and failures', () => {
    const use = toolUseOf(
      [
        mcp('linear', { ms: 300 }),
        mcp('linear', { ms: 5, ending: 'refused' }),
        mcp('sentry', { ms: 5, ending: 'refused' }),
      ],
      HOMES,
    );

    expect(use.servers).toEqual([
      {
        server: 'linear',
        calls: 1,
        failed: 0,
        latency: LatencyHistogram.timing([300]),
        lastCallFailed: false,
      },
    ]);
  });

  it('lists every skill read once', () => {
    const use = toolUseOf(
      [
        step({ paths: ['/workspace/.claude/skills/b/SKILL.md'] }),
        step({ paths: ['/workspace/.claude/skills/a/SKILL.md'] }),
        step({ paths: ['/workspace/.claude/skills/b/more.md'] }),
      ],
      HOMES,
    );

    expect(use.skills).toEqual(['a', 'b']);
  });

  it('says a run used nothing where it called no tools', () => {
    expect(toolUseOf([], HOMES)).toEqual({ servers: [], skills: [] });
  });
});
