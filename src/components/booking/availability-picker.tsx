"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  apiGet,
  type ApiDayAvailability,
  type ApiRangeAvailability,
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
import { cn } from "@/lib/utils";

const RANGE_DAYS = 62;

/**
 * Self-contained calendar + time-slot picker. Fetches the public availability
 * API itself. Calls `onPick(date, time)` whenever a time is chosen.
 */
export function AvailabilityPicker({
  serviceId,
  staffId,
  selected,
  onPick,
  compact = false,
  admin = false,
}: {
  serviceId: string;
  staffId?: string | null;
  selected?: { date: string; time: string } | null;
  onPick: (date: string, time: string) => void;
  compact?: boolean;
  admin?: boolean;
}) {
  const today = salonToday();
  const endpoint = admin ? "/api/admin/availability" : "/api/availability";
  const [date, setDate] = useState<string | null>(selected?.date ?? null);
  const [view, setView] = useState(() => {
    const { y, m } = parseDateStr(selected?.date ?? today);
    return { y, m };
  });

  const staffQ = staffId ? `&staffId=${encodeURIComponent(staffId)}` : "";

  // Each fetch stamps its result with the key of the request that produced it.
  // A result whose key no longer matches the current one is stale, so it reads
  // back as "still loading" — which gives the spinner without a synchronous
  // setState in the effect body, and makes an out-of-order response harmless.
  const rangeKey = `${endpoint}|${serviceId}|${staffId ?? ""}|${today}`;
  const [rangeRes, setRangeRes] = useState<{
    key: string;
    map: Map<string, boolean>;
  } | null>(null);
  useEffect(() => {
    let live = true;
    apiGet<ApiRangeAvailability>(
      `${endpoint}?serviceId=${encodeURIComponent(serviceId)}&from=${today}&days=${RANGE_DAYS}${staffQ}`,
    )
      .then(
        (r) =>
          live &&
          setRangeRes({
            key: rangeKey,
            map: new Map(r.dates.map((d) => [d.dateStr, d.hasSlots])),
          }),
      )
      .catch(() => live && setRangeRes({ key: rangeKey, map: new Map() }));
    return () => {
      live = false;
    };
  }, [rangeKey, endpoint, serviceId, staffQ, today]);
  const openMap = rangeRes?.key === rangeKey ? rangeRes.map : null;

  const dayKey = `${endpoint}|${serviceId}|${staffId ?? ""}|${date ?? ""}`;
  const [dayRes, setDayRes] = useState<{
    key: string;
    data: ApiDayAvailability;
  } | null>(null);
  useEffect(() => {
    if (!date) return;
    let live = true;
    apiGet<ApiDayAvailability>(
      `${endpoint}?serviceId=${encodeURIComponent(serviceId)}&date=${date}${staffQ}`,
    )
      .then((d) => live && setDayRes({ key: dayKey, data: d }))
      .catch(
        () =>
          live &&
          setDayRes({
            key: dayKey,
            data: { mode: "day", dateStr: date, isOpen: false, reason: null, times: [] },
          }),
      );
    return () => {
      live = false;
    };
  }, [dayKey, endpoint, serviceId, staffQ, date]);
  const day = dayRes?.key === dayKey ? dayRes.data : null;

  if (!openMap) {
    return (
      <div className="flex justify-center rounded-md border border-line bg-card py-10">
        <Loader2 className="h-5 w-5 animate-spin text-ink-faint" aria-label="Ladataan" />
      </div>
    );
  }

  const { y, m } = view;
  const mm = String(m).padStart(2, "0");
  const lead = mondayIndex(`${y}-${mm}-01`);
  const total = daysInMonth(y, m);
  const cells: (string | null)[] = [
    ...Array(lead).fill(null),
    ...Array.from({ length: total }, (_, i) => `${y}-${mm}-${String(i + 1).padStart(2, "0")}`),
  ];
  const lastAllowed = addDaysStr(today, RANGE_DAYS - 1);
  const canPrev = `${y}-${mm}-01` > today;
  const shift = (delta: number) => {
    const nm = m + delta;
    if (nm < 1) setView({ y: y - 1, m: 12 });
    else if (nm > 12) setView({ y: y + 1, m: 1 });
    else setView({ y, m: nm });
  };

  return (
    <div className={cn("rounded-md border border-line bg-card p-4", compact && "p-3")}>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shift(-1)}
          disabled={!canPrev}
          className="px-2 py-1 text-sm text-ink-soft enabled:hover:bg-paper-2 disabled:opacity-30"
          aria-label="Edellinen kuukausi"
        >
          ‹
        </button>
        <span className="text-sm font-medium capitalize">{monthLabelFi(y, m)}</span>
        <button
          type="button"
          onClick={() => shift(1)}
          className="px-2 py-1 text-sm text-ink-soft hover:bg-paper-2"
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
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />;
          const disabled = d < today || d > lastAllowed || !(openMap.get(d) ?? false);
          const isSel = date === d;
          return (
            <button
              key={d}
              type="button"
              disabled={disabled}
              aria-pressed={isSel}
              onClick={() => setDate(d)}
              className={cn(
                "relative aspect-square min-h-11 rounded-sm text-sm tabular-nums transition-colors",
                disabled && "text-ink-faint/40",
                !disabled && !isSel && "text-ink hover:bg-paper-2",
                isSel && "bg-ink text-paper",
              )}
            >
              {Number(d.slice(-2))}
              {!disabled && !isSel && (
                <span className="absolute inset-x-0 bottom-1 mx-auto h-1 w-1 rounded-full bg-success" />
              )}
            </button>
          );
        })}
      </div>

      {date && (
        <div className="mt-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-ink-faint">{longDateFi(date)}</p>
          {!day ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-ink-faint" />
            </div>
          ) : day.times.length === 0 ? (
            <p className="py-3 text-sm text-ink-faint">Ei vapaita aikoja tälle päivälle.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {day.times.map((t) => (
                <button
                  key={t.time}
                  type="button"
                  onClick={() => onPick(date, t.time)}
                  className={cn(
                    "min-h-11 rounded-sm border py-2 text-sm tabular-nums transition-colors",
                    selected?.date === date && selected?.time === t.time
                      ? "border-ink bg-ink text-paper"
                      : "border-line-strong hover:border-ink",
                  )}
                >
                  {t.time}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
