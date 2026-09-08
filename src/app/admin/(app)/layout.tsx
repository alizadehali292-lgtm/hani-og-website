import { requireUser } from "@/lib/auth-guards";
import { getAdminLang } from "@/lib/i18n/admin-server";
import { AdminShell } from "./shell";

export default async function AdminAppLayout({ children }: LayoutProps<"/admin">) {
  const [user, lang] = await Promise.all([requireUser(), getAdminLang()]);
  return (
    <AdminShell
      user={{ name: user.name, email: user.email, role: user.role }}
      lang={lang}
    >
      {children}
    </AdminShell>
  );
}
