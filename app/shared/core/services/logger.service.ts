/**
 * Structured Logger Service
 *
 * Lightweight JSON logger wrapping console.log/console.error with structured output.
 * Replaces raw console.log throughout webhook handler and billing routes.
 *
 * Decision D-01/D-02: Zero new dependencies, simple utility wrapping console.
 */

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  data?: Record<string, unknown>;
}

function formatEntry(
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
    ...(data ? { data } : {}),
  };
}

export const logger = {
  info(context: string, message: string, data?: Record<string, unknown>): void {
    const entry = formatEntry("info", context, message, data);
    console.log(JSON.stringify(entry));
  },

  warn(context: string, message: string, data?: Record<string, unknown>): void {
    const entry = formatEntry("warn", context, message, data);
    console.warn(JSON.stringify(entry));
  },

  error(context: string, message: string, data?: Record<string, unknown>): void {
    const entry = formatEntry("error", context, message, data);
    console.error(JSON.stringify(entry));
  },

  debug(context: string, message: string, data?: Record<string, unknown>): void {
    if (process.env.NODE_ENV === "development") {
      const entry = formatEntry("debug", context, message, data);
      console.debug(JSON.stringify(entry));
    }
  },
};
