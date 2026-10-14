import { useState } from 'react';
import JobDocumentsSheet from '@/components/job/JobDocumentsSheet';
import { Button } from '@/components/ui/button';

// Temporary test page for the documents sheet — remove after verification
export default function DocsSheetTestPage() {
  const [open, setOpen] = useState(true);
  return (
    <div className="p-4">
      <Button onClick={() => setOpen(true)}>Open</Button>
      <JobDocumentsSheet open={open} onOpenChange={setOpen} orderNumber="OR20260910068" />
    </div>
  );
}
