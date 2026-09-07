"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  setStatusAction,
  cancelAppointmentAction,
  rescheduleAppointmentAction,
  updateNoteAction,
  type ActionState,
} from "../actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { AvailabilityPicker } from "@/components/booking/availability-picker";
import { longDateFi } from "@/lib/dates-client";
import type { BookingStatus } from "@/lib/types";

const INIT: ActionState = {};

export function StatusActions({
  id,
  status,
}: {
  id: string;
  status: BookingStatus;
}) {
  const [state, action, pending] = useActionState(setStatusAction, INIT);
  const options: { value: BookingStatus; label: string; variant?: "primary" | "secondary" }[] = [
    { value: "CONFIRMED", label: "Merkitse vahvistetuksi" },
    { value: "COMPLETED", label: "Merkitse valmiiksi", variant: "primary" },
    { value: "NO_SHOW", label: "Ei saapunut" },
  ];
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {options
          .filter((o) => o.value !== status)
          .map((o) => (
            <form key={o.value} action={action}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="status" value={o.value} />
              <Button type="submit" size="sm" variant={o.variant ?? "secondary"} disabled={pending}>
                {o.label}
              </Button>
            </form>
          ))}
      </div>
      {state.error && (
        <Alert tone="danger" className="mt-2">
          {state.error}
        </Alert>
      )}
    </div>
  );
}

export function CancelAppointment({ id, disabled }: { id: string; disabled?: boolean }) {
  const [state, action, pending] = useActionState(cancelAppointmentAction, INIT);
  const [open, setOpen] = useState(false);

  if (disabled) {
    return <p className="text-sm text-ink-faint">Peruttua tai valmista varausta ei voi perua.</p>;
  }

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Peru varaus
      </Button>
    );
  }

  return (
    <form action={action} className="space-y-2 rounded-md border border-line bg-paper-2 p-3">
      <input type="hidden" name="id" value={id} />
      <label className="block text-xs text-ink-soft">
        Syy (valinnainen, näkyy asiakkaalle sähköpostissa vain jos kirjoitat sen)
        <Textarea name="reason" rows={2} className="mt-1" />
      </label>
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <div className="flex gap-2">
        <Button type="submit" variant="danger" size="sm" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Vahvista peruutus"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Takaisin
        </Button>
      </div>
    </form>
  );
}

export function RescheduleAppointment({
  id,
  serviceId,
  staffId,
  disabled,
}: {
  id: string;
  serviceId: string;
  staffId: string;
  disabled?: boolean;
}) {
  const [state, action, pending] = useActionState(rescheduleAppointmentAction, INIT);
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<{ date: string; time: string } | null>(null);

  if (disabled) {
    return <p className="text-sm text-ink-faint">Tätä varausta ei voi siirtää.</p>;
  }

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Siirrä aikaa
      </Button>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="date" value={pick?.date ?? ""} />
      <input type="hidden" name="time" value={pick?.time ?? ""} />
      <AvailabilityPicker
        serviceId={serviceId}
        staffId={staffId}
        selected={pick}
        onPick={(date, time) => setPick({ date, time })}
      />
      {pick && (
        <p className="text-sm text-ink-soft">
          Uusi aika: <strong className="capitalize">{longDateFi(pick.date)}</strong> klo {pick.time}
        </p>
      )}
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!pick || pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Vahvista siirto"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setOpen(false);
            setPick(null);
          }}
        >
          Peruuta
        </Button>
      </div>
    </form>
  );
}

export function InternalNote({ id, note }: { id: string; note: string }) {
  const [state, action, pending] = useActionState(updateNoteAction, INIT);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <Textarea name="note" defaultValue={note} rows={3} placeholder="Sisäinen muistiinpano…" />
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          {pending ? "Tallennetaan…" : "Tallenna muistiinpano"}
        </Button>
        {state.ok && <span className="text-xs text-success">Tallennettu.</span>}
        {state.error && <span className="text-xs text-danger">{state.error}</span>}
      </div>
    </form>
  );
}
