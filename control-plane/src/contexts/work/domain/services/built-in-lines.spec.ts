import { BUILT_IN_LINES } from '@work/domain/services/built-in-lines';
import { BUILT_IN_TOOLS } from '@work/domain/services/built-in-tools';
import { describe, expect, it } from 'vitest';

const BUILT_IN_STATIONS = BUILT_IN_LINES.flatMap((line) => line.stations);

describe('the words the built-in lines wait for', () => {
  it('are each waited for once on any one line', () => {
    for (const line of BUILT_IN_LINES) {
      const awaited = line.reactions.map((each) => each.happening.value);

      expect(new Set(awaited).size).toBe(awaited.length);
    }
  });
});

describe('what the built-in line tells its agents', () => {
  it('names no tool in a prompt that the station does not have', () => {
    for (const opening of BUILT_IN_STATIONS) {
      const prompt = opening.agentPrompt?.value ?? '';
      const named = BUILT_IN_TOOLS.map((each) => each.declared.tool)
        .filter((tool) => prompt.includes(`spotlight ${tool.value}`))
        .map((tool) => tool.value);
      const held = opening.tools.map((tool) => tool.value);

      expect(held).toEqual(expect.arrayContaining(named));
    }
  });

  it('gives every tool it hands out to a station that exists here', () => {
    const known = BUILT_IN_TOOLS.map((each) => each.declared.tool.value);

    for (const opening of BUILT_IN_STATIONS) {
      for (const tool of opening.tools) {
        expect(known).toContain(tool.value);
      }
    }
  });
});
