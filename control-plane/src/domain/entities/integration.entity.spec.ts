import { DeclaredHappening } from '@domain/entities/declared-happening.entity';
import { Integration } from '@domain/entities/integration.entity';
import { InvalidIntegrationError } from '@domain/exceptions/invalid-integration.error';
import { Happening } from '@domain/value-objects/happening.vo';
import { MarkKind } from '@domain/value-objects/mark-kind.vo';
import { SecretName } from '@domain/value-objects/secret-name.vo';
import { Signing } from '@domain/value-objects/signing.vo';
import { SourceKey } from '@domain/value-objects/source-key.vo';
import { describe, expect, it } from 'vitest';

const LINEAR = SourceKey.of('linear');

const signing = () =>
  Signing.of({
    scheme: 'hmac-sha256',
    header: 'Linear-Signature',
    secret: SecretName.of('LINEAR_WEBHOOK_SECRET'),
  });

const declared = (happening: string, label = 'Issue completed') =>
  DeclaredHappening.of({
    happening: Happening.of(happening),
    label,
    told: 'The issue was moved to Done.',
    finds: [MarkKind.of('linear.issue')],
  });

const integration = (declares = [declared('linear.issue.completed')]) =>
  Integration.of({ source: LINEAR, signing: signing(), declares });

describe('Integration', () => {
  it('holds the words its host can raise', () => {
    expect(integration().declares).toHaveLength(1);
    expect(integration().raises(Happening.of('linear.issue.completed'))).toBe(
      true,
    );
    expect(integration().raises(Happening.of('linear.issue.opened'))).toBe(
      false,
    );
  });

  it('is called by its source where the file gives no name', () => {
    expect(integration().name).toBe('linear');
    expect(
      Integration.of({
        source: LINEAR,
        name: 'Linear',
        signing: signing(),
        declares: [declared('linear.issue.completed')],
      }).name,
    ).toBe('Linear');
  });

  // A host that raises nothing is one nobody could wait on.
  it('refuses one that raises no words at all', () => {
    expect(() => integration([])).toThrow(InvalidIntegrationError);
  });

  // A file raising another host's words would have stations waiting on
  // something this source never says.
  it('refuses a word belonging to another source', () => {
    expect(() => integration([declared('github.issue.completed')])).toThrow(
      /another source's word/,
    );
  });

  // The second would never be reached, and nothing would say why.
  it('refuses one that says a word twice', () => {
    expect(() =>
      integration([
        declared('linear.issue.completed'),
        declared('linear.issue.completed', 'Completed again'),
      ]),
    ).toThrow(/twice/);
  });

  it('is the same integration as another to the same host', () => {
    expect(integration().equals(integration())).toBe(true);
  });
});
