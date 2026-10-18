import { requireUser } from "@/lib/auth/session";
import { loadDashboardOr404 } from "../load";
import { notFound } from "next/navigation";
import { PageHeader, LinkButton } from "@/components/ui";
import { PairingChat } from "@/components/pairing-chat";

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/pairings/${id}/chat`);
  const { pairing, venture } = await loadDashboardOr404(user, id);
  if (![pairing.builderId, pairing.counterpartId].includes(user.id) && !user.roles.includes("admin")) notFound();
  return <><PageHeader title="Your conversation" description={venture.name} aside={<LinkButton href={`/pairings/${id}`} variant="secondary">Back to pairing</LinkButton>} /><PairingChat key={id} pairingId={id} userId={user.id} /></>;
}
