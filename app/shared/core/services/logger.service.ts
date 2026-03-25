/**
<<<<<<< HEAD
 * Structured Logger Service
 *
 * Lightweight JSON logger wrapping console.log/console.error with structured output.
 * Replaces raw console.log throughout webhook handler and billing routes.
 *
 * Decision D-01/D-02: Zero new dependencies, simple utility wrapping console.
=======
 * Structured JSON logger utility
 *
 * Wraps console.log/console.warn/console.error with structured JSON output.
 * Replaces raw console.log statements across billing routes (STRP-05).
 *
 * Output format: { timestamp, level, context, message, data? }
 * - info/debug -> console.log (stdout)
 * - warn -> console.warn (stderr)
 * - error -> console.error (stderr)
 * - debug -> only outputs when NODE_ENV === "development"
 *
 * Zero new dependencies. ~30 lines.
>>>>>>> c2b85828f307c32c7d73093a83914d83564c13bf
 */

type LogLevel = "info" | "warn" | "error" | "debug";

<<<<<<< HEAD
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  data?: Record<string, unknown>;
}

function formatEntry(
=======
function formatLog(
>>>>>>> c2b85828f307c32c7d73093a83914d83564c13bf
  level: LogLevel,
  context: string,
  message: string,
  data?: Record<string, unknown>,
<<<<<<< HEAD
): LogEntry {
=======
): Record<string, unknown> {
>>>>>>> c2b85828f307c32c7d73093a83914d83564c13bf
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
<<<<<<< HEAD
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
=======
    console.log(JSON.stringify(formatLog("info", context, message, data)));
  },

  warn(context: string, message: string, data?: Record<string, unknown>): void {
    console.warn(JSON.stringify(formatLog("warn", context, message, data)));
  },

  error(context: string, message: string, data?: Record<string, unknown>): void {
    console.error(JSON.stringify(formatLog("error", context, message, data)));
  },

  debug(context: string, message: string, data?: Record<string, unknown>): void {
    if (process.env.NODE_ENV !== "development") return;
    console.log(JSON.stringify(formatLog("debug", context, message, data)));
>>>>>>> c2b85828f307c32c7d73093a83914d83564c13bf
  },
};
