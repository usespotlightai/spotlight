import { Integration } from '@integrations/domain/entities/integration.entity';
import { InvalidIntegrationError } from '@integrations/domain/exceptions/invalid-integration.error';
import { Binding } from '@integrations/domain/value-objects/binding.vo';
import { ConnectionHolder } from '@integrations/domain/value-objects/connection-holder.vo';
import { ConnectionHolderRule } from '@integrations/domain/value-objects/connection-holder-rule.vo';
import { DeclaredHappening } from '@integrations/domain/value-objects/declared-happening.vo';
import { DefinedActions } from '@integrations/domain/value-objects/defined-actions.vo';
import { HappeningName } from '@integrations/domain/value-objects/happening-name.vo';
import { MarkKind } from '@integrations/domain/value-objects/mark-kind.vo';
import { OfferedTool } from '@integrations/domain/value-objects/offered-tool.vo';
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { ToolBacking } from '@integrations/domain/value-objects/tool-backing.vo';
import { Webhook } from '@integrations/domain/value-objects/webhook.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it } from 'vitest';

const LINEAR = SourceKey.of('linear');
const KNOWN = ['task.opened', 'task.asked'];

const declared = (happening: string, label = 'Issue completed') =>
  DeclaredHappening.of({
    happening: HappeningName.of(happening),
    label,
    told: 'The issue was moved to Done.',
    finds: [MarkKind.of('linear.issue')],
  });

const integration = (declares = [declared('linear.issue.completed')]) =>
  Integration.of({
    source: LINEAR,
    webhook: declares.length > 0 ? Webhook.of({ declares }) : null,
  });

describe('Integration', () => {
  it('has the words its host can raise', () => {
    expect(integration().declares).toHaveLength(1);
    expect(
      integration().raises(HappeningName.of('linear.issue.completed')),
    ).toBe(true);
    expect(integration().raises(HappeningName.of('linear.issue.opened'))).toBe(
      false,
    );
  });

  it('is called by its source where the file gives no name', () => {
    expect(integration().name).toBe('linear');
    expect(Integration.of({ source: LINEAR, name: 'Linear' }).name).toBe(
      'Linear',
    );
  });

  it('allows one that raises no words', () => {
    expect(integration([]).declares).toHaveLength(0);
  });

  it('rejects a word belonging to another source', () => {
    expect(() => integration([declared('github.issue.completed')])).toThrow(
      /without the linear\. prefix/,
    );
  });

  it('rejects one that says a word twice', () => {
    expect(() =>
      integration([
        declared('linear.issue.completed'),
        declared('linear.issue.completed', 'Completed again'),
      ]),
    ).toThrow(/more than once/);
  });

  it('posts on the events it binds, and no others', () => {
    const posting = Integration.of({
      source: LINEAR,
      actions: DefinedActions.of(['post']),
      bindings: [
        Binding.of({ event: 'task.asked', does: 'post', known: KNOWN }),
      ],
    });

    expect(posting.postsOn('task.asked')).toBe(true);
    expect(posting.postsOn('task.opened')).toBe(false);
  });

  it('rejects a binding, or a tool, that names an action it does not define', () => {
    expect(() =>
      Integration.of({
        source: LINEAR,
        bindings: [
          Binding.of({ event: 'task.asked', does: 'post', known: KNOWN }),
        ],
      }),
    ).toThrow(/names undefined action post/);
    expect(() =>
      Integration.of({
        source: LINEAR,
        offers: [
          OfferedTool.of({
            source: LINEAR,
            name: 'comment',
            description: 'Comment.',
            backing: ToolBacking.action('comment'),
          }),
        ],
      }),
    ).toThrow(/names undefined action/);
  });

  it('is the same integration as another to the same host', () => {
    expect(integration().equals(integration())).toBe(true);
  });
});

describe('Integration holder rule', () => {
  it('takes the team’s connection unless it says otherwise', () => {
    expect(
      Integration.of({ source: LINEAR, connects: true }).holderRule.kind,
    ).toBe('team');
  });

  it('takes each requester’s connection when it connects over oauth2', () => {
    expect(
      Integration.of({
        source: LINEAR,
        connects: true,
        holderRule: ConnectionHolderRule.requester(),
      }).holderRule.byRequester,
    ).toBe(true);
  });

  it('rejects the requester holder rule when nobody can connect', () => {
    expect(() =>
      Integration.of({
        source: LINEAR,
        holderRule: ConnectionHolderRule.requester(),
      }),
    ).toThrow(InvalidIntegrationError);
  });
});

describe('Integration connections', () => {
  const PERSON = ConnectionHolder.person(UserId.of('user_1'));

  it('takes a team connection whenever it connects', () => {
    expect(
      Integration.of({ source: LINEAR, connects: true }).takesConnectionFrom(
        ConnectionHolder.team(),
      ),
    ).toBe(true);
  });

  it('takes a person’s connection only when it acts as the requester', () => {
    expect(
      Integration.of({ source: LINEAR, connects: true }).takesConnectionFrom(
        PERSON,
      ),
    ).toBe(false);
    expect(
      Integration.of({
        source: LINEAR,
        connects: true,
        holderRule: ConnectionHolderRule.requester(),
      }).takesConnectionFrom(PERSON),
    ).toBe(true);
  });

  it('takes no connection when it connects to nothing', () => {
    expect(
      Integration.of({ source: LINEAR }).takesConnectionFrom(
        ConnectionHolder.team(),
      ),
    ).toBe(false);
  });
});
