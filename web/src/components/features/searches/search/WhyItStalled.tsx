import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { StallGroup } from '@/components/features/searches/search/StallGroup';
import { StallTask } from '@/components/features/searches/search/StallTask';
import type { ReplayedStation, ReplaySet } from '@/lib/replay';
import {
  causesByKind,
  reflecting,
  type SearchCandidate,
  type SearchDetail,
  setTaskTitle,
  uncausedTasks,
  whyItStalledAnchor,
} from '@/lib/search';
import {
  formatCauseAction,
  formatCauseMeaning,
  formatCauseTitle,
  formatReflectionLooked,
  formatReflectionOutcome,
  formatStanding,
  formatWhyItStalled,
  REFLECTION_LOOKING,
  UNCAUSED_NOTE,
  UNCAUSED_TITLE,
} from '@/lib/search-words';

type WhyItStalledProps = {
  at: ReplayedStation;
  iteration: SearchDetail['iterations'][number];
  set: ReplaySet | undefined;
  standing: SearchCandidate | null;
};

export function WhyItStalled({
  at,
  iteration,
  set,
  standing,
}: WhyItStalledProps) {
  const reflection = iteration.reflection;
  const looking = reflecting(iteration);
  const groups = causesByKind(iteration);
  const uncaused = uncausedTasks(iteration);
  const anchor = whyItStalledAnchor(iteration.number);

  return (
    <InsightsCard id={anchor} title={formatWhyItStalled(iteration.number)}>
      <div
        data-slot="why-it-stalled"
        data-iteration={iteration.number}
        className="flex flex-col gap-3"
      >
        <div className="flex flex-col gap-1 text-sm leading-6">
          {standing && (
            <p data-slot="reflection-standing" className="text-foreground">
              {formatStanding(standing)}
            </p>
          )}
          {looking || !reflection?.outcome ? (
            <p className="text-muted-foreground">{REFLECTION_LOOKING}</p>
          ) : (
            <>
              {reflection.tasks.length > 0 && (
                <p className="text-muted-foreground">
                  {formatReflectionLooked(reflection.tasks.length)}
                </p>
              )}
              <p data-slot="reflection-outcome" className="text-foreground">
                {formatReflectionOutcome(reflection.outcome)}
              </p>
            </>
          )}
        </div>

        {groups.map((group) => (
          <StallGroup
            key={group.cause}
            kind={group.cause}
            title={formatCauseTitle(group.cause)}
            meaning={formatCauseMeaning(group.cause)}
            action={formatCauseAction(group.cause)}
          >
            {group.causes.map((cause) => (
              <StallTask
                key={cause.taskId}
                slug={at.slug}
                teamId={at.teamId}
                title={setTaskTitle(
                  { runId: cause.originalRunId, taskId: cause.taskId },
                  set,
                )}
                replayRunId={cause.replayRunId}
                evidence={cause.evidence}
                suggestion={cause.suggestion}
              />
            ))}
          </StallGroup>
        ))}

        {uncaused.length > 0 && (
          <StallGroup
            kind="none"
            title={UNCAUSED_TITLE}
            meaning={UNCAUSED_NOTE}
          >
            {uncaused.map((task) => (
              <StallTask
                key={task.taskId}
                slug={at.slug}
                teamId={at.teamId}
                title={setTaskTitle(
                  { runId: task.originalRunId, taskId: task.taskId },
                  set,
                )}
                replayRunId={task.replayRunId}
              />
            ))}
          </StallGroup>
        )}
      </div>
    </InsightsCard>
  );
}
