import { redirect, notFound } from "next/navigation";
import { getAdminRenderAccess, AdminError } from "@/lib/admin/auth";
import {
  adminSections,
  type AdminSection,
  type AdminSnapshot,
} from "@/lib/admin/model";
import { AdminWorkspace } from "@/components/admin/admin-workspace";
import { getStoreConnection } from "@/lib/storefront/server";
export default async function Administration({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section } = await params;
  const selected = section?.[0] || "dashboard";
  if (
    (section?.length || 0) > 1 ||
    !adminSections.includes(selected as AdminSection)
  )
    notFound();
  let access;
  try {
    access = await getAdminRenderAccess();
  } catch (e) {
    if (e instanceof AdminError) redirect("/admin/login");
    throw e;
  }
  const [result, connection] = await Promise.all([access.client.rpc("admin_snapshot"), getStoreConnection()]);
  if (result.error)
    return (
      <div className="admin-login">
        <h1>Workspace unavailable</h1>
        <p>Apply the administration migrations, then reload this page.</p>
        <a href="/admin/login">Return to sign in</a>
      </div>
    );
  return (
    <AdminWorkspace
      key={selected}
      section={selected as AdminSection}
      initial={{ ...result.data as AdminSnapshot, connection }}
      email={access.user.email || "Administrator"}
      role={access.role}
    />
  );
}
