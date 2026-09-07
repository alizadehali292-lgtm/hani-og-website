import { ConfirmResetForm } from "../reset-forms";

export const metadata = { title: "Uusi salasana", robots: { index: false } };

export default async function ResetConfirmPage({
  params,
}: PageProps<"/admin/reset/[token]">) {
  const { token } = await params;
  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-display text-xl tracking-tight">Hani Beauty &amp; Hair</p>
          <p className="mt-1 text-sm text-ink-soft">Aseta uusi salasana</p>
        </div>
        <div className="rounded-md border border-line bg-card p-6 shadow-card">
          <ConfirmResetForm token={token} />
        </div>
      </div>
    </div>
  );
}
