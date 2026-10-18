export interface DependentSource<Id> {
  dependentsOf(id: Id): Promise<readonly string[]>;
}

export interface DependentsPort<Id> {
  register(source: DependentSource<Id>): void;

  of(id: Id): Promise<readonly string[]>;
}
