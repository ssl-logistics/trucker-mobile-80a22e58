// TEMPORARY verification page for JobDocumentsSheet — will be removed after visual check.
import { useState } from "react";
import JobDocumentsSheet from "@/components/job/JobDocumentsSheet";
import { Button } from "@/components/ui/button";

export default function TempDocsTest() {
  const [open, setOpen] = useState(true);
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Button onClick={() => setOpen(true)}>Open docs</Button>
      <JobDocumentsSheet open={open} onOpenChange={setOpen} orderNumber="OR20260923009" />
    </div>
  );
}
