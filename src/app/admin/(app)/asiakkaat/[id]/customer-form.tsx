"use client";

import { useActionState } from "react";
import { updateCustomerAction, type CustomerActionState } from "../actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";

const INIT: CustomerActionState = {};

export function CustomerForm({
  id,
  notes,
  marketingConsent,
  isBlocked,
}: {
  id: string;
  notes: string;
  marketingConsent: boolean;
  isBlocked: boolean;
}) {
  const [state, action, pending] = useActionState(updateCustomerAction, INIT);
  return (
    <form action={action} className="space-y-4 rounded-md border border-line bg-card p-4">
      <input type="hidden" name="id" value={id} />
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-faint">
          Sisäinen muistiinpano
        </label>
        <Textarea name="notes" defaultValue={notes} rows={3} placeholder="Vain henkilökunnalle…" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="marketingConsent" defaultChecked={marketingConsent} />
        Markkinointilupa
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isBlocked" defaultChecked={isBlocked} />
        Estä verkkovaraukset
      </label>
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          {pending ? "Tallennetaan…" : "Tallenna"}
        </Button>
        {state.ok && <span className="text-xs text-success">Tallennettu.</span>}
      </div>
    </form>
  );
}
