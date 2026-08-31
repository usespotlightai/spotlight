import { useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { InitialAvatar } from '@/components/common/avatar/InitialAvatar';
import { Conversation } from '@/components/inbox/Conversation';
import { InboxAsked } from '@/components/inbox/InboxAsked';
import { InboxComposer } from '@/components/inbox/InboxComposer';
import { InboxResolve } from '@/components/inbox/InboxResolve';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { PageHeader } from '@/components/layout/PageHeader';
import { RunBriefing } from '@/components/runs/RunBriefing';
import { useInbox } from '@/hooks/api/useInbox';
import { useReadInboxItem } from '@/hooks/api/useReadInboxItem';
import { useSession } from '@/hooks/api/useSession';
import { useTaskJournal } from '@/hooks/api/useTaskJournal';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { shownAt } from '@/lib/inbox';
import { taskPath } from '@/lib/task';
import { teamPath } from '@/lib/team';

export function InboxItem() {
  const { slug, itemId } = useParams();
  const [params] = useSearchParams();
  const { data: waiting } = useInbox(slug);
  const item = waiting?.find((each) => each.id === itemId);
  const { data: worked } = useTaskJournal(slug, item?.taskId);
  const { data: session } = useSession();
  const { data: workspace } = useWorkspace(slug);
  const read = useReadInboxItem();

  // Keyed by the conversation's state, not the item: an ask arriving while it
  // is open makes it unread again.
  const seen = useRef<string | null>(null);

  useEffect(() => {
    const at = item && `${item.id}:${item.notes.length}`;

    if (!slug || !item?.unread || !at || seen.current === at) {
      return;
    }

    seen.current = at;
    read.mutate({ slug, itemId: item.id });
  }, [slug, item, read.mutate]);

  if (!item || !slug) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-8">
        <p className="text-muted-foreground text-sm">
          Nothing here is waiting on you any more.
        </p>
      </div>
    );
  }

  const team = workspace?.teams.find(
    (candidate) => candidate.id === item.teamId,
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title={
          <Breadcrumbs
            segments={[
              ...(team
                ? [
                    {
                      label: team.name,
                      icon: (
                        <InitialAvatar name={team.name} className="bg-card" />
                      ),
                      to: teamPath(slug, team.id),
                    },
                  ]
                : []),
              {
                label: item.title,
                to: taskPath(slug, item.teamId, item.taskId),
              },
            ]}
          />
        }
        actions={
          item.resolved ? null : <InboxResolve slug={slug} itemId={item.id} />
        }
      />

      <Conversation
        item={{
          id: item.id,
          createdAt: item.createdAt,
          station: {
            name: item.station,
            color: item.stationColor,
            position: item.stationPosition,
            count: item.stationCount,
          },
          working: item.working,
          notes: item.notes,
        }}
        worked={worked ?? []}
        viewerId={session?.user.id}
        openAt={shownAt(item.notes, params.get('run'))}
        opening={
          item.briefing ? (
            <RunBriefing briefing={item.briefing} />
          ) : (
            <InboxAsked item={item} />
          )
        }
        footer={
          item.resolved ? (
            <p className="text-center text-muted-foreground text-xs">
              {item.standsAt.name === item.station
                ? 'This is settled. There is nothing left to answer.'
                : `This moved on to ${item.standsAt.name}. There is nothing left to answer.`}
            </p>
          ) : (
            <InboxComposer
              slug={slug}
              itemId={item.id}
              station={item.station}
            />
          )
        }
      />
    </div>
  );
}
