import {
  type ClipboardEvent,
  type DragEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  carriesFiles,
  drawn,
  filesIn,
  type PendingAttachment,
  sizeProblem,
} from '@/lib/attachment';
import { uploadAttachment } from '@/lib/upload-attachment';

const uniqueKey = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

type Outcome =
  | { readonly state: 'ready'; readonly id: string }
  | { readonly state: 'failed'; readonly problem: string };

type Ready = PendingAttachment & { readonly state: 'ready' };

export function useAttachments(
  slug: string,
  onReady?: (attachment: Ready) => void,
) {
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const ready = useRef(onReady);

  useEffect(() => {
    ready.current = onReady;
  });

  const finish = (key: string, outcome: Outcome) =>
    setAttachments((all) =>
      all.map((each) => (each.key === key ? { ...each, ...outcome } : each)),
    );

  const add = (files: readonly File[]): PendingAttachment[] => {
    const added = files.map((file) => {
      const problem = sizeProblem(file);

      const pending: PendingAttachment = {
        key: uniqueKey(),
        name: file.name,
        size: file.size,
        image: drawn(file.type) ? file : null,
        ...(problem ? { state: 'failed', problem } : { state: 'uploading' }),
      };

      return { file, pending };
    });

    setAttachments((all) => [...all, ...added.map(({ pending }) => pending)]);

    for (const { file, pending } of added) {
      if (pending.state !== 'uploading') {
        continue;
      }

      uploadAttachment({ slug, file }).then(
        ({ id }) => {
          finish(pending.key, { state: 'ready', id });
          ready.current?.({ ...pending, state: 'ready', id });
        },
        () =>
          finish(pending.key, { state: 'failed', problem: 'Upload failed' }),
      );
    }

    return added.map(({ pending }) => pending);
  };

  const remove = useCallback((key: string) => {
    setAttachments((all) => all.filter((each) => each.key !== key));
  }, []);

  const clear = () => setAttachments([]);

  const handlersFor = (take: (files: readonly File[]) => void) => {
    const took = (event: ClipboardEvent | DragEvent, files: File[]) => {
      if (files.length === 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      take(files);
    };

    return {
      onDragOver: (event: DragEvent) => {
        if (carriesFiles(event.dataTransfer)) {
          event.preventDefault();
        }
      },
      onDropCapture: (event: DragEvent) => {
        if (carriesFiles(event.dataTransfer)) {
          event.preventDefault();
        }
        took(event, filesIn(event.dataTransfer));
      },
      onPasteCapture: (event: ClipboardEvent) =>
        took(event, filesIn(event.clipboardData)),
    };
  };

  return {
    attachments,
    ids: attachments.flatMap((each) =>
      each.state === 'ready' ? [each.id] : [],
    ),
    uploading: attachments.some((each) => each.state === 'uploading'),
    add,
    remove,
    clear,
    handlers: handlersFor(add),
    handlersFor,
  };
}
