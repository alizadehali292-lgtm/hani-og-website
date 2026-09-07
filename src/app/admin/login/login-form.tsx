"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, type LoginState } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";

const initial: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initial);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <Field label="Sähköposti" htmlFor="email" error={state.fieldErrors?.email} required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          autoFocus
          required
        />
      </Field>
      <Field label="Salasana" htmlFor="password" error={state.fieldErrors?.password} required>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Kirjaudutaan…" : "Kirjaudu sisään"}
      </Button>
      <p className="text-center text-xs text-ink-faint">
        <Link href="/admin/reset" className="hover:text-ink">
          Unohtuiko salasana?
        </Link>
      </p>
    </form>
  );
}
