import { Suspense } from 'react';
import { PageState } from '@/components/ui/page-state';
import { LibraryBrowser } from '@/features/library/library-browser';

export default function LibraryPage() {
  return <Suspense fallback={<PageState/>}><LibraryBrowser/></Suspense>;
}
