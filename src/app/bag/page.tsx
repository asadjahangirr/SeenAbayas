import { pageMetadata } from "@/lib/cms/metadata";
import type { Metadata } from "next";
import { BagPageContent } from "@/components/bag/bag-page";

const baseMetadata: Metadata = { title: "Your shopping bag", robots: { index: false, follow: false } };
export default function BagPage() { return <BagPageContent />; }

export async function generateMetadata(): Promise<Metadata> { return pageMetadata(baseMetadata); }
