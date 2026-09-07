"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import {
  apiGet,
  apiSend,
  ApiError,
  type ApiCategory,
  type ApiStaff,
  type ApiDayAvailability,
  type ApiRangeAvailability,
  type ApiBookingResult,
  type ApiService,
} from "@/lib/api-client";
import {
  salonToday,
  addDaysStr,
  mondayIndex,
  daysInMonth,
  monthLabelFi,
  longDateFi,
  parseDateStr,
  WEEKDAY_HEADERS_FI,
} from "@/lib/dates-client";
import { formatPrice, formatDuration, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { StaffAvatar } from "@/components/site/staff-avatar";

export type Step = "service" | "staff" | "date" | "time" | "details" | "confirm";
export const STEP_ORDER: Step[] = [
  "service",
  "staff",
  "date",
  "time",
  "details",
  "confirm",
];

/**
 * Clamp a requested step to what the current selection can actually support.
 *
 * The querystring is user-editable and can be stale (a bookmarked link whose
 * service was since deleted, a hand-typed `?step=confirm`), so the step is
 * always derived rather than trusted. Pure and exported so it can be tested
 * without mounting the flow.
 */
export function resolveStep(input: {
  requested: string | null;
  hasServiceId: boolean;
  servicePending: boolean;
  serviceMissing: boolean;
  hasDate: boolean;
  hasTime: boolean;
  hasCustomer: boolean;
}): Step {
  const {
    requested,
    hasServiceId,
    servicePending,
    serviceMissing,
    hasDate,
    hasTime,
    hasCustomer,
  } = input;
  const wanted: Step | null =
    requested && (STEP_ORDER as string[]).includes(requested)
      ? (requested as Step)
      : null;
  // Deep link `/ajanvaraus?service=<id>` with no step lands on staff selection.
  const target = wanted ?? (hasServiceId ? "staff" : "service");
  if (!hasServiceId) return "service";
  if (servicePending) return target; // don't downgrade while the catalogue loads
  if (serviceMissing) return "service";
  if ((target === "time" || target === "details" || target === "confirm") && !hasDate) {
    return "date";
  }
  if ((target === "details" || target === "confirm") && !hasTime) return "time";
  // Contact details live in memory only, so a resumed URL arrives without them.
  // Confirming would fail server validation, so send the customer to fill them in.
  if (target === "confirm" && !hasCustomer) return "details";
  return target;
}

const STEP_LABELS: Record<Step, string> = {
  service: "Palvelu",
  staff: "Tekijä",
  date: "Päivä",
  time: "Aika",
  details: "Tiedot",
  confirm: "Vahvistus",
};

const ANY = "any";
const RANGE_DAYS = 62;

type Customer = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

type Policy = { currency: string; locale: string; cancellationPolicyText: string };

export function BookingFlow({ policy }: { policy: Policy }) {
  const router = useRouter();
  const params = useSearchParams();

  const [staffList, setStaffList] = useState<ApiStaff[]>([]);
  const [customer, setCustomer] = useState<Customer>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // `attempt` stamps the result so a retry (or a dep change) shows the spinner
  // again without a setState in the effect body.
  const [catalogRes, setCatalogRes] = useState<{
    attempt: number;
    data: ApiCategory[] | null;
  } | null>(null);
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    apiGet<ApiCategory[]>("/api/services")
      .then((cats) => live && setCatalogRes({ attempt: catalogAttempt, data: cats }))
      .catch(() => live && setCatalogRes({ attempt: catalogAttempt, data: null }));
    return () => {
      live = false;
    };
  }, [catalogAttempt]);

  const catalogCurrent = catalogRes?.attempt === catalogAttempt ? catalogRes : null;
  const catalog = catalogCurrent?.data ?? null;
  const catalogError = catalogCurrent !== null && catalogCurrent.data === null;

  const staffById = useMemo(
    () => Object.fromEntries(staffList.map((s) => [s.id, s])),
    [staffList],
  );

  // ── The querystring is the source of truth for the selection ───────────────
  // Keeping step/service/staff/date/time in the URL means a refresh, a shared
  // link or the browser Back button preserves the customer's progress instead of
  // dumping them back to step 1. Personal details (name, email, phone, note) are
  // deliberately NOT in the URL — they would leak into history, server logs and
  // Referer headers. Losing those on a hard refresh is the correct trade.
  const serviceId = params.get("service");
  const staffId = params.get("staff") || ANY;
  const date = params.get("date");
  const time = params.get("time");

  const service = useMemo(
    () => catalog?.flatMap((c) => c.services).find((s) => s.id === serviceId) ?? null,
    [catalog, serviceId],
  );

  const customerComplete = Boolean(
    customer.firstName.trim() &&
      customer.lastName.trim() &&
      customer.email.trim() &&
      customer.phone.trim(),
  );

  // Resolve the chosen stylist's name for the confirm summary.
  //
  // StaffStep also loads this list, but it only mounts when the customer walks
  // through that step. Since the flow can now resume at any step from the URL,
  // the summary would otherwise fall back to "kuka tahansa" and mislabel a
  // specific stylist on a refreshed or shared link.
  useEffect(() => {
    if (!serviceId) return;
    let live = true;
    apiGet<ApiStaff[]>(`/api/staff?serviceId=${encodeURIComponent(serviceId)}`)
      .then((list) => live && setStaffList(list))
      .catch(() => {
        /* summary falls back to the generic label; the step itself reports errors */
      });
    return () => {
      live = false;
    };
  }, [serviceId]);
  // A serviceId we can't resolve yet: still loading vs. genuinely gone.
  const servicePending = Boolean(serviceId) && catalog === null && !catalogError;
  const serviceMissing = Boolean(serviceId) && catalog !== null && service === null;

  const step: Step = useMemo(
    () =>
      resolveStep({
        requested: params.get("step"),
        hasServiceId: Boolean(serviceId),
        servicePending,
        serviceMissing,
        hasDate: Boolean(date),
        hasTime: Boolean(time),
        hasCustomer: customerComplete,
      }),
    [params, serviceId, servicePending, serviceMissing, date, time, customerComplete],
  );

  const stepIndex = STEP_ORDER.indexOf(step);

  type Selection = {
    step: Step;
    service?: string | null;
    staff?: string | null;
    date?: string | null;
    time?: string | null;
  };

  const push = useCallback(
    (next: Selection) => {
      const q = new URLSearchParams();
      const svc = next.service === undefined ? serviceId : next.service;
      const stf = next.staff === undefined ? staffId : next.staff;
      const d = next.date === undefined ? date : next.date;
      const t = next.time === undefined ? time : next.time;
      if (svc) q.set("service", svc);
      if (stf && stf !== ANY) q.set("staff", stf);
      if (d) q.set("date", d);
      if (t) q.set("time", t);
      q.set("step", next.step);
      setError(null);
      router.push(`/ajanvaraus?${q.toString()}`, { scroll: false });
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [router, serviceId, staffId, date, time],
  );

  const goto = useCallback((s: Step) => push({ step: s }), [push]);

  const reset = () =>
    push({ step: "service", service: null, staff: null, date: null, time: null });

  return (
    <div className="mx-auto max-w-2xl px-5 pb-28 pt-10 sm:px-8 sm:pb-16">
      <Progress step={step} stepIndex={stepIndex} onJump={goto} canJumpTo={{ service, staffId, date, time }} />

      {error && (
        <Alert tone="danger" className="mt-4">
          {error}
        </Alert>
      )}

      {serviceMissing && (
        <Alert tone="warning" className="mt-4">
          Valittua palvelua ei enää löydy. Valitse palvelu uudelleen.
        </Alert>
      )}

      {/* Restoring a shared or refreshed URL: the selected service is only known
          once the catalogue arrives, so hold the step until then. */}
      {servicePending && step !== "service" ? (
        <div className="mt-6 space-y-2" aria-busy="true">
          <p className="text-sm text-ink-faint">Ladataan varausta…</p>
          <div className="h-12 animate-pulse rounded-sm bg-paper-3" />
          <div className="h-12 animate-pulse rounded-sm bg-paper-3" />
          <div className="h-12 animate-pulse rounded-sm bg-paper-3" />
        </div>
      ) : (
      <div className="mt-6">
        {step === "service" && (
          <ServiceStep
            catalog={catalog}
            failed={catalogError}
            onRetry={() => setCatalogAttempt((n) => n + 1)}
            selectedId={service?.id ?? null}
            currency={policy.currency}
            locale={policy.locale}
            onPick={(s) =>
              push({ step: "staff", service: s.id, staff: null, date: null, time: null })
            }
          />
        )}

        {step === "staff" && service && (
          <StaffStep
            serviceId={service.id}
            value={staffId}
            onLoaded={setStaffList}
            onPick={(id) => push({ step: "date", staff: id, date: null, time: null })}
            onAutoAdvance={(id) => push({ step: "date", staff: id })}
          />
        )}

        {step === "date" && service && (
          <DateStep
            serviceId={service.id}
            staffId={staffId === ANY ? undefined : staffId}
            value={date}
            onPick={(d) => push({ step: "time", date: d, time: null })}
          />
        )}

        {step === "time" && service && date && (
          <TimeStep
            serviceId={service.id}
            staffId={staffId === ANY ? undefined : staffId}
            date={date}
            value={time}
            onPick={(t) => push({ step: "details", time: t })}
          />
        )}

        {step === "details" && (
          <DetailsStep
            customer={customer}
            note={note}
            consent={consent}
            onChange={setCustomer}
            onNote={setNote}
            onConsent={setConsent}
            onNext={() => goto("confirm")}
            policyText={policy.cancellationPolicyText}
          />
        )}

        {step === "confirm" && service && date && time && (
          <ConfirmStep
            service={service}
            staff={staffId === ANY ? null : staffById[staffId] ?? null}
            date={date}
            time={time}
            customer={customer}
            note={note}
            currency={policy.currency}
            locale={policy.locale}
            policyText={policy.cancellationPolicyText}
            submitting={submitting}
            onEdit={(s) => goto(s)}
            onConfirm={async () => {
              setSubmitting(true);
              setError(null);
              try {
                const res = await apiSend<ApiBookingResult>("/api/appointments", "POST", {
                  serviceId: service.id,
                  staffId: staffId === ANY ? undefined : staffId,
                  date,
                  time,
                  // Consent belongs inside `customer` — that's where
                  // createBookingSchema / customerInputSchema read it.
                  customer: { ...customer, marketingConsent: consent },
                  note: note.trim() || undefined,
                });
                router.push(`/varaus/${res.publicId}?t=${encodeURIComponent(res.manageToken)}&new=1`);
              } catch (e) {
                setSubmitting(false);
                if (e instanceof ApiError && (e.code === "SLOT_TAKEN" || e.code === "SLOT_INVALID")) {
                  // push() clears `error`, so set it after navigating back.
                  push({ step: "time", time: null });
                  setError("Valitettavasti tämä aika ehdittiin juuri varata. Valitse toinen aika.");
                } else if (e instanceof ApiError) {
                  setError(e.message);
                } else {
                  setError("Varauksen tallennus epäonnistui. Yritä uudelleen.");
                }
              }
            }}
          />
        )}
      </div>
      )}

      {step !== "service" && (
        <div className="mt-8">
          <button
            type="button"
            onClick={() => goto(STEP_ORDER[Math.max(0, stepIndex - 1)])}
            className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Takaisin
          </button>
          <button
            type="button"
            onClick={reset}
            className="ml-4 text-sm text-ink-faint hover:text-ink"
          >
            Aloita alusta
          </button>
        </div>
      )}
    </div>
  );
}

