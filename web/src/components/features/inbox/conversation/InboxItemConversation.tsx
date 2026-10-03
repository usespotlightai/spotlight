import { useSearchParams } from 'react-router';
import { Conversation } from '@/components/features/inbox/conversation/Conversation';
import { InboxItemFooter } from '@/components/features/inbox/conversation/InboxItemFooter';
import { InboxItemOpening } from '@/components/features/inbox/conversation/InboxItemOpening';
import { FailureCount } from '@/components/features/inbox/FailureCount';
import { RunActivity } from '@/components/features/runs/RunActivity';
import { RunSidePanel } from '@/components/features/runs/RunSidePanel';
import {
  type BreadcrumbSegment,
  Breadcrumbs,
} from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { useAnswerInboxItem } from '@/hooks/api/useAnswerInboxItem';
import {
  type InboxItem,
  type RunJournal,
  shownAt,
  workedOn,
} from '@/lib/inbox';
import { carriesItsOwn, stationOf } from '@/lib/inbox-item';

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
  const ownsItsOpening = carriesItsOwn(item);

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
            about: ownsItsOpening
              ? { title: item.title, description: item.description }
              : undefined,
            createdAt: item.createdAt,
            station: stationOf(item),
            working: item.working,
            resolved: item.resolved,
            notes: item.notes,
          }}
          worked={worked}
          deciding={{
            pending: answer.isPending,
            onDecide: (approve, said) =>
              answer.mutate({
                slug,
                itemId: item.id,
                body: said,
                attachments: [],
                approve,
              }),
          }}
          openAt={shownAt(item.notes, params.get('run'))}
          live={
            item.runId && item.working ? (
              <RunActivity
                journals={workedOn(worked, item.notes, item.runId)}
                working={item.working}
                station={stationOf(item)}
              />
            ) : undefined
          }
          opening={
            ownsItsOpening ? undefined : <InboxItemOpening item={item} />
          }
          footer={
            ownsItsOpening ? null : <InboxItemFooter slug={slug} item={item} />
          }
        />
      </RunSidePanel>
    </div>
  );
}
