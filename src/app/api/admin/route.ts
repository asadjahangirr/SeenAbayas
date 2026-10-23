import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  requireAdmin,
  checkOrigin,
  readAdminBody,
  privateJson,
  adminFailure,
  AdminError,
} from "@/lib/admin/auth";
import {
  productSchema,
  recordRequestSchema,
  documentRequestSchema,
} from "@/lib/admin/model";
import { getStoreConnection } from "@/lib/storefront/server";
import { defaultShippingSettings, shippingSettingsSchema } from "@/lib/shipping/settings";

export async function GET() {
  try {
    const { client } = await requireAdmin();
    const [result, connection] = await Promise.all([
      client.rpc("admin_snapshot"),
      getStoreConnection(),
    ]);
    if (result.error)
      throw new AdminError(
        "Could not load administration data. Check the migrations.",
        503,
      );
    return privateJson({ ...result.data, connection });
  } catch (e) {
    return adminFailure(e);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { client, role } = await requireAdmin();
    const body = await readAdminBody(request);
    let result;
    if (body.action === "site") {
      const v = documentRequestSchema.parse(body.input);
      // Do not persist private origin/parcel data before the public-read
      // redaction migration is installed, even when saving only a draft.
      if (JSON.stringify(v.document.shipping) !== JSON.stringify(defaultShippingSettings)) {
        if (role === "owner") {
          const health = await client.rpc("admin_shipping_health");
          if (health.error || health.data?.quotes_ready !== true)
            throw new AdminError("Run 20261022000100_shipping_quotes.sql in Supabase SQL Editor before saving Royal Mail settings.", 503);
        }
      }
      if (role !== "owner") {
        const previous = await client.rpc("admin_snapshot");
        if (previous.error) throw new AdminError("Reload administration data before saving.", 503);
        const current = shippingSettingsSchema.parse(previous.data?.site?.draft?.shipping || {});
        const published = shippingSettingsSchema.parse(previous.data?.site?.published?.shipping || {});
        if (JSON.stringify(current) !== JSON.stringify(v.document.shipping) ||
          (v.publish && JSON.stringify(published) !== JSON.stringify(v.document.shipping)))
          throw new AdminError("Only the owner can change shipping settings.", 403);
      }
      result = await client.rpc("admin_save_site", {
        document: v.document,
        expected_version: v.version,
        publish: v.publish,
      });
    } else if (body.action === "restore") {
      result = await client.rpc("admin_restore_site", {
        target_version: z.number().int().min(1).parse(body.version),
        expected_version: z.number().int().min(0).parse(body.currentVersion),
      });
    } else if (body.action === "product") {
      const product = productSchema.parse(body.product);
      result = await client.rpc("admin_save_product", {
        product,
        expected_updated_at: body.updatedAt
          ? z.iso.datetime({ offset: true }).parse(body.updatedAt)
          : null,
      });
    } else if (body.action === "delete-product") {
      result = await client.rpc("admin_delete_product", {
        product_id: z.uuid().parse(body.id),
        expected_updated_at: z.iso
          .datetime({ offset: true })
          .parse(body.updatedAt),
      });
      if (result.error && ["PGRST202", "42883"].includes(result.error.code))
        throw new AdminError(
          "Run 20261019000400_product_delete.sql in Supabase SQL Editor to enable product deletion.",
          503,
        );
    } else if (body.action === "bulk") {
      const input = z
        .object({
          ids: z.array(z.uuid()).min(1).max(500),
          operation: z.enum(["stock", "archive", "reorder", "publish", "hide"]),
          quantity: z.number().int().min(0).max(1000000).nullable(),
        })
        .strict()
        .parse(body.input);
      result = await client.rpc("admin_bulk_products", input);
      if (
        result.error &&
        ["publish", "hide"].includes(input.operation) &&
        result.error.message === "Invalid operation"
      )
        throw new AdminError(
          "Run 20261019000500_product_visibility.sql in Supabase SQL Editor to enable Show / Hide in collection.",
          503,
        );
      if (result.error?.message.startsWith("Cannot show selected products."))
        throw new AdminError(result.error.message, 400);
    } else if (body.action === "record") {
      const v = recordRequestSchema.parse(body.input);
      result = await client.rpc("admin_save_record", {
        record_kind: v.kind,
        record_id: v.id,
        data: v.data,
        expected_version: v.version,
      });
    } else if (body.action === "delete") {
      const v = z
        .object({ id: z.uuid(), version: z.number().int().min(1) })
        .strict()
        .parse(body.input);
      result = await client.rpc("admin_delete_record", {
        record_id: v.id,
        expected_version: v.version,
      });
    } else throw new AdminError("Unknown administration action.");
    if (result.error) {
      const conflict = result.error.code === "40001";
      const knownError = [
        [
          "This product has reserved stock",
          "This product has reserved stock. Archive it instead to retain active order data.",
        ],
        [
          "This product is referenced by an order",
          "This product is used by an order. Archive it instead to preserve order history.",
        ],
        [
          "Product no longer exists",
          "This product was already removed. Reload the product list.",
        ],
        [
          "Move products out of this category first",
          "This category still has products. Assign them to another category in Products & stock, then delete it.",
        ],
        [
          "Choose an existing category",
          "That category no longer exists. Reload the product and choose another category.",
        ],
        [
          "Payment must be verified",
          "This order's payment has not been verified. Paid fulfilment statuses are available after the payment integration confirms payment.",
        ],
        [
          "Closed orders cannot be reopened",
          "Completed and cancelled orders cannot be reopened. You can still update their notes.",
        ],
        [
          "Published products need photography",
          "Add a product photograph before showing this piece in the store.",
        ],
        [
          "Retain order history",
          "Order history is retained. Use the order's fulfilment status to cancel it.",
        ],
      ].find(([message]) => result.error.message.includes(message))?.[1];
      throw new AdminError(
        conflict
          ? "Someone else changed this record. Reload before saving your changes."
          : result.error.code === "42501"
            ? "You do not have permission for this action."
            : result.error.code === "23505"
              ? "That design reference, size, category link or coupon code already exists. Choose a different one."
              : knownError
                ? knownError
                : result.error.code === "23514"
                  ? "Check the product details and stock. Stock must cover reserved units; visible products need a price, description and active size."
                  : "Save failed. Check required fields, unique names and stock reserved in active orders.",
        conflict ? 409 : result.error.code === "42501" ? 403 : 400,
      );
    }
    revalidatePath("/", "layout");
    return privateJson({ success: true, result: result.data });
  } catch (e) {
    if (e instanceof z.ZodError)
      return privateJson(
        {
          error: e.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join(" "),
        },
        400,
      );
    return adminFailure(e);
  }
}
