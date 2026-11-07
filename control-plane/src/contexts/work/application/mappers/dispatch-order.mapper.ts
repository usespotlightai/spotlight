import type { JsonObject } from '@shared-kernel/domain/json-value';
import type { RunOrderContract } from '@work/application/contracts/run-order.contract';
import { DispatchOrder } from '@work/domain/value-objects/dispatch-order.vo';

export const DispatchOrderMapper = {
  toDispatchOrder(order: RunOrderContract): DispatchOrder {
    return DispatchOrder.of(JSON.parse(JSON.stringify(order)) as JsonObject);
  },

  toRunOrder(order: DispatchOrder): RunOrderContract {
    return order.snapshot as unknown as RunOrderContract;
  },
};
