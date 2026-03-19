import { NextResponse } from "next/server";
import { getEmailRuntimeStatus } from "@/app/shared/core/email";

/**
 * Health check endpoint for Docker and monitoring systems
 * Returns 200 OK if the application is running
 */
export async function GET() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const headerSizeWarnings = (globalThis as any).__headerSizeWarnings ?? 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const headerSizeTotalBytes = (globalThis as any).__headerSizeTotalBytes ?? 0;
    const email = getEmailRuntimeStatus();

    // Basic health check - application is running
    const health = {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      metrics: {
        headerSizeWarnings,
        headerSizeTotalBytes,
      },
      integrations: {
        email,
      },
    };

    return NextResponse.json(health, { status: 200 });
  } catch (error) {
    // If there's any error, return 503 Service Unavailable
    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 },
    );
  }
}
