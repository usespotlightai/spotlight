import type { ReactNode } from 'react';

const CARD = 'flex flex-col rounded-xl border border-border bg-card p-1';

type CardListProps = {
  label: string;
  loading?: boolean;
  children: ReactNode;
};

export function CardList({ label, loading = false, children }: CardListProps) {
  return loading ? (
    <div role="status" aria-label={label} className={CARD}>
      {children}
    </div>
  ) : (
    <ul aria-label={label} className={CARD}>
      {children}
    </ul>
  );
}
