import type {
  HarnessProfileResourceDto,
  McpServerDto,
} from '@configuration/application/dto/harness-profile-resource.dto';
import { ApiProperty } from '@nestjs/swagger';
import { ResourceResponseDto } from '@platform/http/dto/resource.response.dto';

export const MCP_SERVER_ENV =
  'Environment for the server. A value is plain text, stored and shown as written, or a reference to a workspace secret, as in secret.LINEAR_API_KEY: the reference must name a secret the workspace has, and the server gets only a stand-in, since egress injects the value into its requests to the hosts the secret is bound to.';

class PermissionsResponseDto {
  @ApiProperty({
    type: String,
    isArray: true,
    example: ['read', 'edit', 'execute(npm test *)'],
    description:
      'What the harness may do without asking: read, edit or execute, alone or with a pattern',
  })
  readonly allow: readonly string[];

  @ApiProperty({
    type: String,
    isArray: true,
    example: ['execute(git push *)'],
    description:
      'What the harness asks a person about first; the ask goes to their inbox as an approval',
  })
  readonly ask: readonly string[];

  @ApiProperty({
    type: String,
    isArray: true,
    example: ['read(.env)', 'execute(rm -rf *)'],
    description: 'What the harness may never do',
  })
  readonly deny: readonly string[];

  constructor(permissions: HarnessProfileResourceDto['permissions']) {
    this.allow = permissions.allow;
    this.ask = permissions.ask;
    this.deny = permissions.deny;
  }
}

class McpServerResponseDto {
  @ApiProperty({ example: 'linear' })
  readonly name: string;

  @ApiProperty({ example: 'npx' })
  readonly command: string;

  @ApiProperty({
    type: String,
    isArray: true,
    example: ['-y', '@linear/mcp-server'],
  })
  readonly args: readonly string[];

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { LINEAR_TEAM: 'core' },
    description: MCP_SERVER_ENV,
  })
  readonly env: Readonly<Record<string, string>>;

  constructor(server: McpServerDto) {
    this.name = server.name;
    this.command = server.command;
    this.args = server.args;
    this.env = server.env;
  }
}

export class HarnessProfileResourceResponseDto extends ResourceResponseDto {
  @ApiProperty({
    example: '9c2e6d5a-1f47-4c8b-9a3d-2b7e5f0c1d84',
    description: 'The team it belongs to',
  })
  readonly teamId: string;

  @ApiProperty({
    example: 'careful',
    description:
      'What stations name it by. Immutable: changing it means replacing the profile',
  })
  readonly key: string;

  @ApiProperty({
    type: PermissionsResponseDto,
    description:
      'Coarse rules every harness is told in its own terms; where one cannot say a rule, warnings name the approximation',
  })
  readonly permissions: PermissionsResponseDto;

  @ApiProperty({
    type: McpServerResponseDto,
    isArray: true,
    description: 'Stdio MCP servers, handed to each harness in its own format',
  })
  readonly mcpServers: readonly McpServerResponseDto[];

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: {
      'claude-code': { includeCoAuthoredBy: false },
      codex: 'model_verbosity = "low"\n',
      cursor: { editor: { vimMode: true } },
    },
    description:
      'Each harness’s own settings, passed through as it reads them: Claude Code settings JSON, Codex config.toml text, Cursor CLI config JSON',
  })
  readonly native: Readonly<Record<string, unknown>>;

  constructor(profile: HarnessProfileResourceDto) {
    super(profile);
    this.teamId = profile.teamId;
    this.key = profile.key;
    this.permissions = new PermissionsResponseDto(profile.permissions);
    this.mcpServers = profile.mcpServers.map(
      (each) => new McpServerResponseDto(each),
    );
    this.native = profile.native;
  }
}
