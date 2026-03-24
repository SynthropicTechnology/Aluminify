/**
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
 */

type LogLevel = "info" | "warn" | "error" | "debug";

function formatLog(
  level: LogLevel,
  context: string,
  message: string,
  data?: Record<string, unknown>,
): Record<string, unknown> {
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
  },
};
