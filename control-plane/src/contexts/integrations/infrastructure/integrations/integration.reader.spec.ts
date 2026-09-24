import { IntegrationReader } from '@integrations/infrastructure/integrations/integration.reader';
import { defined } from '@integrations/integrations.definitions.fake-spec';
import { CelExpressionEngine } from '@platform/expressions/cel-expression.engine';
import { describe, expect, it } from 'vitest';

const expressions = new CelExpressionEngine();

const WHOLE = `
integration: linear
webhook:
  verify:
    hmac:
      algorithm: sha256
      secret: secret.LINEAR_WEBHOOK_SECRET
      header: linear-signature
  events:
    - when: \${{ body.type == "Issue" }}
      raise:
        happening: linear.issue.completed
        label: Issue completed
        told: The issue was moved to Done.
        marks:
          - kind: linear.issue
            value: \${{ body.data.identifier }}
`;

describe('IntegrationReader', () => {
  it('reads every integration a team defined', () => {
    const read = new IntegrationReader(expressions).read([defined(WHOLE)]);

    expect(read.integrations.map((each) => each.source)).toEqual(['linear']);
    expect(read.integrations[0]?.path).toBe('integrations/linear');
    expect(read.problems).toEqual([]);
  });

  it('keeps reading past a definition that will not', () => {
    const read = new IntegrationReader(expressions).read([
      defined('integration: sentry'),
      defined(WHOLE),
    ]);

    expect(read.integrations.map((each) => each.source)).toEqual(['linear']);
    expect(read.problems[0]?.path).toBe('integrations/sentry');
  });

  it('reads nothing at all from nothing at all', () => {
    expect(new IntegrationReader(expressions).read([])).toEqual({
      integrations: [],
      problems: [],
    });
  });
});
