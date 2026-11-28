import { useSearchParams } from 'react-router';

import { TaskPullRequestPills } from '@/components/features/board/task/TaskPullRequestPills';
import { CloseTaskSuggestion } from '@/components/features/inbox/conversation/CloseTaskSuggestion';
import { Conversation } from '@/components/features/inbox/conversation/Conversation';
import { InboxItemBriefing } from '@/components/features/inbox/conversation/InboxItemBriefing';
import { InboxItemFooter } from '@/components/features/inbox/conversation/InboxItemFooter';
import { FailureCount } from '@/components/features/inbox/FailureCount';
import { InboxTaskParts } from '@/components/features/inbox/parts/InboxTaskParts';
import { RunActivity } from '@/components/features/runs/RunActivity';
import { RunSidePanel } from '@/components/features/runs/RunSidePanel';
import { Dockable } from '@/components/shared/decision-tray/Dockable';
import {
  type BreadcrumbSegment,
  Breadcrumbs,
} from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { useAnswerInboxItem } from '@/hooks/api/useAnswerInboxItem';
import { useTaskPullRequests } from '@/hooks/api/useTaskPullRequests';
import { useClosableTask } from '@/hooks/useClosableTask';
import { useRunProgress } from '@/hooks/useRunProgress';
import {
  conversationClosed,
  type InboxItemView,
  type RunJournal,
  shownAt,
  workedOn,
} from '@/lib/inbox';
import {
  carriesItsOwn,
  promptOf,
  stationOf,
  suggestsClosing,
} from '@/lib/inbox-item';
import { nonEmpty } from '@/lib/non-empty';
import { shownProgress } from '@/lib/run';

const CLOSE_TASK = 'close-task';

type InboxItemConversationProps = {
  slug: string;
  item: InboxItemView;
  conversationId: string;
  worked: readonly RunJournal[];
  openAt?: number | null;
  openPartAt?: string | null;
  trail: readonly BreadcrumbSegment[];
};

export function InboxItemConversation({
  slug,
  item,
  conversationId,
  worked,
  openAt = null,
  openPartAt = null,
  trail,
}: InboxItemConversationProps) {
  const [params] = useSearchParams();
  const resolved = item.resolved || conversationClosed(item, conversationId);
  const conversation = { ...item, resolved };
  const answer = useAnswerInboxItem();
  const ownsItsBriefing = carriesItsOwn(item);
  const reported = useRunProgress(item.runId, item.progress);
  const progress = shownProgress(reported, item.runId, worked);
  const closable = useClosableTask(item.teamId, item.taskId);
  const { data: pullRequests = [] } = useTaskPullRequests(
    item.teamId,
    item.taskId,
  );
  const closing =
    suggestsClosing(conversation) && closable
      ? {
          id: CLOSE_TASK,
          kind: 'Suggestion',
          label: 'Close the task',
          group: 'Suggestions',
          content: (
            <CloseTaskSuggestion
              slug={slug}
              teamId={item.teamId}
              station={item.station}
              closable={closable}
            />
          ),
        }
      : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title={<Breadcrumbs segments={trail} />}
        trailing={<FailureCount failure={item.failure} />}
      />

      <RunSidePanel>
        <Conversation
          item={{
            id: conversationId,
            taskId: item.taskId,
            teamId: item.teamId,
            about: ownsItsBriefing
              ? { title: item.title, description: item.description }
              : undefined,
            createdAt: item.createdAt,
            station: stationOf(item),
            progress,
            waiting: item.waiting,
            resolved,
            notes: item.notes,
            folded: item.folded,
          }}
          worked={worked}
          deciding={{
            pending: answer.isPending,
            onDecide: ({ approve, ask, body, inputs }) =>
              answer.mutate({
                slug,
                itemId: conversationId,
                body,
                attachments: [],
                approve,
                ask,
                inputs,
              }),
          }}
          docked={closing ? [closing] : []}
          pills={
            pullRequests.length > 0 && (
              <TaskPullRequestPills pullRequests={pullRequests} />
            )
          }
          suggestion={
            closing ? (
              <div className="mt-3">
                <Dockable id={closing.id}>{closing.content}</Dockable>
              </div>
            ) : undefined
          }
          openAt={shownAt(item.notes, params.get('run')) ?? openAt}
          closing={
            <InboxTaskParts
              slug={slug}
              item={item}
              openAt={openAt === null ? openPartAt : null}
            />
          }
          prompt={promptOf(item)}
          live={
            nonEmpty(item.runId) && progress ? (
              <RunActivity
                runId={item.runId}
                journals={workedOn(worked, item.notes, item.runId)}
                progress={progress}
                station={stationOf(item)}
                waiting={item.waiting}
              />
            ) : undefined
          }
          briefing={
            ownsItsBriefing ? undefined : <InboxItemBriefing item={item} />
          }
          footer={
            ownsItsBriefing ? null : (
              <InboxItemFooter
                slug={slug}
                item={conversation}
                conversationId={conversationId}
                progress={reported}
              />
            )
          }
        />
      </RunSidePanel>
    </div>
  );
}
