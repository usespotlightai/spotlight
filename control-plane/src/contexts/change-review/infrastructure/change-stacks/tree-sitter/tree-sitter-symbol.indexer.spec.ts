import type { DiffSource } from '@change-review/application/ports/diff-reader.port';
import type { IndexedFile } from '@change-review/domain/services/symbol-index';
import { TreeSitterSymbolIndexer } from '@change-review/infrastructure/change-stacks/tree-sitter/tree-sitter-symbol.indexer';
import { describe, expect, it } from 'vitest';

const indexer = new TreeSitterSymbolIndexer();

const source = (path: string, lines: string[]): DiffSource => ({
  path,
  side: 'after',
  text: lines.join('\n'),
});

const indexed = async (
  ...sources: DiffSource[]
): Promise<readonly IndexedFile[]> => (await indexer.index(sources)).files;

const symbolsOf = (file: IndexedFile | undefined) =>
  file?.symbols.map(({ name, kind, line }) => [name, kind, line]);

describe('TreeSitterSymbolIndexer', () => {
  it('reads what a TypeScript file defines, exports and imports', async () => {
    const [routes, invite] = await indexed(
      source('src/routes.tsx', [
        "import Page, { invite as send } from './invite';",
        "import * as mail from '@/lib/mail';",
        'export default function Invitations() {',
        '  return <Page onSend={() => send(mail.address)} />;',
        '}',
      ]),
      source('src/invite.ts', [
        'export const invite = () => 1;',
        'class Hidden {',
        '  resend() {',
        '    const local = 1;',
        '  }',
        '}',
        'export { Hidden as default };',
      ]),
    );

    expect(symbolsOf(routes)).toEqual([['Invitations', 'component', 3]]);
    expect(routes?.symbols[0]?.exportedAs).toEqual(['default', 'Invitations']);
    expect(routes?.imports).toEqual([
      {
        local: 'Page',
        imported: 'default',
        specifier: './invite',
        resolved: ['src/invite.ts'],
        project: true,
      },
      {
        local: 'send',
        imported: 'invite',
        specifier: './invite',
        resolved: ['src/invite.ts'],
        project: true,
      },
      {
        local: 'mail',
        imported: '*',
        specifier: '@/lib/mail',
        resolved: [],
        project: true,
      },
    ]);
    expect(routes?.references).toEqual(
      expect.arrayContaining([
        { name: 'Page', line: 4, through: null },
        { name: 'send', line: 4, through: null },
        { name: 'address', line: 4, through: 'mail' },
      ]),
    );

    expect(symbolsOf(invite)).toEqual([
      ['invite', 'constant', 1],
      ['Hidden', 'class', 2],
      ['resend', 'method', 3],
    ]);
    expect(invite?.symbols[1]?.exportedAs).toEqual(['default']);
  });

  it('finds routes a server declares and the paths a client calls', async () => {
    const [controller, client] = await indexed(
      source('src/runs.controller.ts', [
        "@Controller('teams/:teamId/runs')",
        'export class RunController {',
        "  @Get(':runId/change-stacks')",
        '  list() {}',
        '}',
        "router.post('/invites', create);",
      ]),
      source('web/src/api.ts', [
        'export const read = (team: string, run: string) =>',
        // biome-ignore lint/suspicious/noTemplateCurlyInString: source code being read
        '  fetch(`/api/teams/${team}/runs/${run}/change-stacks`);',
      ]),
    );

    expect(
      controller?.symbols
        .filter((symbol) => symbol.kind === 'route')
        .map(({ name, line }) => [name, line]),
    ).toEqual([
      ['GET /teams/:teamId/runs/:runId/change-stacks', 3],
      ['POST /invites', 6],
    ]);
    expect(client?.routeUses).toEqual([
      { path: '/api/teams/:param/runs/:param/change-stacks', line: 2 },
    ]);
  });

  it('reads Go by package', async () => {
    const [queue, worker] = await indexed(
      source('runner/internal/queue/queue.go', [
        'package queue',
        'type Job struct{}',
        'func (j *Job) Run() {}',
        'func Next() *Job { return nil }',
      ]),
      source('runner/internal/worker/worker.go', [
        'package worker',
        'import "usespotlight.ai/runner/internal/queue"',
        'func Work() { queue.Next().Run() }',
      ]),
    );

    expect(symbolsOf(queue)).toEqual([
      ['Job', 'type', 2],
      ['Run', 'method', 3],
      ['Next', 'function', 4],
    ]);
    expect(worker?.imports).toEqual([
      expect.objectContaining({
        local: 'queue',
        imported: '*',
        resolved: ['runner/internal/queue/queue.go'],
      }),
    ]);
    expect(worker?.references).toEqual(
      expect.arrayContaining([{ name: 'Next', line: 3, through: 'queue' }]),
    );
  });

  it('reads Python, Java, Rust and Ruby', async () => {
    const [python, java, rust, ruby] = await indexed(
      source('app/invites/service.py', [
        'from .models import Invite as Inv',
        'class InviteService:',
        '    def create(self, email):',
        '        return Inv(email)',
        '@router.post("/teams/{team_id}/invites")',
        'def create_invite(): pass',
        'LIMIT = 3',
      ]),
      source('src/main/java/com/acme/InviteController.java', [
        'package com.acme;',
        '@RequestMapping("/teams")',
        'public class InviteController {',
        '  @PostMapping("/{id}/invites")',
        '  public Invite create() { return null; }',
        '}',
      ]),
      source('src/invite.rs', [
        'use crate::store::{Store, save as persist};',
        'pub struct Invite;',
        'impl Invite { pub fn create(&self) { persist(); } }',
      ]),
      source('app/services/invite_service.rb', [
        'class InviteService',
        '  LIMIT = 3',
        '  def create(email) = Store.save(email)',
        'end',
      ]),
    );

    expect(symbolsOf(python)).toEqual([
      ['InviteService', 'class', 2],
      ['create', 'method', 3],
      ['POST /teams/{team_id}/invites', 'route', 5],
      ['create_invite', 'function', 6],
      ['LIMIT', 'constant', 7],
    ]);
    expect(python?.imports[0]).toMatchObject({
      local: 'Inv',
      imported: 'Invite',
      specifier: '.models',
      project: true,
    });
    expect(symbolsOf(java)).toEqual([
      ['InviteController', 'class', 3],
      ['create', 'method', 5],
      ['POST /teams/{id}/invites', 'route', 4],
    ]);
    expect(symbolsOf(rust)).toEqual([
      ['Invite', 'type', 2],
      ['create', 'method', 3],
    ]);
    expect(
      rust?.imports.map(({ local, imported, specifier }) => [
        local,
        imported,
        specifier,
      ]),
    ).toEqual([
      ['Store', 'Store', 'crate::store'],
      ['persist', 'save', 'crate::store'],
    ]);
    expect(symbolsOf(ruby)).toEqual([
      ['InviteService', 'class', 1],
      ['LIMIT', 'constant', 2],
      ['create', 'method', 3],
    ]);
    expect(ruby?.references).toEqual(
      expect.arrayContaining([{ name: 'save', line: 3, through: 'Store' }]),
    );
  });

  it('leaves files it has no grammar for out', async () => {
    expect(await indexed(source('README.md', ['# Hi']))).toEqual([]);
  });
});

describe('TreeSitterSymbolIndexer spans', () => {
  it('knows where each definition ends', async () => {
    const [file] = await indexed(
      source('src/review.ts', [
        'export function threadsOf() {',
        '  const found = [];',
        '  return found;',
        '}',
      ]),
    );

    expect(
      file?.symbols.map(({ name, line, endLine }) => [name, line, endLine]),
    ).toEqual([['threadsOf', 1, 4]]);
  });
});

describe('TreeSitterSymbolIndexer re-exports', () => {
  it('counts a re-export as an import of the file it re-exports', async () => {
    const [index] = await indexed(
      source('web/src/lib/api/index.ts', [
        "export * from './sdk.gen';",
        "export { type Label } from './types.gen';",
      ]),
      source('web/src/lib/api/sdk.gen.ts', ['export const listLabels = 1;']),
      source('web/src/lib/api/types.gen.ts', ['export type Label = {};']),
    );

    expect(
      index?.imports.map(({ imported, resolved }) => [imported, resolved]),
    ).toEqual([
      ['*', ['web/src/lib/api/sdk.gen.ts']],
      ['Label', ['web/src/lib/api/types.gen.ts']],
    ]);
  });
});
