import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const DAY_SCHEMA = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** JSON-LD HairSalon markup for local SEO. Rendered once in the site layout. */
export async function StructuredData() {
  const [settings, hours] = await Promise.all([
    getSettings(),
    prisma.businessHours.findMany({ where: { isClosed: false } }),
  ]);

  const data = {
    "@context": "https://schema.org",
    "@type": "HairSalon",
    name: settings.name,
    url: SITE,
    telephone: settings.phone,
    email: settings.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: settings.addressLine,
      postalCode: settings.postalCode,
      addressLocality: settings.city,
      addressCountry: "FI",
    },
    areaServed: "Helsinki",
    priceRange: "€€",
    currenciesAccepted: settings.currency,
    openingHoursSpecification: hours.map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: `https://schema.org/${DAY_SCHEMA[h.dayOfWeek]}`,
      opens: h.openTime,
      closes: h.closeTime,
    })),
    potentialAction: {
      "@type": "ReserveAction",
      target: `${SITE}/ajanvaraus`,
      name: "Varaa aika",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
