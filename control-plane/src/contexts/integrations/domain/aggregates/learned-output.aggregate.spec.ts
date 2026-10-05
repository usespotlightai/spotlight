import { LearnedOutput } from '@integrations/domain/aggregates/learned-output.aggregate';
import { OutputShape } from '@integrations/domain/value-objects/output-shape.vo';
import { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it } from 'vitest';

const AT = new Date('2026-10-05T12:00:00.000Z');

const first = () =>
  LearnedOutput.first({
    teamId: TeamId.of('team_1'),
    tool: ToolName.of('linear.comment'),
    answer: { url: 'https://linear.app/c/1' },
    at: AT,
  });

describe('LearnedOutput', () => {
  it('is learned from one call, for the integration that offers the tool', () => {
    const learned = first();

    expect(learned.isNew).toBe(true);
    expect(learned.calls).toBe(1);
    expect(learned.source.value).toBe('linear');
    expect(learned.shape.toJson()).toEqual(
      OutputShape.of({ url: 'x' }).toJson(),
    );
  });

  it('merges each later call into what it learned', () => {
    const later = new Date('2026-10-05T13:00:00.000Z');
    const learned = first().learnedFrom({ url: 'y', id: 'c_1' }, later);

    expect(learned.calls).toBe(2);
    expect(learned.learnedAt).toEqual(later);
    expect(learned.shape.schema).toMatchObject({ required: ['url'] });
  });

  it('is never kept without a version or a call', () => {
    expect(() =>
      LearnedOutput.rehydrate({
        teamId: TeamId.of('team_1'),
        tool: ToolName.of('linear.comment'),
        shape: OutputShape.of(null),
        calls: 0,
        learnedAt: AT,
        version: 1,
      }),
    ).toThrow(InconsistentStateError);
  });
});
