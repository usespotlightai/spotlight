const NODES_PER_OPERATION = 4000;

export class SchemaBudget {
  private left = NODES_PER_OPERATION;

  spend(): boolean {
    this.left -= 1;

    return this.left >= 0;
  }
}
