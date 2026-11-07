import type {
  Dependent,
  DependentSource,
  DependentsPort,
} from '@identity/application/ports/dependents.port';

export class DependentsRegistry<Id> implements DependentsPort<Id> {
  private readonly sources: DependentSource<Id>[] = [];

  register(source: DependentSource<Id>): void {
    this.sources.push(source);
  }

  async of(id: Id): Promise<readonly Dependent[]> {
    const dependents: Dependent[] = [];

    for (const source of this.sources) {
      dependents.push(...(await source.dependentsOf(id)));
    }

    return dependents;
  }
}
