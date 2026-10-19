import { makeCancellationForm } from "@/lib/policies";
import { getPolicySettings } from "@/lib/cms/policies";

export async function GET() {
  return new Response(makeCancellationForm(await getPolicySettings()), { headers: {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Disposition": 'attachment; filename="seen-cancellation-form.txt"',
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex, nofollow",
  } });
}
