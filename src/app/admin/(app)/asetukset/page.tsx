import { getSettings } from "@/lib/settings";
import { getT } from "@/lib/i18n/admin-server";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getSettings();
  const t = await getT();
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="font-display text-2xl">{t("page.settings")}</h1>
      <SettingsForm settings={settings} />
    </div>
  );
}
