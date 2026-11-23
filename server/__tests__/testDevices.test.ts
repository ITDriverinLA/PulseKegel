import {
  ANALYTICS_TEST_DEVICE_IDS_ENV,
  collectTestDeviceIds,
  eventSignalsTestDevice,
  excludeTestDevices,
  isTestDevicePredicateSql,
  notTestDeviceSql,
  parseTestDeviceIds,
  resetTestDeviceIdWarningForTests,
  wantIncludeTest,
} from "../testDevices";

const hex = (ch: string) => ch.repeat(64);

describe("wantIncludeTest", () => {
  it("is false by default and for any value other than 1", () => {
    expect(wantIncludeTest(undefined)).toBe(false);
    expect(wantIncludeTest({})).toBe(false);
    expect(wantIncludeTest({ include_test: undefined })).toBe(false);
    expect(wantIncludeTest({ include_test: "true" })).toBe(false);
    expect(wantIncludeTest({ include_test: "yes" })).toBe(false);
    expect(wantIncludeTest({ include_test: "0" })).toBe(false);
    expect(wantIncludeTest({ include_test: 1 })).toBe(false);
    expect(wantIncludeTest({ include_test: ["true"] })).toBe(false);
  });

  it("is true only for include_test=1", () => {
    expect(wantIncludeTest({ include_test: "1" })).toBe(true);
    expect(wantIncludeTest({ include_test: ["1"] })).toBe(true);
  });
});

describe("parseTestDeviceIds", () => {
  beforeEach(() => {
    resetTestDeviceIdWarningForTests();
  });

  it("parses comma-separated 64-hex ids and trims whitespace", () => {
    const a = hex("a");
    const b = hex("b");
    expect(parseTestDeviceIds(` ${a}, ${b} ,${a} `)).toEqual([a, b]);
  });

  it("returns an empty list when the secret is empty or missing", () => {
    expect(parseTestDeviceIds(undefined)).toEqual([]);
    expect(parseTestDeviceIds(null)).toEqual([]);
    expect(parseTestDeviceIds("")).toEqual([]);
    expect(parseTestDeviceIds("   ")).toEqual([]);
  });

  it("ignores malformed ids and logs once without printing them", () => {
    const a = hex("a");
    const logs: string[] = [];
    const log = (message: string) => logs.push(message);

    expect(parseTestDeviceIds(`not-an-id,${a},123,ffff`, log)).toEqual([a]);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain(ANALYTICS_TEST_DEVICE_IDS_ENV);
    expect(logs[0]).toContain("ignored 3 malformed id(s)");
    expect(logs[0]).not.toContain(a);
    expect(logs[0]).not.toContain("not-an-id");
    expect(logs[0]).not.toContain("ffff");

    // Second parse with more junk must not log again.
    expect(parseTestDeviceIds("still-bad", log)).toEqual([]);
    expect(logs).toHaveLength(1);
  });
});

