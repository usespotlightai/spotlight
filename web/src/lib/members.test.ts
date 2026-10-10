import { describe, expect, it } from 'vitest';
import {
  expiryOfInvite,
  inviterNamed,
  joiningAs,
  membersShown,
  parseEmails,
  rolesOffered,
  sameAddress,
  showOf,
} from '@/lib/members';

const NOW = Date.parse('2026-10-10T12:00:00.000Z');

describe('parseEmails', () => {
  it('splits on commas, semicolons, spaces and new lines', () => {
    expect(parseEmails('a@x.io, b@x.io;c@x.io\nd@x.io  e@x.io').valid).toEqual([
      'a@x.io',
      'b@x.io',
      'c@x.io',
      'd@x.io',
      'e@x.io',
    ]);
  });

  it('keeps the first spelling of an address typed twice', () => {
    expect(parseEmails('Ada@x.io ada@X.io')).toEqual({
      valid: ['Ada@x.io'],
      invalid: [],
    });
  });

  it('tells addresses from what is not one', () => {
    expect(parseEmails('ada@x.io grace alan@ @x.io b@c')).toEqual({
      valid: ['ada@x.io'],
      invalid: ['grace', 'alan@', '@x.io', 'b@c'],
    });
  });

  it('finds nothing in blank text', () => {
    expect(parseEmails('  ,\n ')).toEqual({ valid: [], invalid: [] });
  });
});

describe('rolesOffered', () => {
  it('lists the current role with the ones it may become, highest first', () => {
    expect(rolesOffered('member', ['owner', 'admin'])).toEqual([
      'owner',
      'admin',
      'member',
    ]);
    expect(rolesOffered('owner', [])).toEqual(['owner']);
  });
});

describe('sameAddress', () => {
  it('ignores case and surrounding space', () => {
    expect(sameAddress(' Ada@Example.com', 'ada@example.COM')).toBe(true);
    expect(sameAddress('ada@example.com', 'grace@example.com')).toBe(false);
  });
});

describe('the members filter', () => {
  const people = [
    { role: 'owner' },
    { role: 'admin' },
    { role: 'member' },
  ] as never[];

  it('reads only the filters it knows', () => {
    expect(showOf(new URLSearchParams('show=admin'))).toBe('admin');
    expect(showOf(new URLSearchParams('show=invited'))).toBe('invited');
    expect(showOf(new URLSearchParams('show=nobody'))).toBeNull();
  });

  it('shows everyone, one role, or no members at all for the invites', () => {
    expect(membersShown(people, null)).toHaveLength(3);
    expect(membersShown(people, 'admin')).toEqual([{ role: 'admin' }]);
    expect(membersShown(people, 'invited')).toBeNull();
  });
});

describe('expiryOfInvite', () => {
  it('counts the days left, and says when it has run out', () => {
    expect(expiryOfInvite('2026-10-15T11:00:00.000Z', NOW)).toBe(
      'Expires in 5 days',
    );
    expect(expiryOfInvite('2026-10-10T20:00:00.000Z', NOW)).toBe(
      'Expires within a day',
    );
    expect(expiryOfInvite('2026-10-09T12:00:00.000Z', NOW)).toBe('Expired');
  });
});

describe('joiningAs', () => {
  it('says the role and the teams joined', () => {
    expect(joiningAs('member', ['Platform'])).toBe(
      'You join as a member, on the Platform team.',
    );
    expect(joiningAs('admin', ['Platform', 'Growth'])).toBe(
      'You join as an admin, on the Platform and Growth teams.',
    );
    expect(joiningAs('member', [])).toBe(
      'You join as a member of the workspace on Spotlight.',
    );
  });
});

describe('inviterNamed', () => {
  it('names the inviter, or someone who has left once their account is gone', () => {
    expect(inviterNamed('Sam Rivera')).toBe('Sam Rivera');
    expect(inviterNamed(null)).toBe('Someone who has left');
  });
});
