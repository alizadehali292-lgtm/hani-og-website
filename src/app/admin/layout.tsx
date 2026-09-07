import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hallinta",
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div data-surface="admin" className="min-h-full bg-paper text-ink">
      {children}
    </div>
  );
}
