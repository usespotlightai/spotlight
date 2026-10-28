import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type PillProps = {
  children: ReactNode;
  lead?: ReactNode;
  title?: string;
  href?: string;
  className?: string;
};

export function Pill({ children, lead, title, href, className }: PillProps) {
  const classes = cn(
    'flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card py-1 font-medium text-muted-foreground text-xs',
    lead ? 'pr-2.5 pl-2' : 'px-2.5',
    href &&
      'outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
    className,
  );

  return href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      className={classes}
    >
      {lead}
      {children}
    </a>
  ) : (
    <span title={title} className={classes}>
      {lead}
      {children}
    </span>
  );
}
