import { BUILT_IN_LINES } from '@lines/domain/services/built-in-lines';
import { BUILT_IN_TOOLS } from '@work/domain/value-objects/built-in-tools';
import { describe, expect, it } from 'vitest';

const BUILT_IN_STATIONS = BUILT_IN_LINES.flatMap((line) => line.stations);

describe('what the built-in line tells its agents', () => {
  it('names no tool in a prompt that the station does not have', () => {
    for (const opening of BUILT_IN_STATIONS) {
      const prompt = opening.agentPrompt?.value ?? '';
      const named = BUILT_IN_TOOLS.map((each) => each.declared.tool)
        .filter((tool) => prompt.includes(`spotlight tools call ${tool.value}`))
        .map((tool) => tool.value);
      const enabled = opening.tools.map((tool) => tool.value);

      expect(enabled).toEqual(expect.arrayContaining(named));
    }
  });

  it('enables every tool it hands out at a station that exists here', () => {
    const known = BUILT_IN_TOOLS.map((each) => each.declared.tool.value);

    for (const opening of BUILT_IN_STATIONS) {
      for (const tool of opening.tools) {
        expect(known).toContain(tool.value);
      }
    }
  });
});
