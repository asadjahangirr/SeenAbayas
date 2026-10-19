
import { Copy } from "@/components/cms/content-provider";
import { ArrowLeft } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export default function PieceNotFound() {
  return <div className="container piece-not-found"><h1><Copy text={"This piece could not be found."} /></h1><p><Copy text={"Return to the collection to explore the SEEN edit."} /></p><ButtonLink href="/collection"><ArrowLeft size={17} aria-hidden="true" /><Copy text={"Back to the collection"} /></ButtonLink></div>;
}
