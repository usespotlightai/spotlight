import { useNavigate } from 'react-router';
import { useForwardTrail } from '@/lib/trail';

export function useFollowStarted(onOpenChange: (open: boolean) => void) {
  const navigate = useNavigate();
  const trail = useForwardTrail();

  return (path: string) => {
    onOpenChange(false);
    navigate(path, { state: trail.length > 0 ? { trail } : undefined });
  };
}
