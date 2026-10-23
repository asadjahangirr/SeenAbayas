import type { AdminSection } from "./model";

// These keys are also validated by the database migration. Never accept an
// arbitrary capability supplied by a browser as proof of permission.
export const permissionGroups = [
  { label: "Products", options: [["products", "Edit products, photos, prices, sizes and stock"], ["products.delete", "Permanently delete unused products"], ["categories", "Manage categories"]] },
  { label: "Daily operations", options: [["orders", "View orders and update fulfilment, tracking and notes"], ["inbox", "Manage customer messages"], ["finance", "View finances and manage expenses"], ["coupons", "Manage discount codes"]] },
  { label: "Website", options: [["content", "Edit website wording"], ["hero", "Change homepage film"], ["media", "Upload and manage the media library"], ["appearance.colours", "Change website colours"], ["appearance.motion", "Change animations"], ["appearance.featured", "Choose homepage products"]] },
  { label: "Store settings", options: [["settings.announcement", "Change the announcement banner"], ["settings.delivery", "Change delivery fees, free delivery, parcel weights and services"], ["settings.business", "Change business and returns details"], ["settings.privacy", "Change privacy information"], ["settings.review", "Approve policy review status"]] },
  { label: "Publishing", options: [["publish", "Publish assigned website changes to the live store"], ["history", "View activity and restore website drafts (assigned settings only)"]] },
] as const;
export type AdminPermission = typeof permissionGroups[number]["options"][number][0];
export const permissionKeys: AdminPermission[] = permissionGroups.flatMap(group => group.options.map(([key]) => key));
export type AdminAccess = { mainAdmin: boolean; permissions: string[] };
export function permits(access: AdminAccess, key: string) {
  return access.mainAdmin || access.permissions.includes(key);
}
export function sectionAllowed(access: AdminAccess, section: AdminSection) {
  if (section === "dashboard" || section === "security") return true;
  if (section === "settings" || section === "appearance")
    return access.mainAdmin || access.permissions.some(key => key.startsWith(section + "."));
  return permits(access, section);
}
export function legacyAccess(role: "owner" | "editor"): AdminAccess {
  return { mainAdmin: role === "owner", permissions: role === "owner" ? [...permissionKeys] : ["products", "categories", "content", "hero", "media", "appearance.colours", "appearance.motion", "appearance.featured", "publish", "history"] };
}
