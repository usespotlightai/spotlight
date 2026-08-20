import { Link, useLocation } from 'react-router';

export function NotFound() {
  const { pathname } = useLocation();

  return (
    <section>
      <h1>Not found</h1>
      <p>
        No route matches <code>{pathname}</code>.
      </p>
      <Link to="/">Back to home</Link>
    </section>
  );
}
