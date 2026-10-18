import { HookReply } from '@integrations/domain/value-objects/hook-reply.vo';
import { describe, expect, it } from 'vitest';

describe('HookReply', () => {
  it('succeeds on any 2xx answer', () => {
    expect(HookReply.answered(204, null).succeeded).toBe(true);
    expect(HookReply.answered(200, { ok: true }).failure('why')).toBeNull();
  });

  it('denies only through a 2xx answer that says deny', () => {
    expect(
      HookReply.answered(200, { deny: '  drops a column  ' }).denyReason,
    ).toBe('drops a column');
    expect(
      HookReply.answered(422, { deny: 'drops a column' }).denyReason,
    ).toBeNull();
    expect(HookReply.answered(200, { deny: '   ' }).denyReason).toBeNull();
    expect(HookReply.answered(200, ['deny']).denyReason).toBeNull();
  });

  it('fails as unreachable when nothing answered', () => {
    expect(HookReply.unanswered().failure('timed out')).toMatchObject({
      code: 'unreachable',
      reason: 'timed out',
    });
  });

  it('fails by what the endpoint answered', () => {
    expect(HookReply.answered(503, null).failure('why')?.code).toBe(
      'server-error',
    );
    expect(HookReply.answered(429, null).failure('why')?.code).toBe(
      'throttled',
    );
    expect(HookReply.answered(404, null).failure('why')?.code).toBe('rejected');
  });
});
