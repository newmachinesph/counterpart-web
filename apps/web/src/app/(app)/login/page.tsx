import { PairingMark } from "@/components/illustrations";
import Link from "next/link";
import { authenticate } from "./actions";
export const metadata = { title: "Sign in" };
export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const register = q.mode === "register";
  const input = "w-full rounded-xl border border-line px-4 py-3 mt-2";
  return <div className="max-w-md mx-auto py-8 sm:py-16">
    <PairingMark size={48} />
    <h1 className="display text-4xl mt-6">{register ? "Find your counterpart." : "Welcome back."}</h1>
    <p className="text-muted mt-3">{register ? "Create an account to list a venture or find a paid commercial role." : "Sign in to your ventures, applications, and pairings."}</p>
    {q.error && <p role="alert" className="mt-5 rounded-xl bg-red-bg text-red p-4 text-sm">{q.error}</p>}
    {q.need && <p role="status" className="mt-5 text-sm text-muted">This page requires a {q.need} account. Sign in with the appropriate account.</p>}
    <form action={authenticate} className="mt-8 space-y-5">
      <input type="hidden" name="mode" value={register ? "register" : "login"} />
      <input type="hidden" name="next" value={q.next ?? "/dashboard"} />
      {register && <label className="block text-sm">Your name<input name="name" autoComplete="name" minLength={2} maxLength={120} required className={input} /></label>}
      <label className="block text-sm">Email<input name="email" type="email" autoComplete="email" required className={input} /></label>
      <label className="block text-sm">Password<input name="password" type="password" autoComplete={register ? "new-password" : "current-password"} minLength={12} maxLength={128} required className={input} />{register && <span className="block mt-2 text-muted">Use at least 12 characters.</span>}</label>
      {register && <label className="block text-sm">I want to<select name="role" className={input}><option value="builder">List a product I have built</option><option value="counterpart">Grow a venture as a Counterpart</option></select></label>}
      {register && <label className="flex gap-2 text-sm"><input type="checkbox" name="acceptPlatformTerms" required/><span>I am an adult and accept the <Link href="/terms" className="underline">platform terms</Link>. I have read the <Link href="/privacy" className="underline">privacy notice</Link>.</span></label>}
      <button className="w-full rounded-full bg-brand text-white py-3 font-medium">{register ? "Create account" : "Sign in"}</button>
    </form>
    {!register && <p className="mt-4 text-sm"><Link href="/account/forgot" className="underline">Forgot your password?</Link></p>}
    <p className="mt-6 text-sm text-muted">{register ? "Already have an account? " : "New to Counterpart? "}<Link className="underline text-fg" href={`/login?mode=${register ? "login" : "register"}&next=${encodeURIComponent(q.next ?? "/dashboard")}`}>{register ? "Sign in" : "Create an account"}</Link></p>
  </div>;
}
