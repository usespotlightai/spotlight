import { ApprovalIntent } from '@work/domain/value-objects/approval-intent.vo';
import { describe, expect, it } from 'vitest';

describe('ApprovalIntent', () => {
  it('keeps the intent of the agent as one line that completes a sentence', () => {
    expect(
      ApprovalIntent.from(
        '  post the drain summary on ENG-412,\n publicly under the team’s name.  ',
      )?.value,
    ).toBe('post the drain summary on ENG-412, publicly under the team’s name');
  });

  it('keeps what the agent exclaimed, dropping only a closing full stop', () => {
    expect(ApprovalIntent.from('ship it now!')?.value).toBe('ship it now!');
  });

  it('never cuts a character in half', () => {
    const intent = ApprovalIntent.from(`${'a'.repeat(198)}🚀🚀🚀`)?.value ?? '';

    expect(Array.from(intent)).toHaveLength(200);
    expect(intent.endsWith('🚀…')).toBe(true);
    expect(() => encodeURIComponent(intent)).not.toThrow();
  });

  it('keeps nothing where the agent gave no intent', () => {
    expect(ApprovalIntent.from('  . ')).toBeNull();
    expect(ApprovalIntent.from(undefined)).toBeNull();
    expect(ApprovalIntent.from(42)).toBeNull();
  });

  it('cuts a long one short rather than rejecting the call', () => {
    const intent = ApprovalIntent.from('post '.repeat(80));

    expect(intent?.value).toHaveLength(200);
    expect(intent?.value.endsWith('…')).toBe(true);
  });
});
