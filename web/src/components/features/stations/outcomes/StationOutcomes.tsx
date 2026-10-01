import { Play } from 'lucide-react';
import { OutcomeGroup } from '@/components/features/stations/outcomes/OutcomeGroup';
import { StationOutcomesSkeleton } from '@/components/features/stations/outcomes/StationOutcomesSkeleton';
import { StationSection } from '@/components/features/stations/StationSection';
import { CreateTaskLink } from '@/components/features/team/CreateTaskLink';
import { MembersOnly } from '@/components/features/team/MembersOnly';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { EmptyState } from '@/components/shared/EmptyState';
import { useStationOutcomes } from '@/hooks/api/useStationOutcomes';
import { notFound } from '@/lib/error';
import { failed, loading } from '@/lib/query';

const BOX = 'flex justify-center rounded-xl border border-border py-10';

type StationOutcomesProps = {
  slug: string;
  teamId: string;
  lineId: string;
  stationId: string;
};

export function StationOutcomes({
  slug,
  teamId,
  lineId,
  stationId,
}: StationOutcomesProps) {
  const outcomes = useStationOutcomes(teamId, lineId, stationId);
  const groups = outcomes.data?.groups ?? [];

  return (
    <StationSection title="How its runs turned out">
      {loading(outcomes) ? (
        <StationOutcomesSkeleton />
      ) : failed(outcomes) && notFound(outcomes.error) ? (
        <div className={BOX}>
          <MembersOnly title="Only the team’s members can see how its runs turned out" />
        </div>
      ) : failed(outcomes) ? (
        <div className={BOX}>
          <CouldNotLoad
            what="The station’s runs"
            retrying={outcomes.isFetching}
            onRetry={() => void outcomes.refetch()}
          />
        </div>
      ) : groups.length === 0 ? (
        <div className={BOX}>
          <EmptyState
            icon={Play}
            title="No runs yet"
            action={<CreateTaskLink slug={slug} teamId={teamId} />}
          >
            Once tasks reach this station, its runs show here, grouped by the
            config they ran with.
          </EmptyState>
        </div>
      ) : (
        <ol aria-label="Runs by config" className="flex flex-col gap-3">
          {groups.map((group) => (
            <OutcomeGroup
              key={group.fingerprint ?? 'unrecorded'}
              slug={slug}
              teamId={teamId}
              group={group}
            />
          ))}
        </ol>
      )}
    </StationSection>
  );
}
