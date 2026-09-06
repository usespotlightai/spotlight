import { Fragment, type ReactNode, useLayoutEffect, useRef } from 'react';
import { InboxMessage } from '@/components/features/inbox/conversation/InboxMessage';
import { InboxWorking } from '@/components/features/inbox/conversation/InboxWorking';
import { PersonSaid } from '@/components/features/inbox/conversation/PersonSaid';
import { TimeMarker } from '@/components/features/inbox/conversation/TimeMarker';
import {
  type Conversing,
  HELD_AT_TOP,
  type InboxMessage as Message,
  openedAt,
  type RunJournal,
} from '@/lib/inbox';

interface Turn {
  readonly prompt: Message | null;
  readonly messages: Message[];
}

const turnsOf = (item: Conversing): Turn[] => {
  const cut: Turn[] = [{ prompt: null, messages: [] }];

  for (const note of item.notes) {
    if (note.voice === 'person') {
      cut.push({ prompt: note, messages: [] });
    } else {
      cut[cut.length - 1]?.messages.push(note);
    }
  }

  return cut;
};

/**
 * Which notes are worth a time above them: the ones that do not read the same
 * as the mark already standing. A note raised with the conversation it opens
 * carries the same moment as the conversation, and one of them is enough.
 */
const marksIn = (item: Conversing): Set<number> => {
  let standing = openedAt(item.createdAt);
  const marked = new Set<number>();

  for (const note of item.notes) {
    const reads = openedAt(note.at);

    if (reads !== standing) {
      standing = reads;
      marked.add(note.position);
    }
  }

  return marked;
};

const CLOSE = 80;

/**
 * How long the conversation has to stop growing before a move through it is
 * worth watching. Everything above this is the page assembling itself — the
 * bodies filling in, the journal landing — and animating that only draws the
 * eye to a position the reader never held.
 */
const SETTLING_MS = 250;

const put = (
  box: HTMLDivElement,
  inside: HTMLDivElement,
  at: number | null,
): boolean => {
  const note = at === null ? null : inside.querySelector(`[data-note="${at}"]`);
  const was = box.scrollTop;

  box.scrollTop = note
    ? note.getBoundingClientRect().top -
      box.getBoundingClientRect().top +
      box.scrollTop
    : box.scrollHeight;

  // A move that never happened raises no scroll to catch.
  return box.scrollTop !== was;
};

type ConversationProps = {
  item: Conversing;
  worked: readonly RunJournal[];
  viewerId?: string;
  openAt?: number | null;
  opening?: ReactNode;
  live?: ReactNode;
  footer: ReactNode;
};

export function Conversation({
  item,
  worked,
  viewerId,
  openAt,
  opening,
  live,
  footer,
}: ConversationProps) {
  const marked = marksIn(item);
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const held = useRef<number | null>(null);
  const ours = useRef(false);

  // Watching the content rather than the message count: a message is not its
  // final height when it mounts, and a scroll measured before that lands short.
  // Laid out rather than merely effected, so the first painted frame is already
  // in place instead of showing the top and then leaving it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the item is what starts the conversation over, though the effect reads only the nodes
  useLayoutEffect(() => {
    const box = scroller.current;
    const inside = content.current;

    if (!box || !inside) {
      return;
    }

    held.current = openAt ?? null;
    following.current = held.current === null;
    ours.current = put(box, inside, held.current);

    let settled = false;
    let quiet: ReturnType<typeof setTimeout>;

    // Each growth pushes the moment of stillness back, so the conversation is
    // settled only once it has actually stopped moving.
    const stirred = () => {
      settled = false;
      clearTimeout(quiet);
      quiet = setTimeout(() => {
        settled = true;
      }, SETTLING_MS);
    };
    stirred();

    const grew = new ResizeObserver(() => {
      stirred();

      // The markdown above it mounts late, so it is put back.
      if (held.current !== null) {
        ours.current = put(box, inside, held.current) || ours.current;
        return;
      }

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
      const cut = !settled || far || stillness;

      const was = box.scrollTop;
      box.scrollTo({ top: foot, behavior: cut ? 'auto' : 'smooth' });

      // A cut lands at once and raises the one scroll it has to answer for.
      // A glide raises them the whole way down and cannot be spoken for by a
      // single flag, so it is left to be read as the reader's own.
      if (cut) {
        ours.current = box.scrollTop !== was || ours.current;
      }
    });
    grew.observe(inside);

    return () => {
      clearTimeout(quiet);
      grew.disconnect();
    };
  }, [item.id, openAt]);

  const watched = () => {
    const box = scroller.current;

    if (!box) {
      return;
    }

    // Only the reader's own scroll gives up the note.
    if (ours.current) {
      ours.current = false;
      return;
    }

    held.current = null;
    following.current =
      box.scrollHeight - box.scrollTop - box.clientHeight < CLOSE;
  };

  return (
    <>
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

          {turnsOf(item).map((turn, at, all) => {
            const head = turn.prompt ? (
              <PersonSaid
                body={turn.prompt.body}
                name={
                  turn.prompt.author?.id === viewerId
                    ? null
                    : turn.prompt.author?.name
                }
              />
            ) : at === 0 ? (
              opening
            ) : null;

            if (!head && turn.messages.length === 0) {
              return null;
            }

            return (
              <section
                // biome-ignore lint/suspicious/noArrayIndexKey: turns are cut in order and never reordered
                key={at}
                className="flex flex-col"
              >
                {turn.prompt && marked.has(turn.prompt.position) && (
                  <div className="mt-6 mb-3">
                    <TimeMarker at={turn.prompt.at} />
                  </div>
                )}

                {head && <div className={HELD_AT_TOP}>{head}</div>}

                <ol className="mt-6 flex flex-col gap-6">
                  {turn.messages.map((note, place) => {
                    const before = turn.messages[place - 1];

                    return (
                      <Fragment key={`${item.id}-${note.position}`}>
                        {(!before || before.station !== note.station) &&
                          marked.has(note.position) && (
                            <li>
                              <TimeMarker at={note.at} />
                            </li>
                          )}

                        <InboxMessage
                          message={note}
                          stationCount={item.station.count}
                          teamId={item.teamId}
                          about={item.about}
                          worked={worked.filter(
                            (each) => each.runId === note.runId,
                          )}
                        />
                      </Fragment>
                    );
                  })}

                  {at === all.length - 1 &&
                    (live ? (
                      // Its own list of steps, so it hangs in a row of its own
                      // rather than nesting a list straight inside this one.
                      <li>{live}</li>
                    ) : (
                      item.working && (
                        <InboxWorking
                          station={item.station.name}
                          stationColor={item.station.color}
                          stationPosition={item.station.position}
                          stationCount={item.station.count}
                        />
                      )
                    ))}
                </ol>
              </section>
            );
          })}
        </div>
      </div>

      {/* The panel's own ground, which is what the work fades into rather
          than stopping at an edge. */}
      <div className="relative shrink-0 bg-surface">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-full h-10 bg-gradient-to-t from-surface to-transparent"
        />

        <div className="mx-auto w-full max-w-3xl px-8 pt-2 pb-6">
          <div className="-mx-3">{footer}</div>
        </div>
      </div>
    </>
  );
}
