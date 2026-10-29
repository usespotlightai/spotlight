import type { ReactNode } from 'react';
import { type PillSize, type PillVariant, pillClass } from '@/lib/pill';

type ExternalPillLinkProps = {
  href: string;
  variant?: PillVariant;
  size?: PillSize;
  className?: string;
  children: ReactNode;
};

export function ExternalPillLink({
  href,
  variant = 'outline',
  size = 'small',
  className,
  children,
}: ExternalPillLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={pillClass(variant, className, size)}
    >
      {children}
    </a>
  );
}
