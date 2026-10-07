import type { ReactNode } from 'react';
import { useFlatLists } from '@/components/features/replays/FlatLists';

const CARD = 'flex flex-col rounded-xl border border-border bg-card p-1';

const FLAT = '-mx-2 flex flex-col';

type CardListProps = {
  label: string;
  loading?: boolean;
  children: ReactNode;
};

export function CardList({ label, loading = false, children }: CardListProps) {
  const look = useFlatLists() ? FLAT : CARD;

  return loading ? (
    <div role="status" aria-label={label} className={look}>
      {children}
    </div>
  ) : (
    <ul aria-label={label} className={look}>
      {children}
    </ul>
  );
}
