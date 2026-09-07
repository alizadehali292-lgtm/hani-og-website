import type { Metadata } from "next";
import { Suspense } from "react";
import { getSettings } from "@/lib/settings";
import { BookingFlow } from "./booking-flow";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Varaa aika",
  description:
    "Varaa aika Hani Beauty & Hair -kampaamoon Helsingin Töölössä. Valitse palvelu, tekijä ja sinulle sopiva aika muutamassa vaiheessa.",
  robots: { index: true, follow: true },
};

export default async function BookingPage() {
  const s = await getSettings();
  return (
    <Suspense fallback={null}>
      <BookingFlow
        policy={{
          currency: s.currency,
          locale: s.locale,
          cancellationPolicyText: s.cancellationPolicyText,
        }}
      />
    </Suspense>
  );
}
