import { Fragment, useEffect, useRef } from 'react';
import { useParams } from 'react-router';
import { InitialAvatar } from '@/components/common/avatar/InitialAvatar';
import { InboxAsked } from '@/components/inbox/InboxAsked';
import { InboxComposer } from '@/components/inbox/InboxComposer';
import { InboxMessage } from '@/components/inbox/InboxMessage';
import { InboxWorking } from '@/components/inbox/InboxWorking';
import { PersonSaid } from '@/components/inbox/PersonSaid';
import { TimeMarker } from '@/components/inbox/TimeMarker';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { PageHeader } from '@/components/layout/PageHeader';
import { useInbox } from '@/hooks/api/useInbox';
import { useReadInboxItem } from '@/hooks/api/useReadInboxItem';
import { useSession } from '@/hooks/api/useSession';
import { useTaskJournal } from '@/hooks/api/useTaskJournal';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import {
  HELD_AT_TOP,
  type InboxItem as Item,
  type InboxMessage as Message,
} from '@/lib/inbox';
import { taskPath } from '@/lib/task';
import { teamPath } from '@/lib/team';

/**
 * One turn within the conversation: a person's word and the work that followed
 * it. Cut on who spoke, where the domain cuts on what a note did, because this
 * is how far a held prompt may travel before the next pushes it out of view.
 * The task opens the first turn, so that one has no prompt of its own.
 */
interface Turn {
  readonly prompt: Message | null;
  readonly messages: Message[];
}

const turnsOf = (item: Item): Turn[] => {
  const cut: Turn[] = [{ prompt: null, messages: [] }];

  for (const note of item.notes) {
    if (note.author) {
      cut.push({ prompt: note, messages: [] });
    } else {
      cut[cut.length - 1]?.messages.push(note);
    }
  }

  return cut;
};

export function InboxItem() {
  const { slug, itemId } = useParams();
  const { data: waiting } = useInbox(slug);
  const item = waiting?.find((each) => each.id === itemId);
  const { data: worked } = useTaskJournal(slug, item?.taskId);
  const { data: session } = useSession();
  const { data: workspace } = useWorkspace(slug);
  const read = useReadInboxItem();
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const following = useRef(true);

  // Watching the content rather than the message count: a message is not its
  // final height when it mounts, and a scroll measured before that lands short.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the task is what starts the conversation over, though the effect reads only the nodes
  useEffect(() => {
    const box = scroller.current;
    const inside = content.current;

    if (!box || !inside) {
      return;
    }

    following.current = true;
    box.scrollTop = box.scrollHeight;

    const grew = new ResizeObserver(() => {
      if (!following.current) {
        return;
      }

      const foot = box.scrollHeight - box.clientHeight;

      // Further than a screenful is the conversation settling into place
      // rather than growing, and gliding through it is only a long wait.
      const far = foot - box.scrollTop > box.clientHeight;
      const stillness = window.matchMedia?.(
        '(prefers-reduced-motion: reduce)',
      )?.matches;

      box.scrollTo({
        top: foot,
        behavior: far || stillness ? 'auto' : 'smooth',
      });
    });
    grew.observe(inside);

    return () => grew.disconnect();
  }, [itemId]);

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

  const CLOSE = 80;

  const watched = () => {
    const box = scroller.current;
    if (box) {
      following.current =
        box.scrollHeight - box.scrollTop - box.clientHeight < CLOSE;
    }
  };

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
      />

      <div
        ref={scroller}
        onScroll={watched}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        <div
          ref={content}
          className="mx-auto flex w-full max-w-3xl flex-col px-8 py-8"
        >
          <TimeMarker at={item.createdAt} />

          {turnsOf(item).map((turn, at, all) => (
            <section
              // biome-ignore lint/suspicious/noArrayIndexKey: turns are cut in order and never reordered
              key={at}
              className="flex flex-col"
            >
              {turn.prompt && (
                <div className="mt-6 mb-3">
                  <TimeMarker at={turn.prompt.at} />
                </div>
              )}

              <div className={HELD_AT_TOP}>
                {turn.prompt ? (
                  <PersonSaid
                    body={turn.prompt.body}
                    name={
                      turn.prompt.author?.id === session?.user.id
                        ? null
                        : turn.prompt.author?.name
                    }
                  />
                ) : (
                  <InboxAsked item={item} />
                )}
              </div>

              <ol className="mt-6 flex flex-col gap-6">
                {turn.messages.map((note, place) => {
                  const before = turn.messages[place - 1];

                  return (
                    <Fragment key={`${item.id}-${note.position}`}>
                      {(!before || before.station !== note.station) && (
                        <li>
                          <TimeMarker at={note.at} />
                        </li>
                      )}

                      <InboxMessage
                        message={note}
                        stationCount={item.stationCount}
                        worked={
                          worked?.filter((each) => each.runId === note.runId) ??
                          []
                        }
                      />
                    </Fragment>
                  );
                })}

                {item.working && at === all.length - 1 && (
                  <InboxWorking
                    station={item.station}
                    stationColor={item.stationColor}
                    stationPosition={item.stationPosition}
                    stationCount={item.stationCount}
                  />
                )}
              </ol>
            </section>
          ))}
        </div>
      </div>

      <div className="shrink-0 px-8 pb-6">
        <div className="mx-auto w-full max-w-3xl">
          {item.resolved ? (
            <p className="text-center text-muted-foreground text-xs">
              This moved on to {item.standsAt.station}. There is nothing left to
              answer.
            </p>
          ) : (
            <InboxComposer
              slug={slug}
              itemId={item.id}
              station={item.station}
            />
          )}
        </div>
      </div>
    </div>
  );
}
