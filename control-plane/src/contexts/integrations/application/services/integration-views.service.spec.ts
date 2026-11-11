import type { IntegrationCompilerPort } from '@integrations/application/ports/integration-compiler.port';
import type { IntegrationRecord } from '@integrations/application/ports/integration-resources.port';
import { IntegrationViews } from '@integrations/application/services/integration-views.service';
import { TEAM, teams } from '@integrations/integrations.resources.fake-spec';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { describe, expect, it } from 'vitest';

const uncompiled: IntegrationCompilerPort = {
  compile: () => ({ ok: false, problems: [] }),
};

const stored = (over: Partial<IntegrationRecord> = {}): IntegrationRecord => ({
  id: 'integration_1',
  version: 3,
  teamId: TEAM,
  integration: 'linear',
  definition: { integration: 'linear' },
  tools: ['linear.comment', 'linear.issue-create'],
  generatedFrom: null,
  reading: null,
  ...over,
});

const views = () => new IntegrationViews(teams(), uncompiled);

describe('IntegrationViews', () => {
  it('reads a stored integration with its address and tools', () => {
    const view = views().onTeam(stored(), 'core');

    expect(view.integration).toBe('linear');
    expect(view.address).toContain('linear');
    expect(view.tools).toEqual({
      comment: 'linear.comment',
      'issue-create': 'linear.issue-create',
    });
  });

  it('fails as inconsistent state, not as a client error, for a stored integration name of a shape it cannot take (R7-02)', () => {
    expect(() =>
      views().onTeam(stored({ integration: 'Not A Key' }), 'core'),
    ).toThrow(InconsistentStateError);
  });

  it('fails as inconsistent state, not as a client error, for a stored tool name of a shape it cannot take (R7-02)', () => {
    expect(() =>
      views().onTeam(stored({ tools: ['comment'] }), 'core'),
    ).toThrow(InconsistentStateError);
  });
});
