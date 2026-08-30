import { StationIcon } from '@/components/board/StationIcon';
import { MarkdownEditor } from '@/components/common/form/MarkdownEditor';
import { InboxWork } from '@/components/inbox/InboxWork';
import { PersonSaid } from '@/components/inbox/PersonSaid';
import { useSession } from '@/hooks/api/useSession';
import {
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
};

/**
 * A station speaks in the page's own voice, plainly and full width, in the
 * colour of the station that said it rather than the one the task stands at
 * now. Notes are written as markdown, so they are read as markdown.
 */
export function InboxMessage({
  message,
  stationCount,
  worked,
}: InboxMessageProps) {
  const { data: session } = useSession();
  const person = message.author;

  if (person) {
    return (
      <li className={HELD_AT_TOP}>
        <PersonSaid
          body={message.body}
          // Your own words need no name on them.
          name={person.id === session?.user.id ? null : person.name}
        />
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
        <StationIcon
          share={stationShare(message.stationPosition, stationCount)}
          color={message.stationColor}
        />
        {message.station}
      </span>

      {worked.length > 0 && <InboxWork journals={worked} />}

      <MarkdownEditor
        readOnly
        initialValue={message.body}
        placeholder=""
        ariaLabel={`What ${message.station} said`}
        className="border-none bg-transparent p-0"
      />
    </li>
  );
}
