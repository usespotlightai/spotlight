import type { RunCheckoutShape } from '@runs/application/contracts/run-spec.contract';
import { RunSpecPartsMapper } from '@work/application/mappers/run-spec-parts.mapper';
import type { TaskCheckout } from '@work/domain/services/task-checkouts';

export const RunCheckoutsMapper = {
  toRun(checkouts: readonly TaskCheckout[]): RunCheckoutShape[] {
    return checkouts.map((checkout) =>
      RunSpecPartsMapper.proxiedCheckout({
        path: checkout.repository.name,
        branch: checkout.branch?.value ?? null,
        ref: checkout.ref,
        diffOf: checkout.diffOf === 'commits' ? 'commits' : null,
        setup: checkout.setup,
      }),
    );
  },
};
