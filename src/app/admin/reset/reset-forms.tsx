"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestResetAction, confirmResetAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";

export function RequestResetForm() {
  const [state, action, pending] = useActionState(requestResetAction, {});
  if (state.done) {
    return (
      <Alert tone="success">
        Jos sähköpostiosoitteella on tili, lähetimme siihen palautuslinkin. Tarkista myös
        roskapostikansio.
      </Alert>
    );
  }
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <Field label="Sähköposti" htmlFor="email" required>
        <Input id="email" name="email" type="email" autoComplete="username" required autoFocus />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Lähetetään…" : "Lähetä palautuslinkki"}
      </Button>
      <p className="text-center text-xs text-ink-faint">
        <Link href="/admin/login" className="hover:text-ink">
          Takaisin kirjautumiseen
        </Link>
      </p>
    </form>
  );
}

export function ConfirmResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(confirmResetAction, {});
  if (state.ok) {
    return (
      <div className="space-y-4 text-center">
        <Alert tone="success">Salasana vaihdettu. Voit nyt kirjautua sisään.</Alert>
        <Link
          href="/admin/login"
          className="inline-block rounded-sm bg-ink px-5 py-2.5 text-sm font-medium text-paper hover:bg-clay-deep"
        >
          Kirjaudu sisään
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <Field label="Uusi salasana" htmlFor="password" hint="Vähintään 10 merkkiä." required>
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </Field>
      <Field label="Vahvista salasana" htmlFor="confirm" required>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Tallennetaan…" : "Aseta uusi salasana"}
      </Button>
    </form>
  );
}
