import {
  type ClipboardEvent,
  type DragEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useUploadAttachment } from '@/hooks/api/useUploadAttachment';
import {
  drawn,
  filesIn,
  type PendingAttachment,
  refused,
} from '@/lib/attachment';

type Outcome =
  | { readonly state: 'ready'; readonly id: string }
  | { readonly state: 'failed'; readonly problem: string };

export function useAttachments(slug: string) {
  const upload = useUploadAttachment();
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const counted = useRef(0);

  const previews = useRef(new Set<string>());

  useEffect(
    () => () => {
      for (const preview of previews.current) {
        URL.revokeObjectURL(preview);
      }
    },
    [],
  );

  const letGo = (gone: readonly PendingAttachment[]) => {
    for (const { preview } of gone) {
      if (preview) {
        URL.revokeObjectURL(preview);
        previews.current.delete(preview);
      }
    }
  };

  const settle = (key: string, outcome: Outcome) =>
    setAttachments((all) =>
      all.map((each) => (each.key === key ? { ...each, ...outcome } : each)),
    );

  const add = (files: readonly File[]) => {
    const added = files.map((file) => {
      counted.current += 1;

      const preview = drawn(file.type) ? URL.createObjectURL(file) : null;
      const problem = refused(file);

      if (preview) {
        previews.current.add(preview);
      }

      const pending: PendingAttachment = {
        key: String(counted.current),
        name: file.name,
        size: file.size,
        preview,
        ...(problem ? { state: 'failed', problem } : { state: 'uploading' }),
      };

      return { file, pending };
    });

    setAttachments((all) => [...all, ...added.map(({ pending }) => pending)]);

    for (const { file, pending } of added) {
      if (pending.state !== 'uploading') {
        continue;
      }

      upload.mutateAsync({ slug, file }).then(
        ({ id }) => settle(pending.key, { state: 'ready', id }),
        () =>
          settle(pending.key, { state: 'failed', problem: 'Upload failed' }),
      );
    }
  };

  const remove = (key: string) => {
    letGo(attachments.filter((each) => each.key === key));
    setAttachments((all) => all.filter((each) => each.key !== key));
  };

  const clear = () => {
    letGo(attachments);
    setAttachments([]);
  };

  const took = (event: ClipboardEvent | DragEvent, files: File[]) => {
    if (files.length === 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    add(files);
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
    handlers: {
      onDragOver: (event: DragEvent) => {
        if (event.dataTransfer.types.includes('Files')) {
          event.preventDefault();
        }
      },
      onDropCapture: (event: DragEvent) =>
        took(event, filesIn(event.dataTransfer)),
      onPasteCapture: (event: ClipboardEvent) =>
        took(event, filesIn(event.clipboardData)),
    },
  };
}
