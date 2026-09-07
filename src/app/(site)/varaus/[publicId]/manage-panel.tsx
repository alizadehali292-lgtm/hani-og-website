"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { apiGet, apiSend, ApiError } from "@/lib/api-client";
import { longDateFi } from "@/lib/dates-client";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { AvailabilityPicker } from "@/components/booking/availability-picker";

export function ManagePanel({
  publicId,
  token,
  serviceName,
  canCancel,
  canReschedule,
  policyText,
  windowHours,
  salonPhone,
}: {
  publicId: string;
  token: string;
  serviceName: string;
  canCancel: boolean;
  canReschedule: boolean;
  policyText: string;
  windowHours: number;
  salonPhone: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "cancel" | "reschedule">("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ctx, setCtx] = useState<{ serviceId: string; staffId: string | null } | null>(null);
  const [pick, setPick] = useState<{ date: string; time: string } | null>(null);

  const locked = !canCancel && !canReschedule;

  useEffect(() => {
    if (mode !== "reschedule" || ctx) return;
    apiGet<{ serviceId: string; staffId: string | null }>(
      `/api/appointments/${publicId}/slot-context?t=${encodeURIComponent(token)}`,
    )
      .then(setCtx)
      .catch(() => setError("Aikoja ei voitu ladata. Yritä uudelleen."));
  }, [mode, ctx, publicId, token]);

  async function doCancel() {
    setBusy(true);
    setError(null);
    try {
      await apiSend(`/api/appointments/${publicId}?t=${encodeURIComponent(token)}`, "DELETE");
      router.refresh();
    } catch (e) {
      setBusy(false);
      setError(e instanceof ApiError ? e.message : "Peruutus epäonnistui. Yritä uudelleen.");
    }
  }

  async function doReschedule() {
    if (!pick) return;
    setBusy(true);
    setError(null);
    try {
      await apiSend(`/api/appointments/${publicId}`, "PATCH", {
        token,
        action: "reschedule",
        date: pick.date,
        time: pick.time,
      });
      router.refresh();
    } catch (e) {
      setBusy(false);
      if (e instanceof ApiError && (e.code === "SLOT_TAKEN" || e.code === "SLOT_INVALID")) {
        setError("Tämä aika ei ole enää vapaana. Valitse toinen aika.");
        setPick(null);
      } else {
        setError(e instanceof ApiError ? e.message : "Siirto epäonnistui. Yritä uudelleen.");
      }
    }
  }

  if (locked) {
    return (
      <div className="mt-6 rounded-sm bg-paper-2 p-4 text-sm text-ink-soft">
        Tätä varausta ei voi enää muuttaa verkossa (peruutusaika on {windowHours} h ennen aikaa).
        Ota tarvittaessa yhteyttä salonkiin: {salonPhone}.
        <p className="mt-2 text-xs text-ink-faint">{policyText}</p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      {error && (
        <Alert tone="danger" className="mb-3">
          {error}
        </Alert>
      )}

      {mode === "idle" && (
        <div className="flex flex-wrap gap-2">
          {canReschedule && (
            <Button variant="secondary" onClick={() => setMode("reschedule")}>
              Siirrä aikaa
            </Button>
          )}
          {canCancel && (
            <Button variant="ghost" onClick={() => setMode("cancel")}>
              Peru varaus
            </Button>
          )}
        </div>
      )}

      {mode === "cancel" && (
        <div className="rounded-md border border-line bg-card p-4">
          <p className="text-sm text-ink">
            Perutaanko varaus <strong>{serviceName}</strong>?
          </p>
          <p className="mt-1 text-xs text-ink-faint">{policyText}</p>
          <div className="mt-4 flex gap-2">
            <Button variant="danger" disabled={busy} onClick={doCancel}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kyllä, peru varaus"}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setMode("idle")}>
              Älä peru
            </Button>
          </div>
        </div>
      )}

      {mode === "reschedule" && (
        <div>
          {!ctx ? (
            <div className="flex justify-center rounded-md border border-line bg-card py-10">
              <Loader2 className="h-5 w-5 animate-spin text-ink-faint" />
            </div>
          ) : (
            <AvailabilityPicker
              serviceId={ctx.serviceId}
              staffId={ctx.staffId}
              selected={pick}
              onPick={(date, time) => setPick({ date, time })}
            />
          )}
          {pick && (
            <p className="mt-3 text-sm text-ink-soft">
              Uusi aika: <strong className="capitalize">{longDateFi(pick.date)}</strong> klo {pick.time}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <Button disabled={!pick || busy} onClick={doReschedule}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Vahvista uusi aika"}
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setMode("idle");
                setPick(null);
              }}
            >
              Peruuta
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
