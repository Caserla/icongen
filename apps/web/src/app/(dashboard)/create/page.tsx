import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { GenerationForm } from "@/features/generation/components/generation-form";

export const metadata: Metadata = { title: "Create" };

export default function CreatePage() {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="New generation" title="Describe the icon your app needs" description="Give the model product context and a visual direction. The final input fields will be confirmed in the image-generation module specification." />
      <Card className="max-w-3xl"><GenerationForm /></Card>
    </div>
  );
}
