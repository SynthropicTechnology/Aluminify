/**
 * Tests for structured logger utility
 * Validates JSON output format, log levels, and output channels
 */

describe("logger", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("logger.info outputs valid JSON to stdout with timestamp, level, context, message, and data fields", () => {
    const spy = jest.spyOn(console, "log").mockImplementation(() => {});

    const { logger } = require("@/app/shared/core/services/logger.service");

    logger.info("webhook", "Event received", { event_id: "evt_123" });

    expect(spy).toHaveBeenCalledTimes(1);

    const output = JSON.parse(spy.mock.calls[0][0]);
    expect(output.timestamp).toBeDefined();
    expect(() => new Date(output.timestamp).toISOString()).not.toThrow();
    expect(output.level).toBe("info");
    expect(output.context).toBe("webhook");
    expect(output.message).toBe("Event received");
    expect(output.data).toEqual({ event_id: "evt_123" });
  });

  it("logger.error outputs to stderr with level 'error'", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});

    const { logger } = require("@/app/shared/core/services/logger.service");

    logger.error("webhook", "Processing failed", { error: "timeout" });

    expect(spy).toHaveBeenCalledTimes(1);

    const output = JSON.parse(spy.mock.calls[0][0]);
    expect(output.level).toBe("error");
    expect(output.context).toBe("webhook");
    expect(output.message).toBe("Processing failed");
    expect(output.data).toEqual({ error: "timeout" });
  });

  it("logger.warn outputs with level 'warn'", () => {
    const spy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const { logger } = require("@/app/shared/core/services/logger.service");

    logger.warn("billing", "Rate limit approaching");

    expect(spy).toHaveBeenCalledTimes(1);

    const output = JSON.parse(spy.mock.calls[0][0]);
    expect(output.level).toBe("warn");
    expect(output.context).toBe("billing");
    expect(output.message).toBe("Rate limit approaching");
  });

  it("logger.debug outputs nothing when NODE_ENV !== 'development'", () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    jest.resetModules();
    const { logger } = require("@/app/shared/core/services/logger.service");

    logger.debug("webhook", "Debug info", { detail: "test" });

    expect(logSpy).not.toHaveBeenCalled();

    process.env.NODE_ENV = originalEnv;
  });

  it("logger.debug outputs JSON when NODE_ENV === 'development'", () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    jest.resetModules();
    const { logger } = require("@/app/shared/core/services/logger.service");

    logger.debug("webhook", "Debug info", { detail: "test" });

    expect(logSpy).toHaveBeenCalledTimes(1);

    const output = JSON.parse(logSpy.mock.calls[0][0]);
    expect(output.level).toBe("debug");
    expect(output.context).toBe("webhook");
    expect(output.message).toBe("Debug info");
    expect(output.data).toEqual({ detail: "test" });

    process.env.NODE_ENV = originalEnv;
  });

  it("when no data parameter is provided, the output JSON does NOT contain a 'data' field", () => {
    const spy = jest.spyOn(console, "log").mockImplementation(() => {});

    const { logger } = require("@/app/shared/core/services/logger.service");

    logger.info("webhook", "Simple message");

    expect(spy).toHaveBeenCalledTimes(1);

    const output = JSON.parse(spy.mock.calls[0][0]);
    expect(output.level).toBe("info");
    expect(output.context).toBe("webhook");
    expect(output.message).toBe("Simple message");
    expect(output).not.toHaveProperty("data");
  });
});
