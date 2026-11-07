import type { CausationPort } from '@integrations/application/ports/causation.port';
import { CausalChain } from '@integrations/domain/value-objects/causal-chain.vo';
import type { CauseCarrier } from '@platform/events/cause-carrier';

export class CarriedCausation implements CausationPort {
  constructor(private readonly carrier: CauseCarrier) {}

  current(): CausalChain {
    return CausalChain.read(this.carrier.current());
  }

  runWith<T>(chain: CausalChain, work: () => Promise<T>): Promise<T> {
    return this.carrier.runWith(chain.started ? chain.stored : null, work);
  }
}
