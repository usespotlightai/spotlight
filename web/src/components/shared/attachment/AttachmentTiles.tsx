import { FileIcon } from 'lucide-react';
import { useParams } from 'react-router';
import {
  type Attachment,
  attachmentPath,
  downloadPath,
  drawn,
  sized,
} from '@/lib/attachment';

const kind = (name: string, contentType: string): string => {
  const dot = name.lastIndexOf('.');

  return dot > 0 ? name.slice(dot + 1) : (contentType.split('/')[1] ?? 'file');
};

export function AttachmentTiles({
  attachments,
}: {
  attachments: readonly Attachment[];
}) {
  const { slug } = useParams();

  if (!slug || attachments.length === 0) {
    return null;
  }

  return (
    <ul className="flex flex-wrap gap-3">
      {attachments.map((each) => {
        const shown = drawn(each.contentType);

        return (
          <li key={each.id} className="w-28">
            <a
              href={
                shown
                  ? attachmentPath(slug, each.id)
                  : downloadPath(slug, each.id)
              }
              {...(shown ? { target: '_blank', rel: 'noreferrer' } : {})}
              aria-label={each.name}
              className="flex size-28 items-center justify-center overflow-hidden rounded-lg border border-border bg-card transition-colors hover:bg-accent"
            >
              {shown ? (
                <img
                  src={attachmentPath(slug, each.id)}
                  alt={each.name}
                  loading="lazy"
                  className="size-full object-cover"
                />
              ) : (
                <span className="flex flex-col items-center gap-1 text-muted-foreground">
                  <FileIcon className="size-5" aria-hidden />
                  <span className="max-w-20 truncate font-medium text-[0.7rem] uppercase">
                    {kind(each.name, each.contentType)}
                  </span>
                </span>
              )}
            </a>

            <span
              title={each.name}
              className="mt-1 block truncate text-foreground text-xs"
            >
              {each.name}
            </span>
            <span className="block text-muted-foreground text-xs">
              {sized(each.size)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
