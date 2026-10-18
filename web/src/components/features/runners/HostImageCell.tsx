import { COMPACT_PILL } from '@/components/features/runners/columns';
import { ImagePill } from '@/components/features/runners/ImagePill';
import { UnavailableImagesPill } from '@/components/features/runners/UnavailableImagesPill';
import { Pill } from '@/components/shared/Pill';
import type { HostImageResponseDto } from '@/lib/api';

export function HostImageCell({
  images,
}: {
  images: readonly HostImageResponseDto[];
}) {
  const defaultImage = images.find((image) => image.isDefault) ?? images[0];
  const others = images.length - 1;
  const unavailable = images.filter((image) => image.unavailableReason);

  if (!defaultImage) {
    return <span className="text-muted-foreground text-xs">–</span>;
  }

  return (
    <span className="flex min-w-0 items-center gap-1">
      <ImagePill
        image={defaultImage.image}
        title={images.map((image) => image.image).join('\n')}
      />

      {others > 0 && <Pill className={COMPACT_PILL}>+{others}</Pill>}

      {unavailable.length > 0 && (
        <UnavailableImagesPill unavailable={unavailable} />
      )}
    </span>
  );
}
