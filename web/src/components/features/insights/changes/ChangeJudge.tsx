import { TrailLink } from '@/components/shell/layout/TrailLink';
import {
  type ChangeMarker,
  judgeShown,
  type StationStanding,
} from '@/lib/insights-changes';
import { judgeAgreementPath } from '@/lib/station';

type ChangeJudgeProps = {
  slug: string;
  teamId: string;
  marker: ChangeMarker;
  standing: StationStanding | null;
};

export function ChangeJudge({
  slug,
  teamId,
  marker,
  standing,
}: ChangeJudgeProps) {
  if (!standing) {
    return null;
  }

  const agreement = (
    <TrailLink
      to={judgeAgreementPath(slug, teamId, standing)}
      className="text-muted-foreground text-xs underline-offset-2 hover:underline"
    >
      How often the judge agrees with people
    </TrailLink>
  );

  return (
    <section data-slot="change-judge" className="flex flex-col gap-1">
      <h3 className="font-medium text-foreground text-sm">Judge</h3>
      {standing.trusted ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-xs">
          <dt className="text-muted-foreground">Before</dt>
          <dd className="text-foreground">{judgeShown(marker.judgeBefore)}</dd>
          <dt className="text-muted-foreground">After</dt>
          <dd className="text-foreground">{judgeShown(marker.judgeAfter)}</dd>
        </dl>
      ) : (
        <p className="text-muted-foreground text-xs">
          Judge scores are hidden until it agrees with people often enough.
        </p>
      )}
      {agreement}
    </section>
  );
}
