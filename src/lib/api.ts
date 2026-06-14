/** Consistent JSON envelope for all API responses. */
import { NextResponse } from "next/server";

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export function ok<T>(data: T): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ success: true, data });
}

export function fail(
  error: unknown,
  status = 500,
): NextResponse<ApiResponse<never>> {
  const message =
    error instanceof Error ? error.message : String(error ?? "Unknown error");
  return NextResponse.json({ success: false, error: message }, { status });
}
