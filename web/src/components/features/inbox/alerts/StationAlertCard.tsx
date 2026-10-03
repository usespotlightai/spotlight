import { BellRing } from 'lucide-react';
import { AlertChart } from '@/components/features/inbox/alerts/AlertChart';
import { StationAlertSkeleton } from '@/components/features/inbox/alerts/StationAlertSkeleton';
import { ImproveStationLink } from '@/components/features/stations/ImproveStationLink';
import { MembersOnly } from '@/components/features/team/MembersOnly';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { buttonVariants } from '@/components/ui/button-variants';
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
  thresholdShown,
} from '@/lib/station-alert';
import { cn } from '@/lib/utils';

type StationAlertCardProps = {
  slug: string;
  teamId: string;
  alertId: string;
};

const LINK = cn(
  buttonVariants({ variant: 'outline', size: 'sm' }),
  'rounded-full bg-card shadow-none',
);

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
    return <MembersOnly title="Only the team’s members can see this alert" />;
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
    <div data-slot="station-alert" className="flex flex-col gap-5">
      <section className="flex flex-col gap-1">
        <p className="flex items-center gap-1.5 text-muted-foreground text-xs">
          <BellRing aria-hidden className="size-3.5" />
          An alert went off at {stationShown(names, crossed.stationId)} on{' '}
          {dayShown(crossed.raisedAt.slice(0, 10))}
        </p>
        <h3 className="font-medium text-foreground text-sm">
          {thresholdShown(crossed)}
        </h3>
        <p className="text-foreground text-sm">{crossingShown(crossed)}</p>
        {crossed.recoveredAt && (
          <p className="text-muted-foreground text-sm">
            Back within it since {dayShown(crossed.recoveredAt.slice(0, 10))}.
          </p>
        )}
      </section>

      {crossed.series.length > 0 ? (
        <AlertChart alert={crossed} />
      ) : (
        <p className="text-muted-foreground text-sm">
          The runs around it are no longer kept, so there is nothing to chart.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <TrailLink
          to={stationPath(slug, teamId, crossed.lineId, crossed.stationId)}
          className={LINK}
        >
          Open the station
        </TrailLink>
        <TrailLink
          to={alertOnInsightsPath(slug, teamId, crossed, new Date())}
          className={LINK}
        >
          See it on Insights
        </TrailLink>
        {named && (
          <ImproveStationLink
            slug={slug}
            teamId={teamId}
            improving={improvingOf(named)}
          />
        )}
      </div>
    </div>
  );
}
