export interface Holder<Id> {
  heldBy(id: Id): Promise<readonly string[]>;
}

export interface HoldingsPort<Id> {
  register(holder: Holder<Id>): void;

  of(id: Id): Promise<readonly string[]>;
}
