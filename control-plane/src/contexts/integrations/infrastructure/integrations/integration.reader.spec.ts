import { MarkKind } from '@integrations/domain/value-objects/mark-kind.vo';
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
        summary: The issue was moved to Done.
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

    expect(read.integrations.map((each) => each.integration)).toEqual([
      'linear',
    ]);
    expect(read.integrations[0]?.path).toBe('integrations/linear');
    expect(read.problems).toEqual([]);
  });

  it('says how many tools the API description it names yielded, and when it was read', () => {
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
            tools: ['petstore.add-pet', 'petstore.find-pets'],
          },
        ),
        reading: { readAt, problem: null, skipped: [] },
      },
    ]);

    expect(read.integrations[0]?.spec).toEqual({
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

  it('names the tools the team’s integrations enable on the marks given', () => {
    const ENABLING = `${WHOLE}actions:
  get:
    request:
      method: GET
      url: https://api.linear.app/issues/\${{ inputs.issue }}
tools:
  get-issue:
    action: get
    description: Read the issue.
    enabledOnMark: linear.issue
    inputs:
      issue:
        default: '\${{ task.marks["linear.issue"] }}'
  get-other:
    action: get
    description: Read the other issue.
    inputs:
      issue:
        required: true
`;
    const reader = new IntegrationReader(expressions, operationsContaining());

    const named = (kinds: readonly string[]) =>
      reader
        .enabledOnMarks(
          [defined(ENABLING)],
          kinds.map((each) => MarkKind.of(each)),
        )
        .map((each) => each.value);

    expect(named(['linear.issue', 'git.pull-request'])).toEqual([
      'linear.get-issue',
    ]);
    expect(named(['linear.team'])).toEqual([]);
  });

  it('keeps reading past a definition that will not', () => {
    const read = new IntegrationReader(
      expressions,
      operationsContaining(),
    ).read([defined('integration: sentry'), defined(WHOLE)]);

    expect(read.integrations.map((each) => each.integration)).toEqual([
      'linear',
    ]);
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
