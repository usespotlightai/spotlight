import type { LabelledSession } from '@assist/application/ports/assist-session-labels.port';
import { InsightsSessionLabels } from '@insights/infrastructure/acl/assist-session-labels';
import { describe, expect, it } from 'vitest';

const BASED_ON: LabelledSession['basedOn'] = {
  runId: 'run_1',
  task: 'Incident owners 2/5',
  station: 'Implementation',
};

const labelOf = (purpose: string, basedOn = BASED_ON) =>
  new InsightsSessionLabels().labelOf({ purpose, key: 'key', basedOn });

describe('InsightsSessionLabels', () => {
  it('names a judging by the station and task of the run it judges, and opens that run', () => {
    expect(labelOf('insights.judge')).toEqual({
      title: 'Judging Implementation on “Incident owners 2/5”',
      opens: true,
    });
  });

  it('names a side-by-side judging and the drafting of judge claims', () => {
    expect(labelOf('insights.pair-judge')).toEqual({
      title: 'Comparing two runs of Implementation on “Incident owners 2/5”',
      opens: true,
    });
    expect(labelOf('insights.claims')).toEqual({
      title: 'Drafting judge claims for Implementation',
      opens: false,
    });
  });

  it('names a judging of a run with no task or station plainly', () => {
    expect(
      labelOf('insights.judge', { runId: 'run_1', task: null, station: null })
        ?.title,
    ).toBe('Judging a run');
  });

  it('names no purpose it does not order', () => {
    expect(labelOf('insights.unknown')).toBeNull();
  });
});
