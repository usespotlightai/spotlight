import { AssemblyLineHttpMapper } from '@presentation/http/mappers/assembly-line.http.mapper';
import { describe, expect, it } from 'vitest';

const changesOf = AssemblyLineHttpMapper.toStationChanges;

describe('AssemblyLineHttpMapper.toStationChanges', () => {
  it('leaves out what the request left out', () => {
    expect(changesOf({ pool: 'dev' })).toEqual({
      name: undefined,
      description: undefined,
      pool: 'dev',
      agentPrompt: undefined,
    });
  });

  it('reads an emptied box as a field cleared', () => {
    expect(changesOf({ description: '', pool: '   ' })).toMatchObject({
      description: null,
      pool: null,
    });
  });

  it('passes a null through as the clearing it already is', () => {
    expect(changesOf({ agentPrompt: null })).toMatchObject({
      agentPrompt: null,
    });
  });

  it('hands the name over as sent, having nothing to fall back to', () => {
    expect(changesOf({ name: '  ' })).toMatchObject({ name: '  ' });
  });

  it('keeps the whitespace inside a prompt, which is its markdown', () => {
    expect(changesOf({ agentPrompt: '## Role\n\nSort.' })).toMatchObject({
      agentPrompt: '## Role\n\nSort.',
    });
  });
});
