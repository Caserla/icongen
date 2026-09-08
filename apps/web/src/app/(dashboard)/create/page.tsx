"use client";
import { GenerationForm } from "@/features/generation/components/generation-form";
export default function CreatePage() {
  return (
    <div className="create-studio">
      <section className="create-studio__workspace">
        <GenerationForm />
      </section>
    </div>
  );
}
