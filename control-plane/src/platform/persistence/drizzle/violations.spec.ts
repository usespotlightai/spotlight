import { connectionsExhausted } from "@platform/persistence/drizzle/violations";
import { describe, expect, it } from "vitest";

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
