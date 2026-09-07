import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { isBookingError } from "@/lib/booking/errors";

/** Consistent JSON envelope for all API responses. */
export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = { ok: false; error: { code: string; message: string; details?: unknown } };

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<ApiOk<T>>({ ok: true, data }, init);
}

export function fail(
  code: string,
  message: string,
  status = 400,
  details?: unknown,
) {
  return NextResponse.json<ApiErr>({ ok: false, error: { code, message, details } }, { status });
}

export class HttpError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isHttpError(e: unknown): e is HttpError {
  return e instanceof HttpError;
}

/** Map any thrown value to a safe API response (never leaks internals). */
export function toErrorResponse(e: unknown) {
  if (e instanceof HttpError) {
    return fail(e.code, e.message, e.status, e.details);
  }
  if (isBookingError(e)) {
    return fail(e.code, e.message, e.status, e.details);
  }
  if (e instanceof ZodError) {
    return fail("VALIDATION", "Tarkista lomakkeen tiedot.", 422, e.flatten());
  }
  console.error("Unhandled API error:", e);
  return fail("SERVER_ERROR", "Jotain meni pieleen. Yritä hetken kuluttua uudelleen.", 500);
}

/** Wrap a route handler so thrown HttpError/BookingError/ZodError become clean JSON. */
export function handler<Args extends unknown[]>(
  fn: (...args: Args) => Promise<Response>,
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      return toErrorResponse(e);
    }
  };
}
