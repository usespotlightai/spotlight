import type {
  EgressRunnerSource,
  EgressRunnersPort,
} from '@secrets/application/ports/egress-runners.port';

export class EgressRunnersRegistry implements EgressRunnersPort {
  private readonly sources: EgressRunnerSource[] = [];

  register(source: EgressRunnerSource): void {
    this.sources.push(source);
  }

  async anyIn(workspaceId: string): Promise<boolean> {
    for (const source of this.sources) {
      if (await source.anyIn(workspaceId)) {
        return true;
      }
    }

    return false;
  }
}
