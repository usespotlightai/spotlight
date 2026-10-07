import { SaidCard } from '@/components/features/inbox/conversation/SaidCard';
import { AttachmentTiles } from '@/components/shared/attachment/AttachmentTiles';
import { ReferenceToken } from '@/components/shared/chat-input/ReferenceToken';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { downloadPath, drawn } from '@/lib/attachment';
import type { ChatMessage, ImprovedStation } from '@/lib/chat';
import { stationReference } from '@/lib/chat-input';
import { stationPath } from '@/lib/station';
import { taskTracePath } from '@/lib/task';

type ChatSaidProps = {
  slug: string;
  teamId: string;
  message: ChatMessage;
  improving?: ImprovedStation | null;
};

const REFERENCE_LINK =
  'rounded-sm underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring';

export function ChatSaid({ slug, teamId, message, improving }: ChatSaidProps) {
  const images = message.attachments.filter((each) => drawn(each.contentType));
  const files = message.attachments.filter((each) => !drawn(each.contentType));
  const referenced =
    Boolean(improving) || files.length > 0 || message.traces.length > 0;

  return (
    <div className="flex flex-col gap-1.5">
      <SaidCard>
        <p className="whitespace-pre-wrap break-words text-foreground text-sm leading-6">
          {message.body}
          {message.body && referenced && ' '}
          {improving && (
            <TrailLink
              to={stationPath(
                slug,
                teamId,
                improving.lineId,
                improving.stationId,
              )}
              className={REFERENCE_LINK}
            >
              <ReferenceToken reference={stationReference(improving)} />
            </TrailLink>
          )}
          {files.map((file) => (
            <a
              key={file.id}
              href={downloadPath(slug, file.id)}
              download={file.name}
              className={REFERENCE_LINK}
            >
              <ReferenceToken
                reference={{ kind: 'file', key: file.id, name: file.name }}
              />
            </a>
          ))}
          {message.traces.map((trace) => (
            <TrailLink
              key={trace.taskId}
              to={taskTracePath(slug, teamId, trace.taskId)}
              className={REFERENCE_LINK}
            >
              <ReferenceToken
                reference={{
                  kind: 'trace',
                  key: trace.taskId,
                  name: trace.title,
                }}
              />
            </TrailLink>
          ))}
        </p>
      </SaidCard>

      <AttachmentTiles attachments={images} />
    </div>
  );
}
