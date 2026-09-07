import { loadAvailabilityAdmin, WEEKDAYS_FI } from "@/lib/admin/availability-admin";
import { getSettings } from "@/lib/settings";
import { formatInTz } from "@/lib/time";
import { Card } from "@/components/ui/misc";
import {
  saveBusinessHoursAction,
  addBreakAction,
  deleteBreakAction,
  addSpecialHoursAction,
  deleteSpecialHoursAction,
  addTimeOffAction,
  deleteTimeOffAction,
} from "./actions";

export const dynamic = "force-dynamic";

const timeInput =
  "h-9 rounded-sm border border-line-strong bg-card px-2 text-sm";
const selectInput = timeInput;

const TYPE_LABELS: Record<string, string> = {
  VACATION: "Loma",
  SICK: "Sairaus",
  BLOCK: "Sulku",
  HOLIDAY: "Pyhäpäivä",
};

export default async function AvailabilityPage() {
  const settings = await getSettings();
  const tz = settings.timezone;
  const data = await loadAvailabilityAdmin(tz);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-2xl">Aukiolot &amp; saatavuus</h1>
        <p className="text-sm text-ink-soft">
          Määrittää, milloin asiakkaat voivat varata aikoja. Varausmoottori laskee vapaat
          ajat näiden sääntöjen, palveluiden keston ja olemassa olevien varausten perusteella.
        </p>
      </div>

      {/* Business hours */}
      <section>
        <h2 className="mb-2 font-display text-lg">Viikoittaiset aukioloajat</h2>
        <form action={saveBusinessHoursAction}>
          <Card className="space-y-2 p-4">
            {data.hours.map((h) => (
              <div key={h.dayOfWeek} className="flex flex-wrap items-center gap-3">
                <span className="w-28 text-sm">{h.label}</span>
                <label className="flex items-center gap-1.5 text-xs text-ink-soft">
                  <input type="checkbox" name={`closed_${h.dayOfWeek}`} defaultChecked={h.isClosed} />
                  Suljettu
                </label>
                <input
                  type="time"
                  name={`open_${h.dayOfWeek}`}
                  defaultValue={h.openTime}
                  className={timeInput}
                />
                <span className="text-ink-faint">–</span>
                <input
                  type="time"
                  name={`close_${h.dayOfWeek}`}
                  defaultValue={h.closeTime}
                  className={timeInput}
                />
              </div>
            ))}
            <button className="mt-2 h-9 rounded-sm bg-ink px-4 text-sm font-medium text-paper hover:bg-clay-deep">
              Tallenna aukioloajat
            </button>
            {settings.openingHoursAreProvisional && (
              <p className="text-xs text-warning">
                Aukioloajat ovat vielä alustavat — tallennus vahvistaa ne oikeiksi.
              </p>
            )}
          </Card>
        </form>
      </section>

      {/* Breaks */}
      <section>
        <h2 className="mb-2 font-display text-lg">Toistuvat tauot</h2>
        <Card className="space-y-3 p-4">
          {data.breaks.length === 0 ? (
            <p className="text-sm text-ink-faint">Ei taukoja.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {data.breaks.map((b) => (
                <li key={b.id} className="flex items-center justify-between py-2">
                  <span>
                    {b.dayLabel} · {b.startTime}–{b.endTime} · {b.label}
                  </span>
                  <form action={deleteBreakAction}>
                    <input type="hidden" name="id" value={b.id} />
                    <button className="text-xs text-danger hover:underline">Poista</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <form action={addBreakAction} className="flex flex-wrap items-end gap-2 border-t border-line pt-3">
            <select name="dayOfWeek" className={selectInput} defaultValue="1">
              {WEEKDAYS_FI.map((d) => (
                <option key={d.n} value={d.n}>
                  {d.label}
                </option>
              ))}
            </select>
            <input type="time" name="startTime" defaultValue="13:00" className={timeInput} required />
            <span className="text-ink-faint">–</span>
            <input type="time" name="endTime" defaultValue="13:30" className={timeInput} required />
            <input
              type="text"
              name="label"
              placeholder="Nimi (esim. Lounas)"
              className="h-9 w-40 rounded-sm border border-line-strong bg-card px-2 text-sm"
            />
            <button className="h-9 rounded-sm border border-line-strong px-3 text-sm hover:border-ink">
              Lisää tauko
            </button>
          </form>
        </Card>
      </section>

      {/* Special hours */}
      <section>
        <h2 className="mb-2 font-display text-lg">Poikkeuspäivät</h2>
        <Card className="space-y-3 p-4">
          {data.specialHours.length === 0 ? (
            <p className="text-sm text-ink-faint">Ei poikkeuspäiviä.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {data.specialHours.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-2">
                  <span>
                    {s.date} ·{" "}
                    {s.isClosed ? "Suljettu" : `${s.openTime}–${s.closeTime}`}
                    {s.note && ` · ${s.note}`}
                  </span>
                  <form action={deleteSpecialHoursAction}>
                    <input type="hidden" name="id" value={s.id} />
                    <button className="text-xs text-danger hover:underline">Poista</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <form
            action={addSpecialHoursAction}
            className="flex flex-wrap items-end gap-2 border-t border-line pt-3"
          >
            <input type="date" name="date" className={timeInput} required />
            <select name="mode" className={selectInput} defaultValue="closed">
              <option value="closed">Suljettu</option>
              <option value="open">Poikkeava aukiolo</option>
            </select>
            <input type="time" name="openTime" className={timeInput} placeholder="Avataan" />
            <span className="text-ink-faint">–</span>
            <input type="time" name="closeTime" className={timeInput} placeholder="Suljetaan" />
            <input
              type="text"
              name="note"
              placeholder="Huomio (esim. Juhannus)"
              className="h-9 w-40 rounded-sm border border-line-strong bg-card px-2 text-sm"
            />
            <button className="h-9 rounded-sm border border-line-strong px-3 text-sm hover:border-ink">
              Lisää
            </button>
          </form>
        </Card>
      </section>

      {/* Time off / blocks */}
      <section>
        <h2 className="mb-2 font-display text-lg">Lomat, poissaolot ja sulut</h2>
        <Card className="space-y-3 p-4">
          {data.timeOff.length === 0 ? (
            <p className="text-sm text-ink-faint">Ei merkintöjä.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {data.timeOff.map((t) => (
                <li key={t.id} className="flex items-center justify-between py-2">
                  <span>
                    {t.staffName} · {TYPE_LABELS[t.type] ?? t.type} ·{" "}
                    {formatInTz(t.startAt, "d.M.yyyy HH:mm", tz)} –{" "}
                    {formatInTz(t.endAt, "d.M.yyyy HH:mm", tz)}
                    {t.reason && ` · ${t.reason}`}
                  </span>
                  <form action={deleteTimeOffAction}>
                    <input type="hidden" name="id" value={t.id} />
                    <button className="text-xs text-danger hover:underline">Poista</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <form
            action={addTimeOffAction}
            className="grid grid-cols-2 gap-2 border-t border-line pt-3 sm:grid-cols-3"
          >
            <select name="staffId" className={selectInput} defaultValue="">
              <option value="">Koko salonki</option>
              {data.staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select name="type" className={selectInput} defaultValue="BLOCK">
              {Object.entries(TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <input
              type="text"
              name="reason"
              placeholder="Syy (valinnainen)"
              className="col-span-2 h-9 rounded-sm border border-line-strong bg-card px-2 text-sm sm:col-span-1"
            />
            <label className="text-xs text-ink-soft">
              Alkaa
              <div className="mt-1 flex gap-1">
                <input type="date" name="startDate" className={timeInput} required />
                <input type="time" name="startTime" defaultValue="00:00" className={timeInput} />
              </div>
            </label>
            <label className="text-xs text-ink-soft">
              Päättyy
              <div className="mt-1 flex gap-1">
                <input type="date" name="endDate" className={timeInput} required />
                <input type="time" name="endTime" defaultValue="23:59" className={timeInput} />
              </div>
            </label>
            <button className="h-9 self-end rounded-sm border border-line-strong px-3 text-sm hover:border-ink">
              Lisää merkintä
            </button>
          </form>
        </Card>
      </section>
    </div>
  );
}
