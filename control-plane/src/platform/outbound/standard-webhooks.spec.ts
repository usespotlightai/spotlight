import { signatureOf } from '@platform/outbound/standard-webhooks';
import { describe, expect, it } from 'vitest';

describe('signatureOf', () => {
  it('signs as the Standard Webhooks specification does', () => {
    expect(
      signatureOf(
        Buffer.from('MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw', 'base64'),
        'msg_p5jXN8AQM9LWM0D4loKWxJek',
        1614265330,
        '{"test": 2432232314}',
      ),
    ).toBe('v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=');
  });
});
