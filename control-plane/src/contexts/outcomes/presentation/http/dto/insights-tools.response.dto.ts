import { ApiProperty } from '@nestjs/swagger';
import type {
  InsightsToolsDto,
  ServerReportDto,
  SkillReportDto,
  ToolRefusalsDto,
  TrendRuleDto,
} from '@outcomes/application/dto/insights-tools.dto';
import { SKILL_TRENDS } from '@outcomes/domain/services/skill-trend';
import type {
  SkillAtStation,
  SkillWeek,
} from '@outcomes/domain/services/tool-insights';
import { InsightsPeriodResponseDto } from '@outcomes/presentation/http/dto/insights-common.response.dto';

const TREND_DESCRIPTION =
  'spreading or fading where the share of runs that used it moved by the trend rule’s points between the latest weeks and the weeks before; steady where it moved less; none where either side had too few runs';

export class SkillWeekResponseDto {
  @ApiProperty({
    example: '2026-09-28',
    description: 'The Monday, UTC, the week starts on',
  })
  readonly week: string;

  @ApiProperty({ example: 14, description: 'Runs that ended that week' })
  readonly runs: number;

  @ApiProperty({ example: 9, description: 'Of those, the runs given it' })
  readonly given: number;

  @ApiProperty({ example: 6, description: 'Of those, the runs that read it' })
  readonly used: number;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 0.43,
    description:
      'The share of that week’s runs that read it; none where no run ended that week',
  })
  readonly usedShare: number | null;

  constructor(week: SkillWeek) {
    this.week = week.week;
    this.runs = week.runs;
    this.given = week.given;
    this.used = week.used;
    this.usedShare = week.usedShare;
  }
}

export class SkillAtStationResponseDto {
  @ApiProperty({ example: 'line_1' })
  readonly lineId: string;

  @ApiProperty({ example: 'station_1' })
  readonly stationId: string;

  @ApiProperty({ example: 30, description: 'Runs that ended there' })
  readonly runs: number;

  @ApiProperty({ example: 30 })
  readonly given: number;

  @ApiProperty({ example: 12 })
  readonly used: number;

  @ApiProperty({
    enum: [...SKILL_TRENDS, null],
    nullable: true,
    example: 'steady',
    description: TREND_DESCRIPTION,
  })
  readonly trend: SkillAtStation['trend'];

  constructor(station: SkillAtStation) {
    this.lineId = station.lineId;
    this.stationId = station.stationId;
    this.runs = station.runs;
    this.given = station.given;
    this.used = station.used;
    this.trend = station.trend;
  }
}

export class SkillReportResponseDto {
  @ApiProperty({ example: 'our-migrations' })
  readonly key: string;

  @ApiProperty({
    example: true,
    description: 'Whether the team’s configuration defines it',
  })
  readonly defined: boolean;

  @ApiProperty({
    example: 40,
    description: 'Runs in the period whose station config gave it',
  })
  readonly given: number;

  @ApiProperty({
    example: 22,
    description:
      'Runs in the period that read it: a tool call touched a file in its folder, or asked the harness for it by name',
  })
  readonly used: number;

  @ApiProperty({
    type: SkillWeekResponseDto,
    isArray: true,
    description: 'Every week of the period, oldest first',
  })
  readonly weeks: readonly SkillWeekResponseDto[];

  @ApiProperty({
    enum: [...SKILL_TRENDS, null],
    nullable: true,
    example: 'spreading',
    description: TREND_DESCRIPTION,
  })
  readonly trend: SkillReportDto['trend'];

  @ApiProperty({
    type: SkillAtStationResponseDto,
    isArray: true,
    description: 'Each station whose runs were given it or read it',
  })
  readonly stations: readonly SkillAtStationResponseDto[];

  constructor(skill: SkillReportDto) {
    this.key = skill.key;
    this.defined = skill.defined;
    this.given = skill.given;
    this.used = skill.used;
    this.weeks = skill.weeks.map((each) => new SkillWeekResponseDto(each));
    this.trend = skill.trend;
    this.stations = skill.stations.map(
      (each) => new SkillAtStationResponseDto(each),
    );
  }
}

export class ServerReportResponseDto {
  @ApiProperty({ example: 'linear' })
  readonly server: string;

  @ApiProperty({ example: 18, description: 'Runs that called it' })
  readonly runs: number;

  @ApiProperty({
    example: 72,
    description:
      'Calls to it across those runs, leaving out calls a person refused to approve',
  })
  readonly calls: number;

