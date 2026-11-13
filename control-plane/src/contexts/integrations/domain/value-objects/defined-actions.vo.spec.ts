import { actionNamed } from '@integrations/domain/value-objects/action.fake-spec';
import { DefinedActions } from '@integrations/domain/value-objects/defined-actions.vo';
import { describe, expect, it } from 'vitest';

const UPLOADING = DefinedActions.of([
  actionNamed('post'),
  actionNamed('attach', { uploads: true }),
]);

describe('DefinedActions', () => {
  it('hands back an action it defines', () => {
    expect(UPLOADING.named('post', 'schedule').name).toBe('post');
  });

  it('rejects one it does not define', () => {
    expect(() => UPLOADING.named('digest', 'schedule')).toThrow(
      /names undefined action digest/,
    );
  });

  it('lets no tool or schedule name an action that uploads files', () => {
    expect(() => UPLOADING.forTool('attach', 'tool linear.attach')).toThrow(
      /names the action attach, which uploads files. Only an event in on sends files/,
    );
    expect(() => UPLOADING.forSchedule('attach', 'schedule')).toThrow(
      /which uploads files/,
    );
    expect(UPLOADING.forTool('post', 'tool linear.post').name).toBe('post');
  });

  it('lets only a binding on an event that has files name an action that uploads them', () => {
    expect(() => UPLOADING.forBinding('attach', 'chat', 'binding')).toThrow(
      /A chat event has no files/,
    );
    expect(() =>
      UPLOADING.forBinding('attach', 'inbox-request', 'binding'),
    ).toThrow(/An inbox request event has no files/);
    expect(() => UPLOADING.forBinding('attach', 'notice', 'binding')).toThrow(
      /A notice event has no files/,
    );
    expect(UPLOADING.forBinding('attach', 'task', 'binding').name).toBe(
      'attach',
    );
  });
});
