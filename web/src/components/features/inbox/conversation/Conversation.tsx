import { Fragment, type ReactNode, useLayoutEffect, useRef } from 'react';
import { InboxNote } from '@/components/features/inbox/conversation/InboxNote';
import { InboxWorking } from '@/components/features/inbox/conversation/InboxWorking';
import { PersonMessage } from '@/components/features/inbox/conversation/PersonMessage';
import { TimeMarker } from '@/components/features/inbox/conversation/TimeMarker';
import { WorldMessage } from '@/components/features/inbox/conversation/WorldMessage';
import { ComposerFooter } from '@/components/shared/ComposerFooter';
import { PaneScroller } from '@/components/shared/PaneScroller';
import { Turn } from '@/components/shared/Turn';
import { useArrivals } from '@/hooks/useArrivals';
import type { ApprovalAnswer } from '@/lib/approval';
import { togglesDisclosure } from '@/lib/disclosure';
import {
  ARRIVING,
  authorsOf,
  type ConversationItem,
  closesOrReopens,
  type Note,
  openedAt,
  type RunJournal,
  STICKY_AT_TOP,
  workedOn,
} from '@/lib/inbox';
import { lastNoteOf } from '@/lib/run-notes';
import { useRunSidePanel } from '@/lib/run-side-panel';
import { cn } from '@/lib/utils';

interface NoteTurn {
  readonly prompt: Note | null;
  readonly notes: Note[];
}

type WorkedBy = ReadonlyMap<number, readonly RunJournal[]>;

const shown = (note: Note): boolean => !closesOrReopens(note);

const turnsOf = (item: ConversationItem): NoteTurn[] => {
  const cut: NoteTurn[] = [{ prompt: null, notes: [] }];

  for (const note of item.notes.filter(shown)) {
    if (note.voice === 'person' || note.voice === 'world') {
      cut.push({ prompt: note, notes: [] });
    } else {
      cut[cut.length - 1]?.notes.push(note);
    }
  }

  return cut;
};

const marksIn = (item: ConversationItem): Set<number> => {
  let current = openedAt(item.createdAt);
  const marked = new Set<number>();

  for (const note of item.notes.filter(shown)) {
    const reads = openedAt(note.at);

    if (reads !== current) {
      current = reads;
      marked.add(note.position);
    }
  }

  return marked;
};

const CLOSE = 80;

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

export type Deciding = {
  readonly pending: boolean;
  readonly onDecide: (answer: ApprovalAnswer) => void;
};

type ConversationProps = {
  item: ConversationItem;
  worked: readonly RunJournal[];
  openAt?: number | null;
  briefing?: ReactNode;
  live?: ReactNode;
  closing?: ReactNode;
  footer: ReactNode;
  deciding?: Deciding;
  afterRun?: (runId: string) => ReactNode;
};