describe("eventSignalsTestDevice and collectTestDeviceIds", () => {
  const production = {
    deviceId: hex("1"),
    eventData: { buildEnv: "production" },
  };
  const simulator = {
    deviceId: hex("2"),
    eventData: { buildEnv: "simulator" },
  };
  const testflight = {
    deviceId: hex("3"),
    eventData: { buildEnv: "testflight" },
  };
  const xcode = { deviceId: hex("4"), eventData: { buildEnv: "xcode" } };
  const dev = { deviceId: hex("5"), eventData: { buildEnv: "dev" } };
  const expoGo = { deviceId: hex("6"), eventData: { buildEnv: "expo_go" } };
  const sandbox = { deviceId: hex("7"), eventData: { isSandbox: true } };
  const sandboxFalse = {
    deviceId: hex("8"),
    eventData: { isSandbox: false, buildEnv: "production" },
  };
  const envOnly = { deviceId: hex("9"), eventData: { result: "completed" } };

  it("flags each buildEnv rule and isSandbox, but not production", () => {
    expect(eventSignalsTestDevice(production.eventData)).toBe(false);
    expect(eventSignalsTestDevice(sandboxFalse.eventData)).toBe(false);
    expect(eventSignalsTestDevice(undefined)).toBe(false);
    expect(eventSignalsTestDevice(simulator.eventData)).toBe(true);
    expect(eventSignalsTestDevice(testflight.eventData)).toBe(true);
    expect(eventSignalsTestDevice(xcode.eventData)).toBe(true);
    expect(eventSignalsTestDevice(dev.eventData)).toBe(true);
    expect(eventSignalsTestDevice(expoGo.eventData)).toBe(true);
    expect(eventSignalsTestDevice(sandbox.eventData)).toBe(true);
  });

  it("collects devices from event signals and the env list", () => {
    const ids = collectTestDeviceIds(
      [production, simulator, sandbox, envOnly],
      [envOnly.deviceId, hex("f")],
    );
    expect(ids.has(production.deviceId)).toBe(false);
    expect(ids.has(simulator.deviceId)).toBe(true);
    expect(ids.has(sandbox.deviceId)).toBe(true);
    expect(ids.has(envOnly.deviceId)).toBe(true);
    expect(ids.has(hex("f"))).toBe(true);
  });

  it("one test event marks the device even if later events look production", () => {
    const deviceId = hex("c");
    const ids = collectTestDeviceIds([
      { deviceId, eventData: { buildEnv: "testflight" } },
      { deviceId, eventData: { buildEnv: "production" } },
    ]);
    expect(ids.has(deviceId)).toBe(true);
  });
});

describe("excludeTestDevices (summary/retention default)", () => {
  const real = {
    deviceId: hex("a"),
    eventType: "purchase_completed",
    eventData: { result: "completed" },
  };
  const testflight = {
    deviceId: hex("b"),
    eventType: "purchase_completed",
    eventData: { result: "completed", buildEnv: "testflight" },
  };
  const envListed = {
    deviceId: hex("c"),
    eventType: "purchase_completed",
    eventData: { result: "completed" },
  };
  const events = [real, testflight, envListed];
  const envIds = [envListed.deviceId];

  it("excludes test devices by default and reports how many were dropped", () => {
    const result = excludeTestDevices(events, { includeTest: false, envIds });
    expect(result.rows).toEqual([real]);
    expect(result.testDevicesExcluded).toBe(2);
  });

  it("includes them and reports testDevicesExcluded=0 when include_test=1", () => {
    const result = excludeTestDevices(events, { includeTest: true, envIds });
    expect(result.rows).toEqual(events);
    expect(result.testDevicesExcluded).toBe(0);
  });
});

function sqlText(value: unknown): string {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === "string" || typeof node === "number") {
      out.push(String(node));
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node && typeof node === "object") {
      const obj = node as { queryChunks?: unknown; value?: unknown };
      if (obj.queryChunks) walk(obj.queryChunks);
      else if ("value" in obj) walk(obj.value);
    }
  };
  walk(value);
  return out.join("");
}

describe("SQL helpers", () => {
  it("notTestDeviceSql is TRUE when include_test is on", () => {
    const fragment = notTestDeviceSql("device_id", true);
    expect(JSON.stringify(fragment)).toContain("TRUE");
  });

  it("predicate mentions buildEnv, isSandbox, and parameterized env ids", () => {
    const id = hex("d");
    const predicate = isTestDevicePredicateSql([id]);
    const encoded = sqlText(predicate);
    expect(encoded).toContain("buildEnv");
    expect(encoded).toContain("isSandbox");
    expect(encoded).toContain("simulator");
    expect(encoded).toContain("testflight");
    expect(encoded).toContain("xcode");
    expect(encoded).toContain("expo_go");
    // The id is passed as a bound parameter, not dropped.
    expect(encoded).toContain(id);
  });
});
