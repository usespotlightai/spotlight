import { HookDecision } from '@integrations/domain/value-objects/hook-decision.vo';
import { describe, expect, it } from 'vitest';

describe('HookDecision', () => {
  it('denies a before-event when a blocking hook no longer reads as written', () => {
    expect(HookDecision.onBrokenHook('dba', 'when is gone', true)).toEqual(
      HookDecision.denied(
        'Hook dba is broken and blocks on failure. Reason: when is gone',
      ),
    );
  });

  it('lets a before-event go on past a broken hook that continues', () => {
    expect(HookDecision.onBrokenHook('dba', 'when is gone', false).denies).toBe(
      false,
    );
  });
});
