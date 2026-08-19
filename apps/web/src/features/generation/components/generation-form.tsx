"use client";

import { useState } from "react";
import { createGenerationSchema } from "@icongen/shared";

const presets = ["Minimal", "Playful", "Bold", "Soft 3D"];

export function GenerationForm() {
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = createGenerationSchema.safeParse({ description });
    setMessage(result.success ? "Form architecture is ready. API integration comes next." : "Please enter at least 10 characters.");
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <label className="block text-sm font-semibold">
        Describe your app and the icon direction
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={7} maxLength={1000} placeholder="A calm focus timer for remote teams, using a simple sunrise symbol and warm colors…" className="mt-2 w-full resize-y rounded-2xl border border-border bg-surface p-4 font-normal leading-7" />
      </label>
      <fieldset>
        <legend className="text-sm font-semibold">Optional style preset</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {presets.map((preset) => (
            <label key={preset} className="cursor-pointer rounded-full border border-border bg-surface px-4 py-2 text-sm hover:bg-surface-muted">
              <input type="radio" name="stylePreset" value={preset} className="mr-2" />{preset}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
        <p className="text-sm text-muted">This job will create 4 icon directions.</p>
        <button type="submit" className="min-h-12 rounded-xl bg-brand px-6 font-semibold text-white hover:bg-brand-strong">Generate 4 icons</button>
      </div>
      {message ? <p role="status" className="rounded-xl bg-surface-muted px-4 py-3 text-sm">{message}</p> : null}
    </form>
  );
}
