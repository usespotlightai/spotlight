import { describe, expect, it } from 'vitest';

import {
  type UpdateCheck,
  type Updater,
  updateCheckOutcome,
  updateFeedOf,
} from './updates';

const VERSION = '0.0.0-canary.273.1';

const updaterFinding = (result: UpdateCheck | null): Updater => ({
  checkForUpdatesAndNotify: () => Promise.resolve(result),
});

const resultWith = (isUpdateAvailable: boolean): UpdateCheck => ({
  isUpdateAvailable,
  updateInfo: { version: '0.0.0-canary.278.1' },
});

describe('updateFeedOf', () => {
  it('reads a pre-release channel from the release named after it', () => {
    expect(updateFeedOf('0.0.0-canary.278.1')).toEqual({
      provider: 'generic',
      url: 'https://github.com/usespotlightai/spotlight/releases/download/canary/',
      channel: 'canary',
    });
  });

  it.each(['1.4.0', '0.12.3', '1.0.0+abc'])(
    'keeps the GitHub release feed for version %s',
    (version) => {
      expect(updateFeedOf(version)).toBeNull();
    },
  );
});

describe('updateCheckOutcome', () => {
  it('names the version that is downloading', async () => {
    expect(
      await updateCheckOutcome(updaterFinding(resultWith(true)), VERSION),
    ).toEqual({
      type: 'info',
      message: 'Spotlight 0.0.0-canary.278.1 is downloading.',
      detail: 'Spotlight installs it when you quit.',
    });
  });

  it('says the app is up to date when the check finds no newer version', async () => {
    expect(
      await updateCheckOutcome(updaterFinding(resultWith(false)), VERSION),
    ).toEqual({
      type: 'info',
      message: 'Spotlight is up to date.',
      detail: `Version ${VERSION}`,
    });
  });

  it('says updates are not available when the updater does not run', async () => {
    expect(await updateCheckOutcome(updaterFinding(null), VERSION)).toEqual({
      type: 'info',
      message: 'Updates are not available in this build.',
      detail: `Version ${VERSION}`,
    });
  });

  it('shows why the check failed', async () => {
    const failing: Updater = {
      checkForUpdatesAndNotify: () =>
        Promise.reject(new Error('No published versions on GitHub')),
    };

    expect(await updateCheckOutcome(failing, VERSION)).toEqual({
      type: 'warning',
      message: 'Spotlight could not check for updates.',
      detail: 'No published versions on GitHub',
    });
  });
});
