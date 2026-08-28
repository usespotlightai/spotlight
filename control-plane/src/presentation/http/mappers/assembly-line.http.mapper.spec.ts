import { AssemblyLineHttpMapper } from '@presentation/http/mappers/assembly-line.http.mapper';
import { describe, expect, it } from 'vitest';

describe('AssemblyLineHttpMapper.toStationChanges', () => {
  it('carries every field the request asked to change', () => {
    expect(
      AssemblyLineHttpMapper.toStationChanges({
        name: 'Intake',
        color: '#db5b52',
        description: 'Where new work lands',
        harness: 'dev',
        agentPrompt: '## Role',
      }),
    ).toEqual({
      name: 'Intake',
      color: '#db5b52',
      description: 'Where new work lands',
      harness: 'dev',
      agentPrompt: '## Role',
    });
  });

  it('leaves out what the request never mentioned', () => {
    expect(
      AssemblyLineHttpMapper.toStationChanges({ color: '#db5b52' }),
    ).toEqual({
      name: undefined,
      color: '#db5b52',
      description: undefined,
      harness: undefined,
      agentPrompt: undefined,
    });
  });

  it('reads a field emptied to blank as a field cleared', () => {
    expect(
      AssemblyLineHttpMapper.toStationChanges({ description: '   ' }),
    ).toMatchObject({ description: null });
  });
});
