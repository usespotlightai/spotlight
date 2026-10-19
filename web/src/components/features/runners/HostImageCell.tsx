import { useRef } from 'react';
import { COMPACT_PILL } from '@/components/features/runners/columns';
import { ImagePill } from '@/components/features/runners/ImagePill';
import { UnavailableImagesPill } from '@/components/features/runners/UnavailableImagesPill';
import { Pill } from '@/components/shared/Pill';
import { useOverflows } from '@/hooks/useOverflows';
import type { HostImageResponseDto } from '@/lib/api';
import { imageShortName } from '@/lib/runner';
import { cn } from '@/lib/utils';

export function HostImageCell({
  images,
}: {
  images: readonly HostImageResponseDto[];
}) {
  const cell = useRef<HTMLSpanElement>(null);
  const overflows = useOverflows(cell, true, 'x');
  const defaultImage = images.find((image) => image.isDefault) ?? images[0];

  if (!defaultImage) {
    return <span className="text-muted-foreground text-xs">–</span>;
  }

  const others = images.filter((image) => image !== defaultImage);
  const unavailable = others.filter((image) => image.unavailableReason);

  return (
    <span
      ref={cell}
      className={cn(
        'flex min-w-0 items-center gap-1 overflow-hidden',
        overflows &&
          '[mask-image:linear-gradient(to_right,black_calc(100%-1.5rem),transparent)]',
      )}
    >
      {defaultImage.unavailableReason ? (
        <UnavailableImagesPill
          unavailable={[defaultImage]}
          className="min-w-20 shrink-[100]"
        >
          {imageShortName(defaultImage.image)}
        </UnavailableImagesPill>
      ) : (
        <ImagePill
          image={defaultImage.image}
          title={images.map((image) => image.image).join('\n')}
        />
      )}

      {others.length > 0 && (
        <Pill className={COMPACT_PILL}>+{others.length}</Pill>
      )}

      {unavailable.length > 0 && (
        <UnavailableImagesPill unavailable={unavailable} className="min-w-12">
          {unavailable.length} unavailable
        </UnavailableImagesPill>
      )}
    </span>
  );
}
