import { AdminRecovery } from "@/components/admin/admin-recovery";
import { requireAdmin } from "@/lib/admin/auth";
import { redirect } from "next/navigation";
export default async function RecoverPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>;
}) {
  if ((await searchParams).stage === "password") {
    try {
      await requireAdmin(false);
    } catch {
      redirect("/admin/recover?error=link");
    }
  }
  return <AdminRecovery />;
}
