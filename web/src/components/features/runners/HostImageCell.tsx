import type { HostImageResponseDto } from '@/lib/api';
import { refusal } from '@/lib/runner';

const shortName = (image: string) => image.slice(image.lastIndexOf('/') + 1);

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
    <span className="flex min-w-0 items-center gap-1.5 text-xs">
      <span
        className="truncate text-foreground"
        title={images.map((image) => image.image).join('\n')}
      >
        {shortName(usual.image)}
      </span>

      {others > 0 && (
        <span className="shrink-0 text-muted-foreground">+{others}</span>
      )}

      {refused.length > 0 && (
        <span
          className="shrink-0 text-destructive"
          title={refused
            .map((image) => `${image.image}: ${refusal(image.refused ?? '')}`)
            .join('\n')}
        >
          {refused.length} refused
        </span>
      )}
    </span>
  );
}
