import { Hand } from 'lucide-react';

import { StationIcon } from '@/components/features/board/column/StationIcon';
import { DecisionButton } from '@/components/shared/DecisionButton';
import { DecisionCard } from '@/components/shared/DecisionCard';
import { DecisionControls } from '@/components/shared/DecisionControls';
import { DecisionHeader } from '@/components/shared/DecisionHeader';
import { DecisionTitle } from '@/components/shared/DecisionTitle';
import { FACT_LABEL, FACT_VALUE, FactRow } from '@/components/shared/FactRow';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import {
  type ChatPullRequest,
  pullRequestNameOf,
  pullRequestStationOf,
  pullRequestStatusOf,
  pullRequestTitleOf,
} from '@/lib/chat';
import { stationShare } from '@/lib/station';
import { taskPath } from '@/lib/task';

const LINK = `${FACT_VALUE} -mx-1.5 rounded-md box-decoration-clone px-1.5 py-0.5 outline-none pointer-coarse:py-1.5 transition-colors hover:bg-accent focus-visible:bg-accent`;

type ChatPullRequestCardProps = {
  slug: string;
  teamId: string;
  title: string;
  pullRequest: ChatPullRequest;
  pending: boolean;
  onHandToLine: () => void;
};

export function ChatPullRequestCard({
  slug,
  teamId,
  title,
  pullRequest,
  pending,
  onHandToLine,
}: ChatPullRequestCardProps) {
  const station = pullRequestStationOf(pullRequest);
  const task = pullRequest.state !== 'gone';

  return (
    <DecisionCard data-slot="chat-pull-request" className="gap-0">
      <DecisionHeader
        title={
          pullRequest.state === 'held' ? (
            <DecisionTitle icon={Hand}>
              {pullRequestTitleOf(pullRequest)}
            </DecisionTitle>
          ) : (
            <DecisionTitle status={pullRequestStatusOf(pullRequest.state)}>
              {pullRequestTitleOf(pullRequest)}
            </DecisionTitle>
          )
        }
      />

      <div className="flex flex-col gap-3 pt-1.5">
        <dl>
          <FactRow>
            <dt className={FACT_LABEL}>Pull request</dt>
            <dd>
              <a
                href={pullRequest.url}
                target="_blank"
                rel="noreferrer"
                className={LINK}
              >
                {title}
                <span className="ml-2 text-muted-foreground">
                  {pullRequestNameOf(pullRequest.url)}
                </span>
              </a>
            </dd>
          </FactRow>

          {task && station && (
            <FactRow>
              <dt className={FACT_LABEL}>Station</dt>
              <dd>
                <p className={`${FACT_VALUE} flex items-center gap-2`}>
                  <StationIcon
                    share={stationShare(
                      pullRequest.stationPosition ?? 0,
                      pullRequest.stationCount ?? 1,
                    )}
                    color={pullRequest.stationColor ?? undefined}
                  />
                  <span className="min-w-0 truncate" title={station}>
                    {station}
                  </span>
                </p>
              </dd>
            </FactRow>
          )}
        </dl>

        {task && (
          <DecisionControls>
            <TrailLink
              to={taskPath(slug, teamId, pullRequest.taskId)}
              className="flex h-7 items-center rounded-sm px-2 text-sm font-medium text-foreground underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:h-9"
            >
              Open task
            </TrailLink>
            {pullRequest.state === 'held' && (
              <DecisionButton
                variant="default"
                disabled={pending}
                onClick={onHandToLine}
              >
                Hand to the line
              </DecisionButton>
            )}
          </DecisionControls>
        )}
      </div>
    </DecisionCard>
  );
}
