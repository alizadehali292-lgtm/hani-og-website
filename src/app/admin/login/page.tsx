import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth-guards";
import { LoginForm } from "./login-form";

export default async function AdminLoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/admin");

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-display text-xl tracking-tight">Hani Beauty &amp; Hair</p>
          <p className="mt-1 text-sm text-ink-soft">Salongin hallinta</p>
        </div>
        <div className="rounded-md border border-line bg-card p-6 shadow-card">
          <LoginForm />
        </div>
        <p className="mt-6 text-center text-xs text-ink-faint">
          Vain henkilökunnalle. Yhteydenotot: {" "}
          <Link href="/" className="hover:text-ink">
            hanibeautyhair.fi
          </Link>
        </p>
      </div>
    </div>
  );
}
