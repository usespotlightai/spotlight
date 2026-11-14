import {
  connectionsExhausted,
  unavailabilityReason,
} from "@platform/persistence/drizzle/violations";
import { DrizzleQueryError } from "drizzle-orm";
import { describe, expect, it } from "vitest";

const pgError = (code: string): Error =>
  Object.assign(new Error("pg"), { code });

const queryError = (cause: Error): DrizzleQueryError =>
  new DrizzleQueryError("select 1", [], cause);

describe("connectionsExhausted", () => {
  it("stops on a cyclic cause chain", () => {
    const error: { cause?: unknown } = {};
    error.cause = error;

    expect(connectionsExhausted(error)).toBe(false);
  });

  it("finds a wrapped refusal", () => {
    expect(connectionsExhausted({ cause: { code: "53300" } })).toBe(true);
  });
});

describe("unavailabilityReason", () => {
  it.each([
    ["too many connections", "53300"],
    ["an admin shutdown", "57P01"],
    ["a connection failure", "08006"],
  ])("gives the SQLSTATE of %s", (_, code) => {
    expect(unavailabilityReason(queryError(pgError(code)))).toBe(code);
  });

  it.each([
    "Connection terminated unexpectedly",
    "Connection terminated due to connection timeout",
    "timeout exceeded when trying to connect",
  ])("gives the message of a dropped pool connection: %s", (message) => {
    expect(unavailabilityReason(queryError(new Error(message)))).toBe(message);
  });

  it("gives a network code under a failed query", () => {
    expect(unavailabilityReason(queryError(pgError("ECONNRESET")))).toBe(
      "ECONNRESET",
    );
  });

  it("ignores a network code outside a query", () => {
    expect(unavailabilityReason(pgError("ECONNRESET"))).toBeNull();
  });

  it.each(["23505", "08P01", "53200"])(
    "ignores %s, which the query itself can cause",
    (code) => {
      expect(unavailabilityReason(queryError(pgError(code)))).toBeNull();
    },
  );


  it("stops on a cyclic cause chain", () => {
    const error: { cause?: unknown } = {};
    error.cause = error;

    expect(unavailabilityReason(error)).toBeNull();
  });
});
