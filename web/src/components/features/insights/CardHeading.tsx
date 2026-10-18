import { InfoTooltip } from '@/components/features/insights/InfoTooltip';

type CardTitleProps = {
  titleId: string;
  title: string;
  description?: string;
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
