import { Integration } from '@integrations/domain/entities/integration.entity';
import { Binding } from '@integrations/domain/value-objects/binding.vo';
import { DeclaredHappening } from '@integrations/domain/value-objects/declared-happening.vo';
import { DefinedActions } from '@integrations/domain/value-objects/defined-actions.vo';
import { HappeningName } from '@integrations/domain/value-objects/happening-name.vo';
import { MarkKind } from '@integrations/domain/value-objects/mark-kind.vo';
import { OfferedTool } from '@integrations/domain/value-objects/offered-tool.vo';
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { ToolBacking } from '@integrations/domain/value-objects/tool-backing.vo';
import { Webhook } from '@integrations/domain/value-objects/webhook.vo';
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
  it('holds the words its host can raise', () => {
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

  it('refuses a word belonging to another source', () => {
    expect(() => integration([declared('github.issue.completed')])).toThrow(
      /must begin with linear\./,
    );
  });

  it('refuses one that says a word twice', () => {
    expect(() =>
      integration([
        declared('linear.issue.completed'),
        declared('linear.issue.completed', 'Completed again'),
      ]),
    ).toThrow(/twice/);
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

  it('refuses a binding, or a tool, that names an action it does not define', () => {
    expect(() =>
      Integration.of({
        source: LINEAR,
        bindings: [
          Binding.of({ event: 'task.asked', does: 'post', known: KNOWN }),
        ],
      }),
    ).toThrow(/names an action "post" that is not defined/);
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
    ).toThrow(/not defined/);
  });

  it('is the same integration as another to the same host', () => {
    expect(integration().equals(integration())).toBe(true);
  });
});
