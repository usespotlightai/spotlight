export class Tombstones {
  private constructor(
    readonly workspace: boolean,
    readonly team: boolean,
    readonly task: boolean,
  ) {}

  static of(deleted: {
    workspace: boolean;
    team: boolean;
    task: boolean;
  }): Tombstones {
    return new Tombstones(deleted.workspace, deleted.team, deleted.task);
  }

  get acceptsFacts(): boolean {
    return !this.workspace && !this.team && !this.task;
  }
}
