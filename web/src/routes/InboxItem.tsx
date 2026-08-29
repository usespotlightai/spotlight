import { useParams } from 'react-router';
import { StationIcon } from '@/components/board/StationIcon';
import { MarkdownEditor } from '@/components/common/form/MarkdownEditor';
import { useInbox } from '@/hooks/api/useInbox';

export function InboxItem() {
  const { slug, taskId } = useParams();
  const { data: waiting } = useInbox(slug);

  const item = waiting?.find((each) => each.taskId === taskId);

  if (!item) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-8">
        <p className="text-muted-foreground text-sm">
          Nothing here is waiting on you any more.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-8 py-8">
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-2 text-muted-foreground text-xs">
            <StationIcon share={1} color={item.stationColor} />
            {item.station}
          </p>

          <h1 className="font-semibold text-2xl text-foreground leading-8 tracking-tight">
            {item.title}
          </h1>

          {item.description && (
            <MarkdownEditor
              readOnly
              initialValue={item.description}
              placeholder=""
              ariaLabel="Description"
              className="border-none bg-transparent p-0"
            />
          )}
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="font-medium text-muted-foreground text-xs">
            Activity
          </h2>

          <ol className="flex flex-col gap-3">
            {item.notes.map((note) => (
              <li
                key={note.position}
                className="flex flex-col gap-1 border-border border-l-2 pl-3"
              >
                <p className="font-medium text-foreground text-xs">
                  {note.station}
                </p>
                <p className="whitespace-pre-wrap text-muted-foreground text-sm">
                  {note.body}
                </p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
