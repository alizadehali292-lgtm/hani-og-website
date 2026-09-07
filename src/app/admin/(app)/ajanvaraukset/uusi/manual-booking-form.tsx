"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { apiGet } from "@/lib/api-client";
import { createManualBookingAction, type ManualBookingState } from "./actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { AvailabilityPicker } from "@/components/booking/availability-picker";
import { longDateFi } from "@/lib/dates-client";
import { formatDuration, formatPrice } from "@/lib/utils";

type SvcOption = {
  id: string;
  name: string;
  categoryName: string;
  durationMinutes: number;
  priceCents: number;
  priceType: string;
  staffIds: string[];
};
type StaffOption = { id: string; name: string };
type FoundCustomer = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  isBlocked: boolean;
};

const INIT: ManualBookingState = {};

export function ManualBookingForm({
  services,
  staff,
  currency,
  locale,
}: {
  services: SvcOption[];
  staff: StaffOption[];
  currency: string;
  locale: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(createManualBookingAction, INIT);

  const [customerMode, setCustomerMode] = useState<"existing" | "new">("existing");
  const [picked, setPicked] = useState<FoundCustomer | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoundCustomer[]>([]);
  const [searching, setSearching] = useState(false);

  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [slot, setSlot] = useState<{ date: string; time: string } | null>(null);

  const service = services.find((s) => s.id === serviceId) ?? null;
  const eligibleStaff = service
    ? staff.filter((s) => service.staffIds.includes(s.id))
    : staff;

  // Whether a search is warranted is derived, not stored — so the stale results
  // of an abandoned query are filtered out at render instead of being cleared
  // with a synchronous setState inside the effect.
  const shouldSearch = customerMode === "existing" && query.trim().length >= 2;
  useEffect(() => {
    if (!shouldSearch) return;
    const t = setTimeout(() => {
      setSearching(true);
      apiGet<FoundCustomer[]>(`/api/admin/customers?q=${encodeURIComponent(query.trim())}`)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(t);
  }, [query, shouldSearch]);
  const visibleResults = shouldSearch ? results : [];
  const isSearching = shouldSearch && searching;

  useEffect(() => {
    if (state.ok && state.id) router.push(`/admin/ajanvaraukset/${state.id}`);
  }, [state, router]);

  const canPickTime = serviceId && staffId;

  return (
    <form action={action} className="space-y-6">
      {/* hidden values */}
      {picked && <input type="hidden" name="customerId" value={picked.id} />}
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="staffId" value={staffId} />
      <input type="hidden" name="date" value={slot?.date ?? ""} />
      <input type="hidden" name="time" value={slot?.time ?? ""} />

      {/* Customer */}
      <section className="rounded-md border border-line bg-card p-4">
        <h2 className="mb-3 font-display text-lg">Asiakas</h2>
        <div className="mb-3 flex gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="_cmode"
              checked={customerMode === "existing"}
              onChange={() => {
                setCustomerMode("existing");
              }}
            />
            Olemassa oleva
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="_cmode"
              checked={customerMode === "new"}
              onChange={() => {
                setCustomerMode("new");
                setPicked(null);
              }}
            />
            Uusi asiakas
          </label>
        </div>

        {customerMode === "existing" ? (
          picked ? (
            <div className="flex items-center justify-between rounded-sm border border-line-strong bg-paper-2 px-3 py-2 text-sm">
              <span>
                <strong>
                  {picked.firstName} {picked.lastName}
                </strong>{" "}
                · {picked.email} · {picked.phone}
                {picked.isBlocked && <span className="ml-2 text-danger">(estetty)</span>}
              </span>
              <button
                type="button"
                className="text-xs text-clay hover:underline"
                onClick={() => setPicked(null)}
              >
                vaihda
              </button>
            </div>
          ) : (
            <div className="relative">
              <Input
                placeholder="Hae nimellä, sähköpostilla tai puhelimella"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {(isSearching || visibleResults.length > 0) && (
                <div className="absolute z-10 mt-1 w-full rounded-sm border border-line-strong bg-card shadow-pop">
                  {isSearching && <p className="px-3 py-2 text-xs text-ink-faint">Haetaan…</p>}
                  {visibleResults.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setPicked(r);
                        setResults([]);
                        setQuery("");
                      }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-paper-2"
                    >
                      <strong>
                        {r.firstName} {r.lastName}
                      </strong>
                      <span className="text-ink-faint"> · {r.email} · {r.phone}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Etunimi" htmlFor="fn" required>
              <Input id="fn" name="firstName" autoComplete="off" />
            </Field>
            <Field label="Sukunimi" htmlFor="ln" required>
              <Input id="ln" name="lastName" autoComplete="off" />
            </Field>
            <Field label="Sähköposti" htmlFor="em" required>
              <Input id="em" name="email" type="email" autoComplete="off" />
            </Field>
            <Field label="Puhelin" htmlFor="ph" required>
              <Input id="ph" name="phone" type="tel" autoComplete="off" />
            </Field>
          </div>
        )}
      </section>

      {/* Service + staff */}
      <section className="rounded-md border border-line bg-card p-4">
        <h2 className="mb-3 font-display text-lg">Palvelu</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-ink-soft">
            Palvelu
            <select
              value={serviceId}
              onChange={(e) => {
                // Changing the service invalidates the staff choice and the slot.
                setServiceId(e.target.value);
                setStaffId("");
                setSlot(null);
              }}
              className="mt-1 block h-10 w-full rounded-sm border border-line-strong bg-card px-2 text-sm"
            >
              <option value="">Valitse palvelu…</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.categoryName} — {s.name} ({formatDuration(s.durationMinutes, "fi")})
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-ink-soft">
            Tekijä
            <select
              value={staffId}
              onChange={(e) => {
                setStaffId(e.target.value);
                setSlot(null);
              }}
              disabled={!serviceId}
              className="mt-1 block h-10 w-full rounded-sm border border-line-strong bg-card px-2 text-sm disabled:opacity-50"
            >
              <option value="">Valitse tekijä…</option>
              {eligibleStaff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {service && (
          <p className="mt-2 text-xs text-ink-faint">
            Hinta:{" "}
            {service.priceType === "CONSULTATION"
              ? "sopimuksen mukaan"
              : formatPrice(service.priceCents, { currency, locale })}{" "}
            · Kesto: {formatDuration(service.durationMinutes, "fi")}
          </p>
        )}
      </section>

      {/* Time */}
      <section className="rounded-md border border-line bg-card p-4">
        <h2 className="mb-3 font-display text-lg">Aika</h2>
        {!canPickTime ? (
          <p className="text-sm text-ink-faint">Valitse ensin palvelu ja tekijä.</p>
        ) : (
          <>
            <AvailabilityPicker
              admin
              serviceId={serviceId}
              staffId={staffId}
              selected={slot}
              onPick={(date, time) => setSlot({ date, time })}
            />
            {slot && (
              <p className="mt-3 text-sm text-ink-soft">
                Valittu: <strong className="capitalize">{longDateFi(slot.date)}</strong> klo{" "}
                {slot.time}
              </p>
            )}
          </>
        )}
      </section>

      {/* Extras */}
      <section className="rounded-md border border-line bg-card p-4">
        <Field label="Sisäinen muistiinpano (valinnainen)" htmlFor="note">
          <Input id="note" name="internalNote" autoComplete="off" />
        </Field>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" name="allowOverbook" />
          Salli päällekkäisvaraus (ohita ristiriitatarkistus)
        </label>
      </section>

      {state.error && <Alert tone="danger">{state.error}</Alert>}

      <Button
        type="submit"
        size="lg"
        disabled={pending || !slot || (customerMode === "existing" && !picked)}
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Luodaan…
          </>
        ) : (
          "Luo varaus"
        )}
      </Button>
    </form>
  );
}
