import { JudgeStandingNote } from '@/components/features/stations/judge/JudgeStandingNote';
import { StationSection } from '@/components/features/stations/StationSection';
import { SectionLink } from '@/components/shared/SectionLink';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { useStationJudge } from '@/hooks/api/useStationJudge';
import { failed, loading } from '@/lib/query';
import { judgeAgreementPath } from '@/lib/station';

type StationJudgeLineProps = {
  slug: string;
  teamId: string;
  lineId: string;
  stationId: string;
};

export function StationJudgeLine({
  slug,
  teamId,
  lineId,
  stationId,
}: StationJudgeLineProps) {
  const judge = useStationJudge(teamId, lineId, stationId);

  if (failed(judge)) {
    return null;
  }

  return (
    <StationSection
      title="Judge"
      action={
        <SectionLink to={judgeAgreementPath(slug, teamId, { stationId })}>
          How it agrees with people
        </SectionLink>
      }
    >
      {loading(judge) || !judge.data ? (
        <SkeletonLine className="w-80 text-sm" />
      ) : (
        <JudgeStandingNote standing={judge.data.standing} />
      )}
    </StationSection>
  );
}