export function Conversation({
  item,
  worked,
  openAt,
  briefing,
  live,
  closing,
  footer,
  deciding,
  afterRun,
}: ConversationProps) {
  const marked = marksIn(item);
  const turns = turnsOf(item);
  const workedBy: WorkedBy = new Map(
    item.notes.map((note) => [
      note.position,
      workedOn(worked, item.notes, note.runId, note.at),
    ]),
  );
  const arrived = useArrivals(
    item.id,
    item.notes.map((note) => note.position),
  );
  const { sidePanel } = useRunSidePanel();
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const pinnedAt = useRef<number | null>(null);
  const ours = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new item starts the conversation again, but the effect reads only the nodes
  useLayoutEffect(() => {
    const box = scroller.current;
    const inside = content.current;

    if (!box || !inside) {
      return;
    }

    pinnedAt.current = openAt ?? null;
    following.current = pinnedAt.current === null;
    ours.current = put(box, inside, pinnedAt.current);

    const grew = new ResizeObserver(() => {
      if (pinnedAt.current !== null) {
        ours.current = put(box, inside, pinnedAt.current) || ours.current;
        return;
      }

      if (!following.current) {
        return;
      }

      const was = box.scrollTop;
      box.scrollTo({ top: box.scrollHeight - box.clientHeight });
      ours.current = box.scrollTop !== was || ours.current;
    });
    grew.observe(inside);

    const toggled = (event: Event) => {
      if (togglesDisclosure(event.target)) {
        pinnedAt.current = null;
        following.current = false;
      }
    };
    box.addEventListener('click', toggled, true);

    return () => {
      grew.disconnect();
      box.removeEventListener('click', toggled, true);
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

    pinnedAt.current = null;
    following.current =
      box.scrollHeight - box.scrollTop - box.clientHeight < CLOSE;
  };

  const rendered = (turn: NoteTurn, at: number): boolean =>
    turn.prompt !== null ||
    turn.notes.length > 0 ||
    (at === 0 && Boolean(briefing));

  return (
    <PaneScroller
      ref={scroller}
      onScroll={watched}
      sidePanel={sidePanel}
      footer={<ComposerFooter>{footer}</ComposerFooter>}
    >
      <div
        ref={content}
        className="mx-auto flex w-full max-w-3xl flex-col px-8 py-8"
      >
        <TimeMarker at={item.createdAt} />

        {turns.map((turn, at, all) => {
          const head =
            turn.prompt?.voice === 'world' ? (
              <WorldMessage
                body={turn.prompt.body}
                attachments={turn.prompt.attachments}
                authors={authorsOf(turn.prompt)}
                source={turn.prompt.source}
                deferredTo={turn.prompt.deferredTo}
              />
            ) : turn.prompt ? (
              <PersonMessage
                body={turn.prompt.body}
                attachments={turn.prompt.attachments}
                authors={authorsOf(turn.prompt)}
              />
            ) : at === 0 ? (
              briefing
            ) : null;

          if (!rendered(turn, at)) {
            return null;
          }

          const afterAnother = all.slice(0, at).some(rendered);

          return (
            <Turn
              // biome-ignore lint/suspicious/noArrayIndexKey: the turns come in order and their order does not change
              key={at}
              className={cn(afterAnother && 'mt-6')}
              head={
                <>
                  {turn.prompt && marked.has(turn.prompt.position) && (
                    <div className={cn('mb-3', !afterAnother && 'mt-6')}>
                      <TimeMarker at={turn.prompt.at} />
                    </div>
                  )}

                  {head && (
                    <div
                      data-note={turn.prompt?.position}
                      className={cn(
                        STICKY_AT_TOP,
                        turn.prompt &&
                          arrived(turn.prompt.position) &&
                          ARRIVING,
                      )}
                    >
                      {head}
                    </div>
                  )}
                </>
              }
            >
              <ol className="mt-6 flex flex-col gap-6">
                {turn.notes.map((note, place) => {
                  const before = turn.notes[place - 1];
                  const closesRun =
                    note.runId &&
                    lastNoteOf(item.notes, note.runId) === note.position
                      ? afterRun?.(note.runId)
                      : null;

                  return (
                    <Fragment key={`${item.id}-${note.position}`}>
                      {(!before || before.station !== note.station) &&
                        marked.has(note.position) && (
                          <li>
                            <TimeMarker at={note.at} />
                          </li>
                        )}

                      <InboxNote
                        note={note}
                        stationCount={item.station.count}
                        teamId={item.teamId}
                        about={item.about}
                        resolved={item.resolved}
                        deciding={deciding}
                        arrived={arrived(note.position)}
                        worked={workedBy.get(note.position) ?? []}
                      />

                      {closesRun && <li>{closesRun}</li>}
                    </Fragment>
                  );
                })}

                {at === all.length - 1 &&
                  (live ? (
                    <li className="empty:hidden">{live}</li>
                  ) : (
                    item.progress && (
                      <InboxWorking
                        progress={item.progress}
                        station={item.station.name}
                        stationColor={item.station.color}
                        stationPosition={item.station.position}
                        stationCount={item.station.count}
                      />
                    )
                  ))}
              </ol>
            </Turn>
          );
        })}

        {closing && <div className="mt-3">{closing}</div>}
      </div>
    </PaneScroller>
  );
}
