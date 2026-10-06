import { createContext, type ReactNode, useContext } from 'react';

export type CardHeadingParts = {
  readonly titleId: string;
  readonly title: string;
  readonly description?: string;
  readonly controls: ReactNode;
};

export const CardHeadingContext = createContext<CardHeadingParts | null>(null);

export const useCardHeading = (): CardHeadingParts | null =>
  useContext(CardHeadingContext);
