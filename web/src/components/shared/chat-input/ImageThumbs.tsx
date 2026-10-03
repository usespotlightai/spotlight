import { X } from 'lucide-react';
import { ImagePreview } from '@/components/shared/attachment/ImagePreview';
import type { PendingAttachment } from '@/lib/attachment';
import { cn } from '@/lib/utils';

type ImageThumbsProps = {
  images: readonly PendingAttachment[];
  onRemove: (key: string) => void;
};

export function ImageThumbs({ images, onRemove }: ImageThumbsProps) {
  if (images.length === 0) {
    return null;
  }

  return (
    <ul aria-label="Images" className="flex flex-wrap gap-2 pb-2">
      {images.map((image) => (
        <li
          key={image.key}
          className="group relative size-14 overflow-hidden rounded-lg border border-border"
          title={image.state === 'failed' ? image.problem : image.name}
        >
          {image.image && (
            <ImagePreview
              image={image.image}
              alt={image.name}
              className={cn(
                'size-full object-cover',
                image.state === 'uploading' && 'animate-pulse opacity-60',
                image.state === 'failed' && 'opacity-40',
              )}
            />
          )}
          <button
            type="button"
            onClick={() => onRemove(image.key)}
            aria-label={`Remove ${image.name}`}
            className="absolute top-0.5 right-0.5 flex size-4 items-center justify-center rounded-full bg-foreground/70 text-background opacity-0 outline-none transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
          >
            <X aria-hidden className="size-3" />
          </button>
        </li>
      ))}
    </ul>
  );
}
