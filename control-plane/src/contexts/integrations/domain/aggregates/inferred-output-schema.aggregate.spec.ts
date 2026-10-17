import { InferredOutputSchema } from '@integrations/domain/aggregates/inferred-output-schema.aggregate';
import { OutputShape } from '@integrations/domain/value-objects/output-shape.vo';
import { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it } from 'vitest';

const AT = new Date('2026-10-05T12:00:00.000Z');

const first = () =>
  InferredOutputSchema.first({
    teamId: TeamId.of('team_1'),
    tool: ToolName.of('linear.comment'),
    answer: { url: 'https://linear.app/c/1' },
    at: AT,
  });

describe('InferredOutputSchema', () => {
  it('is inferred from one call, for the integration that provides the tool', () => {
    const schema = first();

    expect(schema.isNew).toBe(true);
    expect(schema.calls).toBe(1);
    expect(schema.integration.value).toBe('linear');
    expect(schema.shape.toJson()).toEqual(
      OutputShape.of({ url: 'x' }).toJson(),
    );
  });

  it('merges each later call into what it inferred', () => {
    const later = new Date('2026-10-05T13:00:00.000Z');
    const schema = first().inferFrom({ url: 'y', id: 'c_1' }, later);

    expect(schema.calls).toBe(2);
    expect(schema.inferredAt).toEqual(later);
    expect(schema.shape.schema).toMatchObject({ required: ['url'] });
  });

  it('is never stored without a version or a call', () => {
    expect(() =>
      InferredOutputSchema.rehydrate({
        teamId: TeamId.of('team_1'),
        tool: ToolName.of('linear.comment'),
        shape: OutputShape.of(null),
        calls: 0,
        inferredAt: AT,
        version: 1,
      }),
    ).toThrow(InconsistentStateError);
  });
});
