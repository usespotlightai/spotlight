import type { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import type { WorkspaceRunnerFacts } from '@runners/domain/services/workspace-readiness';
import type { CredentialSource } from '@runners/domain/value-objects/credential-source.vo';
import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';

// A person hears of an outage once work waits for its hosts, or once they have been quiet this long.
const TELLS_A_PERSON_AFTER_MS = 5 * 60_000;

// Hosts that serve work here, none of which reports in now.
export interface OfflineHosts {
  readonly hosts: readonly RunnerHost[];
  // When Spotlight last heard from one of them.
  readonly since: Date;
}

export interface HarnessOutage extends OfflineHosts {
  readonly harness: HarnessId;
}

export interface SourceOutage extends OfflineHosts {
  readonly source: CredentialSource;
}

const offline = (
  hosts: readonly RunnerHost[],
  now: Date,
): OfflineHosts | null => {
  if (hosts.length === 0 || hosts.some((host) => host.isOnlineAt(now))) {
    return null;
  }

  return {
    hosts,
    since: new Date(
      Math.max(...hosts.map((host) => host.lastHeartbeatAt.getTime())),
    ),
  };
};

const each = <Item>(
  items: readonly Item[],
  same: (one: Item, other: Item) => boolean,
): Item[] =>
  items.filter(
    (item, at) => items.findIndex((other) => same(item, other)) === at,
  );

export const HostOutages = {
  // No runner can start work for these harnesses until a person acts: hosts here run the harness, none of them reports in now, and no pool of the workspace provisions a runner instead. The platform pool does not count, because it takes no work that the hosts of the workspace fit. Where an online host runs the harness, the work waits only for a free slot.
  ofHarnesses(facts: WorkspaceRunnerFacts): HarnessOutage[] {
    if (
      facts.pools.some(
        (pool) => !pool.isPlatform && pool.canProvision(facts.platform.poolSet),
      )
    ) {
      return [];
    }

    const serving = facts.hosts.filter((host) =>
      host.servesAHarnessAt(facts.now),
    );

    return each(
      serving.flatMap((host) => host.report.harnesses),
      (one, other) => one.equals(other),
    ).flatMap((harness) => {
      const quiet = offline(
        serving.filter((host) => host.servesAt(harness, facts.now)),
        facts.now,
      );

      return quiet ? [{ harness, ...quiet }] : [];
    });
  },

  // The pull pools and trusts whose hosts, those that serve a harness, all stopped reporting in.
  ofSources(hosts: readonly RunnerHost[], now: Date): SourceOutage[] {
    const serving = hosts.filter((host) => host.servesAHarnessAt(now));

    return each(
      serving.map((host) => host.source),
      (one, other) => one.equals(other),
    ).flatMap((source) => {
      const quiet = offline(
        serving.filter((host) => host.hasSource(source)),
        now,
      );

      return quiet ? [{ source, ...quiet }] : [];
    });
  },

  // The outages that Spotlight has not raised yet. A pull pool or a trust has one raised outage at a time.
  unraised(
    outages: readonly SourceOutage[],
    raised: readonly { readonly source: CredentialSource }[],
  ): SourceOutage[] {
    return outages.filter(
      (outage) => !raised.some((each) => each.source.equals(outage.source)),
    );
  },

  // A person hears of the outage once work waits in the workspace, or once its hosts have been quiet for a few minutes.
  tellsAPerson(
    outage: OfflineHosts,
    input: { readonly workWaits: boolean; readonly now: Date },
  ): boolean {
    return (
      input.workWaits ||
      input.now.getTime() - outage.since.getTime() >= TELLS_A_PERSON_AFTER_MS
    );
  },
};
