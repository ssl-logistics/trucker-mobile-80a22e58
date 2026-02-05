import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import ReportProblemDrawer from "./ReportProblemDrawer";
import expenseViewIcon from '@/assets/expense-view-icon.svg';
import expenseAddIcon from '@/assets/expense-add-icon.svg';
import reportProblemIcon from '@/assets/report-problem-icon.svg';

interface JobActionButtonsProps {
  jobId?: string;
  orderNumber?: string;
  isPodCompleted?: boolean;
}

export default function JobActionButtons({ jobId, orderNumber, isPodCompleted }: JobActionButtonsProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const [isReportDrawerOpen, setIsReportDrawerOpen] = useState(false);
  
  const isFromHistory = new URLSearchParams(location.search).get('from') === 'history';

  // Hide all buttons when POD is completed (similar to SOP success behavior)
  if (isPodCompleted) {
    return null;
  }

  return (
    <>
      <div className={`grid gap-3 ${isFromHistory ? 'grid-cols-2' : 'grid-cols-3'}`}>
        <button 
          className="flex flex-col items-center gap-1 text-primary"
          onClick={() => navigate(`/job/${jobId}/expenses`)}
        >
          <img src={expenseViewIcon} alt="" className="w-8 h-8" />
          <span className="text-xs font-medium">{t('jobActions.viewExpenses')}</span>
        </button>

        <button 
          className="flex flex-col items-center gap-1 text-primary"
          onClick={() => navigate(`/job/${jobId}/add-expense`, { state: { returnPath: location.pathname } })}
        >
          <img src={expenseAddIcon} alt="" className="w-8 h-8" />
          <span className="text-xs font-medium">{t('jobActions.addExpense')}</span>
        </button>

        {!isFromHistory && (
          <button 
            className="flex flex-col items-center gap-1 text-primary"
            onClick={() => setIsReportDrawerOpen(true)}
          >
            <img src={reportProblemIcon} alt="" className="w-8 h-8" />
            <span className="text-xs font-medium">{t('jobActions.reportProblem')}</span>
          </button>
        )}
      </div>

      <ReportProblemDrawer
        open={isReportDrawerOpen}
        onOpenChange={setIsReportDrawerOpen}
        jobId={jobId}
        orderNumber={orderNumber}
      />
    </>
  );
}
