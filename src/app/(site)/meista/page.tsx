import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { StaffAvatar } from "@/components/site/staff-avatar";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Meistä",
  description:
    "Hani Beauty & Hair on rauhallinen kampaamo ja kauneushoitola Helsingin Töölössä. Tutustu tiimiin ja arvoihimme.",
};

export default async function AboutPage() {
  const staff = await prisma.staff.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: "asc" },
  });

  return (
    <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-20">
      <p className="text-sm uppercase tracking-[0.2em] text-clay">Meistä</p>
      <h1 className="mt-4 font-display text-4xl sm:text-5xl">Rauhallinen salonki Töölössä</h1>

      <div className="mt-8 space-y-4 text-pretty text-ink-soft">
        <p>
          Hani Beauty &amp; Hair on vuonna 2020 perustettu pieni kampaamo ja kauneushoitola
          Mechelininkadulla, Helsingin Töölössä. Teemme leikkaukset, värjäykset, raidat ja
          balayagen, permanentit sekä kampaukset ja meikit — kiireettömästi ja huolella.
        </p>
        <p>
          Uskomme, että hyvä lopputulos syntyy kuuntelemisesta: keskustelemme toiveistasi,
          huomioimme hiustesi kunnon ja etsimme sinulle sopivan tyylin. Tavoitteena on, että
          lähdet salongista rennompana ja tyytyväisenä.
        </p>
      </div>

      {staff.length > 0 && (
        <>
          <h2 className="mt-14 font-display text-2xl">Tiimi</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            {staff.map((s) => (
              <div key={s.id} className="rounded-md border border-line bg-card p-5">
                <div className="flex items-center gap-3">
                  <StaffAvatar name={s.name} imageUrl={s.imageUrl} color={s.color} size={44} />
                  <div>
                    <p className="font-display text-lg">{s.name}</p>
                    {s.title && <p className="text-xs text-ink-faint">{s.title}</p>}
                  </div>
                </div>
                {s.bio && <p className="mt-3 text-sm text-ink-soft">{s.bio}</p>}
              </div>
            ))}
          </div>
        </>
      )}

      <div className="mt-14 rounded-md border border-line bg-card p-6 text-center">
        <p className="font-display text-xl">Varaa aikasi verkossa</p>
        <Link
          href="/ajanvaraus"
          className="mt-4 inline-block rounded-sm bg-ink px-6 py-3 text-sm font-medium text-paper hover:bg-clay-deep"
        >
          Varaa aika
        </Link>
      </div>
    </div>
  );
}
