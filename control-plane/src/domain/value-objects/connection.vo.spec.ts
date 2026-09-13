import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';
import { Connection } from '@domain/value-objects/connection.vo';
import { describe, expect, it } from 'vitest';

describe('Connection', () => {
  it('holds the host it is to and what that host calls the workspace', () => {
    const connection = Connection.of('github', '81234567');

    expect(connection.source).toBe('github');
    expect(connection.externalId).toBe('81234567');
  });

  it('says which host it is to', () => {
    const connection = Connection.of('github', '42');

    expect(connection.isTo('github')).toBe(true);
    expect(connection.isTo('linear')).toBe(false);
  });

  it('takes an identifier in whatever shape its host counts in', () => {
    expect(Connection.of('linear', 'team_9NxQ').externalId).toBe('team_9NxQ');
  });

  it('is the same connection as another to the same host and identifier', () => {
    expect(
      Connection.of('github', '42').equals(Connection.of('github', '42')),
    ).toBe(true);
    expect(
      Connection.of('github', '42').equals(Connection.of('github', '43')),
    ).toBe(false);
  });

  it('is not the same connection as one to another host', () => {
    expect(
      Connection.of('github', '42').equals(Connection.of('linear', '42')),
    ).toBe(false);
  });

  it('refuses a host named in anything but the way a source is addressed', () => {
    expect(() => Connection.of('GitHub', '42')).toThrow(InvalidIdentifierError);
    expect(() => Connection.of('git hub', '42')).toThrow(
      InvalidIdentifierError,
    );
    expect(() => Connection.of('', '42')).toThrow(InvalidIdentifierError);
  });

  it('refuses a connection that names nothing', () => {
    expect(() => Connection.of('github', '  ')).toThrow(InvalidIdentifierError);
  });
});
