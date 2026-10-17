import { GraduationCap } from 'lucide-react';
import { useState } from 'react';
import { InsightsTile } from '@/components/features/insights/InsightsTile';
import { InsightsTiles } from '@/components/features/insights/InsightsTiles';
import { JudgeAgreementSkeleton } from '@/components/features/stations/judge/JudgeAgreementSkeleton';
import { RubricVersionCard } from '@/components/features/stations/judge/RubricVersionCard';
import { CreateTaskLink } from '@/components/features/team/CreateTaskLink';
import { MembersOnly } from '@/components/features/team/MembersOnly';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { EmptyState } from '@/components/shared/EmptyState';
import { ChoiceSelect } from '@/components/shared/form/ChoiceSelect';
import { useStationJudge } from '@/hooks/api/useStationJudge';
import { notFound } from '@/lib/error';
import { formatRubric, judgeTiles } from '@/lib/judge';
import { failed, loading } from '@/lib/query';

const BOX = 'flex justify-center rounded-xl border border-border py-10';

type JudgeAgreementProps = {
  slug: string;
  teamId: string;
  lineId: string;
  stationId: string;
};

export function JudgeAgreement({
  slug,
  teamId,
  lineId,
  stationId,
}: JudgeAgreementProps) {
  const query = useStationJudge(teamId, lineId, stationId);
  const [picked, setPicked] = useState<string | null>(null);

  if (loading(query)) {
    return <JudgeAgreementSkeleton />;
  }

  if (failed(query) && notFound(query.error)) {
    return (
      <div className={BOX}>
        <MembersOnly title="Only team members can see judge agreement" />
      </div>
    );
  }

  if (failed(query) || !query.data) {
    return (
      <div className={BOX}>
        <CouldNotLoad
          what="How the judge agrees with people"
          retrying={query.isFetching}
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  }

  const { calibration, versions, coverage, judge } = query.data;
  const shown =
    versions.find((version) => version.rubricVersion === picked) ??
    versions.find((version) => version.current) ??
    versions[0];

  if (!shown) {
    return (
      <div className={BOX}>
        <EmptyState
          icon={GraduationCap}
          title="No judged runs yet"
          action={<CreateTaskLink slug={slug} teamId={teamId} />}
        >
          Judge agreement with people shows here per rubric once the judge
          scores runs.
        </EmptyState>
      </div>
    );
  }

  return (
    <div data-slot="judge-agreement" className="flex flex-col gap-3">
      <InsightsTiles label="How far to trust the judge">
        {judgeTiles(calibration, coverage).map((tile) => (
          <InsightsTile
            key={tile.id}
            label={tile.label}
            value={tile.value}
            detail={tile.detail}
          />
        ))}
      </InsightsTiles>

      {versions.length > 1 && (
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-muted-foreground text-xs">
            Rubric
          </span>
          <ChoiceSelect
            label="Rubric"
            compact
            clearable={false}
            choices={versions.map((version) => ({
              value: version.rubricVersion,
              label: formatRubric(version),
            }))}
            value={shown.rubricVersion}
            placeholder="Current version"
            onChange={setPicked}
          />
        </div>
      )}

      <RubricVersionCard
        key={shown.rubricVersion}
        version={shown}
        claims={shown.current && judge ? judge.claims : []}
        trust={calibration.trust}
      />
    </div>
  );
}
