import { Fragment, useEffect, useRef } from 'react';
import { useParams } from 'react-router';
import { InboxAsked } from '@/components/inbox/InboxAsked';
import { InboxComposer } from '@/components/inbox/InboxComposer';
import { InboxMessage } from '@/components/inbox/InboxMessage';
import { InboxWorking } from '@/components/inbox/InboxWorking';
import { PersonSaid } from '@/components/inbox/PersonSaid';
import { TimeMarker } from '@/components/inbox/TimeMarker';
import { useInbox } from '@/hooks/api/useInbox';
import { useReadInboxItem } from '@/hooks/api/useReadInboxItem';
import { useSession } from '@/hooks/api/useSession';
import { useTaskJournal } from '@/hooks/api/useTaskJournal';
import {
  HELD_AT_TOP,
  type InboxItem as Item,
  type InboxMessage as Message,
} from '@/lib/inbox';

/**
 * A stretch of the conversation: what a person put in, and the work that
 * followed it. The task itself opens the first stretch, so it has no prompt of
 * its own.
 */
interface Stretch {
  readonly prompt: Message | null;
  readonly messages: Message[];
}

/**
 * Cut at every person's word, because each holds the top only until the next
 * one arrives — a stretch is what a held prompt is allowed to travel within.
 */
const stretches = (item: Item): Stretch[] => {
  const cut: Stretch[] = [{ prompt: null, messages: [] }];

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
  const read = useReadInboxItem();
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  // Someone who scrolled up to read should not be dragged back down.
  const following = useRef(true);

  /*
  Follow the foot of the conversation as it grows.

  Watching the content rather than the message count, because a message is not
  its final height when it mounts: the markdown it holds lays itself out a beat
  later, and a scroll measured before that lands short. A count also says
  nothing when the item changes for one the same length.
  */
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

      /*
      A message arriving is a short step, and worth watching happen. Anything
      further than a screenful is the conversation settling into place rather
      than growing, and gliding through it would only be a long wait.
      */
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

  // Near enough the foot to count as still there, in pixels.
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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
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

          {stretches(item).map((stretch, at, all) => (
            <section
              // biome-ignore lint/suspicious/noArrayIndexKey: stretches are cut in order and never reordered
              key={at}
              className="flex flex-col"
            >
              {/* Above the prompt, the same as the one that opens the
                  conversation and the ones between stations. */}
              {stretch.prompt && (
                <div className="mt-6 mb-3">
                  <TimeMarker at={stretch.prompt.at} />
                </div>
              )}

              <div className={HELD_AT_TOP}>
                {stretch.prompt ? (
                  <PersonSaid
                    body={stretch.prompt.body}
                    name={
                      stretch.prompt.author?.id === session?.user.id
                        ? null
                        : stretch.prompt.author?.name
                    }
                  />
                ) : (
                  <InboxAsked item={item} />
                )}
              </div>

              <ol className="mt-6 flex flex-col gap-6">
                {stretch.messages.map((note, place) => {
                  const before = stretch.messages[place - 1];

                  return (
                    <Fragment key={`${item.id}-${note.position}`}>
                      {/* A station taking up the work is a break in it, the
                          first one included: it came from somewhere else. */}
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

                {/* Only under the last stretch: what is being worked on is
                    what was asked most recently. */}
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
              This moved on to {item.station}. There is nothing left to answer.
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
