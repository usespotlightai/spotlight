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

  it('finds Go method patterns on a ServeMux', async () => {
    const [server] = await indexed(
      source('cmd/api/main.go', [
        'package main',
        'func main() {',
        '  mux.HandleFunc("POST /teams/{team}/invites", invite)',
        '  mux.Handle("/health", health)',
        '  r.GET("/runs/:id", run)',
        '}',
      ]),
    );

    expect(
      server?.symbols
        .filter((symbol) => symbol.kind === 'route')
        .map(({ name, line }) => [name, line]),
    ).toEqual([
      ['POST /teams/{team}/invites', 3],
      ['ANY /health', 4],
      ['GET /runs/:id', 5],
    ]);
  });

  it('reads PHP by namespace', async () => {
    const [controller, invite, routes] = await indexed(
      source('app/Http/Controllers/InviteController.php', [
        '<?php',
        'namespace App\\Http\\Controllers;',
        'use App\\Models\\{Invite, Team as Group};',
        "#[Route('/teams')]",
        'class InviteController extends Controller',
        '{',
        '    public const LIMIT = 3;',
        "    #[Route('/{id}/invites', methods: ['POST'])]",
        '    public function create(Request $request): Invite',
        '    {',
        '        $invite = Invite::open($request->all());',
        '        return new Group($invite);',
        '    }',
        '}',
      ]),
      source('app/Models/Invite.php', [
        '<?php',
        'namespace App\\Models;',
        'class Invite',
        '{',
        '    public static function open(array $fields): static { return new static(); }',
        '}',
        'function invite() {}',
      ]),
      source('routes/web.php', [
        '<?php',
        "Route::post('invites', [InviteController::class, 'create']);",
        "$app->get('/teams/{team}/runs', fn () => null);",
        '$url = "/api/teams/$team->id/runs";',
      ]),
    );

    expect(symbolsOf(controller)).toEqual([
      ['InviteController', 'class', 5],
      ['LIMIT', 'constant', 7],
      ['create', 'method', 9],
      ['POST /teams/{id}/invites', 'route', 8],
    ]);
    expect(
      controller?.imports.map(({ local, imported, specifier, resolved }) => [
        local,
        imported,
        specifier,
        resolved,
      ]),
    ).toEqual([
      ['Invite', 'Invite', 'App\\Models\\Invite', ['app/Models/Invite.php']],
      ['Group', 'Team', 'App\\Models\\Team', ['app/Models/Invite.php']],
    ]);
    expect(controller?.references).toEqual(
      expect.arrayContaining([
        { name: 'open', line: 11, through: 'Invite' },
        { name: 'all', line: 11, through: '$request' },
        { name: 'Group', line: 12, through: null },
      ]),
    );
    expect(controller?.references.map(({ name }) => name)).not.toContain(
      'invite',
    );
    expect(symbolsOf(invite)).toEqual([
      ['Invite', 'class', 3],
      ['open', 'method', 5],
      ['invite', 'function', 7],
    ]);
    expect(
      routes?.symbols
        .filter((symbol) => symbol.kind === 'route')
        .map(({ name, line }) => [name, line]),
    ).toEqual([
      ['POST /invites', 2],
      ['GET /teams/{team}/runs', 3],
    ]);
    expect(routes?.routeUses).toEqual([
      { path: '/api/teams/:param/runs', line: 4 },
    ]);
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

  it('reads C# across the project', async () => {
    const [controller, store] = await indexed(
      source('src/Acme/Controllers/InviteController.cs', [
        'using Acme.Models;',
        'using Store = Acme.Data.InviteStore;',
        'namespace Acme.Controllers;',
        '[Route("api/[controller]s")]',
        'public class InviteController : ControllerBase',
        '{',
        '    public const int Limit = 3;',
        '    [HttpPost("{id}")]',
        '    public async Task<Invite> Create(int id, Store store)',
        '    {',
        '        await store.SaveAsync(Invite.Open(id));',
        '        return new Invite(Limit);',
        '    }',
        '    [HttpGet("~/health")]',
        '    public string Health() => "ok";',
        '}',
        'app.MapGet("/teams/{team}/runs", () => "ok");',
      ]),
      source('src/Acme/Data/InviteStore.cs', [
        'namespace Acme.Data;',
        'public record InviteStore(string Name)',
        '{',
        '    public Task SaveAsync(Invite invite) => Task.CompletedTask;',
        '}',
        'var url = $"/api/invites/{id}";',
      ]),
    );

    expect(symbolsOf(controller)).toEqual([
      ['InviteController', 'class', 5],
      ['Limit', 'constant', 7],
      ['Create', 'method', 9],
      ['POST /api/invites/{id}', 'route', 8],
      ['Health', 'method', 15],
      ['GET /health', 'route', 14],
      ['GET /teams/{team}/runs', 'route', 17],
    ]);
    expect(
      controller?.imports.map(({ local, imported, resolved }) => [
        local,
        imported,
        resolved,
      ]),
    ).toEqual([['Store', 'InviteStore', ['src/Acme/Data/InviteStore.cs']]]);
    expect(controller?.scope).toEqual([
      'src/Acme/Controllers/InviteController.cs',
      'src/Acme/Data/InviteStore.cs',
    ]);
    expect(controller?.references).toEqual(
      expect.arrayContaining([
        { name: 'SaveAsync', line: 11, through: 'store' },
        { name: 'Open', line: 11, through: 'Invite' },
        { name: 'Limit', line: 12, through: null },
      ]),
    );
    expect(symbolsOf(store)).toEqual([
      ['InviteStore', 'class', 2],
      ['SaveAsync', 'method', 4],
    ]);
    expect(store?.routeUses).toEqual([{ path: '/api/invites/{id}', line: 6 }]);
  });

  it('reads the scripts of Vue and Svelte components', async () => {
    const [page, card, labels] = await indexed(
      source('web/src/pages/Invites.vue', [
        '<template>',
        '  <div>',
        '  <InviteCard :invite="invite" /><router-link to="/" />',
        '</template>',
        '<script setup lang="ts">',
        "import InviteCard from '../components/InviteCard.svelte';",
        '</script>',
      ]),
      source('web/src/components/InviteCard.svelte', [
        '<script lang="ts">',
        "  import { label } from './labels';",
        '  export let invite;',
        '  function open() { return label(invite); }',
        '</script>',
        '<button on:click={open}>{invite.email}</button>',
        "<script>fetch('/api/invites');</script>",
      ]),
      source('web/src/components/labels.ts', [
        'export const label = (invite) => invite.email;',
      ]),
    );

    expect(symbolsOf(page)).toEqual([['Invites', 'component', 1]]);
    expect(page?.symbols[0]?.endLine).toBe(7);
    expect(page?.imports).toEqual([
      expect.objectContaining({
        local: 'InviteCard',
        imported: 'default',
        resolved: ['web/src/components/InviteCard.svelte'],
      }),
    ]);
    expect(page?.references).toEqual(
      expect.arrayContaining([
        { name: 'InviteCard', line: 3, through: null },
        { name: 'RouterLink', line: 3, through: null },
      ]),
    );
    expect(page?.references.map(({ name }) => name)).not.toContain('Template');
    expect(symbolsOf(card)).toEqual([
      ['InviteCard', 'component', 1],
      ['invite', 'constant', 3],
      ['open', 'function', 4],
    ]);
    expect(card?.symbols[0]?.exportedAs).toEqual(['default']);
    expect(card?.routeUses).toEqual([{ path: '/api/invites', line: 7 }]);
    expect(card?.imports[0]?.resolved).toEqual([
      'web/src/components/labels.ts',
    ]);
    expect(symbolsOf(labels)).toEqual([['label', 'constant', 1]]);
  });

  it('reads Terraform by module directory', async () => {
    const [main, outputs] = await indexed(
      source('infra/main.tf', [
        'variable "region" { default = "eu-west-1" }',
        // biome-ignore lint/suspicious/noTemplateCurlyInString: source code being read
        'locals { name = "logs-${var.region}" }',
        'resource "aws_s3_bucket" "logs" {',
        '  bucket = local.name',
        '  tags   = module.network.tags',
        '}',
        'data "aws_iam_policy" "read" { arn = aws_s3_bucket.logs[0].arn }',
        'module "network" {',
        '  source = "./network"',
        '  region = var.region',
        '}',
        'output "policy" { value = data.aws_iam_policy.read.policy }',
      ]),
      source('infra/network/outputs.tf', [
        'output "tags" { value = { team = each.key } }',
        'variable "region" {}',
      ]),
    );

    expect(symbolsOf(main)).toEqual([
      ['var.region', 'constant', 1],
      ['local.name', 'constant', 2],
      ['aws_s3_bucket.logs', 'constant', 3],
      ['data.aws_iam_policy.read', 'constant', 7],
      ['output.policy', 'constant', 12],
    ]);
    expect(main?.imports).toEqual([
      expect.objectContaining({
        local: 'module.network',
        specifier: './network',
        resolved: ['infra/network/outputs.tf'],
      }),
    ]);
    expect(main?.references).toEqual([
      { name: 'var.region', line: 2, through: null },
      { name: 'local.name', line: 4, through: null },
      { name: 'tags', line: 5, through: 'module.network' },
      { name: 'aws_s3_bucket.logs', line: 7, through: null },
      { name: 'region', line: 10, through: 'module.network' },
      { name: 'var.region', line: 10, through: null },
      { name: 'data.aws_iam_policy.read', line: 12, through: null },
    ]);
    expect(outputs?.symbols).toEqual([
      expect.objectContaining({ name: 'output.tags', exportedAs: ['tags'] }),
      expect.objectContaining({ name: 'var.region', exportedAs: ['region'] }),
    ]);
    expect(outputs?.references).toEqual([]);
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
