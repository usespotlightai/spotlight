import { IntegrationReader } from '@integrations/infrastructure/integrations/integration.reader';
import { defined } from '@integrations/integrations.definitions.fake-spec';
import { operationsContaining } from '@integrations/integrations.documents.fake-spec';
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
    const read = new IntegrationReader(
      expressions,
      operationsContaining(),
    ).read([defined(WHOLE)]);

    expect(read.integrations.map((each) => each.source)).toEqual(['linear']);
    expect(read.integrations[0]?.path).toBe('integrations/linear');
    expect(read.problems).toEqual([]);
  });

  it('says how many tools the API description it names gave, and when it was read', () => {
    const readAt = new Date('2026-10-05T12:00:00.000Z');
    const read = new IntegrationReader(
      expressions,
      operationsContaining(),
    ).read([
      {
        ...defined(
          'integration: petstore\nopenapi:\n  url: https://petstore3.swagger.io/api/v3/openapi.json\n',
          {
            hash: 'a'.repeat(64),
            offers: ['petstore.add-pet', 'petstore.find-pets'],
          },
        ),
        reading: { readAt, problem: null, passedOver: [] },
      },
    ]);

    expect(read.integrations[0]?.described).toEqual({
      kind: 'openapi',
      tools: 2,
      readAt,
      problem: null,
    });
  });

  it('declares nothing the team’s integrations do not offer', async () => {
    expect(
      await new IntegrationReader(expressions, operationsContaining()).declared(
        [defined(WHOLE)],
        ['linear.comment', 'sentry.comment'],
      ),
    ).toEqual([]);
  });

  it('keeps reading past a definition that will not', () => {
    const read = new IntegrationReader(
      expressions,
      operationsContaining(),
    ).read([defined('integration: sentry'), defined(WHOLE)]);

    expect(read.integrations.map((each) => each.source)).toEqual(['linear']);
    expect(read.problems[0]?.path).toBe('integrations/sentry');
  });

  it('reads nothing at all from nothing at all', () => {
    expect(
      new IntegrationReader(expressions, operationsContaining()).read([]),
    ).toEqual({
      integrations: [],
      problems: [],
    });
  });
});