// ── Progress ────────────────────────────────────────────────────────────────
function Progress({
  step,
  stepIndex,
}: {
  step: Step;
  stepIndex: number;
  onJump: (s: Step) => void;
  canJumpTo: { service: unknown; staffId: unknown; date: unknown; time: unknown };
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-clay">
        Vaihe {stepIndex + 1} / {STEP_ORDER.length} · {STEP_LABELS[step]}
      </p>
      <div className="mt-2 flex gap-1.5" aria-hidden>
        {STEP_ORDER.map((s, i) => (
          <span
            key={s}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              i <= stepIndex ? "bg-clay" : "bg-line",
            )}
          />
        ))}
      </div>
    </div>
  );
}

// ── Shared bits ─────────────────────────────────────────────────────────────
function StepTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-4">
      <h1 className="font-display text-2xl sm:text-3xl">{children}</h1>
      {sub && <p className="mt-1 text-sm text-ink-soft">{sub}</p>}
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12 text-ink-faint">
      <Loader2 className="h-5 w-5 animate-spin" aria-label="Ladataan" />
    </div>
  );
}

/** Shown when a step's fetch fails, so the customer isn't left on a dead spinner. */
function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="py-8">
      <Alert tone="danger">{message}</Alert>
      <div className="mt-4 flex justify-center">
        <Button variant="secondary" onClick={onRetry}>
          Yritä uudelleen
        </Button>
      </div>
    </div>
  );
}

