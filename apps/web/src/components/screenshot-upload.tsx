"use client";
import { useEffect, useState } from "react";
import { platform } from "@/lib/api/browser";
import { Field, INPUT_CLASS } from "./ui";

export function ScreenshotUpload({ productUrl, error }: { productUrl: string; error?: string }) {
  const [urls, setUrls] = useState("");
  const [logo, setLogo] = useState("");
  const [previewStatus, setPreviewStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  useEffect(() => {
    if (!/^https?:\/\//.test(productUrl)) return;
    let active = true;
    platform<{image: string | null; logo: string | null}>("website-preview", {url: productUrl}).then(data => {
      if (!active) return;
      setUrls(previous => previous || data.image || "");
      setLogo(previous => previous || data.logo || "");
      setPreviewStatus(data.image || data.logo ? "Website images found. You can replace or remove them below." : "No website images found. Upload your own below.");
    }).catch(() => { if (active) setPreviewStatus("Website preview unavailable. Upload your own images below."); });
    return () => { active = false; };
  }, [productUrl]);
  return <div className="flex flex-col gap-3">
    {previewStatus && <p role="status" className="text-sm text-muted">{previewStatus}</p>}
    <Field htmlFor="screenshot-file" label="Product screenshots" hint="PNG, JPEG or WebP, up to 4 MB each. Uploaded screenshots are publicly accessible.">
      <input id="screenshot-file" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} className={INPUT_CLASS} onChange={async event => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (file.size > 4 * 1024 * 1024) { setProblem("Choose an image of 4 MB or smaller."); return; }
        setBusy(true); setProblem("");
        const data = new FormData(); data.append("file", file);
        try { const asset = await platform<{url: string}>("assets", data); setUrls(previous => [previous, asset.url].filter(Boolean).join("\n")); }
        catch (err) { setProblem((err as Error).message); }
        finally { setBusy(false); }
      }} />
    </Field>
    {busy && <p role="status" className="text-sm text-muted">Uploading screenshot…</p>}
    {problem && <p role="alert" className="text-sm text-red">{problem}</p>}
    <Field htmlFor="screenshots" label="Screenshot URLs" error={error} hint="Uploaded image URLs appear here. You can also paste a public image URL on each line.">
      <textarea id="screenshots" name="screenshots" rows={2} value={urls} onChange={event => setUrls(event.target.value)} className={INPUT_CLASS} />
    </Field>
    {/^https?:\/\//.test(urls.split("\n")[0]) && <div className="rounded-xl border border-line bg-surface p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={urls.split("\n")[0]} alt="Project cover preview" className="w-full h-48 object-contain" referrerPolicy="no-referrer" />
    </div>}
    <Field htmlFor="logoUrl" label="Project logo URL (optional)" hint="Square, wide and tall logos keep their original proportions.">
      <input id="logoUrl" name="logoUrl" type="url" value={logo} onChange={event => setLogo(event.target.value)} className={INPUT_CLASS} />
      <input aria-label="Upload project logo" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} className={INPUT_CLASS} onChange={async event => {
        const file = event.target.files?.[0]; if (!file) return;
        if (file.size > 4 * 1024 * 1024) { setProblem("Choose a logo of 4 MB or smaller."); return; }
        setBusy(true); setProblem("");
        const data = new FormData(); data.append("file", file);
        try { setLogo((await platform<{url: string}>("assets", data)).url); }
        catch (err) { setProblem((err as Error).message); }
        finally { setBusy(false); }
      }} />
    </Field>
    {/^https?:\/\//.test(logo) && <div className="w-40 h-24 p-3 rounded-xl border border-line bg-surface">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo} alt="Project logo preview" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
    </div>}
  </div>;
}
