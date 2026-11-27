import { Link, type LinkProps } from 'react-router';

import { useForwardTrail } from '@/lib/trail';

export function TrailLink({ state, ...props }: LinkProps) {
  const trail = useForwardTrail();
  const given: unknown = state;
  const carried = typeof given === 'object' ? given : null;

  return (
    <Link {...props} state={trail.length > 0 ? { ...carried, trail } : given} />
  );
}
