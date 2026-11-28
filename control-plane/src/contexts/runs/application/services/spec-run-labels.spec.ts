import { SpecRunLabels } from '@runs/application/services/spec-run-labels';
import { describe, expect, it } from 'vitest';

describe('SpecRunLabels', () => {
  it('names a run queued by hand for whoever reads it', async () => {
    const found = await new SpecRunLabels().labelsOf([
      {
        owner: 'workspace',
        kind: 'spec',
        id: 'run_1',
        token: null,
        team: null,
      },
    ]);

    expect(found.get('workspace/spec/run_1')).toEqual({
      title: 'A run queued by hand',
      readers: {
        of: 'the-run',
        opens: false,
        hidden: 'Title hidden. This run belongs to a team you’re not on.',
      },
    });
  });
});
