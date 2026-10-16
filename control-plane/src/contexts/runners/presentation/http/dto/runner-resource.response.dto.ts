import { ApiProperty } from '@nestjs/swagger';
import { ResourceResponseDto } from '@platform/http/dto/resource.response.dto';
import type {
  EgressResourceDto,
  RunnerPoolResourceDto,
  RunnerTrustResourceDto,
  WorkspaceRunnersResourceDto,
} from '@runners/application/dto/runner-resource.dto';

const WORKSPACE_ID = {
  example: '5b1e9d2c-7a43-4f8e-b6c0-3d9a8e1f2b57',
  description: 'The workspace it belongs to',
};

const LABELS = {
  type: String,
  isArray: true,
  example: ['vpc-internal'],
  description:
    'What a line or station may name in runners to place its work here',
};

export class RunnerTrustResourceResponseDto extends ResourceResponseDto {
  @ApiProperty(WORKSPACE_ID)
  readonly workspaceId: string;

  @ApiProperty({
    example: 'production-cluster',
    description: 'Names the trust; fixed for its life',
  })
  readonly key: string;

  @ApiProperty({
    example: 'https://oidc.eks.eu-west-1.amazonaws.com/id/EXAMPLE',
    description:
      'The issuer of the tokens the platform gives its workloads; its keys are found through OIDC discovery',
  })
  readonly issuer: string;

  @ApiProperty({
    example: 'system:serviceaccount:spotlight:runner',
    description: 'The workload a token must be issued to, exactly',
  })
  readonly subject: string;

  @ApiProperty({
    example: 'spotlight',
    description: 'The audience a token must be issued for',
  })
  readonly audience: string;

  @ApiProperty(LABELS)
  readonly labels: readonly string[];

  constructor(trust: RunnerTrustResourceDto) {
    super(trust);
    this.workspaceId = trust.workspaceId;
    this.key = trust.key;
    this.issuer = trust.issuer;
    this.subject = trust.subject;
    this.audience = trust.audience;
    this.labels = trust.labels;
  }
}

export class PoolProvisionResponseDto {
  @ApiProperty({
    example: 'https://provision.example.com/runs',
    description:
      'Called with every run the pool is to serve, signed as Standard Webhooks sign',
  })
  readonly url: string;

  @ApiProperty({
    type: 'integer',
    nullable: true,
    example: 1,
    description:
      'Changed to rotate provision.secret, which is write-only and never answered',
  })
  readonly secretVersion: number | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'spotlight',
    description:
      'The egress the pool’s runners send their traffic through: spotlight for the platform egress, the id of an egress in the workspace, or null for none',
  })
  readonly egress: string | null;

  @ApiProperty({
    enum: ['all', 'bound'],
    example: 'all',
    description:
      'Which traffic of a run goes through the egress: all, or only the traffic to bound hosts. all when the pool names no egress',
  })
  readonly egressTraffic: 'all' | 'bound';

  constructor(
    url: string,
    secretVersion: number | null,
    egress: string | null,
    egressTraffic: 'all' | 'bound',
  ) {
    this.url = url;
    this.secretVersion = secretVersion;
    this.egress = egress;
    this.egressTraffic = egressTraffic;
  }
}

export class RunnerPoolResourceResponseDto extends ResourceResponseDto {
  @ApiProperty(WORKSPACE_ID)
  readonly workspaceId: string;

  @ApiProperty({
    example: 'ephemeral',
    description: 'Names the pool, and is its address; fixed for its life',
  })
  readonly key: string;

  @ApiProperty(LABELS)
  readonly labels: readonly string[];

  @ApiProperty({
    type: 'integer',
    nullable: true,
    example: 8,
    description: 'The most runs the pool serves at once, or null for no limit',
  })
  readonly maxRuns: number | null;

  @ApiProperty({
    enum: ['pull', 'push'],
    example: 'pull',
    description:
      'pull when hosts claim with the pool token, push when Spotlight calls provision; fixed for its life, and not settable',
  })
  readonly mode: 'pull' | 'push';

  @ApiProperty({
    type: 'integer',
    nullable: true,
    example: 1,
    description:
      'Changed, with a new token, to rotate the pool token of a pull pool, which is write-only and never answered',
  })
  readonly tokenVersion: number | null;

  @ApiProperty({
    type: PoolProvisionResponseDto,
    nullable: true,
    description: 'How Spotlight starts a runner for each run, for a push pool',
  })
  readonly provision: PoolProvisionResponseDto | null;

  constructor(pool: RunnerPoolResourceDto) {
    super(pool);
    this.workspaceId = pool.workspaceId;
    this.key = pool.key;
    this.labels = pool.labels;
    this.maxRuns = pool.maxRuns;
    this.mode = pool.mode;
    this.tokenVersion = pool.tokenVersion;
    this.provision = pool.provision
      ? new PoolProvisionResponseDto(
          pool.provision.url,
          pool.provision.secretVersion,
          pool.provision.egress,
          pool.provision.egressTraffic,
        )
      : null;
  }
}

export class WorkspaceRunnersResourceResponseDto extends ResourceResponseDto {
  @ApiProperty(WORKSPACE_ID)
  readonly workspaceId: string;

  @ApiProperty({
    type: String,
    isArray: true,
    example: ['production-cluster'],
    description: 'The runner trusts, by key, the workspace lets work through',
  })
  readonly trusts: readonly string[];

  @ApiProperty({
    type: String,
    isArray: true,
    example: ['ephemeral'],
    description: 'The runner pools, by key, the workspace lets work through',
  })
  readonly pools: readonly string[];

  constructor(declared: WorkspaceRunnersResourceDto) {
    super(declared);
    this.workspaceId = declared.workspaceId;
    this.trusts = declared.trusts;
    this.pools = declared.pools;
  }
}

export class EgressResourceResponseDto extends ResourceResponseDto {
  @ApiProperty(WORKSPACE_ID)
  readonly workspaceId: string;

  @ApiProperty({
    example: 'shared',
    description: 'Names the egress, and is its address; fixed for its life',
  })
  readonly key: string;

  @ApiProperty({
    example: 'https://egress.example.com',
    description:
      'Where the runners of a pool that names this egress send their traffic',
  })
  readonly url: string;

  @ApiProperty({
    type: 'integer',
    nullable: true,
    example: 1,
    description:
      'Changed, with a new token, to rotate the egress token, which is write-only and never answered',
  })
  readonly tokenVersion: number | null;

  constructor(egress: EgressResourceDto) {
    super(egress);
    this.workspaceId = egress.workspaceId;
    this.key = egress.key;
    this.url = egress.url;
    this.tokenVersion = egress.tokenVersion;
  }
}
