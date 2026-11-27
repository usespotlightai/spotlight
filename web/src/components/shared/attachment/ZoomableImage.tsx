import { useRef } from 'react';

import { ImageGallery } from '@/components/shared/attachment/ImageGallery';
import { useImageGallery } from '@/components/shared/attachment/imageGalleryContext';
import { useGalleryTile } from '@/hooks/useGalleryTile';
import { cn } from '@/lib/utils';

type ZoomableImageProps = {
  src: string;
  name: string;
  className?: string;
  loading?: HTMLImageElement['loading'];
  onError?: () => void;
};

function Tile({ src, name, className, loading, onError }: ZoomableImageProps) {
  const button = useRef<HTMLButtonElement>(null);
  const { shown, open } = useGalleryTile(button, src, name);

  return (
    <button
      ref={button}
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        open();
      }}
      aria-label={`View ${name}`}
      className={cn(
        'size-full cursor-zoom-in rounded-[inherit] outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
        shown && 'bg-muted',
      )}
    >
      <img
        src={src}
        alt=""
        loading={loading}
        onError={onError}
        className={cn(className, shown && 'invisible')}
      />
    </button>
  );
}

export function ZoomableImage(props: ZoomableImageProps) {
  return useImageGallery() ? (
    <Tile {...props} />
  ) : (
    <ImageGallery>
      <Tile {...props} />
    </ImageGallery>
  );
}