  @ApiProperty({ nullable: true, type: Number, example: 4 })
  readonly callsPerRun: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 420,
    description:
      'Median time a finished call took from when it started working, estimated from fixed latency buckets',
  })
  readonly p50Ms: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 2_100,
    description:
      'Time 95 in 100 finished calls took at most, estimated from fixed latency buckets',
  })
  readonly p95Ms: number | null;

  @ApiProperty({
    example: 3,
    description: 'Calls that failed, counting calls that never finished',
  })
  readonly failedCalls: number;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 0.04,
    description: 'Failed calls over calls, from 0 to 1',
  })
  readonly errorRate: number | null;

  @ApiProperty({
    example: 1,
    description:
      'Runs that failed where the run’s last call to this server failed',
  })
  readonly failingRuns: number;

  @ApiProperty({
    example: 2,
    description: 'Runs in which a person refused one of its tools',
  })
  readonly refused: number;

  constructor(server: ServerReportDto) {
    this.server = server.server;
    this.runs = server.runs;
    this.calls = server.calls;
    this.callsPerRun = server.callsPerRun;
    this.p50Ms = server.p50Ms;
    this.p95Ms = server.p95Ms;
    this.failedCalls = server.failedCalls;
    this.errorRate = server.errorRate;
    this.failingRuns = server.failingRuns;
    this.refused = server.refused;
  }
}

export class ToolRefusalsResponseDto {
  @ApiProperty({
    example: 'create_issue',
    description:
      'The tool’s own name, or what the harness asked to do where it names no tool',
  })
  readonly tool: string;

  @ApiProperty({ nullable: true, type: String, example: 'linear' })
  readonly server: string | null;

  @ApiProperty({
    example: 2,
    description: 'Runs in which a person refused this tool',
  })
  readonly refused: number;

  constructor(refusals: ToolRefusalsDto) {
    this.tool = refusals.tool;
    this.server = refusals.server;
    this.refused = refusals.refused;
  }
}

export class TrendRuleResponseDto {
  @ApiProperty({
    example: 2,
    description: 'How many of the latest weeks are weighed against the rest',
  })
  readonly recentWeeks: number;

  @ApiProperty({
    example: 5,
    description: 'The minimum number of runs each side needs for a trend',
  })
  readonly minRuns: number;

  @ApiProperty({
    example: 20,
    description:
      'How many points the share of runs that used a skill must move',
  })
  readonly shiftPoints: number;

  constructor(rule: TrendRuleDto) {
    this.recentWeeks = rule.recentWeeks;
    this.minRuns = rule.minRuns;
    this.shiftPoints = rule.shiftPoints;
  }
}

export class InsightsToolsResponseDto {
  @ApiProperty({ type: InsightsPeriodResponseDto })
  readonly period: InsightsPeriodResponseDto;

  @ApiProperty({
    type: String,
    isArray: true,
    example: ['2026-09-21', '2026-09-28'],
    description: 'The Mondays of every week the period touches, oldest first',
  })
  readonly weeks: readonly string[];

  @ApiProperty({ example: 120, description: 'Runs that ran in the period' })
  readonly runs: number;

  @ApiProperty({ type: TrendRuleResponseDto })
  readonly trendRule: TrendRuleResponseDto;

  @ApiProperty({
    type: SkillReportResponseDto,
    isArray: true,
    description:
      'Every skill a run in the period was given or read, the most used first',
  })
  readonly skills: readonly SkillReportResponseDto[];

  @ApiProperty({
    type: String,
    isArray: true,
    example: ['grafana-dashboards'],
    description:
      'Skills the team’s configuration defines that no run in the period read',
  })
  readonly unused: readonly string[];

  @ApiProperty({
    type: ServerReportResponseDto,
    isArray: true,
    description:
      'Every MCP server a run in the period called, the busiest first',
  })
  readonly servers: readonly ServerReportResponseDto[];

  @ApiProperty({
    type: ToolRefusalsResponseDto,
    isArray: true,
    description:
      'Each tool a person refused to approve for a run in the period, per server, the most refused first',
  })
  readonly refusals: readonly ToolRefusalsResponseDto[];

  constructor(tools: InsightsToolsDto) {
    this.period = new InsightsPeriodResponseDto(tools.period);
    this.weeks = [...tools.weeks];
    this.runs = tools.runs;
    this.trendRule = new TrendRuleResponseDto(tools.trendRule);
    this.skills = tools.skills.map((each) => new SkillReportResponseDto(each));
    this.unused = [...tools.unused];
    this.servers = tools.servers.map(
      (each) => new ServerReportResponseDto(each),
    );
    this.refusals = tools.refusals.map(
      (each) => new ToolRefusalsResponseDto(each),
    );
  }
}
