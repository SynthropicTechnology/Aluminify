/**
<<<<<<< HEAD
 * Structured Logger Service
 *
 * Lightweight JSON structured logger for stdout (D-01/D-02).
 * Wraps console.log/console.error with structured JSON output
 * (timestamp, level, context, message).
 *
 * Not a full logging framework -- just a simple utility.
=======
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
>>>>>>> 249b25702a9c6d93e5d63cdb791da445510067d1
 */

type LogLevel = "info" | "warn" | "error" | "debug";

<<<<<<< HEAD
=======
<<<<<<< HEAD
>>>>>>> 249b25702a9c6d93e5d63cdb791da445510067d1
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  data?: Record<string, unknown>;
}

<<<<<<< HEAD
function createLogEntry(
=======
function formatEntry(
=======
function formatLog(
>>>>>>> c2b85828f307c32c7d73093a83914d83564c13bf
>>>>>>> 249b25702a9c6d93e5d63cdb791da445510067d1
  level: LogLevel,
  context: string,
  message: string,
  data?: Record<string, unknown>,
<<<<<<< HEAD
): LogEntry {
=======
<<<<<<< HEAD
): LogEntry {
=======
): Record<string, unknown> {
>>>>>>> c2b85828f307c32c7d73093a83914d83564c13bf
>>>>>>> 249b25702a9c6d93e5d63cdb791da445510067d1
  return {
    timestamp: new Date().toISOString(),
    level,
    context,
    message,
<<<<<<< HEAD
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
=======
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
>>>>>>> 249b25702a9c6d93e5d63cdb791da445510067d1
  },
};
