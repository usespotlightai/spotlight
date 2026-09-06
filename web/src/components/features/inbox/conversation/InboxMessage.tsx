import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { StationIcon } from '@/components/features/board/column/StationIcon';
import { InboxWork } from '@/components/features/inbox/conversation/InboxWork';
import { PersonSaid } from '@/components/features/inbox/conversation/PersonSaid';
import { SaidCard } from '@/components/features/inbox/conversation/SaidCard';
import { SetupSteps } from '@/components/features/onboarding/SetupSteps';
import { MarkdownEditor } from '@/components/shared/form/MarkdownEditor';
import { useSession } from '@/hooks/api/useSession';
import {
  type Conversing,
  HELD_AT_TOP,
  type InboxMessage as Message,
  type RunJournal,
} from '@/lib/inbox';
import { stationShare } from '@/lib/station';

type InboxMessageProps = {
  message: Message;
  // How many stations the line holds, which a place is a share of.
  stationCount: number;
  worked: readonly RunJournal[];
  // Whose team it is, for a note that shows that team's own standing.
  teamId: string | undefined;
  about: Conversing['about'];
};

export function InboxMessage({
  message,
  stationCount,
  worked,
  teamId,
  about,
}: InboxMessageProps) {
  const { data: session } = useSession();
  const navigate = useNavigate();
  const written = useRef<HTMLDivElement>(null);

  // A link in a note goes to a page of this application like any other link
  // in it, rather than out through the browser and back again. Listened for
  // rather than handled in the markup, because what carries the link is text
  // somebody wrote and not an element this renders.
  useEffect(() => {
    const held = written.current;

    if (!held) {
      return;
    }

    const following = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement).closest('a');
      const href = anchor?.getAttribute('href');

      if (!href?.startsWith('/') || event.metaKey || event.ctrlKey) {
        return;
      }

      event.preventDefault();
      void navigate(href);
    };

    held.addEventListener('click', following);

    return () => held.removeEventListener('click', following);
  }, [navigate]);

  if (message.form === 'settled') {
    return null;
  }

  if (message.voice === 'world') {
    return (
      // The same inset the held cards carry, so every card is one width and
      // the words inside them all line up with the plain text.
      <li data-note={message.position} className="-mx-3">
        <SaidCard>
          <p className="whitespace-pre-wrap text-foreground text-sm leading-6">
            {message.body}
          </p>
        </SaidCard>
      </li>
    );
  }

  if (message.voice === 'person') {
    return (
      <li data-note={message.position} className={HELD_AT_TOP}>
        <PersonSaid
          body={message.body}
          name={
            message.author && message.author.id !== session?.user.id
              ? message.author.name
              : null
          }
        />
      </li>
    );
  }

  const shows = message.form === 'setup' && teamId;

  return (
    <li data-note={message.position} className="flex flex-col gap-1.5">
      {/* Where a station said it, it says which. Spotlight speaking for
          itself stands under no station's name. */}
      {!shows && (
        <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
          <StationIcon
            share={stationShare(message.stationPosition, stationCount)}
            color={message.stationColor}
          />
          {message.station}
        </span>
      )}

      {worked.length > 0 && <InboxWork journals={worked} />}

      {shows ? (
        <SetupSteps teamId={teamId} body={message.body} about={about} />
      ) : (
        <div ref={written}>
          <MarkdownEditor
            readOnly
            initialValue={message.body}
            placeholder=""
            ariaLabel={`What ${message.station} said`}
            className="border-none bg-transparent p-0"
          />
        </div>
      )}
    </li>
  );
}
