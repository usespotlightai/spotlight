import { InfoNote } from '@/components/features/insights/InfoNote';

type CardTitleProps = {
  titleId: string;
  title: string;
  description?: string;
};

export function CardTitle({ titleId, title, description }: CardTitleProps) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <h2 id={titleId} className="font-medium text-foreground text-xs">
        {title}
      </h2>
      {description && <InfoNote note={description} />}
    </span>
  );
}
