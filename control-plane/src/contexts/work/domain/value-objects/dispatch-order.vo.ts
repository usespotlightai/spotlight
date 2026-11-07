import type { JsonObject } from '@shared-kernel/domain/json-value';

export class DispatchOrder {
  private constructor(readonly snapshot: JsonObject) {}

  static of(snapshot: JsonObject): DispatchOrder {
    return new DispatchOrder(snapshot);
  }
}
