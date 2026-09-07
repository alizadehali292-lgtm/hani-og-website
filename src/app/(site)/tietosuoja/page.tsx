import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Tietosuojaseloste",
  description: "Miten Hani Beauty & Hair käsittelee henkilötietoja ajanvarauksen yhteydessä.",
};

export default async function PrivacyPage() {
  const s = await getSettings();
  return (
    <div className="mx-auto max-w-2xl px-5 py-16 text-pretty sm:px-8 sm:py-20">
      <h1 className="font-display text-3xl sm:text-4xl">Tietosuojaseloste</h1>
      <p className="mt-3 text-sm text-ink-faint">
        Laadittu EU:n yleisen tietosuoja-asetuksen (GDPR) mukaisesti. Viimeksi päivitetty:
        [täydennä päivämäärä].
      </p>

      <div className="mt-8 space-y-6 text-sm text-ink-soft">
        <section>
          <h2 className="font-display text-lg text-ink">1. Rekisterinpitäjä</h2>
          <p className="mt-2">
            {s.legalName || s.name}
            {s.businessId && ` (Y-tunnus ${s.businessId})`}
            <br />
            {s.addressLine}, {s.postalCode} {s.city}
            <br />
            {s.phone} · {s.email}
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg text-ink">2. Käsiteltävät tiedot ja tarkoitus</h2>
          <p className="mt-2">
            Käsittelemme ajanvarauksen tekemiseksi ja hoitamiseksi seuraavia tietoja: etu- ja
            sukunimi, sähköpostiosoite, puhelinnumero, varatun palvelun ja ajan tiedot sekä
            asiakkaan mahdollisesti antama vapaa viesti. Käsittelyn peruste on sopimuksen
            täytäntöönpano (varaus) ja rekisterinpitäjän oikeutettu etu (asiakassuhteen hoito).
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg text-ink">3. Markkinointi</h2>
          <p className="mt-2">
            Lähetämme markkinointiviestejä vain, jos olet antanut siihen suostumuksen. Voit
            perua suostumuksen milloin tahansa ottamalla yhteyttä.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg text-ink">4. Säilytysaika</h2>
          <p className="mt-2">
            Säilytämme varaustietoja asiakassuhteen ja lakisääteisten velvoitteiden edellyttämän
            ajan. [Täydennä tarkka säilytysaika, esim. kirjanpitolain mukainen 6 vuotta
            tositteiden osalta.]
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg text-ink">5. Tietojen luovutukset ja käsittelijät</h2>
          <p className="mt-2">
            Emme myy tai luovuta henkilötietoja kolmansille markkinointitarkoituksiin. Tietoja
            käsittelevät puolestamme sähköposti- ja palvelinpalvelun tarjoajat sopimuksen
            perusteella. [Täydennä käytetyt palveluntarjoajat.] Tietoja ei siirretä EU/ETA-alueen
            ulkopuolelle ilman asianmukaisia suojatoimia.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg text-ink">6. Rekisteröidyn oikeudet</h2>
          <p className="mt-2">
            Sinulla on oikeus tarkastaa itseäsi koskevat tiedot, pyytää niiden oikaisua tai
            poistoa, rajoittaa tai vastustaa käsittelyä sekä tehdä valitus tietosuojavaltuutetun
            toimistolle. Pyynnöt osoitetaan yllä oleviin yhteystietoihin.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg text-ink">7. Evästeet</h2>
          <p className="mt-2">
            Sivusto käyttää vain toiminnan kannalta välttämättömiä evästeitä (mm. kirjautuminen
            hallintaan). Emme käytä seuranta- tai mainosevästeitä.
          </p>
        </section>
      </div>
    </div>
  );
}
