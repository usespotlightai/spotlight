import { Fragment, type ReactNode } from 'react';

import { FoldedVisits } from '@/components/features/inbox/conversation/FoldedVisits';
import { InboxNote } from '@/components/features/inbox/conversation/InboxNote';
import { InboxWorking } from '@/components/features/inbox/conversation/InboxWorking';
import { ThreadMessage } from '@/components/features/inbox/conversation/ThreadMessage';
import { TimeMarker } from '@/components/features/inbox/conversation/TimeMarker';
import { ComposerFooter } from '@/components/shared/ComposerFooter';
import { PaneScroller } from '@/components/shared/PaneScroller';
import { THREAD_COLUMN } from '@/components/shared/thread-column';
import { Turn } from '@/components/shared/Turn';
import { useArrivals } from '@/hooks/useArrivals';
import { useConversationScroll } from '@/hooks/useConversationScroll';
import type { ApprovalAnswer } from '@/lib/approval';
import { placeVisits } from '@/lib/folded-visit';
import {
  ARRIVING,
  type ConversationItem,
  type Note,
  openedAt,
  type RunJournal,
  type RunPrompt,
  STICKY_AT_TOP,
  showsInThread,
  workedOn,
} from '@/lib/inbox';
import { lastNoteOf } from '@/lib/run-notes';
import { useRunSidePanel } from '@/lib/run-side-panel';
import { showsMessage } from '@/lib/thread-message';
import { cn } from '@/lib/utils';

interface NoteTurn {
  readonly prompt: Note | null;
  readonly notes: Note[];
}

interface RunClosingPlace {
  readonly turn: number;
  readonly after: number | null;
}

export type AfterRun = {
  readonly runId: string;
  readonly content: ReactNode;
};

type WorkedBy = ReadonlyMap<number, readonly RunJournal[]>;

const turnsOf = (item: ConversationItem): NoteTurn[] => {
  const cut: NoteTurn[] = [{ prompt: null, notes: [] }];

  for (const note of item.notes.filter(showsInThread)) {
    if (note.voice === 'person' || note.voice === 'world') {
      cut.push({ prompt: note, notes: [] });
    } else {
      cut[cut.length - 1]?.notes.push(note);
    }
  }

  return cut;
};

const closingPlaceOf = (
  turns: readonly NoteTurn[],
  notes: readonly Note[],
  runId: string,
): RunClosingPlace => {
  const reach = lastNoteOf(notes, runId) ?? Number.POSITIVE_INFINITY;
  let place: RunClosingPlace = { turn: 0, after: null };

  turns.forEach((turn, at) => {
    if (turn.prompt && turn.prompt.position <= reach) {
      place = { turn: at, after: null };
    }

    for (const note of turn.notes) {
      if (note.position <= reach) {
        place = { turn: at, after: note.position };
      }
    }
  });

  return place;
};

const marksIn = (item: ConversationItem): Set<number> => {
  let current = openedAt(item.createdAt);
  const marked = new Set<number>();

  for (const note of item.notes.filter(showsInThread)) {
    const reads = openedAt(note.at);

    if (reads !== current) {
      current = reads;
      marked.add(note.position);
    }
  }

  return marked;
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
  afterRun?: AfterRun;
  prompt?: RunPrompt | null;
  suggestion?: ReactNode;
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
  prompt,
  suggestion,
}: ConversationProps) {
  const marked = marksIn(item);
  const turns = turnsOf(item);
  const shownNotes = item.notes.filter(showsInThread);
  const placed = placeVisits(item.folded, shownNotes);
  const promptAt = prompt
    ? shownNotes.find((note) => note.runId === prompt.runId)?.position
    : undefined;
  const foldedBefore = (position: number) => {
    const visits = placed.before.get(position);

    return visits ? (
      <FoldedVisits visits={visits} item={item} worked={worked} />
    ) : null;
  };
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
  const setup = item.notes.filter(showsInThread).at(-1)?.form === 'setup';
  const latest = item.notes.at(-1)?.position;
  const { scroller, content, watched } = useConversationScroll(
    item.id,
    openAt ?? null,
    setup,
  );

  const rendered = (turn: NoteTurn, at: number): boolean =>
    turn.prompt !== null ||
    turn.notes.length > 0 ||
    (at === 0 && Boolean(briefing));
  const firstShown = turns.findIndex(rendered);
  const runClosing = afterRun?.content
    ? closingPlaceOf(turns, item.notes, afterRun.runId)
    : null;

  return (
    <PaneScroller
      ref={scroller}
      onScroll={watched}
      sidePanel={sidePanel}
      footer={<ComposerFooter>{footer}</ComposerFooter>}
    >
      <div ref={content} className={cn(THREAD_COLUMN, 'flex flex-col')}>
        <TimeMarker at={item.createdAt} />

        {turns.map((turn, at, all) => {
          const head =
            turn.prompt && showsMessage(turn.prompt) ? (
              <ThreadMessage note={turn.prompt} teamId={item.teamId} />
            ) : at === 0 ? (
              briefing
            ) : null;

          if (!rendered(turn, at)) {
            return null;
          }

          const afterAnother = at > firstShown;
          const earlier = turn.prompt && foldedBefore(turn.prompt.position);

          return (
            // oxlint-disable-next-line react/no-array-index-key -- the turns come in order and their order does not change
            <Fragment key={at}>
              {earlier && <div className="mt-6">{earlier}</div>}

              <Turn
                className={cn(afterAnother && 'mt-6')}
                head={
                  <>
                    {head &&
                      turn.prompt &&
                      marked.has(turn.prompt.position) && (
                        <div className={cn('mb-3', !afterAnother && 'mt-6')}>
                          <TimeMarker at={turn.prompt.at} />
                        </div>
                      )}

                    {head && (
                      <div
                        data-head
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
                  {runClosing?.turn === at && runClosing.after === null && (
                    <li>{afterRun?.content}</li>
                  )}

                  {turn.notes.map((note, place) => {
                    const before = turn.notes[place - 1];
                    const closesRun =
                      runClosing?.turn === at &&
                      runClosing.after === note.position
                        ? afterRun?.content
                        : null;

                    const earlierHere = foldedBefore(note.position);

                    return (
                      <Fragment key={`${item.id}-${note.position}`}>
                        {earlierHere && <li>{earlierHere}</li>}

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
                          suggestion={
                            note.position === latest ? suggestion : undefined
                          }
                          arrived={arrived(note.position)}
                          worked={workedBy.get(note.position) ?? []}
                          prompt={
                            note.position === promptAt
                              ? prompt?.text
                              : undefined
                          }
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
                          session={worked.at(-1)}
                        />
                      )
                    ))}
                </ol>
              </Turn>
            </Fragment>
          );
        })}

        {placed.after.length > 0 && (
          <div className="mt-6">
            <FoldedVisits visits={placed.after} item={item} worked={worked} />
          </div>
        )}

        {closing && <div className="mt-3">{closing}</div>}
      </div>
    </PaneScroller>
  );
}
