import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { MarkKind } from '@integrations/domain/value-objects/mark-kind.vo';
import { describe, expect, it } from 'vitest';

describe('MarkKind', () => {
  it('belongs to the integration it names first', () => {
    const issue = MarkKind.of('sentry.issue');

    expect(issue.belongsTo(IntegrationKey.of('sentry'))).toBe(true);
    expect(issue.belongsTo(IntegrationKey.of('sent'))).toBe(false);
    expect(
      MarkKind.of('sentryx.issue').belongsTo(IntegrationKey.of('sentry')),
    ).toBe(false);
  });
});
