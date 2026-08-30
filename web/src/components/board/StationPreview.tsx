import { ChevronDown } from 'lucide-react';
import { StationIcon } from '@/components/board/StationIcon';

type StationPreviewProps = {
  name: string;
  count: number;
  color: string;
  share: number;
};

export function StationPreview({
  name,
  count,
  color,
  share,
}: StationPreviewProps) {
  return (
    <div
      data-slot="station-preview"
      style={{
        backgroundImage: `linear-gradient(to right, ${color}1f, transparent 60%)`,
      }}
      className="flex h-9 cursor-grabbing items-center gap-2 rounded-md bg-accent px-3 shadow-overlay ring-1 ring-foreground/10"
    >
      <ChevronDown
        className="size-3 shrink-0 text-muted-foreground"
        aria-hidden
      />

      <StationIcon share={share} color={color} className="-mr-1.5" />

      <span className="truncate px-1.5 font-medium text-foreground text-sm">
        {name}
      </span>

      <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
        {count}
      </span>
    </div>
  );
}
