import { requireUser } from "@/lib/auth-guards";
import { AdminShell } from "./shell";

export default async function AdminAppLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireUser();
  return (
    <AdminShell user={{ name: user.name, email: user.email, role: user.role }}>
      {children}
    </AdminShell>
  );
}
