import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { AuthProvider } from '@/contexts/AuthContext';
import JobDocumentsSheet from '@/components/job/JobDocumentsSheet';

function Harness() {
  const [open, setOpen] = useState(true);
  return (
    <LanguageProvider>
      <AuthProvider>
        <button id="reopen" onClick={() => setOpen(true)}>
          REOPEN
        </button>
        <JobDocumentsSheet open={open} onOpenChange={setOpen} orderNumber="OR20261007026/01" />
      </AuthProvider>
    </LanguageProvider>
  );
}

createRoot(document.getElementById('root')!).render(<Harness />);
