import type { QueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { type Location, Route } from 'react-router';
import { StoryFrame } from '@/stories/StoryFrame';
import { StoryShell } from '@/stories/StoryShell';

type StoryPageProps = {
  at: string | Partial<Location>;
  seed?: (client: QueryClient) => void;
  children: ReactNode;
};

export function StoryPage({ at, seed, children }: StoryPageProps) {
  return (
    <StoryShell at={at} seed={seed}>
      <Route element={<StoryFrame />}>{children}</Route>
    </StoryShell>
  );
}
