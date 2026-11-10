import {
  type ClipboardEvent,
  type DragEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  allowFileDrop,
  drawn,
  dropFiles,
  type PendingAttachment,
  pasteFiles,
  sizeProblem,
} from '@/lib/attachment';
import { uploadAttachment } from '@/lib/upload-attachment';

const uniqueKey = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

type Outcome =
  | {
      readonly state: 'ready';
      readonly id: string;
      readonly uploadedAt: number;
    }
  | { readonly state: 'failed'; readonly problem: string };

type Ready = PendingAttachment & { readonly state: 'ready' };

export function useAttachments(
  slug: string,
  onReady?: (attachment: Ready) => void,
  initial: readonly PendingAttachment[] = [],
) {
  const [attachments, setAttachments] = useState<PendingAttachment[]>(() => [
    ...initial,
  ]);
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
        contentType: file.type,
        imageSource: drawn(file.type) ? { blob: file } : null,
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
          const uploadedAt = Date.now();

          finish(pending.key, { state: 'ready', id, uploadedAt });
          ready.current?.({ ...pending, state: 'ready', id, uploadedAt });
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

  const restore = useCallback((back: readonly PendingAttachment[]) => {
    setAttachments((all) => [
      ...back.filter((each) => !all.some((kept) => kept.key === each.key)),
      ...all,
    ]);
  }, []);

  return {
    attachments,
    ids: attachments.flatMap((each) =>
      each.state === 'ready' ? [each.id] : [],
    ),
    uploading: attachments.some((each) => each.state === 'uploading'),
    add,
    remove,
    clear,
    restore,
    handlers: {
      onDragOver: allowFileDrop,
      onDropCapture: (event: DragEvent) => dropFiles(event, add),
      onPasteCapture: (event: ClipboardEvent) => pasteFiles(event, add),
    },
  };
}
