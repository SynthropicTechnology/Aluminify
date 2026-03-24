/**
 * Structured Logger Service
 *
 * Lightweight JSON structured logger for stdout (D-01/D-02).
 * Wraps console.log/console.error with structured JSON output
 * (timestamp, level, context, message).
 *
 * Not a full logging framework -- just a simple utility.
 */

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  data?: Record<string, unknown>;
}

function createLogEntry(
  level: LogLevel,
  context: string,
  message: string,
  data?: Record<string, unknown>,
): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    context,
    message,
    ...(data !== undefined ? { data } : {}),
  };
}

function log(
  level: LogLevel,
  context: string,
  message: string,
  data?: Record<string, unknown>,
): void {
  const entry = createLogEntry(level, context, message, data);
  const output = JSON.stringify(entry);

  switch (level) {
    case "error":
      console.error(output);
      break;
    case "warn":
      console.warn(output);
      break;
    case "debug":
      if (process.env.NODE_ENV === "development") {
        console.debug(output);
      }
      break;
    default:
      console.log(output);
  }
}

export const logger = {
  info(context: string, message: string, data?: Record<string, unknown>): void {
    log("info", context, message, data);
  },
  warn(context: string, message: string, data?: Record<string, unknown>): void {
    log("warn", context, message, data);
  },
  error(context: string, message: string, data?: Record<string, unknown>): void {
    log("error", context, message, data);
  },
  debug(context: string, message: string, data?: Record<string, unknown>): void {
    log("debug", context, message, data);
  },
};
