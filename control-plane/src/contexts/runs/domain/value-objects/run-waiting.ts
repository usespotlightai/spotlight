import type { RunState } from '@runs/domain/value-objects/run-state';

interface WaitingFacts {
  readonly state: RunState;
  readonly claimableFrom: Date | null;
  readonly reservedUntil: Date | null;
}

export const claimableAt = (run: WaitingFacts, now: Date): boolean =>
  run.state === 'queued' &&
  (run.claimableFrom === null || run.claimableFrom <= now);

export const waitsForAnyRunnerAt = (run: WaitingFacts, now: Date): boolean =>
  claimableAt(run, now) &&
  (run.reservedUntil === null || run.reservedUntil <= now);

// Why Spotlight provisions no runner for a queued run: only the hosts of a pull pool or a trust take it, only such hosts take it and none of them reports in, the pools that fit it are full, only the platform pool could take it and the operator does not allow it that work, or no pool fits it.
export const WAIT_REASONS = [
  'hosts-pull',
  'hosts-offline',
  'no-pool-has-room',
  'platform-pool-not-allowed',
  'no-pool-matches',
] as const;

export type WaitReason = (typeof WAIT_REASONS)[number];

// The hosts that a run waits for while none of them reports in.
export interface QuietHosts {
  readonly hosts: readonly string[];
  // When Spotlight last heard from one of them, or null when none is left to hear from.
  readonly since: Date | null;
}

// Why a queued run waits. Quiet names the hosts for hosts-offline, and only for it.
export interface WaitCause {
  readonly reason: WaitReason;
  readonly quiet: QuietHosts | null;
}

export const WaitCauses = {
  // The run waits for hosts that are all offline.
  hostsOffline(quiet: QuietHosts): WaitCause {
    return { reason: 'hosts-offline', quiet };
  },

  // The run waits for another reason, which names no hosts.
  of(reason: Exclude<WaitReason, 'hosts-offline'>): WaitCause {
    return { reason, quiet: null };
  },

  // A cause as Spotlight kept it. A hosts-offline wait kept without its hosts names none.
  restored(input: {
    readonly reason: WaitReason;
    readonly hosts: readonly string[] | null;
    readonly since: Date | null;
  }): WaitCause {
    return input.reason === 'hosts-offline'
      ? WaitCauses.hostsOffline({
          hosts: input.hosts ?? [],
          since: input.since,
        })
      : WaitCauses.of(input.reason);
  },
};

// Why a queued run waits, and since when.
export interface RunWait extends WaitCause {
  readonly since: Date;
}

// A wait as Spotlight keeps it: it belongs to one queueing of the run.
export interface QueuedRunWait extends RunWait {
  readonly queuedAt: Date;
}

interface WaitFacts {
  readonly state: RunState;
  readonly queuedAt: Date;
  readonly reserved: boolean;
}

// A wait holds while the run is queued and no runner is reserved for it. A wait from an earlier queueing of the run no longer holds.
export const currentWait = (
  run: WaitFacts,
  wait: QueuedRunWait | null,
): RunWait | null =>
  wait &&
  run.state === 'queued' &&
  !run.reserved &&
  wait.queuedAt.getTime() === run.queuedAt.getTime()
    ? { reason: wait.reason, quiet: wait.quiet, since: wait.since }
    : null;
