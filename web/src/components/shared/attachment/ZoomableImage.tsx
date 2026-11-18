import { useId, useLayoutEffect, useRef } from 'react';

import { ImageGallery } from '@/components/shared/attachment/ImageGallery';
import { useImageGallery } from '@/components/shared/attachment/imageGalleryContext';
import { cn } from '@/lib/utils';

type ZoomableImageProps = {
  src: string;
  name: string;
  className?: string;
  loading?: HTMLImageElement['loading'];
  onError?: () => void;
};

function Tile({ src, name, className, loading, onError }: ZoomableImageProps) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const gallery = useImageGallery();
  const register = gallery?.register;
  const unregister = gallery?.unregister;
  const shown = gallery?.openId === id;

  useLayoutEffect(() => {
    if (button.current) {
      register?.({ id, src, name, button: button.current });
    }
  }, [id, src, name, register]);

  useLayoutEffect(() => () => unregister?.(id), [id, unregister]);

  return (
    <button
      ref={button}
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        gallery?.open(id);
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
