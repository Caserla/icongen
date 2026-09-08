"use client";
import { PageState } from "@/components/ui/page-state";
export default function ErrorPage({reset}:{reset:()=>void}){return <PageState kind="error" onRetry={reset}/>}
