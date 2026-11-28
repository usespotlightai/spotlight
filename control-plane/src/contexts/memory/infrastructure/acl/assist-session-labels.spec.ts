import { MemorySessionLabels } from '@memory/infrastructure/acl/assist-session-labels';
import { describe, expect, it } from 'vitest';

const labelOf = (purpose: string) =>
  new MemorySessionLabels().labelOf({
    purpose,
    key: 'key',
    basedOn: { runId: 'run_1', task: 'Fix the queue', station: 'Build' },
  });

describe('MemorySessionLabels', () => {
  it('names the duplicate check of proposed memories and memory upkeep, opening no run', () => {
    expect(labelOf('memory.compare-proposals')).toEqual({
      title: 'Checking proposed memories',
      opens: false,
    });
    expect(labelOf('memory.consolidate')).toEqual({
      title: 'Running memory upkeep',
      opens: false,
    });
  });

  it('names no purpose it does not order', () => {
    expect(labelOf('memory.other')).toBeNull();
  });
});
