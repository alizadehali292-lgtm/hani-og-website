"use client";

/** Thin client for the public JSON API. Unwraps the {ok,data,error} envelope. */

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

async function unwrap<T>(res: Response): Promise<T> {
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new ApiError(res.status, "NETWORK", "Yhteysvirhe. Yritä uudelleen.");
  }
  const body = json as
    | { ok: true; data: T }
    | { ok: false; error: { code: string; message: string; details?: unknown } };
  if (!body || typeof body !== "object" || !("ok" in body)) {
    throw new ApiError(res.status, "UNKNOWN", "Odottamaton vastaus palvelimelta.");
  }
  if (!body.ok) {
    throw new ApiError(res.status, body.error.code, body.error.message, body.error.details);
  }
  return body.data;
}

export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, { signal, headers: { accept: "application/json" } });
  return unwrap<T>(res);
}

export async function apiSend<T>(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: { "content-type": "application/json", accept: "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return unwrap<T>(res);
}

// ── Response types ───────────────────────────────────────────────────────────
export type ApiService = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
  priceType: "FIXED" | "FROM" | "CONSULTATION";
};
export type ApiCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  services: ApiService[];
};
export type ApiStaff = {
  id: string;
  name: string;
  slug: string;
  title: string | null;
  bio: string | null;
  imageUrl: string | null;
  color: string;
};
export type ApiDayAvailability = {
  mode: "day";
  dateStr: string;
  isOpen: boolean;
  reason: string | null;
  times: { time: string; startUtc: string; staffIds: string[] }[];
};
export type ApiRangeAvailability = {
  mode: "range";
  dates: { dateStr: string; hasSlots: boolean; isOpen: boolean }[];
};
export type ApiBookingResult = {
  publicId: string;
  status: "PENDING" | "CONFIRMED";
  manageToken: string;
  manageUrl: string;
  startUtc: string;
  endUtc: string;
};
