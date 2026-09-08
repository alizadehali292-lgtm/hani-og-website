import Link from "next/link";
import { getT } from "@/lib/i18n/admin-server";
import { loadCalendar, type CalView } from "@/lib/admin/calendar";
import { addLocalDays } from "@/lib/time";
import { longDateFi, monthLabelFi, shortDateFi } from "@/lib/dates-client";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PX_PER_MIN = 0.9;
const WD = ["Ma", "Ti", "Ke", "To", "Pe", "La", "Su"];

function hhmm(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

export default async function CalendarPage({ searchParams }: PageProps<"/admin/kalenteri">) {
  const sp = await searchParams;
  const view = ((Array.isArray(sp.view) ? sp.view[0] : sp.view) as CalView) || "week";
  const anchor = (Array.isArray(sp.date) ? sp.date[0] : sp.date) || "";
  const cal = await loadCalendar(["day", "week", "month"].includes(view) ? view : "week", anchor);

  const step = view === "day" ? 1 : view === "week" ? 7 : 30;
  const prev =
    view === "month"
      ? shiftMonth(cal.date, -1)
      : addLocalDays(view === "week" ? cal.from : cal.date, -step);
  const next =
    view === "month"
      ? shiftMonth(cal.date, 1)
      : addLocalDays(view === "week" ? cal.from : cal.date, step);

  const title =
    view === "day"
      ? longDateFi(cal.date)
      : view === "week"
        ? `${shortDateFi(cal.from)} – ${shortDateFi(cal.to)}`
        : monthLabelFi(Number(cal.date.slice(0, 4)), Number(cal.date.slice(5, 7)));

  const t = await getT();
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl">{t("page.calendar")}</h1>
        <Link
          href="/admin/ajanvaraukset/uusi"
          className="rounded-sm bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-clay-deep"
        >
          + Uusi ajanvaraus
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex overflow-hidden rounded-sm border border-line-strong text-sm">
          {(["day", "week", "month"] as const).map((v) => (
            <Link
              key={v}
              href={`/admin/kalenteri?view=${v}&date=${cal.date}`}
              className={cn(
                "px-3 py-1.5",
                view === v ? "bg-ink text-paper" : "hover:bg-paper-2",
              )}
            >
              {v === "day" ? "Päivä" : v === "week" ? "Viikko" : "Kuukausi"}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Link
            href={`/admin/kalenteri?view=${view}&date=${prev}`}
            className="rounded-sm border border-line-strong px-2 py-1 hover:border-ink"
          >
            ‹
          </Link>
          <span className="min-w-40 text-center font-medium capitalize">{title}</span>
          <Link
            href={`/admin/kalenteri?view=${view}&date=${next}`}
            className="rounded-sm border border-line-strong px-2 py-1 hover:border-ink"
          >
            ›
          </Link>
          <Link
            href={`/admin/kalenteri?view=${view}&date=${cal.today}`}
            className="rounded-sm border border-line-strong px-3 py-1 hover:border-ink"
          >
            Tänään
          </Link>
        </div>
      </div>

      {view === "month" ? (
        <MonthGrid cal={cal} />
      ) : (
        <TimeGrid cal={cal} view={view} />
      )}
    </div>
  );
}

function shiftMonth(dateStr: string, delta: number): string {
  const [y, m] = dateStr.split("-").map(Number);
  const nm = m + delta;
  const ny = y + Math.floor((nm - 1) / 12);
  const mm = ((nm - 1 + 12) % 12) + 1;
  return `${ny}-${String(mm).padStart(2, "0")}-01`;
}

function TimeGrid({
  cal,
  view,
}: {
  cal: Awaited<ReturnType<typeof loadCalendar>>;
  view: "day" | "week";
}) {
  const span = cal.dayEnd - cal.dayStart;
  const height = span * PX_PER_MIN;
  const hours: number[] = [];
  for (let m = cal.dayStart; m <= cal.dayEnd; m += 60) hours.push(m);

  return (
    <div className="overflow-x-auto rounded-md border border-line bg-card">
      {/* A 7-column week needs the horizontal scroll on a phone, but a single
          day does not — forcing 640px there would make the owner scroll
          sideways to read one column. */}
      <div className={cn("flex", view === "week" && "min-w-[640px]")}>
        {/* hour gutter */}
        <div className="w-12 shrink-0 border-r border-line">
          <div style={{ height: 28 }} />
          {hours.map((m) => (
            <div
              key={m}
              className="relative text-[10px] text-ink-faint"
              style={{ height: 60 * PX_PER_MIN }}
            >
              <span className="absolute -top-1.5 right-1">{hhmm(m)}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-1">
          {cal.dayList.map((day) => {
            const isToday = day === cal.today;
            const dayEvents = cal.events.filter((e) => e.dateStr === day);
            return (
              <div key={day} className="min-w-0 flex-1 border-r border-line last:border-r-0">
                <div
                  className={cn(
                    "flex h-7 items-center justify-center gap-1 border-b border-line text-xs",
                    isToday ? "bg-clay-tint font-medium text-clay-deep" : "text-ink-soft",
                  )}
                >
                  {view === "week" && <span>{WD[(new Date(day + "T00:00:00Z").getUTCDay() + 6) % 7]}</span>}
                  <span>{Number(day.slice(-2))}.{Number(day.slice(5, 7))}.</span>
                </div>
                <div className="relative" style={{ height }}>
                  {hours.map((m, i) => (
                    <div
                      key={m}
                      className="absolute inset-x-0 border-t border-line/70"
                      style={{ top: i * 60 * PX_PER_MIN }}
                    />
                  ))}
                  {dayEvents.map((e, i) => {
                    const top = (e.startMin - cal.dayStart) * PX_PER_MIN;
                    const h = Math.max(16, (e.endMin - e.startMin) * PX_PER_MIN - 1);
                    const overlap = dayEvents.filter(
                      (o, j) => j < i && o.endMin > e.startMin && o.startMin < e.endMin,
                    ).length;
                    return (
                      <Link
                        key={e.id}
                        href={`/admin/ajanvaraukset/${e.id}`}
                        className="absolute overflow-hidden rounded-[3px] border-l-2 px-1.5 py-0.5 text-[11px] leading-tight text-ink shadow-card"
                        style={{
                          top,
                          height: h,
                          left: `${overlap * 14}px`,
                          right: "2px",
                          background: "var(--card)",
                          borderLeftColor: e.staffColor,
                          opacity: e.status === "NO_SHOW" ? 0.5 : 1,
                        }}
                        title={`${hhmm(e.startMin)} ${e.customerName} — ${e.serviceName} (${e.staffName})`}
                      >
                        <span className="block truncate font-medium">
                          {hhmm(e.startMin)} {e.customerName}
                        </span>
                        <span className="block truncate text-ink-faint">
                          {e.serviceName} · {e.staffName}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MonthGrid({ cal }: { cal: Awaited<ReturnType<typeof loadCalendar>> }) {
  const month = Number(cal.date.slice(5, 7));
  const byDay = new Map<string, typeof cal.events>();
  for (const e of cal.events) {
    const b = byDay.get(e.dateStr);
    if (b) b.push(e);
    else byDay.set(e.dateStr, [e]);
  }
  return (
    <div className="rounded-md border border-line bg-card">
      <div className="grid grid-cols-7 border-b border-line text-center text-[11px] uppercase text-ink-faint">
        {WD.map((d) => (
          <span key={d} className="py-1.5">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cal.dayList.map((day) => {
          const inMonth = Number(day.slice(5, 7)) === month;
          const evs = byDay.get(day) ?? [];
          return (
            <Link
              key={day}
              href={`/admin/kalenteri?view=day&date=${day}`}
              className={cn(
                "min-h-24 border-b border-r border-line p-1.5 text-xs last:border-r-0 hover:bg-paper-2",
                !inMonth && "bg-paper-2/50 text-ink-faint/60",
                day === cal.today && "bg-clay-tint",
              )}
            >
              <span className="font-medium">{Number(day.slice(-2))}</span>
              <div className="mt-1 space-y-0.5">
                {evs.slice(0, 3).map((e) => (
                  <span
                    key={e.id}
                    className="block truncate rounded-[2px] border-l-2 pl-1 text-[10px]"
                    style={{ borderLeftColor: e.staffColor }}
                  >
                    {hhmm(e.startMin)} {e.customerName}
                  </span>
                ))}
                {evs.length > 3 && (
                  <span className="block text-[10px] text-ink-faint">+{evs.length - 3} lisää</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
