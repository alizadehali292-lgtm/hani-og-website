"use client";

import { useActionState, useState } from "react";
import { Download, ShieldAlert } from "lucide-react";
import { eraseCustomerAction, type CustomerActionState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";

/**
 * GDPR controls for one customer: subject-access download (Art. 15) and
 * erasure (Art. 17). `/tietosuoja` promises customers both.
 *
 * Erasure is irreversible, so it is collapsed by default and requires the
 * customer's full name to be typed — a checkbox is too easy to click through.
 */
export function GdprPanel({
  customerId,
  fullName,
  appointmentCount,
}: {
  customerId: string;
  fullName: string;
  appointmentCount: number;
}) {
  const [state, action, pending] = useActionState(
    eraseCustomerAction,
    {} as CustomerActionState,
  );
  const [confirming, setConfirming] = useState(false);

  return (
    <section className="mt-8 rounded-md border border-line bg-card p-4">
      <h2 className="flex items-center gap-2 font-display text-lg">
        <ShieldAlert className="h-4 w-4 text-ink-faint" aria-hidden />
        Tietosuoja
      </h2>
      <p className="mt-1 text-sm text-ink-faint">
        Asiakkaan oikeudet: tietojen saanti ja poisto (GDPR art. 15 ja 17).
      </p>

      <a
        href={`/admin/asiakkaat/${customerId}/vienti`}
        className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-sm border border-line-strong px-3 text-sm text-ink hover:border-ink"
      >
        <Download className="h-4 w-4" aria-hidden />
        Lataa asiakkaan tiedot (JSON)
      </a>

      <div className="mt-5 border-t border-line pt-4">
        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="text-sm text-danger hover:underline"
          >
            Poista asiakkaan tiedot pysyvästi…
          </button>
        ) : (
          <form action={action} className="space-y-3">
            <input type="hidden" name="id" value={customerId} />
            {state.error && <Alert tone="danger">{state.error}</Alert>}
            <p className="text-sm text-ink-soft">
              {appointmentCount > 0 ? (
                <>
                  Asiakkaalla on {appointmentCount} varausta. Varaukset säilytetään
                  kirjanpitoa varten, mutta <strong>henkilötiedot anonymisoidaan
                  pysyvästi</strong> eikä asiakasta voi enää tunnistaa.
                </>
              ) : (
                <>
                  Asiakkaalla ei ole varauksia, joten tiedot{" "}
                  <strong>poistetaan kokonaan</strong>.
                </>
              )}{" "}
              Toimintoa ei voi perua.
            </p>
            <label className="block text-sm">
              <span className="text-ink-soft">
                Kirjoita vahvistukseksi asiakkaan koko nimi:{" "}
                <strong className="text-ink">{fullName}</strong>
              </span>
              <Input name="confirm" autoComplete="off" className="mt-1" />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="danger" size="sm" disabled={pending}>
                {pending ? "Poistetaan…" : "Poista pysyvästi"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirming(false)}
              >
                Peruuta
              </Button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
