"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/app/(app)/login/actions";
import type { User } from "@/lib/domain/types";
import { isWorkspacePath, userInitials } from "@/lib/workspace-navigation";
import { PairingMark } from "./illustrations";

const MARKETING = [["/bench", "Bench"], ["/jobs", "Jobs"], ["/how-it-works", "How it works"], ["/builders", "For builders"], ["/counterparts", "For counterparts"], ["/investors", "For investors"]];
type NavUser = Pick<User, "name" | "email" | "roles">;

function AccountMenu({ user }: { user: NavUser }) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  const itemClass = "block rounded-lg px-3 py-2.5 text-sm hover:bg-surface focus-visible:bg-surface";
  return <div ref={container} className="relative" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <button ref={trigger} type="button" aria-label={`Account menu for ${user.name}`} aria-expanded={open} aria-controls="account-menu" onClick={() => setOpen(!open)} className="flex items-center gap-2 rounded-full p-1 hover:bg-surface">
      <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand ring-1 ring-brand/15">{userInitials(user.name)}</span>
      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={`mr-1 text-muted transition-transform ${open ? "rotate-180" : ""}`}><path d="m6 9 6 6 6-6" /></svg>
    </button>
    {open && <div id="account-menu" className="absolute right-0 top-full z-40 mt-3 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-bg p-2 shadow-soft">
      <div className="border-b border-line px-3 py-3 mb-1"><p className="font-medium break-words">{user.name}</p><p className="mt-1 break-all text-xs text-muted">{user.email}</p><p className="mt-2 text-xs capitalize text-brand">{user.roles.join(" · ")}</p></div>
      <nav aria-label="Your account" onClick={() => setOpen(false)}>
        <Link className={itemClass} href="/dashboard">Your dashboard</Link>
        <Link className={itemClass} href="/settings/verification">Account & verification</Link>
        <Link className={itemClass} href="/support">Help & support</Link>
        {user.roles.includes("admin") && <Link className={itemClass} href="/admin">Admin operations</Link>}
        <div className="my-1 border-t border-line" />
        <Link className={itemClass} href="/bench">Explore the Bench <span aria-hidden="true">↗</span></Link>
        <Link className={itemClass} href="/jobs">Browse jobs <span aria-hidden="true">↗</span></Link>
      </nav>
      <form action={signOut} className="mt-1 border-t border-line pt-1"><button className={`${itemClass} w-full text-left text-red`} type="submit">Sign out</button></form>
    </div>}
  </div>;
}

export function Navigation({ user, unread }: { user: NavUser | null; unread: number }) {
  const pathname = usePathname();
  const workspace = isWorkspacePath(pathname);
  const links = [["/dashboard", "Overview"], ["/pairings", "Pairings"], ...(user?.roles.some(role => role === "builder" || role === "admin") ? [["/ventures", "Ventures"]] : []), ...(user?.roles.includes("admin") ? [["/admin", "Administration"]] : [])];
  return <header className="sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur-md">
    <div className="mx-auto flex min-h-18 max-w-6xl items-center gap-4 px-4 sm:px-6">
      <Link href={workspace && user ? "/dashboard" : "/"} aria-label={workspace && user ? "Counterpart dashboard" : "Counterpart home"} className="flex shrink-0 items-center gap-2.5"><PairingMark size={26} /><span className="text-base font-medium tracking-tight">Counterpart</span></Link>
      {workspace ? <span className="hidden border-l border-line pl-4 text-xs text-muted sm:block">Workspace</span> : <nav aria-label="Explore Counterpart" className="hidden flex-1 items-center justify-center gap-1 lg:flex">{MARKETING.map(([href, label]) => <Link key={href} href={href} className="rounded-full px-2 py-2 text-xs text-muted hover:bg-surface hover:text-fg">{label}</Link>)}</nav>}
      <div className="ml-auto flex items-center gap-3 sm:gap-5">
        {user ? <>
          {!workspace && <Link href="/dashboard" className="hidden text-sm text-muted hover:text-fg sm:block">Dashboard</Link>}
          <Link href="/notifications" aria-label={`Inbox${unread ? `, ${unread} unread` : ""}`} className="relative flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-fg">
            <svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
            {unread > 0 && <span className="absolute -right-1 top-0 min-w-4 rounded-full bg-brand px-1 text-center text-[10px] leading-4 text-white">{unread > 99 ? "99+" : unread}</span>}
          </Link>
          <AccountMenu key={pathname} user={user} />
        </> : <Link href="/login" className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-ink">Sign in</Link>}
      </div>
    </div>
    {workspace && user ? <nav aria-label="Workspace" className="mx-auto flex max-w-6xl gap-5 overflow-x-auto px-4 sm:gap-7 sm:px-6">{links.map(([href, label]) => {
      const active = pathname === href || pathname.startsWith(`${href}/`);
      return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`shrink-0 border-b-2 py-3 text-sm ${active ? "border-brand font-medium text-brand" : "border-transparent text-muted hover:border-line-strong hover:text-fg"}`}>{label}</Link>;
    })}</nav> : !workspace && <nav aria-label="Browse Counterpart" className="flex gap-5 overflow-x-auto border-t border-line px-4 py-3 text-sm lg:hidden">{MARKETING.map(([href, label]) => <Link key={href} href={href} className="shrink-0 text-muted hover:text-fg">{label}</Link>)}</nav>}
  </header>;
}
