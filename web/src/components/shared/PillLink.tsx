import type { LinkProps } from 'react-router';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { type PillSize, type PillVariant, pillClass } from '@/lib/pill';

type PillLinkProps = LinkProps & {
  variant?: PillVariant;
  size?: PillSize;
};

export function PillLink({
  variant = 'outline',
  size = 'small',
  className,
  ...props
}: PillLinkProps) {
  return (
    <TrailLink className={pillClass(variant, className, size)} {...props} />
  );
}
