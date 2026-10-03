import type { UseQueryResult } from '@tanstack/react-query';
import { Gauge, Stethoscope } from 'lucide-react';
import { type ReactNode, useId } from 'react';
import { HealthLines } from '@/components/features/replays/HealthLines';
import { FlakyChecks } from '@/components/features/replays/set/health/FlakyChecks';
import { NoiseDetails } from '@/components/features/replays/set/health/NoiseDetails';
import { ProbeSetDialog } from '@/components/features/replays/set/health/ProbeSetDialog';
import { SanityDetails } from '@/components/features/replays/set/health/SanityDetails';
import { StrongerModelDialog } from '@/components/features/replays/set/health/StrongerModelDialog';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { DialogButton } from '@/components/shared/DialogButton';
import { failed, loading } from '@/lib/query';
import {
  type ReplayedStation,
  type ReplaySet,
  replayPath,
  type StationLive,
  startRefusal,
  strongerRefusal,
} from '@/lib/replay';
import {
  CHECK_SET,
  HEALTH_LABEL,
  HEALTH_NOTE,
  LIVE_MODEL_UNREAD,
  sanityRetryable,
  TRY_AGAIN,
  TRY_STRONGER_MODEL,
} from '@/lib/replay-words';

type LiveQuery = Pick<
  UseQueryResult<unknown>,
  'data' | 'isPending' | 'errorUpdateCount' | 'isFetching' | 'refetch'
>;

type SetHealthProps = {
  at: ReplayedStation;
  set: ReplaySet;
  live: StationLive | null;
  liveQuery: LiveQuery;
};

type StrongerSeed = {
  readonly model: string | null;
  readonly effort: string | null;
};

const strongerRefusalOf = (
  set: ReplaySet,
  live: StationLive | null,
  liveQuery: LiveQuery,
): ReactNode => {
  const refusal = startRefusal(set);

  if (refusal || loading(liveQuery)) {
    return refusal;
  }
  if (failed(liveQuery)) {
    return (
      <CouldNotLoad
        what={LIVE_MODEL_UNREAD}
        retrying={liveQuery.isFetching}
        onRetry={() => void liveQuery.refetch()}
        className="items-center"
      />
    );
  }

  return strongerRefusal(set, live);
};

export function SetHealth({ at, set, live, liveQuery }: SetHealthProps) {
  const { health } = set;
  const titleId = useId();
  const strongerRefusalId = useId();
  const harness = live?.harness;
  const refusal = strongerRefusalOf(set, live, liveQuery);
  const stronger = (label: string, seed: StrongerSeed | null) => (
    <DialogButton
      label={label}
      icon={Gauge}
      variant="outline"
      refusedBecause={refusal}
      waiting={loading(liveQuery)}
      refusalId={strongerRefusalId}
      refusalShown={seed === null}
      dialog={(open, onOpenChange) =>
        live && harness ? (
          <StrongerModelDialog
            at={at}
            set={set}
            live={{ ...live, harness }}
            seed={seed}
            open={open}
            onOpenChange={onOpenChange}
          />
        ) : null
      }
    />
  );

  return (
    <section
      aria-labelledby={titleId}
      data-slot="set-health"
      className="flex flex-col gap-2 rounded-lg border border-border bg-card px-3 py-2.5"
    >
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 id={titleId} className="font-medium text-foreground text-sm">
            {HEALTH_LABEL}
          </h2>
          <p className="text-muted-foreground text-xs leading-5">
            {HEALTH_NOTE}
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <DialogButton
            label={CHECK_SET}
            icon={Stethoscope}
            variant="outline"
            refusedBecause={startRefusal(set)}
            dialog={(open, onOpenChange) => (
              <ProbeSetDialog
                at={at}
                set={set}
                open={open}
                onOpenChange={onOpenChange}
              />
            )}
          />
          {stronger(TRY_STRONGER_MODEL, null)}
        </div>
      </div>

      <HealthLines
        setName={set.name}
        health={health}
        minGain={set.minGain}
        replayTo={(replayId) => replayPath(at, replayId)}
        details={{
          noise: health.noise && (
            <NoiseDetails set={set} noise={health.noise} />
          ),
          checks: health.checks && (
            <FlakyChecks
              slug={at.slug}
              teamId={at.teamId}
              set={set}
              checks={health.checks}
            />
          ),
          sanity: health.sanity && (
            <SanityDetails
              slug={at.slug}
              teamId={at.teamId}
              set={set}
              sanity={health.sanity}
              retry={
                sanityRetryable(health.sanity)
                  ? stronger(TRY_AGAIN, {
                      model: health.sanity.model,
                      effort: health.sanity.effort,
                    })
                  : null
              }
            />
          ),
        }}
      />
    </section>
  );
}
