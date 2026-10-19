import { getAdminUser } from "@/app/admin-auth";
import { AdminWorkspace } from "@/components/AdminWorkspace";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminUser();
  return <AdminWorkspace email={admin?.email}>{children}</AdminWorkspace>;
}
