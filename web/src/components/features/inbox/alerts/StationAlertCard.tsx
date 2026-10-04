import { BellRing } from 'lucide-react';
import { AlertChart } from '@/components/features/inbox/alerts/AlertChart';
import { AlertChartEmpty } from '@/components/features/inbox/alerts/AlertChartEmpty';
import { StationAlertSkeleton } from '@/components/features/inbox/alerts/StationAlertSkeleton';
import { ImproveStationLink } from '@/components/features/stations/ImproveStationLink';
import { MembersOnly } from '@/components/features/team/MembersOnly';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { DecisionCard } from '@/components/shared/DecisionCard';
import { DecisionHeader } from '@/components/shared/DecisionHeader';
import { DecisionTitle } from '@/components/shared/DecisionTitle';
import { PillLink } from '@/components/shared/PillLink';
import { useLines } from '@/hooks/api/useLines';
import { useStationAlert } from '@/hooks/api/useStationAlert';
import { notFound } from '@/lib/error';
import { improvingOf, stationNamesOf, stationShown } from '@/lib/insights';
import { dayShown } from '@/lib/judge';
import { failed, loading } from '@/lib/query';
import { stationPath } from '@/lib/station';
import {
  alertOnInsightsPath,
  crossingShown,
  limitShown,
  recoveredShown,
} from '@/lib/station-alert';

type StationAlertCardProps = {
  slug: string;
  teamId: string;
  alertId: string;
};

export function StationAlertCard({
  slug,
  teamId,
  alertId,
}: StationAlertCardProps) {
  const alert = useStationAlert(teamId, alertId);
  const names = stationNamesOf(useLines(teamId).data);

  if (loading(alert)) {
    return <StationAlertSkeleton />;
  }

  if (failed(alert) && notFound(alert.error)) {
    return (
      <MembersOnly title="You’re no longer on this team, so you can’t see this alert" />
    );
  }

  if (failed(alert) || !alert.data) {
    return (
      <CouldNotLoad
        what="The alert"
        retrying={alert.isFetching}
        onRetry={() => void alert.refetch()}
        className="items-start"
      />
    );
  }

  const crossed = alert.data;
  const named = names.get(crossed.stationId);

  return (
    <DecisionCard data-slot="station-alert" aria-label="Station alert">
      <DecisionHeader
        title={
          <DecisionTitle as="h2" icon={BellRing}>
            An alert went off at {stationShown(names, crossed.stationId)}
          </DecisionTitle>
        }
        trailing={
          <p className="shrink-0 text-muted-foreground text-xs tabular-nums">
            {dayShown(crossed.raisedAt.slice(0, 10))}
          </p>
        }
      />

      <div className="mb-2 flex flex-col">
        <p className="break-words text-foreground text-sm">
          {crossingShown(crossed)} {limitShown(crossed)}
        </p>
        {crossed.recoveredAt && (
          <p className="text-muted-foreground text-sm">
            {recoveredShown(
              crossed,
              dayShown(crossed.recoveredAt.slice(0, 10)),
            )}
          </p>
        )}
      </div>

      {crossed.series.length > 0 ? (
        <AlertChart alert={crossed} />
      ) : (
        <AlertChartEmpty />
      )}

      <div className="flex flex-wrap gap-2">
        <PillLink
          to={stationPath(slug, teamId, crossed.lineId, crossed.stationId)}
        >
          Open the station
        </PillLink>
        <PillLink to={alertOnInsightsPath(slug, teamId, crossed, new Date())}>
          See it on Insights
        </PillLink>
        {named && (
          <ImproveStationLink
            slug={slug}
            teamId={teamId}
            improving={improvingOf(named)}
          />
        )}
      </div>
    </DecisionCard>
  );
}
