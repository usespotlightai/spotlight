import { Fragment, type ReactNode, useEffect, useRef } from 'react';
import { InboxMessage } from '@/components/inbox/InboxMessage';
import { InboxWorking } from '@/components/inbox/InboxWorking';
import { PersonSaid } from '@/components/inbox/PersonSaid';
import { TimeMarker } from '@/components/inbox/TimeMarker';
import {
  type Conversing,
  HELD_AT_TOP,
  type InboxMessage as Message,
  type RunJournal,
} from '@/lib/inbox';

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

const turnsOf = (item: Conversing): Turn[] => {
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

const CLOSE = 80;

type ConversationProps = {
  item: Conversing;
  worked: readonly RunJournal[];
  viewerId?: string;
  opening?: ReactNode;
  footer: ReactNode;
};

export function Conversation({
  item,
  worked,
  viewerId,
  opening,
  footer,
}: ConversationProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const following = useRef(true);

  // Watching the content rather than the message count: a message is not its
  // final height when it mounts, and a scroll measured before that lands short.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the item is what starts the conversation over, though the effect reads only the nodes
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
  }, [item.id]);

  const watched = () => {
    const box = scroller.current;
    if (box) {
      following.current =
        box.scrollHeight - box.scrollTop - box.clientHeight < CLOSE;
    }
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
                {turn.prompt && (
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
                        {(!before || before.station !== note.station) && (
                          <li>
                            <TimeMarker at={note.at} />
                          </li>
                        )}

                        <InboxMessage
                          message={note}
                          stationCount={item.station.count}
                          worked={worked.filter(
                            (each) => each.runId === note.runId,
                          )}
                        />
                      </Fragment>
                    );
                  })}

                  {item.working && at === all.length - 1 && (
                    <InboxWorking
                      station={item.station.name}
                      stationColor={item.station.color}
                      stationPosition={item.station.position}
                      stationCount={item.station.count}
                    />
                  )}
                </ol>
              </section>
            );
          })}
        </div>
      </div>

      {/* The panel's own ground, which is what the work fades into rather
          than stopping at an edge. */}
      <div className="relative shrink-0 bg-card">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-full h-10 bg-gradient-to-t from-card to-transparent"
        />

        <div className="mx-auto w-full max-w-3xl px-8 pt-2 pb-6">
          <div className="-mx-3">{footer}</div>
        </div>
      </div>
    </>
  );
}
