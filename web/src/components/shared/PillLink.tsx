import type { LinkProps } from 'react-router';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { type PillVariant, pillClass } from '@/lib/pill';

type PillLinkProps = LinkProps & {
  variant?: PillVariant;
};

export function PillLink({
  variant = 'outline',
  className,
  ...props
}: PillLinkProps) {
  return <TrailLink className={pillClass(variant, className)} {...props} />;
}
