import { HookVerdict } from '@integrations/domain/value-objects/hook-verdict.vo';
import { describe, expect, it } from 'vitest';

describe('HookVerdict', () => {
  it('denies a before-event when a blocking hook no longer reads as written', () => {
    expect(HookVerdict.onBrokenHook('dba', 'when is gone', true)).toEqual(
      HookVerdict.denied(
        'Hook dba is broken and blocks on failure. Reason: when is gone',
      ),
    );
  });

  it('lets a before-event go on past a broken hook that continues', () => {
    expect(HookVerdict.onBrokenHook('dba', 'when is gone', false).denies).toBe(
      false,
    );
  });
});
