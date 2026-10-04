import { ApprovalIntent } from '@work/domain/value-objects/approval-intent.vo';
import { describe, expect, it } from 'vitest';

describe('ApprovalIntent', () => {
  it('keeps what the agent said as one line that completes a sentence', () => {
    expect(
      ApprovalIntent.said(
        '  post the drain summary on ENG-412,\n publicly under the team’s name.  ',
      )?.value,
    ).toBe('post the drain summary on ENG-412, publicly under the team’s name');
  });

  it('keeps nothing where the agent said nothing', () => {
    expect(ApprovalIntent.said('  . ')).toBeNull();
    expect(ApprovalIntent.said(undefined)).toBeNull();
    expect(ApprovalIntent.said(42)).toBeNull();
  });

  it('cuts a long one short rather than refusing the call', () => {
    const said = ApprovalIntent.said('post '.repeat(80));

    expect(said?.value).toHaveLength(200);
    expect(said?.value.endsWith('…')).toBe(true);
  });
});
