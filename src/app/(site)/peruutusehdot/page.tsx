import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Peruutusehdot",
  description: "Hani Beauty & Hair -kampaamon ajanvarauksen peruutus- ja siirtoehdot.",
};

export default async function CancellationTermsPage() {
  const s = await getSettings();
  return (
    <div className="mx-auto max-w-2xl px-5 py-16 sm:px-8 sm:py-20">
      <h1 className="font-display text-3xl sm:text-4xl">Peruutusehdot</h1>
      <div className="mt-8 space-y-4 text-pretty text-ink-soft">
        <p>{s.cancellationPolicyText}</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Maksuton peruutus ja ajan siirto onnistuu verkossa varausvahvistuksen linkistä
            viimeistään {s.cancellationWindowHours} tuntia ennen varattua aikaa.
          </li>
          <li>
            Tämän jälkeen tehdyistä peruutuksista tai saapumatta jättämisestä voidaan veloittaa{" "}
            {s.lateCancellationFeePercent} % palvelun hinnasta.
          </li>
          <li>
            Myöhemmät muutokset onnistuvat soittamalla{" "}
            <a href={`tel:${s.phone.replace(/\s/g, "")}`} className="text-clay hover:underline">
              {s.phone}
            </a>
            .
          </li>
        </ul>
        <p className="text-sm text-ink-faint">
          Pidätämme oikeuden ehtojen päivittämiseen. Voimassa oleva versio näkyy aina tällä sivulla.
        </p>
      </div>
    </div>
  );
}
