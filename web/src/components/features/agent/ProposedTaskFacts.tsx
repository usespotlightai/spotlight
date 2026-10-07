import { StationIcon } from '@/components/features/board/column/StationIcon';
import { FACT_LABEL, FACT_VALUE, FactRow } from '@/components/shared/FactRow';
import { MarkdownEditor } from '@/components/shared/form/MarkdownEditor';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { type Proposal, proposedStationOf } from '@/lib/chat';
import { stationShare } from '@/lib/station';
import { taskPath } from '@/lib/task';

type ProposedTaskFactsProps = {
  slug: string;
  teamId: string;
  proposal: Proposal;
  titleId: string;
};

export function ProposedTaskFacts({
  slug,
  teamId,
  proposal,
  titleId,
}: ProposedTaskFactsProps) {
  const station = proposedStationOf(proposal);

  return (
    <dl>
      <FactRow>
        <dt className={FACT_LABEL}>Task</dt>
        <dd>
          {proposal.taskId ? (
            <TrailLink
              id={titleId}
              to={taskPath(slug, teamId, proposal.taskId)}
              className={`${FACT_VALUE} underline-offset-2 hover:underline`}
            >
              {proposal.title}
            </TrailLink>
          ) : (
            <p id={titleId} className={FACT_VALUE}>
              {proposal.title}
            </p>
          )}
        </dd>
      </FactRow>

      <FactRow>
        <dt className={FACT_LABEL}>Station</dt>
        <dd>
          {station ? (
            <p className={`${FACT_VALUE} flex items-center gap-2`}>
              <StationIcon
                share={stationShare(
                  proposal.stationPosition ?? 0,
                  proposal.stationCount ?? 1,
                )}
                color={proposal.stationColor ?? undefined}
              />
              <span className="min-w-0 truncate">{station}</span>
            </p>
          ) : (
            <p className={`${FACT_VALUE} text-muted-foreground`}>
              Station deleted
            </p>
          )}
        </dd>
      </FactRow>

      {proposal.description && (
        <FactRow>
          <dt className={FACT_LABEL}>Details</dt>
          <dd>
            <MarkdownEditor
              key={proposal.description}
              readOnly
              initialValue={proposal.description}
              placeholder=""
              ariaLabel={`What ${proposal.title} is about`}
              className="border-none bg-transparent p-0 text-sm"
            />
          </dd>
        </FactRow>
      )}
    </dl>
  );
}
