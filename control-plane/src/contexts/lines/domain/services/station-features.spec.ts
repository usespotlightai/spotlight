import { agentFeaturesOf } from '@lines/domain/services/station-features';
import { describe, expect, it } from 'vitest';

describe('agentFeaturesOf', () => {
  it('gives a station that runs an agent every feature its line does not turn off', () => {
    expect(agentFeaturesOf('work')).toEqual({
      diffs: true,
      decisions: true,
      memories: true,
    });
    expect(agentFeaturesOf('work', { decisions: false })).toEqual({
      diffs: true,
      decisions: false,
      memories: true,
    });
  });

  it('gives a backlog or the completed station none its line does not turn on', () => {
    expect(agentFeaturesOf('backlog')).toEqual({
      diffs: false,
      decisions: false,
      memories: false,
    });
    expect(agentFeaturesOf('completed', { memories: true }).memories).toBe(
      true,
    );
  });
});
