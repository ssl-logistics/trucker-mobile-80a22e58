import "./lib/installFetchWrapper";
import { createRoot } from "react-dom/client";
import "./index.css";
import { LanguageProvider } from "./contexts/LanguageContext";
import { AuthProvider } from "./contexts/AuthContext";
import JobDocumentsSheet from "./components/job/JobDocumentsSheet";

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(
    <LanguageProvider>
      <AuthProvider>
        <JobDocumentsSheet open onOpenChange={() => {}} orderNumber="OR20261007026/01" />
      </AuthProvider>
    </LanguageProvider>
  );
}
