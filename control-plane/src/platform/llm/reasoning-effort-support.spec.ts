import { ReasoningEffortSupport } from '@platform/llm/reasoning-effort-support';
import { describe, expect, it } from 'vitest';

const ACME = { owner: 'ws_acme/inference_acme', revision: '1' };

const GLOBEX = { owner: 'ws_globex/inference_globex', revision: '1' };

describe('ReasoningEffortSupport', () => {
  it('knows nothing it was not told', () => {
    expect(new ReasoningEffortSupport().of(ACME)).toBeNull();
  });

  it('keeps what one endpoint learnt away from another workspace', () => {
    const support = new ReasoningEffortSupport();

    support.remember(ACME, false);

    expect(support.of(ACME)).toBe(false);
    expect(support.of(GLOBEX)).toBeNull();
  });

  it('learns again when the endpoint changes', () => {
    const support = new ReasoningEffortSupport();

    support.remember(ACME, false);

    expect(support.of({ ...ACME, revision: '2' })).toBeNull();
  });

  it('drops what an older version of the endpoint learnt', () => {
    const support = new ReasoningEffortSupport();

    support.remember(ACME, false);
    support.remember({ ...ACME, revision: '2' }, true);

    expect(support.of(ACME)).toBeNull();
    expect(support.of({ ...ACME, revision: '2' })).toBe(true);
  });

  it('forgets the endpoint it heard of longest ago when it is full', () => {
    const support = new ReasoningEffortSupport(2);
    const INITECH = { owner: 'ws_initech/inference_initech', revision: '1' };

    support.remember(ACME, true);
    support.remember(GLOBEX, true);
    support.remember(ACME, false);
    support.remember(INITECH, true);

    expect(support.of(GLOBEX)).toBeNull();
    expect(support.of(ACME)).toBe(false);
    expect(support.of(INITECH)).toBe(true);
  });
});
