import { createRoot } from 'react-dom/client';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/toaster';
import JobDocumentsSheet from '@/components/job/JobDocumentsSheet';

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <JobDocumentsSheet open onOpenChange={() => {}} orderNumber="OR20261007026/01" />
        <Toaster />
      </AuthProvider>
    </LanguageProvider>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
