import type {
  Holder,
  HoldingsPort,
} from '@identity/application/ports/holdings.port';

export class HoldingsRegistry<Id> implements HoldingsPort<Id> {
  private readonly holders: Holder<Id>[] = [];

  register(holder: Holder<Id>): void {
    this.holders.push(holder);
  }

  async of(id: Id): Promise<readonly string[]> {
    const held: string[] = [];

    for (const holder of this.holders) {
      held.push(...(await holder.heldBy(id)));
    }

    return held;
  }
}
