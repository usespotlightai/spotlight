import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { RunPolicyContract } from '@runs/application/contracts/run-order.contract';
import type { RunFactsPort } from '@runs/application/ports/run-facts.port';
import type {
  RunViewerSource,
  RunViewersPort,
  ViewedRun,
} from '@runs/application/ports/run-viewers.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export interface ListedRun extends ViewedRun {
  readonly policy: Pick<RunPolicyContract, 'listed'>;
}

export interface WatchedRun extends ViewedRun {
  readonly attempt: number;
}

export class RunViewing implements RunViewersPort {
  private readonly sources = new Map<string, RunViewerSource>();

  constructor(
    private readonly facts: RunFactsPort,
    private readonly access: WorkspaceAccessPort,
  ) {}

  register(source: RunViewerSource): void {
    this.sources.set(source.owner, source);
  }

  async watchedBy(runId: RunId, viewer: UserId): Promise<WatchedRun | null> {
    const [run] = await this.facts.of([runId]);

    return run && (await this.readableAmong([run], viewer)).has(runId.value)
      ? run
      : null;
  }

  async readableAmong(
    runs: readonly ListedRun[],
    viewer: UserId,
  ): Promise<ReadonlySet<string>> {
    const byOwner = new Map<string, ListedRun[]>();

    for (const run of runs.filter((each) => each.policy.listed)) {
      const owner = run.requester.owner;
      byOwner.set(owner, [...(byOwner.get(owner) ?? []), run]);
    }

    const readable = await Promise.all(
      [...byOwner].map(([owner, owned]) =>
        (this.sources.get(owner) ?? this.membersOf(owner)).readableAmong(
          owned,
          viewer,
        ),
      ),
    );

    return new Set(readable.flatMap((each) => [...each]));
  }

  private membersOf(owner: string): RunViewerSource {
    return {
      owner,
      readableAmong: async (runs, viewer) => {
        const sees = new Map<string, Promise<boolean>>();
        const seen = await Promise.all(
          runs.map((each) => {
            const workspace = each.workspaceId.value;
            const known =
              sees.get(workspace) ??
              this.access.mayView(viewer, each.workspaceId);

            sees.set(workspace, known);
            return known;
          }),
        );

        return new Set(
          runs.flatMap((each, at) => (seen[at] ? [each.runId.value] : [])),
        );
      },
    };
  }
}
