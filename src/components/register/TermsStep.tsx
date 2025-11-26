import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

interface TermsStepProps {
  onNext: (data: any) => void;
}

const TermsStep = ({ onNext }: TermsStepProps) => {
  const { t } = useLanguage();
  const handleAccept = () => {
    onNext({});
  };
  const [canAccept, setCanAccept] = useState(false);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const isAtBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 50;
    if (isAtBottom) {
      setCanAccept(true);
    }
  };

  return (
    <div className="flex flex-col max-h-[calc(100vh-200px)]">
      <div className="text-center mb-6 flex-shrink-0">
        <h2 className="text-xl font-bold text-foreground mb-2">
          {t('termsStep.title')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('termsStep.effectiveDate')}
        </p>
      </div>

      <div 
        className="flex-1 overflow-y-auto space-y-6 text-sm text-foreground mb-6 pr-2"
        onScroll={handleScroll}
        style={{ maxHeight: 'calc(100vh - 350px)' }}
      >
        <section>
          <h3 className="font-semibold mb-2">{t('terms.collection_title')}</h3>
          <p className="mb-2">
            {t('terms.collection_intro')}
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>{t('terms.personal_data')}</strong> {t('terms.personal_data_desc')}
            </li>
            <li>
              <strong>{t('terms.technical_data')}</strong> {t('terms.technical_data_desc')}
            </li>
            <li>
              <strong>{t('terms.price_data')}</strong> {t('terms.price_data_desc')}
            </li>
            <li>
              <strong>{t('terms.financial_data')}</strong> {t('terms.financial_data_desc')}
            </li>
            <li>
              <strong>{t('terms.communication_data')}</strong> {t('terms.communication_data_desc')}
            </li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold mb-2">{t('terms.usage_title')}</h3>
          <p className="mb-2">{t('terms.usage_intro')}</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>{t('terms.usage_1')}</li>
            <li>{t('terms.usage_2')}</li>
            <li>{t('terms.usage_3')}</li>
            <li>{t('terms.usage_4')}</li>
            <li>{t('terms.usage_5')}</li>
            <li>{t('terms.usage_6')}</li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold mb-2">{t('terms.sharing_title')}</h3>
          <p className="mb-2">
            {t('terms.sharing_intro')}
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>{t('terms.sharing_provider')}</strong> {t('terms.sharing_provider_desc')}
            </li>
            <li>
              <strong>{t('terms.sharing_legal')}</strong> {t('terms.sharing_legal_desc')}
            </li>
            <li>
              <strong>{t('terms.sharing_anonymous')}</strong> {t('terms.sharing_anonymous_desc')}
            </li>
          </ul>
        </section>

        <div className="h-20" />
      </div>

      <div className="flex-shrink-0 pt-4 border-t border-border">
        <Button
          onClick={handleAccept}
          disabled={!canAccept}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-12 text-base font-medium disabled:bg-muted disabled:text-muted-foreground"
        >
          {canAccept ? t('termsStep.accept') : t('termsStep.scrollToAccept')}
        </Button>
        {!canAccept && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            {t('termsStep.scrollMessage')}
          </p>
        )}
      </div>
    </div>
  );
};

export default TermsStep;
