import { ReadinessChecks } from '@platform/health/readiness-checks';
import { describe, expect, it } from 'vitest';

const never = () => new Promise<void>(() => undefined);

describe('ReadinessChecks', () => {
  it('reports every check that answers as ok', async () => {
    const checks = new ReadinessChecks();
    checks.register({ name: 'postgres', check: async () => undefined });
    checks.register({ name: 's3', check: async () => undefined });

    expect(await checks.run()).toEqual([
      { name: 'postgres', ok: true },
      { name: 's3', ok: true },
    ]);
  });

  it('reports a check that throws as failed', async () => {
    const checks = new ReadinessChecks();
    const refused = new Error('connection refused');
    checks.register({
      name: 'postgres',
      check: async () => {
        throw refused;
      },
    });

    expect(await checks.run()).toEqual([
      { name: 'postgres', ok: false, error: refused },
    ]);
  });

  it('fails a check that does not answer in time and aborts it', async () => {
    const checks = new ReadinessChecks();
    let signal: AbortSignal | undefined;
    checks.register({
      name: 's3',
      check: (given) => {
        signal = given;
        return never();
      },
    });

    const [outcome] = await checks.checked(10);

    expect(outcome).toMatchObject({ name: 's3', ok: false });
    expect(signal?.aborted).toBe(true);
  });

  it('reuses its answer for a few seconds', async () => {
    const checks = new ReadinessChecks();
    let asked = 0;
    checks.register({
      name: 'postgres',
      check: async () => {
        asked += 1;
      },
    });

    await checks.run();
    await checks.run();

    expect(asked).toBe(1);
  });

  it('refuses two checks with the same name', () => {
    const checks = new ReadinessChecks();
    checks.register({ name: 'postgres', check: async () => undefined });

    expect(() =>
      checks.register({ name: 'postgres', check: async () => undefined }),
    ).toThrow('postgres');
  });
});
