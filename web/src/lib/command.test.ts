import { describe, expect, it } from 'vitest';
import {
  commandKeywords,
  commandMatch,
  commandShortcut,
  navigationTargets,
  settingsTargets,
} from '@/lib/command';

const teams = [{ id: 't1', name: 'Platform' }];

describe('navigationTargets', () => {
  it('opens each team section with the team as context', () => {
    const memory = navigationTargets('acme', teams).find(
      (each) => each.id === 'team:t1:memory',
    );

    expect(memory).toMatchObject({
      label: 'Go to Memory',
      context: 'Platform',
      to: '/w/acme/team/t1/memory',
    });
  });
});

describe('settingsTargets', () => {
  it('shows members and API access to admins only', () => {
    const ids = (role: 'admin' | 'member') =>
      settingsTargets('acme', role, teams).map((each) => each.id);

    expect(ids('admin')).toContain('settings:members');
    expect(ids('member')).not.toContain('settings:members');
    expect(ids('member')).not.toContain('settings:api-access');
  });
});

describe('commandKeywords', () => {
  it('matches on the label and the context', () => {
    expect(
      commandKeywords({
        id: 'x',
        label: 'Review',
        context: 'Backend',
        icon: () => null,
        to: '/',
      } as never),
    ).toEqual(['Review', 'Backend']);
  });
});

describe('commandShortcut', () => {
  it('names the Command key on a Mac and Ctrl elsewhere', () => {
    expect(commandShortcut('Mozilla/5.0 (Macintosh; Intel Mac OS X)')).toBe(
      '⌘K',
    );
    expect(commandShortcut('Mozilla/5.0 (Windows NT 10.0)')).toBe('Ctrl K');
  });
});

describe('commandMatch', () => {
  it('finds a target when every word appears in its label or context', () => {
    expect(
      commandMatch('', 'memory plat', ['Go to Memory', 'Platform']),
    ).toBeGreaterThan(0);
  });

  it('skips a target whose letters only appear scattered', () => {
    expect(
      commandMatch('', 'integr', [
        'Referral link in the invite email',
        'Growth',
      ]),
    ).toBe(0);
  });
});
