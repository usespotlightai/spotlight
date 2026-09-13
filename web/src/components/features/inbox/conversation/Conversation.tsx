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

  // Layout effect on content size: messages grow after mount, and the first paint must already be in place.
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

      if (held.current !== null) {
        ours.current = put(box, inside, held.current) || ours.current;
        return;
      }

      if (!following.current) {
        return;
      }

      const foot = box.scrollHeight - box.clientHeight;

      const far = foot - box.scrollTop > box.clientHeight;
      const stillness = window.matchMedia?.(
        '(prefers-reduced-motion: reduce)',
      )?.matches;
      const cut = !settled || far || stillness;

      const was = box.scrollTop;
      box.scrollTo({ top: foot, behavior: cut ? 'auto' : 'smooth' });

      // Smooth scrolling fires scroll events all the way down, so only an instant jump can be flagged as ours.
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
                attachments={turn.prompt.attachments}
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
                          resolved={item.resolved}
                          worked={worked.filter(
                            (each) => each.runId === note.runId,
                          )}
                        />
                      </Fragment>
                    );
                  })}

                  {at === all.length - 1 &&
                    (live ? (
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
