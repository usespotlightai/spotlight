import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { Happening } from '@shared-kernel/domain/value-objects/happening.vo';
import { IntegrationName } from '@work/domain/value-objects/integration-name.vo';
import { describe, expect, it } from 'vitest';

describe('IntegrationName', () => {
  it('is the integration a happening names', () => {
    expect(
      IntegrationName.ofHappening(Happening.of('linear.issue.created')).equals(
        IntegrationName.of('linear'),
      ),
    ).toBe(true);
  });

  it('refuses a name that is not an integration key', () => {
    expect(() => IntegrationName.of('Linear')).toThrow(InconsistentStateError);
    expect(() => IntegrationName.of('')).toThrow(InconsistentStateError);
  });
});
