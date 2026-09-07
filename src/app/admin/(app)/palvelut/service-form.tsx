"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { saveServiceAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";

type Cat = { id: string; name: string };
type Staff = { id: string; name: string };
type Service = {
  id: string;
  name: string;
  description: string | null;
  categoryId: string;
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  priceCents: number;
  priceType: string;
  isActive: boolean;
  isBookableOnline: boolean;
  displayOrder: number;
  staffIds: string[];
};

export function ServiceForm({
  service,
  categories,
  staff,
}: {
  service?: Service;
  categories: Cat[];
  staff: Staff[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveServiceAction, {} as { error?: string });
  const s = service;

  return (
    <form action={action} className="space-y-4">
      {s && <input type="hidden" name="id" value={s.id} />}
      <Field label="Nimi" htmlFor="name" required>
        <Input id="name" name="name" defaultValue={s?.name ?? ""} required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          Kategoria
          <select
            name="categoryId"
            defaultValue={s?.categoryId ?? categories[0]?.id}
            className="mt-1 block h-10 w-full rounded-sm border border-line-strong bg-card px-2 text-sm"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Hintatyyppi
          <select
            name="priceType"
            defaultValue={s?.priceType ?? "FIXED"}
            className="mt-1 block h-10 w-full rounded-sm border border-line-strong bg-card px-2 text-sm"
          >
            <option value="FIXED">Kiinteä</option>
            <option value="FROM">Alkaen</option>
            <option value="CONSULTATION">Sopimuksen mukaan</option>
          </select>
        </label>
      </div>
      <Field label="Kuvaus" htmlFor="desc">
        <Textarea id="desc" name="description" rows={2} defaultValue={s?.description ?? ""} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Kesto (min)" htmlFor="dur" required>
          <Input id="dur" name="durationMinutes" type="number" min={5} max={600} defaultValue={s?.durationMinutes ?? 45} />
        </Field>
        <Field label="Puskuri ennen" htmlFor="bb">
          <Input id="bb" name="bufferBeforeMinutes" type="number" min={0} max={120} defaultValue={s?.bufferBeforeMinutes ?? 0} />
        </Field>
        <Field label="Puskuri jälkeen" htmlFor="ba">
          <Input id="ba" name="bufferAfterMinutes" type="number" min={0} max={120} defaultValue={s?.bufferAfterMinutes ?? 0} />
        </Field>
        <Field label="Hinta (€)" htmlFor="price">
          <Input
            id="price"
            name="priceEuros"
            type="number"
            step="0.01"
            min={0}
            defaultValue={s ? (s.priceCents / 100).toFixed(2) : "0"}
          />
        </Field>
      </div>
      <Field label="Järjestys" htmlFor="ord">
        <Input id="ord" name="displayOrder" type="number" min={0} max={999} defaultValue={s?.displayOrder ?? 0} />
      </Field>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isActive" defaultChecked={s?.isActive ?? true} />
          Aktiivinen
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isBookableOnline" defaultChecked={s?.isBookableOnline ?? true} />
          Varattavissa verkossa
        </label>
      </div>
      <div>
        <p className="mb-1.5 text-sm font-medium">Kuka tekee tätä palvelua</p>
        <div className="flex flex-wrap gap-3 text-sm">
          {staff.map((m) => (
            <label key={m.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                name="staffIds"
                value={m.id}
                defaultChecked={s ? s.staffIds.includes(m.id) : true}
              />
              {m.name}
            </label>
          ))}
        </div>
      </div>
      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Tallennetaan…" : "Tallenna"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push("/admin/palvelut")}>
          Peruuta
        </Button>
      </div>
    </form>
  );
}
