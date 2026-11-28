import type { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import type { CredentialSource } from '@runners/domain/value-objects/credential-source.vo';

// A person hears of an outage once its hosts have been quiet this long, or this much sooner while work waits for them. A host whose heartbeats only run late is not told of.
const TELLS_A_PERSON_AFTER_MS = 5 * 60_000;

const TELLS_A_PERSON_WHILE_WORK_WAITS_AFTER_MS = 2 * 60_000;

// The hosts of a pull pool or a trust when none of them reports in now: no runner of theirs can start work until a person brings one back.
export interface QuietHosts {
  // The names of the hosts, those whose images serve a harness.
  readonly hosts: readonly string[];
  // When Spotlight last heard from one of them, or null when none is left to hear from.
  readonly since: Date | null;
}

// The hosts of a pull pool or a trust went quiet after Spotlight had heard from them.
export interface SourceOutage {
  readonly source: CredentialSource;
  readonly hosts: readonly string[];
  readonly since: Date;
}

const latest = (hosts: readonly RunnerHost[]): Date | null =>
  hosts.length === 0
    ? null
    : new Date(
        Math.max(...hosts.map((host) => host.lastHeartbeatAt.getTime())),
      );

export const HostOutages = {
  // The hosts of one pull pool or trust are quiet while none of those that can take work reports in now. A host that serves no harness takes no work, so it neither counts nor keeps the others from being quiet.
  quietOf(hosts: readonly RunnerHost[], now: Date): QuietHosts | null {
    const serving = hosts.filter((host) => host.supportsAHarness);

    if (serving.some((host) => host.takesWorkAt(now))) {
      return null;
    }

    return {
      hosts: serving.map((host) => host.report.name),
      since: latest(serving),
    };
  },

  // The pull pools and trusts of these hosts whose hosts all went quiet. A source with no host never went down.
  ofSources(hosts: readonly RunnerHost[], now: Date): SourceOutage[] {
    const sources = hosts
      .map((host) => host.source)
      .filter(
        (source, at, all) =>
          all.findIndex((each) => each.equals(source)) === at,
      );

    return sources.flatMap((source) => {
      const quiet = HostOutages.quietOf(
        hosts.filter((host) => host.hasSource(source)),
        now,
      );

      return quiet?.since
        ? [{ source, hosts: quiet.hosts, since: quiet.since }]
        : [];
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

  // Whether work waits decides only between the two marks: before the first a person hears of nothing, and after the second they hear of it either way.
  hingesOnWaitingWork(outage: SourceOutage, now: Date): boolean {
    const quietFor = now.getTime() - outage.since.getTime();

    return (
      quietFor >= TELLS_A_PERSON_WHILE_WORK_WAITS_AFTER_MS &&
      quietFor < TELLS_A_PERSON_AFTER_MS
    );
  },

  // A person hears of the outage soon while work waits that its hosts could take, or once its hosts have been quiet for a few minutes.
  tellsAPerson(
    outage: SourceOutage,
    input: { readonly workWaits: boolean; readonly now: Date },
  ): boolean {
    return (
      input.now.getTime() - outage.since.getTime() >=
      (input.workWaits
        ? TELLS_A_PERSON_WHILE_WORK_WAITS_AFTER_MS
        : TELLS_A_PERSON_AFTER_MS)
    );
  },
};
