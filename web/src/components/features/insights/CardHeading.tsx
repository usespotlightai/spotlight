import { InfoTooltip } from '@/components/shared/InfoTooltip';
import type { TooltipText } from '@/lib/tooltip-note';

type CardTitleProps = {
  titleId: string;
  title: string;
  description?: TooltipText;
  level?: 2 | 3;
};

export function CardTitle({
  titleId,
  title,
  description,
  level = 2,
}: CardTitleProps) {
  const Heading = level === 3 ? 'h3' : 'h2';

  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <Heading id={titleId} className="font-medium text-foreground text-xs">
        {title}
      </Heading>
      {description && <InfoTooltip tooltip={description} />}
    </span>
  );
}
