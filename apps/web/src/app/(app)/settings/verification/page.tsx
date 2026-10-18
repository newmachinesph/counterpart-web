import { accountAction } from "@/app/account/actions";
import { Notice, Button } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { api } from "@/lib/api/client";
import { PageHeader } from "@/components/ui";
import { VerificationCard } from "./verification-card";

export default async function VerificationPage({searchParams}:{searchParams:Promise<Record<string,string>>}) {
  const q=await searchParams;
  const user = await requireUser("/settings/verification");
  const data = await api<{ configured: boolean; session: { status: string } | null }>("/verification");
  return <><PageHeader title="Your account" description={`${user.name} · ${user.email}`} /><div className="mb-8 space-y-4">{q.error && <Notice tone="red">{q.error}</Notice>}{q.message && <Notice tone="green">{q.message}</Notice>}<Notice>{user.emailVerifiedAt ? "Your email is verified. This does not verify business claims or company authority." : "Verify your email before making or accepting offers."}</Notice>{!user.emailVerifiedAt && <form action={accountAction}><input type="hidden" name="kind" value="resend"/><Button>Send verification email</Button></form>}</div><VerificationCard configured={data.configured} status={data.session?.status ?? null} /></>;
}
