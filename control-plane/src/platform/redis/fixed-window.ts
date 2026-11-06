export interface ScriptRunner {
  eval(
    script: string,
    keys: number,
    ...args: (string | number)[]
  ): Promise<unknown>;
}

const CONSUME = `
local count = redis.call('incr', KEYS[1])
if count == 1 then redis.call('pexpire', KEYS[1], ARGV[1]) end
if count > tonumber(ARGV[2]) then
  redis.call('decr', KEYS[1])
  return math.max(redis.call('pttl', KEYS[1]), 1)
end
return -1`;

export const consumeFixedWindow = async (
  store: ScriptRunner,
  key: string,
  windowMs: number,
  max: number,
): Promise<number | null> => {
  const waitMs = Number(await store.eval(CONSUME, 1, key, windowMs, max));

  return waitMs < 0 ? null : waitMs;
};
