import { GitPullRequest } from 'lucide-react';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTask } from '@/hooks/api/useTasks';
import { pullRequestOf } from '@/lib/pull-request-link';

type TaskPullRequestsProps = {
  teamId: string | undefined;
  taskId: string | null | undefined;
};

export function TaskPullRequests({ teamId, taskId }: TaskPullRequestsProps) {
  const { data: task } = useTask(teamId, taskId ?? undefined);

  return (task?.pullRequests ?? []).map((href) => {
    const { repository, number } = pullRequestOf(href);

    return (
      <Tooltip key={href}>
        <TooltipTrigger
          render={
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              aria-label={`Pull request ${number} in ${repository}`}
              className="flex h-7 items-center gap-1.5 rounded-lg px-2 font-medium text-[0.8rem] outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:h-10 dark:hover:bg-muted/50"
            >
              <GitPullRequest
                aria-hidden
                className="size-3.5 text-muted-foreground"
              />
              #{number}
            </a>
          }
        />
        <TooltipContent side="bottom" align="center">
          {repository}
        </TooltipContent>
      </Tooltip>
    );
  });
}
