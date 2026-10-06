import { InfoNote } from '@/components/features/insights/InfoNote';
import type { CardHeadingParts } from '@/lib/card-heading';

type CardTitleProps = {
  heading: CardHeadingParts;
  as?: 'h2' | 'span';
};

export function CardTitle({ heading, as: Title = 'span' }: CardTitleProps) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <Title
        id={heading.titleId}
        className="font-medium text-foreground text-xs"
      >
        {heading.title}
      </Title>
      {heading.description && <InfoNote note={heading.description} />}
    </span>
  );
}
