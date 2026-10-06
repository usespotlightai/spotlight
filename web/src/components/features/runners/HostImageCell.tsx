import { COMPACT_PILL } from '@/components/features/runners/columns';
import { ImagePill } from '@/components/features/runners/ImagePill';
import { RefusedImagesPill } from '@/components/features/runners/RefusedImagesPill';
import { Pill } from '@/components/shared/Pill';
import type { HostImageResponseDto } from '@/lib/api';

export function HostImageCell({
  images,
}: {
  images: readonly HostImageResponseDto[];
}) {
  const usual = images.find((image) => image.usual) ?? images[0];
  const others = images.length - 1;
  const refused = images.filter((image) => image.refused);

  if (!usual) {
    return <span className="text-muted-foreground text-xs">–</span>;
  }

  return (
    <span className="flex min-w-0 items-center gap-1">
      <ImagePill
        image={usual.image}
        title={images.map((image) => image.image).join('\n')}
      />

      {others > 0 && <Pill className={COMPACT_PILL}>+{others}</Pill>}

      {refused.length > 0 && <RefusedImagesPill refused={refused} />}
    </span>
  );
}
