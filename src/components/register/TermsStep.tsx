import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
interface TermsStepProps {
  onNext: (data: any) => void;
}
const TermsStep = ({
  onNext
}: TermsStepProps) => {
  const {
    t
  } = useLanguage();
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
  return <div className="flex flex-col max-h-[calc(100vh-200px)]">
      <div className="text-center mb-6 flex-shrink-0">
        <h2 className="text-xl font-bold text-foreground mb-2">
          {t('termsStep.title')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('termsStep.effectiveDate')}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6 text-sm text-foreground mb-6 pr-2" onScroll={handleScroll} style={{
      maxHeight: 'calc(100vh - 350px)'
    }}>
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

      {/* Sticky bottom section */}
      <div className="flex-shrink-0 pt-4 space-y-3">
        {/* Scroll indicator bar */}
        <div className="flex items-center rounded-lg p-3 border border-gray-200 gap-[12px] bg-[#292929]">
          <p className="flex-1 text-sm text-primary-foreground">
            {t('termsStep.scrollMessage')}
          </p>
          <Button onClick={handleAccept} disabled={!canAccept} variant="outline" className="px-5 h-9 rounded-lg text-sm font-medium border-2 border-[#48BB78] text-[#48BB78] bg-white hover:bg-[#48BB78] hover:text-white disabled:border-gray-300 disabled:text-gray-400 disabled:bg-gray-100">
            {t('termsStep.ok')}
          </Button>
        </div>
        
        {/* Accept button */}
        <Button onClick={handleAccept} disabled={!canAccept} className="w-full text-white rounded-xl h-12 text-base font-medium bg-[#153860] hover:bg-[#235A99] disabled:bg-gray-300 disabled:text-gray-500">
          {t('termsStep.accept')}
        </Button>
      </div>
    </div>;
};
export default TermsStep;