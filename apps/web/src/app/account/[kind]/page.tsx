import { notFound } from "next/navigation";
import Link from "next/link";
import { accountAction } from "../actions";
import { Button, INPUT_CLASS, Notice } from "@/components/ui";
export default async function AccountPage({params,searchParams}:{params:Promise<{kind:string}>;searchParams:Promise<Record<string,string>>}) {
 const {kind}=await params;const q=await searchParams;
 const titles:Record<string,string>={forgot:"Reset your password",reset:"Choose a new password",verify:"Verify your email"};
 if(!titles[kind]) notFound();
 return <div className="max-w-lg mx-auto px-5 py-16 space-y-6"><h1 className="display text-4xl">{titles[kind]}</h1>{q.error && <Notice tone="red">{q.error}</Notice>}{q.message && <Notice tone="green">{q.message}</Notice>}
 {!q.message && <form action={accountAction} className="space-y-5"><input type="hidden" name="kind" value={kind}/><input type="hidden" name="token" value={q.token??""}/>
 {kind==="forgot" && <label className="block text-sm">Account email<input name="email" type="email" autoComplete="email" required className={INPUT_CLASS}/></label>}
 {kind==="reset" && <label className="block text-sm">New password<input name="password" type="password" minLength={12} maxLength={128} autoComplete="new-password" required className={INPUT_CLASS}/></label>}
 {kind==="verify" && <p className="text-muted">Confirm ownership of the email address associated with this link. This does not verify business claims or company authority.</p>}
 <Button disabled={kind!=="forgot" && !q.token}>{kind==="forgot"?"Send reset link":kind==="reset"?"Change password":"Verify email"}</Button></form>}
 <div className="flex gap-4 text-sm underline"><Link href="/login">Sign in</Link><Link href="/account/forgot">Request a new reset link</Link></div></div>;
}
