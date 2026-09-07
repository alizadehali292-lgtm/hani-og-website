import { describe, expect, it } from "vitest";
import { resolveStep, STEP_ORDER } from "@/app/(site)/ajanvaraus/booking-flow";

/**
 * The booking flow keeps its selection in the querystring so a refresh or the
 * browser Back button preserves progress. That makes the step attacker- and
 * accident-editable, so `resolveStep` must never return a step the data can't
 * render — otherwise the customer lands on a blank half-built screen.
 */

const base = {
  requested: null as string | null,
  hasServiceId: false,
  servicePending: false,
  serviceMissing: false,
  hasDate: false,
  hasTime: false,
  hasCustomer: true,
};

describe("resolveStep", () => {
  it("starts at service selection with an empty URL", () => {
    expect(resolveStep(base)).toBe("service");
  });

  it("ignores a step that is not a real step", () => {
    expect(resolveStep({ ...base, requested: "../../etc/passwd" })).toBe("service");
    expect(resolveStep({ ...base, requested: "confirm!" })).toBe("service");
  });

  it("deep link ?service=<id> with no step lands on staff selection", () => {
    expect(resolveStep({ ...base, hasServiceId: true })).toBe("staff");
  });

  it("forces service selection whenever no service is chosen", () => {
    for (const step of STEP_ORDER) {
      expect(resolveStep({ ...base, requested: step })).toBe("service");
    }
  });

  it("falls back to service selection when the service no longer exists", () => {
    expect(
      resolveStep({
        ...base,
        requested: "confirm",
        hasServiceId: true,
        serviceMissing: true,
        hasDate: true,
        hasTime: true,
      }),
    ).toBe("service");
  });

  it("holds the requested step while the catalogue is still loading", () => {
    // Downgrading here would bounce a refreshing customer back a step for the
    // split second before /api/services resolves.
    expect(
      resolveStep({
        ...base,
        requested: "time",
        hasServiceId: true,
        servicePending: true,
        hasDate: true,
      }),
    ).toBe("time");
  });

  it("cannot reach time, details or confirm without a date", () => {
    for (const step of ["time", "details", "confirm"]) {
      expect(resolveStep({ ...base, requested: step, hasServiceId: true })).toBe("date");
    }
  });

  it("cannot reach details or confirm without a time", () => {
    for (const step of ["details", "confirm"]) {
      expect(
        resolveStep({ ...base, requested: step, hasServiceId: true, hasDate: true }),
      ).toBe("time");
    }
  });

  it("sends a resumed link with no contact details back to the details step", () => {
    // Contact details are intentionally not in the URL, so a shared/refreshed
    // confirm link arrives without them; confirming would fail validation.
    expect(
      resolveStep({
        ...base,
        requested: "confirm",
        hasServiceId: true,
        hasDate: true,
        hasTime: true,
        hasCustomer: false,
      }),
    ).toBe("details");
  });

  it("allows a fully-specified selection through to confirm", () => {
    expect(
      resolveStep({
        ...base,
        requested: "confirm",
        hasServiceId: true,
        hasDate: true,
        hasTime: true,
      }),
    ).toBe("confirm");
  });

  it("never returns a step outside the known order", () => {
    const inputs = [null, "service", "staff", "date", "time", "details", "confirm", "junk"];
    for (const requested of inputs) {
      for (const hasServiceId of [true, false]) {
        for (const hasDate of [true, false]) {
          for (const hasTime of [true, false]) {
            for (const hasCustomer of [true, false]) {
              const out = resolveStep({
                ...base,
                requested,
                hasServiceId,
                hasDate,
                hasTime,
                hasCustomer,
              });
              expect(STEP_ORDER).toContain(out);
            }
          }
        }
      }
    }
  });
});
