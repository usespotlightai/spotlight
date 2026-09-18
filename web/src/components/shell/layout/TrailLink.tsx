import { Link, type LinkProps } from 'react-router';
import { useForwardTrail } from '@/lib/trail';

export function TrailLink({ state, ...props }: LinkProps) {
  const trail = useForwardTrail();

  return (
    <Link
      {...props}
      state={trail.length > 0 ? { ...(state as object | null), trail } : state}
    />
  );
}
