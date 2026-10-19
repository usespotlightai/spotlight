import { COMPACT_PILL } from '@/components/features/runners/columns';
import { Pill } from '@/components/shared/Pill';
import { imageShortName } from '@/lib/runner';

type ImagePillProps = {
  image: string;
  title: string;
};

export function ImagePill({ image, title }: ImagePillProps) {
  return (
    <Pill
      title={title}
      className={`${COMPACT_PILL} min-w-20 shrink-[100] text-foreground`}
    >
      <span className="truncate">{imageShortName(image)}</span>
    </Pill>
  );
}
