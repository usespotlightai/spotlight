import { PersonToolPolicy } from '@integrations/domain/aggregates/person-tool-policy.aggregate';
import { InvalidIntegrationPartError } from '@integrations/domain/exceptions/invalid-integration-part.error';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { PersonToolRule } from '@integrations/domain/value-objects/person-tool-rule.vo';
import { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it } from 'vitest';

const COMMENT = ToolName.of('linear.comment');

const none = () =>
  PersonToolPolicy.none({
    teamId: TeamId.of('team_1'),
    personId: UserId.of('user_alice'),
    integration: IntegrationKey.of('linear'),
  });

describe('PersonToolPolicy', () => {
  it('allows every tool until the person sets a rule', () => {
    expect(none().ruleFor(COMMENT).name).toBe('allowed');
    expect(none().isNew).toBe(true);
  });

  it('keeps a stricter rule, and deletes one set back to allowed', () => {
    const blocked = none().set(COMMENT, PersonToolRule.of('blocked'));

    expect(blocked.ruleFor(COMMENT).name).toBe('blocked');
    expect(blocked.set(COMMENT, PersonToolRule.of('allowed')).rules.size).toBe(
      0,
    );
  });

  it('rejects a rule for a tool another integration offers', () => {
    expect(() =>
      none().set(ToolName.of('github.comment'), PersonToolRule.of('blocked')),
    ).toThrow(InvalidIntegrationPartError);
  });

  it('rejects a rule that is none of allowed, needs-approval and blocked', () => {
    expect(() => PersonToolRule.of('sometimes')).toThrow(
      InvalidIntegrationPartError,
    );
  });

  it('is never stored with a rule that only allows, or without a version', () => {
    const stored = {
      teamId: TeamId.of('team_1'),
      personId: UserId.of('user_alice'),
      integration: IntegrationKey.of('linear'),
    };

    expect(() =>
      PersonToolPolicy.rehydrate({
        ...stored,
        rules: new Map([[COMMENT.value, PersonToolRule.allowed()]]),
        version: 1,
      }),
    ).toThrow(InconsistentStateError);
    expect(() =>
      PersonToolPolicy.rehydrate({ ...stored, rules: new Map(), version: 0 }),
    ).toThrow(InconsistentStateError);
  });
});
