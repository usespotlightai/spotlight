import { useSearchParams } from 'react-router';
import { Conversation } from '@/components/features/inbox/conversation/Conversation';
import { InboxItemBriefing } from '@/components/features/inbox/conversation/InboxItemBriefing';
import { InboxItemFooter } from '@/components/features/inbox/conversation/InboxItemFooter';
import { FailureCount } from '@/components/features/inbox/FailureCount';
import { RunActivity } from '@/components/features/runs/RunActivity';
import { RunSidePanel } from '@/components/features/runs/RunSidePanel';
import {
  type BreadcrumbSegment,
  Breadcrumbs,
} from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { useAnswerInboxItem } from '@/hooks/api/useAnswerInboxItem';
import { useRunProgress } from '@/hooks/useRunProgress';
import {
  type InboxItem,
  type RunJournal,
  shownAt,
  workedOn,
} from '@/lib/inbox';
import { carriesItsOwn, stationOf } from '@/lib/inbox-item';
import { shownProgress } from '@/lib/run';

type InboxItemConversationProps = {
  slug: string;
  item: InboxItem;
  worked: readonly RunJournal[];
  trail: readonly BreadcrumbSegment[];
};

export function InboxItemConversation({
  slug,
  item,
  worked,
  trail,
}: InboxItemConversationProps) {
  const [params] = useSearchParams();
  const answer = useAnswerInboxItem();
  const ownsItsBriefing = carriesItsOwn(item);
  const reported = useRunProgress(item.runId, item.progress);
  const progress = shownProgress(reported, item.runId, worked);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title={<Breadcrumbs segments={trail} />}
        trailing={<FailureCount failure={item.failure} />}
      />

      <RunSidePanel>
        <Conversation
          item={{
            id: item.id,
            teamId: item.teamId,
            about: ownsItsBriefing
              ? { title: item.title, description: item.description }
              : undefined,
            createdAt: item.createdAt,
            station: stationOf(item),
            progress,
            resolved: item.resolved,
            notes: item.notes,
          }}
          worked={worked}
          deciding={{
            pending: answer.isPending,
            onDecide: ({ approve, body, inputs }) =>
              answer.mutate({
                slug,
                itemId: item.id,
                body,
                attachments: [],
                approve,
                inputs,
              }),
          }}
          openAt={shownAt(item.notes, params.get('run'))}
          live={
            item.runId && progress ? (
              <RunActivity
                runId={item.runId}
                journals={workedOn(worked, item.notes, item.runId)}
                progress={progress}
                station={stationOf(item)}
              />
            ) : undefined
          }
          briefing={
            ownsItsBriefing ? undefined : <InboxItemBriefing item={item} />
          }
          footer={
            ownsItsBriefing ? null : (
              <InboxItemFooter slug={slug} item={item} progress={reported} />
            )
          }
        />
      </RunSidePanel>
    </div>
  );
}
