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
import { formatStation, improvingOf, stationNamesOf } from '@/lib/insights';
import { formatDay } from '@/lib/judge';
import { failed, loading } from '@/lib/query';
import { stationPath } from '@/lib/station';
import {
  alertOnInsightsPath,
  formatFiring,
  formatLimit,
  formatResolved,
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
    return <MembersOnly title="Only team members can see this alert" />;
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

  const firing = alert.data;
  const named = names.get(firing.stationId);

  return (
    <DecisionCard data-slot="station-alert" aria-label="Station alert">
      <DecisionHeader
        title={
          <DecisionTitle as="h2" icon={BellRing}>
            Alert fired at {formatStation(names, firing.stationId)}
          </DecisionTitle>
        }
        trailing={
          <p className="shrink-0 text-muted-foreground text-xs tabular-nums">
            {formatDay(firing.firedAt.slice(0, 10))}
          </p>
        }
      />

      <div className="mb-2 flex flex-col">
        <p className="break-words text-foreground text-sm">
          {formatFiring(firing)} {formatLimit(firing)}
        </p>
        {firing.resolvedAt && (
          <p className="text-muted-foreground text-sm">
            {formatResolved(firing, formatDay(firing.resolvedAt.slice(0, 10)))}
          </p>
        )}
      </div>

      {firing.series.length > 0 ? (
        <AlertChart alert={firing} />
      ) : (
        <AlertChartEmpty />
      )}

      <div className="flex flex-wrap gap-2">
        <PillLink
          to={stationPath(slug, teamId, firing.lineId, firing.stationId)}
        >
          Open the station
        </PillLink>
        <PillLink to={alertOnInsightsPath(slug, teamId, firing)}>
          Open in Insights
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
