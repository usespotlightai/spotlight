import type { RepositorySettingsPort } from '@github/application/ports/repository-settings.port';
import type {
  RepositoryVisibilityStorePort,
  StoredVisibility,
} from '@github/application/ports/repository-visibility-store.port';
import {
  keyOf,
  RepositoryVisibilities,
} from '@github/application/services/repository-visibility.service';
import {
  type RepositoryVisibility,
  VISIBILITY_TTL_MS,
} from '@github/domain/value-objects/repository-visibility.vo';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { telemetryInMemory } from '@shared-kernel/application/ports/telemetry.fake-spec';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-01-01T12:00:00Z');
const WORKSPACE = WorkspaceId.of('ws_1');
const API = Repository.of('acme/api');
const WEB = Repository.of('Acme/Web');

const ago = (ms: number) => new Date(NOW.getTime() - ms);

const setup = (
  stored: Record<string, StoredVisibility> = {},
  github: Partial<Record<string, RepositoryVisibility | Error>> = {},
) => {
  const rows = new Map(Object.entries(stored));
  const store: RepositoryVisibilityStorePort = {
    find: vi.fn(() => Promise.resolve(rows)),
    save: vi.fn(
      (
        repository: Repository,
        visibility: RepositoryVisibility,
        checkedAt: Date,
      ) => {
        rows.set(keyOf(repository), { visibility, checkedAt });
        return Promise.resolve();
      },
    ),
  };
  const settings = partial<RepositorySettingsPort>({
    visibilityOf: vi.fn((_: WorkspaceId, repository: Repository) => {
      const answer = github[keyOf(repository)];

      if (answer === undefined || answer instanceof Error) {
        return Promise.reject(answer ?? new Error('GitHub did not answer'));
      }

      return Promise.resolve(answer);
    }),
  });
  const logger = { warn: vi.fn(), info: vi.fn(), error: vi.fn() };
  const telemetry = telemetryInMemory();

  return {
    service: new RepositoryVisibilities(
      store,
      settings,
      { now: () => NOW, sleep: async () => {} },
      partial<LoggerPort>(logger),
      telemetry,
    ),
    store,
    settings,
    logger,
    telemetry,
    rows,
  };
};

const fresh = (visibility: RepositoryVisibility): StoredVisibility => ({
  visibility,
  checkedAt: ago(1000),
});

const stale = (visibility: RepositoryVisibility): StoredVisibility => ({
  visibility,
  checkedAt: ago(VISIBILITY_TTL_MS),
});

describe('RepositoryVisibilities', () => {
  it('says no for no repositories', async () => {
    const { service } = setup();

    expect(await service.arePublic(WORKSPACE, [])).toBe(false);
  });

  it('trusts fresh public rows without asking GitHub', async () => {
    const { service, settings } = setup({
      'acme/api': fresh('public'),
      'acme/web': fresh('public'),
    });

    expect(await service.arePublic(WORKSPACE, [API, WEB])).toBe(true);
    expect(settings.visibilityOf).not.toHaveBeenCalled();
  });

  it('says no when one fresh row is private', async () => {
    const { service } = setup({
      'acme/api': fresh('public'),
      'acme/web': fresh('private'),
    });

    expect(await service.arePublic(WORKSPACE, [API, WEB])).toBe(false);
  });

  it('asks GitHub for a missing row and keeps the answer', async () => {
    const { service, settings, rows, telemetry } = setup(
      {},
      { 'acme/api': 'public' },
    );

    expect(await service.arePublic(WORKSPACE, [API])).toBe(true);
    expect(settings.visibilityOf).toHaveBeenCalledWith(WORKSPACE, API);
    expect(rows.get('acme/api')).toEqual({
      visibility: 'public',
      checkedAt: NOW,
    });
    expect(telemetry.counted).toEqual([
      {
        metric: 'spotlight.repository_visibility.checks',
        attributes: {
          'spotlight.visibility.source': 'refresh',
          'spotlight.visibility.outcome': 'ok',
        },
      },
    ]);
  });

  it('asks GitHub again for a stale row, and follows a repository that turned private', async () => {
    const { service, settings, rows } = setup(
      { 'acme/api': stale('public') },
      { 'acme/api': 'private' },
    );

    expect(await service.arePublic(WORKSPACE, [API])).toBe(false);
    expect(settings.visibilityOf).toHaveBeenCalledTimes(1);
    expect(rows.get('acme/api')?.visibility).toBe('private');
  });

  it('treats a repository as private when GitHub fails, and does not keep the failure', async () => {
    const { service, rows, logger, telemetry } = setup();

    expect(await service.arePublic(WORKSPACE, [API])).toBe(false);
    expect(rows.size).toBe(0);
    expect(logger.warn).toHaveBeenCalledWith(
      { repository: 'acme/api', reason: 'GitHub did not answer' },
      'Could not read the visibility of a repository',
    );
    expect(telemetry.counted[0]?.attributes).toEqual({
      'spotlight.visibility.source': 'refresh',
      'spotlight.visibility.outcome': 'error',
    });
  });

  it('does not use the stale row when GitHub fails', async () => {
    const { service } = setup({ 'acme/api': stale('public') });

    expect(await service.arePublic(WORKSPACE, [API])).toBe(false);
  });

  it('says no and does not throw when the store fails', async () => {
    const { service, store, logger } = setup();
    vi.mocked(store.find).mockRejectedValueOnce(new Error('db down'));

    expect(await service.arePublic(WORKSPACE, [API])).toBe(false);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('keeps what a webhook said, so the next read follows it', async () => {
    const { service, settings, telemetry } = setup({
      'acme/api': fresh('public'),
    });

    await service.record(API, 'private');

    expect(await service.arePublic(WORKSPACE, [API])).toBe(false);
    expect(settings.visibilityOf).not.toHaveBeenCalled();
    expect(telemetry.counted[0]?.attributes).toEqual({
      'spotlight.visibility.source': 'webhook',
      'spotlight.visibility.outcome': 'ok',
    });
  });
});
