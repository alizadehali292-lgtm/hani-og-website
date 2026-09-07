"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { saveStaffAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";

const DAYS = [
  { n: 1, label: "Ma" },
  { n: 2, label: "Ti" },
  { n: 3, label: "Ke" },
  { n: 4, label: "To" },
  { n: 5, label: "Pe" },
  { n: 6, label: "La" },
  { n: 0, label: "Su" },
];

type Sched = Record<number, { isWorking: boolean; startTime: string; endTime: string }>;

export function StaffForm({
  staff,
  services,
  schedule,
}: {
  staff?: {
    id: string;
    name: string;
    title: string | null;
    bio: string | null;
    color: string;
    imageUrl: string | null;
    isActive: boolean;
    isBookable: boolean;
    displayOrder: number;
    serviceIds: string[];
  };
  services: { id: string; name: string; category: string }[];
  schedule: Sched;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveStaffAction, {} as { error?: string });
  const s = staff;

  return (
    <form action={action} className="space-y-4">
      {s && <input type="hidden" name="id" value={s.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nimi" htmlFor="name" required>
          <Input id="name" name="name" defaultValue={s?.name ?? ""} required />
        </Field>
        <Field label="Titteli" htmlFor="title">
          <Input id="title" name="title" defaultValue={s?.title ?? ""} placeholder="esim. Kampaaja" />
        </Field>
      </div>
      <Field label="Esittely" htmlFor="bio">
        <Textarea id="bio" name="bio" rows={3} defaultValue={s?.bio ?? ""} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Kalenterin väri" htmlFor="color">
          <Input id="color" name="color" type="color" defaultValue={s?.color ?? "#a9694e"} className="h-10 w-full p-1" />
        </Field>
        <Field label="Kuvan URL" htmlFor="img">
          <Input id="img" name="imageUrl" defaultValue={s?.imageUrl ?? ""} placeholder="https://…" />
        </Field>
        <Field label="Järjestys" htmlFor="ord">
          <Input id="ord" name="displayOrder" type="number" min={0} defaultValue={s?.displayOrder ?? 0} />
        </Field>
      </div>
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isActive" defaultChecked={s?.isActive ?? true} />
          Aktiivinen
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isBookable" defaultChecked={s?.isBookable ?? true} />
          Varattavissa
        </label>
      </div>

      <div>
        <p className="mb-1.5 text-sm font-medium">Viikkotyöajat</p>
        <div className="space-y-1.5">
          {DAYS.map((d) => {
            const sc = schedule[d.n] ?? { isWorking: false, startTime: "10:00", endTime: "18:00" };
            return (
              <div key={d.n} className="flex items-center gap-2 text-sm">
                <span className="w-8">{d.label}</span>
                <label className="flex items-center gap-1 text-xs text-ink-soft">
                  <input type="checkbox" name={`work_${d.n}`} defaultChecked={sc.isWorking} /> töissä
                </label>
                <input
                  type="time"
                  name={`start_${d.n}`}
                  defaultValue={sc.startTime}
                  className="h-8 rounded-sm border border-line-strong bg-card px-1 text-sm"
                />
                <span className="text-ink-faint">–</span>
                <input
                  type="time"
                  name={`end_${d.n}`}
                  defaultValue={sc.endTime}
                  className="h-8 rounded-sm border border-line-strong bg-card px-1 text-sm"
                />
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-sm font-medium">Palvelut</p>
        <div className="grid max-h-56 grid-cols-1 gap-1 overflow-y-auto rounded-sm border border-line p-2 text-sm sm:grid-cols-2">
          {services.map((sv) => (
            <label key={sv.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                name="serviceIds"
                value={sv.id}
                defaultChecked={s ? s.serviceIds.includes(sv.id) : true}
              />
              <span className="truncate">
                <span className="text-ink-faint">{sv.category} · </span>
                {sv.name}
              </span>
            </label>
          ))}
        </div>
      </div>

      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Tallennetaan…" : "Tallenna"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push("/admin/henkilokunta")}>
          Peruuta
        </Button>
      </div>
    </form>
  );
}
