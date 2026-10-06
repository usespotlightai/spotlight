import { createContext, type ReactNode, useContext } from 'react';
import { InfoNote } from '@/components/features/insights/InfoNote';

export type CardHeadingParts = {
  readonly titleId: string;
  readonly title: string;
  readonly description?: string;
  readonly controls: ReactNode;
};

export const CardHeadingContext = createContext<CardHeadingParts | null>(null);

export const useCardHeading = (): CardHeadingParts | null =>
  useContext(CardHeadingContext);

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
