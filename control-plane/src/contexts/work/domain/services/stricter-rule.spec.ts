import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { StricterRule } from '@work/domain/services/stricter-rule';
import { ApprovalNeeded } from '@work/domain/value-objects/approval-needed.vo';
import { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';
import { Tool } from '@work/domain/value-objects/tool.vo';
import { ToolRule } from '@work/domain/value-objects/tool-rule.vo';
import { describe, expect, it } from 'vitest';

const ALICE = UserId.of('user_alice');

const TEAM_GATE = ApprovalNeeded.of('linear.comment', 'It posts publicly.');

const tool = (approval: ApprovalNeeded | null) =>
  DeclaredTool.of({
    tool: Tool.of('linear.comment'),
    description: 'Comment on the issue.',
    approval,
    offeredBy: 'Linear',
  });

const alice = (rule: string) => ({
  rule: ToolRule.of(rule),
  personId: ALICE,
  personName: 'Alice',
});

describe('StricterRule', () => {
  it('asks the person where the team allows and they ask first', () => {
    const ruled = StricterRule.of(tool(null), alice('needs-approval'));

    expect(ruled.kind).toBe('needs-approval');
    expect(ruled.kind === 'needs-approval' && ruled.needed.askedOf).toEqual(
      ALICE,
    );
    expect(ruled.kind === 'needs-approval' && ruled.needed.because).toBe(
      'Alice asks to approve each call made with their Linear connection.',
    );
  });

  it('still asks where the team gates and the person allows', () => {
    expect(StricterRule.of(tool(TEAM_GATE), alice('allowed'))).toEqual({
      kind: 'needs-approval',
      needed: TEAM_GATE,
    });
  });

  it('blocks whatever the team says where the person blocks', () => {
    for (const approval of [null, TEAM_GATE]) {
      expect(StricterRule.of(tool(approval), alice('blocked'))).toEqual({
        kind: 'blocked',
        by: 'Alice',
      });
    }
  });

  it('keeps the team’s reason, asked of the person, where both ask', () => {
    const ruled = StricterRule.of(tool(TEAM_GATE), alice('needs-approval'));

    expect(ruled.kind === 'needs-approval' && ruled.needed.because).toBe(
      'It posts publicly.',
    );
    expect(ruled.kind === 'needs-approval' && ruled.needed.askedOf).toEqual(
      ALICE,
    );
  });

  it('follows the team alone where no person’s rule applies', () => {
    expect(StricterRule.of(tool(null), null)).toEqual({ kind: 'allowed' });
    expect(StricterRule.of(tool(null), alice('allowed'))).toEqual({
      kind: 'allowed',
    });
    expect(StricterRule.of(tool(TEAM_GATE), null)).toEqual({
      kind: 'needs-approval',
      needed: TEAM_GATE,
    });
  });
});
