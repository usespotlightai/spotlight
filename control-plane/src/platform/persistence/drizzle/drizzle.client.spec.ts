import type { Env } from "@platform/config/env.schema";
import {
  createPool,
  createReadPool,
} from "@platform/persistence/drizzle/drizzle.client";
import { Pool } from "pg";
import type { LoggerPort } from "@shared-kernel/application/ports/logger.port";
import { afterEach, describe, expect, it, vi } from "vitest";

const env = {
  DATABASE_URL: "postgres://localhost/main",
  DATABASE_READ_URL: "postgres://localhost/read",
  DATABASE_POOL_MAX: 7,
  DATABASE_CONNECTION_TIMEOUT_MS: 1_234,
  DATABASE_IDLE_TIMEOUT_MS: 5_678,
} as Env;

const logger = { error: vi.fn() } as unknown as LoggerPort;

const pools: Pool[] = [];

afterEach(async () => {
  await Promise.all(pools.splice(0).map((pool) => pool.end()));
});

const optionsOf = (pool: Pool) => {
  pools.push(pool);
  return pool.options;
};

describe("database pools", () => {
  it("limits the main pool from the environment", () => {
    expect(optionsOf(createPool(env, logger))).toMatchObject({
      max: 7,
      connectionTimeoutMillis: 1_234,
      idleTimeoutMillis: 5_678,
    });
  });

  it("limits the read pool from the environment", () => {
    const main = createPool(env, logger);
    pools.push(main);

    expect(optionsOf(createReadPool(env, main, logger))).toMatchObject({
      connectionString: env.DATABASE_READ_URL,
      max: 7,
      connectionTimeoutMillis: 1_234,
      idleTimeoutMillis: 5_678,
    });
  });

  it("logs an idle client error instead of ending the process", () => {
    const error = new Error("terminated");
    const pool = createPool(env, logger);
    pools.push(pool);

    pool.emit("error", error);

    expect(logger.error).toHaveBeenCalledWith(
      { err: error },
      "Database pool error",
    );
  });
});
