import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
export default function TermsPage() {
  const navigate = useNavigate();
  const {
    t
  } = useLanguage();
  return <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-header text-header-foreground px-4 py-4 flex items-center justify-center relative sticky top-0 z-10">
        <button onClick={() => navigate("/settings")} className="absolute left-0 p-1">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="font-semibold text-sm">{t("terms.title")}</h1>
      </header>

      {/* Content */}
      <div className="bg-white p-6">
        <h2 className="font-bold text-primary mb-4 text-sm text-center">{t("terms.heading")}</h2>

        <p className="text-muted-foreground mb-6 text-sm">{t("terms.updated_date")}</p>

        {/* Data Collection Section */}
        <div className="mb-6">
          <h3 className="font-semibold text-foreground mb-3 text-sm">{t("terms.collection_title")}</h3>
          <p className="text-foreground leading-relaxed mb-3 text-sm">{t("terms.collection_intro")}</p>
          <ul className="space-y-2 ml-4">
            <li className="text-foreground leading-relaxed text-sm">
              <span className="font-semibold">{t("terms.personal_data")}</span> {t("terms.personal_data_desc")}
            </li>
            <li className="text-foreground leading-relaxed text-sm">
              <span className="font-semibold">{t("terms.technical_data")}</span> {t("terms.technical_data_desc")}
            </li>
            <li className="text-foreground leading-relaxed text-sm">
              <span className="font-semibold">{t("terms.price_data")}</span> {t("terms.price_data_desc")}
            </li>
            <li className="text-foreground leading-relaxed text-sm">
              <span className="font-semibold">{t("terms.financial_data")}</span> {t("terms.financial_data_desc")}
            </li>
            <li className="text-foreground leading-relaxed text-sm">
              <span className="font-semibold">{t("terms.communication_data")}</span>{" "}
              {t("terms.communication_data_desc")}
            </li>
          </ul>
        </div>

        {/* How We Use Data Section */}
        <div className="mb-6">
          <h3 className="font-semibold text-foreground mb-3 text-sm">{t("terms.usage_title")}</h3>
          <p className="text-foreground leading-relaxed mb-3 text-sm">{t("terms.usage_intro")}</p>
          <ul className="space-y-2 ml-4">
            <li className="text-foreground leading-relaxed text-sm">{t("terms.usage_1")}</li>
            <li className="text-foreground leading-relaxed text-sm">{t("terms.usage_2")}</li>
            <li className="text-foreground leading-relaxed text-sm">{t("terms.usage_3")}</li>
            <li className="text-foreground leading-relaxed text-sm">{t("terms.usage_4")}</li>
            <li className="text-foreground leading-relaxed text-sm">{t("terms.usage_5")}</li>
            <li className="text-foreground leading-relaxed text-sm">{t("terms.usage_6")}</li>
          </ul>
        </div>

        {/* Data Sharing Section */}
        <div>
          <h3 className="font-semibold text-foreground mb-3 text-sm">{t("terms.sharing_title")}</h3>
          <p className="text-foreground leading-relaxed mb-3 text-sm">{t("terms.sharing_intro")}</p>
          <ul className="space-y-2 ml-4">
            <li className="text-sm text-foreground leading-relaxed">
              <span className="font-semibold text-sm">{t("terms.sharing_provider")}</span>
              <div className="ml-4 mt-1">{t("terms.sharing_provider_desc")}</div>
            </li>
            <li className="text-foreground leading-relaxed text-sm">
              <span className="font-semibold text-sm">{t("terms.sharing_legal")}</span> {t("terms.sharing_legal_desc")}
            </li>
            <li className="text-foreground leading-relaxed text-sm">
              <span className="font-semibold text-sm">{t("terms.sharing_anonymous")}</span> {t("terms.sharing_anonymous_desc")}
            </li>
          </ul>
        </div>
      </div>
    </div>;
}