function Row({
  onClick,
  active,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-sm border px-4 py-3.5 text-left transition-colors",
        active
          ? "border-ink bg-paper-2"
          : "border-line-strong bg-card hover:border-ink",
      )}
    >
      {children}
    </button>
  );
}

// ── Step 1: Service ─────────────────────────────────────────────────────────
function ServiceStep({
  catalog,
  failed,
  onRetry,
  selectedId,
  currency,
  locale,
  onPick,
}: {
  catalog: ApiCategory[] | null;
  failed: boolean;
  onRetry: () => void;
  selectedId: string | null;
  currency: string;
  locale: string;
  onPick: (s: ApiService) => void;
}) {
  const [q, setQ] = useState("");
  if (failed)
    return (
      <LoadError message="Palveluita ei voitu ladata juuri nyt." onRetry={onRetry} />
    );
  if (!catalog) return <Spinner />;

  const needle = q.trim().toLowerCase();
  const filtered = catalog
    .map((c) => ({
      ...c,
      services: needle
        ? c.services.filter((s) => s.name.toLowerCase().includes(needle))
        : c.services,
    }))
    .filter((c) => c.services.length > 0);

  return (
    <div>
      <StepTitle sub="Valitse haluamasi palvelu. Hinnat ovat ohjeellisia.">
        Mihin haluat ajan?
      </StepTitle>
      <Input
        type="search"
        placeholder="Hae palvelua…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-5"
        aria-label="Hae palvelua"
      />
      <div className="space-y-7">
        {filtered.map((c) => (
          <div key={c.id}>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">
              {c.name}
            </h2>
            <div className="space-y-2">
              {c.services.map((s) => (
                <Row key={s.id} active={s.id === selectedId} onClick={() => onPick(s)}>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] text-ink">{s.name}</span>
                    <span className="block text-xs text-ink-faint">
                      {formatDuration(s.durationMinutes, "fi")}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-ink">
                    {s.priceType === "CONSULTATION"
                      ? "sop. muk."
                      : `${s.priceType === "FROM" ? "alk. " : ""}${formatPrice(s.priceCents, { currency, locale })}`}
                  </span>
                </Row>
              ))}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-ink-faint">Ei hakutuloksia.</p>
        )}
      </div>
    </div>
  );
}

