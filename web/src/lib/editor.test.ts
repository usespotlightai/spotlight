import { describe, expect, it } from 'vitest';
import { editorLink, editorSetupSteps, sandboxAlias } from '@/lib/editor';

describe('sandboxAlias', () => {
  it('names a task or chat in its workspace under .spotlight', () => {
    expect(sandboxAlias({ kind: 'task', id: 'abc' }, 'acme')).toBe(
      'task-abc.acme.spotlight',
    );
    expect(sandboxAlias({ kind: 'chat', id: 'c1' }, 'acme')).toBe(
      'chat-c1.acme.spotlight',
    );
  });
});

describe('editorLink', () => {
  it('opens the workspace folder over Remote - SSH in VS Code or Cursor', () => {
    expect(editorLink('vscode', 'task-abc.acme.spotlight')).toBe(
      'vscode://vscode-remote/ssh-remote+task-abc.acme.spotlight/workspace',
    );
    expect(editorLink('cursor', 'task-abc.acme.spotlight')).toBe(
      'cursor://vscode-remote/ssh-remote+task-abc.acme.spotlight/workspace',
    );
  });
});

describe('editorSetupSteps', () => {
  it('uses the plain commands for the hosted Spotlight', () => {
    expect(
      editorSetupSteps('https://app.usespotlight.ai').map(
        (each) => each.command,
      ),
    ).toEqual([
      'curl -fsSL https://app.usespotlight.ai/api/install.sh | sh',
      'spotlight login',
      'spotlight ssh setup',
    ]);
  });

  it('names the address of another Spotlight', () => {
    expect(
      editorSetupSteps('https://spotlight.acme.dev').map(
        (each) => each.command,
      ),
    ).toEqual([
      'curl -fsSL https://spotlight.acme.dev/api/install.sh | sh',
      'spotlight login --url https://spotlight.acme.dev',
      'spotlight ssh setup --url https://spotlight.acme.dev',
    ]);
  });
});
