import { requireAdmin } from "@/lib/admin/auth";
import { getPolicySettings } from "@/lib/cms/policies";
import { makeCancellationForm } from "@/lib/policies";
export async function GET() {
  try {
    await requireAdmin();
    return new Response(makeCancellationForm(await getPolicySettings()), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="seen-draft-cancellation-form.txt"',
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch {
    return new Response(null, {
      status: 401,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
}