// ── Step 2: Staff ──────────────────────────────────────────────────────────
function StaffStep({
  serviceId,
  value,
  onLoaded,
  onPick,
  onAutoAdvance,
}: {
  serviceId: string;
  value: string;
  onLoaded: (s: ApiStaff[]) => void;
  onPick: (id: string) => void;
  onAutoAdvance: (id: string) => void;
}) {
  const [res, setRes] = useState<{ key: string; data: ApiStaff[] | null } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = `${serviceId}|${attempt}`;

  useEffect(() => {
    let live = true;
    apiGet<ApiStaff[]>(`/api/staff?serviceId=${encodeURIComponent(serviceId)}`)
      .then((list) => {
        if (!live) return;
        setRes({ key, data: list });
        onLoaded(list);
        if (list.length <= 1) onAutoAdvance(list[0]?.id ?? ANY);
      })
      // Never fall through to auto-advance on failure — that would silently book
      // "kuka tahansa" without the customer ever seeing this step.
      .catch(() => live && setRes({ key, data: null }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const current = res?.key === key ? res : null;
  if (!current) return <Spinner />;
  if (!current.data)
    return (
      <LoadError
        message="Tekijöitä ei voitu ladata juuri nyt."
        onRetry={() => setAttempt((n) => n + 1)}
      />
    );
  const staff = current.data;
  if (staff.length <= 1) return <Spinner />; // auto-advancing

  return (
    <div>
      <StepTitle sub="Voit valita tietyn tekijän tai antaa meidän valita sopivan.">
        Kenelle varaat?
      </StepTitle>
      <div className="space-y-2">
        <Row active={value === ANY} onClick={() => onPick(ANY)}>
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-paper-3 text-xs font-medium"
            aria-hidden
          >
            ✦
          </span>
          <span className="flex-1">
            <span className="block text-[15px] text-ink">Kuka tahansa</span>
            <span className="block text-xs text-ink-faint">Nopein vapaa aika</span>
          </span>
        </Row>
        {staff.map((s) => (
          <Row key={s.id} active={value === s.id} onClick={() => onPick(s.id)}>
            <StaffAvatar name={s.name} imageUrl={s.imageUrl} color={s.color} size={36} />
            <span className="flex-1">
              <span className="block text-[15px] text-ink">{s.name}</span>
              {s.title && <span className="block text-xs text-ink-faint">{s.title}</span>}
            </span>
          </Row>
        ))}
      </div>
    </div>
  );
}

// ── Step 3: Date ───────────────────────────────────────────────────────────
function DateStep({
  serviceId,
  staffId,
  value,
  onPick,
}: {
  serviceId: string;
  staffId?: string;
  value: string | null;
  onPick: (d: string) => void;
}) {
  const today = salonToday();
  const [res, setRes] = useState<{ key: string; data: Map<string, boolean> | null } | null>(
    null,
  );
  const [attempt, setAttempt] = useState(0);
  const key = `${serviceId}|${staffId ?? ""}|${attempt}`;
  const [viewMonth, setViewMonth] = useState(() => {
    const { y, m } = parseDateStr(today);
    return { y, m };
  });

  useEffect(() => {
    let live = true;
    const qs = new URLSearchParams({ serviceId, from: today, days: String(RANGE_DAYS) });
    if (staffId) qs.set("staffId", staffId);
    apiGet<ApiRangeAvailability>(`/api/availability?${qs.toString()}`)
      .then((r) => {
        if (!live) return;
        setRes({ key, data: new Map(r.dates.map((d) => [d.dateStr, d.hasSlots])) });
      })
      // An empty map would render a fully-disabled calendar with no explanation.
      .catch(() => live && setRes({ key, data: null }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const current = res?.key === key ? res : null;
  if (!current) return <Spinner />;
  if (!current.data)
    return (
      <LoadError
        message="Vapaita päiviä ei voitu ladata juuri nyt."
        onRetry={() => setAttempt((n) => n + 1)}
      />
    );
  const map = current.data;

  const { y, m } = viewMonth;
  const lead = mondayIndex(`${y}-${String(m).padStart(2, "0")}-01`);
  const total = daysInMonth(y, m);
  const cells: (string | null)[] = [
    ...Array(lead).fill(null),
    ...Array.from({ length: total }, (_, i) => `${y}-${String(m).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`),
  ];
  const lastAllowed = addDaysStr(today, RANGE_DAYS - 1);
  const canPrev = `${y}-${String(m).padStart(2, "0")}-01` > today;

  const shift = (delta: number) => {
    const nm = m + delta;
    if (nm < 1) setViewMonth({ y: y - 1, m: 12 });
    else if (nm > 12) setViewMonth({ y: y + 1, m: 1 });
    else setViewMonth({ y, m: nm });
  };

  return (
    <div>
      <StepTitle sub="Vihreällä merkityt päivät ovat varattavissa.">Valitse päivä</StepTitle>
      <div className="rounded-md border border-line bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => shift(-1)}
            disabled={!canPrev}
            className="rounded-sm px-2 py-1 text-sm text-ink-soft enabled:hover:bg-paper-2 disabled:opacity-30"
            aria-label="Edellinen kuukausi"
          >
            ‹
          </button>
          <span className="text-sm font-medium capitalize">{monthLabelFi(y, m)}</span>
          <button
            type="button"
            onClick={() => shift(1)}
            className="rounded-sm px-2 py-1 text-sm text-ink-soft hover:bg-paper-2"
            aria-label="Seuraava kuukausi"
          >
            ›
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] uppercase text-ink-faint">
          {WEEKDAY_HEADERS_FI.map((d) => (
            <span key={d} className="py-1">
              {d}
            </span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((dateStr, i) => {
            if (!dateStr) return <span key={`e${i}`} />;
            const day = Number(dateStr.slice(-2));
            const past = dateStr < today;
            const beyond = dateStr > lastAllowed;
            const open = map.get(dateStr) ?? false;
            const disabled = past || beyond || !open;
            const selected = value === dateStr;
            return (
              <button
                key={dateStr}
                type="button"
                disabled={disabled}
                aria-pressed={selected}
                onClick={() => onPick(dateStr)}
                className={cn(
                  "relative aspect-square min-h-11 rounded-sm text-sm tabular-nums transition-colors",
                  disabled && "text-ink-faint/40",
                  !disabled && !selected && "hover:bg-paper-2 text-ink",
                  selected && "bg-ink text-paper",
                )}
              >
                {day}
                {!disabled && !selected && (
                  <span className="absolute inset-x-0 bottom-1 mx-auto h-1 w-1 rounded-full bg-success" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Step 4: Time ───────────────────────────────────────────────────────────
function TimeStep({
  serviceId,
  staffId,
  date,
  value,
  onPick,
}: {
  serviceId: string;
  staffId?: string;
  date: string;
  value: string | null;
  onPick: (t: string) => void;
}) {
  const [res, setRes] = useState<{ key: string; data: ApiDayAvailability | null } | null>(
    null,
  );
  const [attempt, setAttempt] = useState(0);
  const key = `${serviceId}|${staffId ?? ""}|${date}|${attempt}`;

  useEffect(() => {
    let live = true;
    const qs = new URLSearchParams({ serviceId, date });
    if (staffId) qs.set("staffId", staffId);
    apiGet<ApiDayAvailability>(`/api/availability?${qs.toString()}`)
      .then((d) => live && setRes({ key, data: d }))
      // Synthesising an empty day here would tell the customer "no free times"
      // when the real cause is a failed request.
      .catch(() => live && setRes({ key, data: null }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // A stale key also covers the between-dates case that used to need setData(null).
  const current = res?.key === key ? res : null;
  if (!current) return <Spinner />;
  if (!current.data)
    return (
      <LoadError
        message="Vapaita aikoja ei voitu ladata juuri nyt."
        onRetry={() => setAttempt((n) => n + 1)}
      />
    );
  const data = current.data;

  const morning = data.times.filter((t) => Number(t.time.slice(0, 2)) < 12);
  const afternoon = data.times.filter((t) => Number(t.time.slice(0, 2)) >= 12);

  const group = (label: string, items: typeof data.times) =>
    items.length > 0 && (
      <div className="mb-5">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</h3>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {items.map((t) => (
            <button
              key={t.time}
              type="button"
              onClick={() => onPick(t.time)}
              className={cn(
                "min-h-11 rounded-sm border py-2.5 text-sm tabular-nums transition-colors",
                value === t.time
                  ? "border-ink bg-ink text-paper"
                  : "border-line-strong bg-card hover:border-ink",
              )}
            >
              {t.time}
            </button>
          ))}
        </div>
      </div>
    );

  return (
    <div>
      <StepTitle sub={longDateFi(date)}>Valitse aika</StepTitle>
      {data.times.length === 0 ? (
        <Alert tone="warning">
          Tälle päivälle ei ole vapaita aikoja. Palaa takaisin ja valitse toinen päivä.
        </Alert>
      ) : (
        <>
          {group("Aamupäivä", morning)}
          {group("Iltapäivä", afternoon)}
        </>
      )}
    </div>
  );
}

// ── Step 5: Details ────────────────────────────────────────────────────────
function DetailsStep({
  customer,
  note,
  consent,
  onChange,
  onNote,
  onConsent,
  onNext,
  policyText,
}: {
  customer: Customer;
  note: string;
  consent: boolean;
  onChange: (c: Customer) => void;
  onNote: (n: string) => void;
  onConsent: (b: boolean) => void;
  onNext: () => void;
  policyText: string;
}) {
  // Per-field, so an error appears when you leave a field rather than only after
  // you've tried to submit the whole form.
  const [touched, setTouched] = useState<Partial<Record<keyof Customer, boolean>>>({});
  const errs = validateCustomer(customer);
  const valid = Object.keys(errs).length === 0;
  const errorFor = (f: keyof Customer) => (touched[f] ? errs[f] : undefined);
  const blur = (f: keyof Customer) => () => setTouched((t) => ({ ...t, [f]: true }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setTouched({ firstName: true, lastName: true, email: true, phone: true });
        if (valid) onNext();
      }}
      noValidate
    >
      <StepTitle sub="Tarvitsemme yhteystietosi vahvistusta ja muistutusta varten.">
        Yhteystiedot
      </StepTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Etunimi" htmlFor="fn" required error={errorFor("firstName")}>
          <Input
            id="fn"
            value={customer.firstName}
            autoComplete="given-name"
            onBlur={blur("firstName")}
            onChange={(e) => onChange({ ...customer, firstName: e.target.value })}
          />
        </Field>
        <Field label="Sukunimi" htmlFor="ln" required error={errorFor("lastName")}>
          <Input
            id="ln"
            value={customer.lastName}
            autoComplete="family-name"
            onBlur={blur("lastName")}
            onChange={(e) => onChange({ ...customer, lastName: e.target.value })}
          />
        </Field>
        <Field label="Sähköposti" htmlFor="em" required error={errorFor("email")}>
          <Input
            id="em"
            type="email"
            inputMode="email"
            value={customer.email}
            autoComplete="email"
            onBlur={blur("email")}
            onChange={(e) => onChange({ ...customer, email: e.target.value })}
          />
        </Field>
        <Field label="Puhelin" htmlFor="ph" required error={errorFor("phone")}>
          <Input
            id="ph"
            type="tel"
            inputMode="tel"
            value={customer.phone}
            autoComplete="tel"
            onBlur={blur("phone")}
            onChange={(e) => onChange({ ...customer, phone: e.target.value })}
          />
        </Field>
      </div>
      <div className="mt-4">
        <Field label="Viesti (valinnainen)" htmlFor="msg" hint="Esim. toiveita tai allergioita.">
          <Textarea
            id="msg"
            value={note}
            maxLength={1000}
            onChange={(e) => onNote(e.target.value)}
          />
        </Field>
      </div>
      <label className="mt-4 flex items-start gap-2 text-sm text-ink-soft">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => onConsent(e.target.checked)}
          className="mt-0.5"
        />
        <span>Haluan kuulla tarjouksista ja uutisista sähköpostitse (valinnainen).</span>
      </label>
      <p className="mt-4 rounded-sm bg-paper-2 p-3 text-xs leading-relaxed text-ink-faint">
        {policyText}
      </p>
      <Button type="submit" size="lg" className="mt-6 w-full">
        Jatka vahvistukseen
      </Button>
    </form>
  );
}

// ── Step 6: Confirm ────────────────────────────────────────────────────────
function ConfirmStep({
  service,
  staff,
  date,
  time,
  customer,
  note,
  currency,
  locale,
  policyText,
  submitting,
  onConfirm,
  onEdit,
}: {
  service: ApiService;
  staff: ApiStaff | null;
  date: string;
  time: string;
  customer: Customer;
  note: string;
  currency: string;
  locale: string;
  policyText: string;
  submitting: boolean;
  onConfirm: () => void;
  onEdit: (s: Step) => void;
}) {
  const priceText =
    service.priceType === "CONSULTATION"
      ? "sopimuksen mukaan"
      : `${service.priceType === "FROM" ? "alk. " : ""}${formatPrice(service.priceCents, { currency, locale })}`;

  const line = (k: string, v: string, edit?: Step) => (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <span className="text-xs uppercase tracking-wide text-ink-faint">{k}</span>
      <span className="flex items-baseline gap-3 text-right text-sm text-ink">
        {v}
        {edit && (
          <button
            type="button"
            onClick={() => onEdit(edit)}
            className="text-xs text-clay underline-offset-2 hover:underline"
          >
            muuta
          </button>
        )}
      </span>
    </div>
  );

  return (
    <div>
      <StepTitle sub="Tarkista tiedot ja vahvista varaus.">Vahvista varaus</StepTitle>
      <div className="divide-y divide-line rounded-md border border-line bg-card px-4">
        {line("Palvelu", service.name, "service")}
        {line("Tekijä", staff ? staff.name : "Kuka tahansa", "staff")}
        {line("Päivä", longDateFi(date), "date")}
        {line("Aika", `klo ${time}`, "time")}
        {line("Kesto", formatDuration(service.durationMinutes, "fi"))}
        {line("Hinta", priceText)}
        {line("Nimi", `${customer.firstName} ${customer.lastName}`, "details")}
        {line("Sähköposti", customer.email, "details")}
        {line("Puhelin", customer.phone, "details")}
        {note.trim() && line("Viesti", note.trim(), "details")}
      </div>
      <p className="mt-4 rounded-sm bg-paper-2 p-3 text-xs leading-relaxed text-ink-faint">
        {policyText}
      </p>
      <Button
        type="button"
        size="lg"
        className="mt-6 w-full"
        disabled={submitting}
        onClick={onConfirm}
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Vahvistetaan…
          </>
        ) : (
          <>
            <Check className="h-4 w-4" /> Vahvista varaus
          </>
        )}
      </Button>
    </div>
  );
}

// ── validation ─────────────────────────────────────────────────────────────
function validateCustomer(c: Customer): Partial<Record<keyof Customer, string>> {
  const e: Partial<Record<keyof Customer, string>> = {};
  if (c.firstName.trim().length < 1) e.firstName = "Pakollinen tieto";
  if (c.lastName.trim().length < 1) e.lastName = "Pakollinen tieto";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email.trim())) e.email = "Tarkista sähköpostiosoite";

  // Accept the separators people actually type (spaces, dots, dashes, slashes,
  // parens) and judge on digit count instead — E.164 allows up to 15.
  const phone = c.phone.trim();
  const digits = phone.replace(/\D/g, "");
  if (!/^\+?[\d\s()./-]+$/.test(phone) || digits.length < 6 || digits.length > 15) {
    e.phone = "Tarkista puhelinnumero";
  }
  return e;
}
