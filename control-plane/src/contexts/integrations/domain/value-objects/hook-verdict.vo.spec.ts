import { HookVerdict } from '@integrations/domain/value-objects/hook-verdict.vo';
import { describe, expect, it } from 'vitest';

describe('HookVerdict', () => {
  it('refuses a before-event when a blocking hook no longer reads as written', () => {
    expect(HookVerdict.onBrokenHook('dba', 'when is gone', true)).toEqual(
      HookVerdict.refused(
        'The hook dba no longer reads as it was written (when is gone), and it blocks on failure',
      ),
    );
  });

  it('lets a before-event go on past a broken hook that continues', () => {
    expect(HookVerdict.onBrokenHook('dba', 'when is gone', false).refuses).toBe(
      false,
    );
  });
});
