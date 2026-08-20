import { useGreeting } from '@/hooks/api/useGreeting';

export function About() {
  const { data, isPending, isError } = useGreeting();

  return (
    <section>
      <h1>About</h1>
      <p>React Router running in declarative mode.</p>

      {isPending && <p>Loading…</p>}
      {isError && <p role="alert">Could not reach the control-plane.</p>}
      {data && <p>{data.message}</p>}
    </section>
  );
}
