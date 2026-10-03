import type { LinkProps } from 'react-router';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { type PillVariant, pillClass } from '@/lib/pill';

type PillLinkProps = Omit<LinkProps, 'className'> & {
  variant?: PillVariant;
  className?: string;
};

export function PillLink({
  variant = 'outline',
  className,
  ...props
}: PillLinkProps) {
  return <TrailLink className={pillClass(variant, className)} {...props} />;
}
