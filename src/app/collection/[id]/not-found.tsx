import { ArrowLeft } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export default function PieceNotFound() {
  return <div className="container piece-not-found"><h1>This piece could not be found.</h1><p>Return to the collection to explore the SEEN edit.</p><ButtonLink href="/collection"><ArrowLeft size={17} aria-hidden="true" />Back to the collection</ButtonLink></div>;
}
