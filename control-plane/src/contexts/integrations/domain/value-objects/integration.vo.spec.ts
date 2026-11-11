import { InvalidIntegrationError } from '@integrations/domain/exceptions/invalid-integration.error';
import { actionNamed } from '@integrations/domain/value-objects/action.fake-spec';
import { ActsAs } from '@integrations/domain/value-objects/acts-as.vo';
import { Binding } from '@integrations/domain/value-objects/binding.vo';
import { ConnectionOwner } from '@integrations/domain/value-objects/connection-owner.vo';
import { DeclaredHappening } from '@integrations/domain/value-objects/declared-happening.vo';
import { DefinedActions } from '@integrations/domain/value-objects/defined-actions.vo';
import { HappeningName } from '@integrations/domain/value-objects/happening-name.vo';
import { Integration } from '@integrations/domain/value-objects/integration.vo';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { MarkKind } from '@integrations/domain/value-objects/mark-kind.vo';
import { ProvidedTool } from '@integrations/domain/value-objects/provided-tool.vo';
import { ToolBacking } from '@integrations/domain/value-objects/tool-backing.vo';
import { Webhook } from '@integrations/domain/value-objects/webhook.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it } from 'vitest';

const LINEAR = IntegrationKey.of('linear');
const KNOWN = { task: ['task.opened', 'task.asked'], chat: [] };

const declared = (happening: string, label = 'Issue completed') =>
  DeclaredHappening.of({
    happening: HappeningName.of(happening),
    label,
    summary: 'The issue was moved to Done.',
    finds: [MarkKind.of('linear.issue')],
  });

const integration = (declares = [declared('linear.issue.completed')]) =>
  Integration.of({
    key: LINEAR,
    webhook: declares.length > 0 ? Webhook.of({ declares }) : null,
    actions: DefinedActions.of([actionNamed('post')]),
  });

describe('Integration', () => {
  it('has the happenings the integration can raise', () => {
    expect(integration().declares).toHaveLength(1);
    expect(
      integration().raises(HappeningName.of('linear.issue.completed')),
    ).toBe(true);
    expect(integration().raises(HappeningName.of('linear.issue.opened'))).toBe(
      false,
    );
  });

  it('uses the integration name as its name when the file names none', () => {
    expect(integration().name).toBe('linear');
    expect(
      Integration.of({ key: LINEAR, name: 'Linear', apiSpecs: ['mcp'] }).name,
    ).toBe('Linear');
  });

  it('rejects one that does nothing', () => {
    expect(() => Integration.of({ key: LINEAR })).toThrow(/must do something/);
  });

  it('rejects one that offers tools from two API specs', () => {
    expect(() =>
      Integration.of({ key: LINEAR, apiSpecs: ['openapi', 'mcp'] }),
    ).toThrow(/one API spec/);
  });

  it('takes a connection only over oauth2', () => {
    expect(
      Integration.of({ key: LINEAR, connectsOver: 'oauth2', apiSpecs: ['mcp'] })
        .requiresConnection,
    ).toBe(true);
    expect(
      Integration.of({
        key: LINEAR,
        connectsOver: 'secrets',
        apiSpecs: ['mcp'],
      }).requiresConnection,
    ).toBe(false);
  });

  it('allows one that raises no happenings', () => {
    expect(integration([]).declares).toHaveLength(0);
  });

  it('rejects a happening belonging to another integration', () => {
    expect(() => integration([declared('github.issue.completed')])).toThrow(
      /without the linear\. prefix/,
    );
  });

  it('rejects one that defines a happening twice', () => {
    expect(() =>
      integration([
        declared('linear.issue.completed'),
        declared('linear.issue.completed', 'Completed again'),
      ]),
    ).toThrow(/more than once/);
  });

  it('posts on the events it binds, and no others', () => {
    const posting = Integration.of({
      key: LINEAR,
      actions: DefinedActions.of([actionNamed('post')]),
      bindings: [
        Binding.of({ event: 'task.asked', action: 'post', known: KNOWN }),
      ],
    });

    expect(posting.postsOn('task.asked')).toBe(true);
    expect(posting.postsOn('task.opened')).toBe(false);
  });

  it('rejects a binding, or a tool, that names an action it does not define', () => {
    expect(() =>
      Integration.of({
        key: LINEAR,
        bindings: [
          Binding.of({ event: 'task.asked', action: 'post', known: KNOWN }),
        ],
      }),
    ).toThrow(/names undefined action post/);
    expect(() =>
      Integration.of({
        key: LINEAR,
        writtenTools: [
          ProvidedTool.of({
            integration: LINEAR,
            name: 'comment',
            description: 'Comment.',
            backing: ToolBacking.action('comment'),
          }),
        ],
      }),
    ).toThrow(/names undefined action/);
  });
});

describe('Integration actsAs', () => {
  it('takes the team’s connection unless it says otherwise', () => {
    expect(
      Integration.of({ key: LINEAR, connectsOver: 'oauth2', apiSpecs: ['mcp'] })
        .actsAs.kind,
    ).toBe('team');
  });

  it('takes each requester’s connection when it connects over oauth2', () => {
    expect(
      Integration.of({
        key: LINEAR,
        apiSpecs: ['mcp'],
        connectsOver: 'oauth2',
        actsAs: ActsAs.requester(),
      }).actsAs.byRequester,
    ).toBe(true);
  });

  it('rejects the requester rule when nobody can connect', () => {
    expect(() =>
      Integration.of({
        key: LINEAR,
        apiSpecs: ['mcp'],
        actsAs: ActsAs.requester(),
      }),
    ).toThrow(InvalidIntegrationError);
  });
});

describe('Integration connections', () => {
  const PERSON = ConnectionOwner.person(UserId.of('user_1'));

  it('takes a team connection whenever it connects', () => {
    expect(
      Integration.of({
        key: LINEAR,
        apiSpecs: ['mcp'],
        connectsOver: 'oauth2',
      }).takesConnectionFrom(ConnectionOwner.team()),
    ).toBe(true);
  });

  it('takes a person’s connection only when it acts as the requester', () => {
    expect(
      Integration.of({
        key: LINEAR,
        apiSpecs: ['mcp'],
        connectsOver: 'oauth2',
      }).takesConnectionFrom(PERSON),
    ).toBe(false);
    expect(
      Integration.of({
        key: LINEAR,
        apiSpecs: ['mcp'],
        connectsOver: 'oauth2',
        actsAs: ActsAs.requester(),
      }).takesConnectionFrom(PERSON),
    ).toBe(true);
  });

  it('takes no connection when it connects to nothing', () => {
    expect(
      Integration.of({ key: LINEAR, apiSpecs: ['mcp'] }).takesConnectionFrom(
        ConnectionOwner.team(),
      ),
    ).toBe(false);
  });
});
