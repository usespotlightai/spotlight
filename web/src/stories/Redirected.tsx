import { useLocation } from 'react-router';

export function Redirected() {
  const { pathname } = useLocation();

  return (
    <p className="m-auto p-8 text-muted-foreground text-sm">
      Redirected to {pathname}
    </p>
  );
}
