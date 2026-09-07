"use client";

import { useActionState } from "react";
import { saveSettingsAction } from "./actions";
import type { BusinessSettings } from "@/lib/settings";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";

export function SettingsForm({ settings }: { settings: BusinessSettings }) {
  const [state, action, pending] = useActionState(saveSettingsAction, {} as { ok?: boolean; error?: string });
  const s = settings;

  return (
    <form action={action} className="space-y-8">
      <section className="space-y-4">
        <h2 className="font-display text-lg">Yritystiedot</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nimi" htmlFor="name" required>
            <Input id="name" name="name" defaultValue={s.name} />
          </Field>
          <Field label="Virallinen nimi" htmlFor="legalName">
            <Input id="legalName" name="legalName" defaultValue={s.legalName} />
          </Field>
          <Field label="Y-tunnus" htmlFor="businessId">
            <Input id="businessId" name="businessId" defaultValue={s.businessId} />
          </Field>
          <Field label="Puhelin" htmlFor="phone">
            <Input id="phone" name="phone" defaultValue={s.phone} />
          </Field>
          <Field label="Katuosoite" htmlFor="addressLine" required>
            <Input id="addressLine" name="addressLine" defaultValue={s.addressLine} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Postinumero" htmlFor="postalCode">
              <Input id="postalCode" name="postalCode" defaultValue={s.postalCode} />
            </Field>
            <Field label="Kaupunki" htmlFor="city">
              <Input id="city" name="city" defaultValue={s.city} />
            </Field>
          </div>
          <Field label="Maa" htmlFor="country">
            <Input id="country" name="country" defaultValue={s.country} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field
              label="Karttapiste — leveysaste"
              htmlFor="latitude"
              hint="Yhteystiedot-sivun kartta. Hae piste esim. Google Mapsista."
            >
              <Input
                id="latitude"
                name="latitude"
                type="number"
                step="0.000001"
                min={-90}
                max={90}
                defaultValue={s.latitude}
              />
            </Field>
            <Field label="Karttapiste — pituusaste" htmlFor="longitude">
              <Input
                id="longitude"
                name="longitude"
                type="number"
                step="0.000001"
                min={-180}
                max={180}
                defaultValue={s.longitude}
              />
            </Field>
          </div>
          <Field label="Sähköposti (julkinen)" htmlFor="email">
            <Input id="email" name="email" type="email" defaultValue={s.email} />
          </Field>
          <Field label="Ilmoitussähköposti (omistaja)" htmlFor="ownerNotificationEmail">
            <Input
              id="ownerNotificationEmail"
              name="ownerNotificationEmail"
              type="email"
              defaultValue={s.ownerNotificationEmail}
            />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-lg">Varauskäytännöt</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Aikavälin tarkkuus (min)" htmlFor="slotIntervalMinutes" hint="Tarjottujen aloitusaikojen väli.">
            <Input id="slotIntervalMinutes" name="slotIntervalMinutes" type="number" min={5} max={120} defaultValue={s.slotIntervalMinutes} />
          </Field>
          <Field label="Vähimmäisvarausaika (min)" htmlFor="minLeadTimeMinutes" hint="Kuinka lähelle nykyhetkeä voi varata.">
            <Input id="minLeadTimeMinutes" name="minLeadTimeMinutes" type="number" min={0} defaultValue={s.minLeadTimeMinutes} />
          </Field>
          <Field label="Varausikkuna (vrk)" htmlFor="maxAdvanceDays" hint="Kuinka pitkälle tulevaisuuteen voi varata.">
            <Input id="maxAdvanceDays" name="maxAdvanceDays" type="number" min={1} max={365} defaultValue={s.maxAdvanceDays} />
          </Field>
          <Field label="Peruutusaika (h)" htmlFor="cancellationWindowHours" hint="Maksuton peruutus/siirto tähän asti.">
            <Input id="cancellationWindowHours" name="cancellationWindowHours" type="number" min={0} max={336} defaultValue={s.cancellationWindowHours} />
          </Field>
          <Field label="Myöhäisen peruutuksen maksu (%)" htmlFor="lateCancellationFeePercent">
            <Input id="lateCancellationFeePercent" name="lateCancellationFeePercent" type="number" min={0} max={100} defaultValue={s.lateCancellationFeePercent} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="requireConfirmation" defaultChecked={s.requireConfirmation} />
          Verkkovaraukset odottavat salongin vahvistusta (PENDING)
        </label>
        <Field label="Varausohjeen teksti" htmlFor="bookingPolicyText">
          <Textarea id="bookingPolicyText" name="bookingPolicyText" rows={2} defaultValue={s.bookingPolicyText} />
        </Field>
        <Field label="Peruutusehdot (näkyy asiakkaalle)" htmlFor="cancellationPolicyText">
          <Textarea id="cancellationPolicyText" name="cancellationPolicyText" rows={3} defaultValue={s.cancellationPolicyText} />
        </Field>
      </section>

      <section className="rounded-sm bg-paper-2 p-3 text-xs text-ink-faint">
        Aikavyöhyke <strong>{s.timezone}</strong> · Valuutta <strong>{s.currency}</strong> · Kieli{" "}
        <strong>{s.locale}</strong>. Näiden muuttaminen vaatii ympäristömuuttujien päivityksen ja
        uudelleenjulkaisun.
      </section>

      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Tallennetaan…" : "Tallenna asetukset"}
        </Button>
        {state?.ok && <span className="text-sm text-success">Tallennettu.</span>}
      </div>
    </form>
  );
}
