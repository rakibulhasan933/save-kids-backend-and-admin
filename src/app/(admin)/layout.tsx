import { AdminNav } from "@/components/layout/admin-nav";
import { requireAdminPage } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminPage();

  return (
    <div className="flex min-h-screen">
      <AdminNav email={admin.email} />
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
