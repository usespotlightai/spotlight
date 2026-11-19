import { useQueryClient } from '@tanstack/react-query';

import { ChatPullRequestCard } from '@/components/features/agent/ChatPullRequestCard';
import { chatKeys } from '@/hooks/api/useChats';
import { useResumeLine } from '@/hooks/api/useHold';
import type { ChatPullRequest as PullRequest } from '@/lib/chat';
import { messageOf } from '@/lib/error';
import { toast } from '@/lib/toast';

type ChatPullRequestProps = {
  slug: string;
  teamId: string;
  chatId: string;
  title: string;
  pullRequest: PullRequest;
};

export function ChatPullRequest({
  slug,
  teamId,
  chatId,
  title,
  pullRequest,
}: ChatPullRequestProps) {
  const queryClient = useQueryClient();
  const resume = useResumeLine();

  return (
    <ChatPullRequestCard
      slug={slug}
      teamId={teamId}
      title={title}
      pullRequest={pullRequest}
      pending={resume.isPending}
      onHandToLine={() =>
        resume.mutate(
          {
            teamId,
            taskId: pullRequest.taskId,
            next: 'continue',
          },
          {
            onSuccess: () => {
              void queryClient.invalidateQueries({
                queryKey: chatKeys.one(chatId),
              });
            },
            onError: (error) =>
              toast.add({
                type: 'error',
                title: 'Sorry, the task was not handed to the line',
                description: messageOf(error),
              }),
          },
        )
      }
    />
  );
}
