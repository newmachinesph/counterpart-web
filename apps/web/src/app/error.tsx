"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <div className="max-w-xl mx-auto px-6 py-24"><h1 className="display text-4xl">We could not load this page.</h1><p className="mt-4 text-muted">Please try again in a moment. Your saved work is still on record.</p><button onClick={reset} className="mt-6 rounded-full bg-brand px-6 py-3 text-white">Try again</button></div>;
}
