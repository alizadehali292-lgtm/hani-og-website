import Link from "next/link";

export default function HomePage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-5 pt-20 pb-16 sm:px-8 sm:pt-28">
        <p className="text-sm uppercase tracking-[0.2em] text-clay">
          Kampaamo &amp; kauneushoitola · Helsinki
        </p>
        <h1 className="mt-5 max-w-3xl text-balance font-display text-4xl leading-[1.05] sm:text-6xl">
          Luova kauneusmatka Töölössä.
        </h1>
        <p className="mt-6 max-w-xl text-pretty text-lg text-ink-soft">
          Astu sisään ja rentoudu. Leikkaukset, värit ja kampaukset ammattitaidolla —
          kiireettömästi, sinun tyylilläsi.
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link
            href="/ajanvaraus"
            className="rounded-sm bg-ink px-6 py-3 text-sm font-medium text-paper transition-colors hover:bg-clay-deep"
          >
            Varaa aika
          </Link>
          <Link
            href="/palvelut"
            className="rounded-sm border border-line-strong px-6 py-3 text-sm font-medium text-ink transition-colors hover:border-ink"
          >
            Katso palvelut &amp; hinnat
          </Link>
        </div>
      </section>

      <section className="border-y border-line bg-card">
        <div className="mx-auto grid max-w-6xl gap-px overflow-hidden bg-line sm:grid-cols-3">
          {[
            ["Leikkaukset", "Tyylillesi sopivat leikkaukset kaikenpituisille hiuksille."],
            ["Värit & raidat", "Moniväriraidat ja balayage tuovat eloa hiuksiisi."],
            ["Kampaukset & meikit", "Juhliin, häihin ja arkeen — viimeistelty lopputulos."],
          ].map(([title, body]) => (
            <div key={title} className="bg-card p-8">
              <h2 className="font-display text-xl">{title}</h2>
              <p className="mt-2 text-sm text-ink-soft">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
