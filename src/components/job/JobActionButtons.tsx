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
  checkinType?: 'container_pickup' | 'container_return';
  completedAt?: string | null;
  jobData?: any;
}

export default function JobActionButtons({ jobId, orderNumber, isPodCompleted, checkinType, completedAt, jobData }: JobActionButtonsProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const [isReportDrawerOpen, setIsReportDrawerOpen] = useState(false);
  
  const isFromHistory = new URLSearchParams(location.search).get('from') === 'history';

  // Hide non-expense buttons when POD is completed, but still show expense buttons from history
  const hideNonExpenseButtons = isPodCompleted || isFromHistory;
  
  // Hide expense buttons for container return in history view
  const hideExpenseButtons = isFromHistory && checkinType === 'container_return';

  // Check if more than 3 days have passed since completion (only applies in history view)
  const isExpired = (() => {
    if (!isFromHistory || !completedAt) return false;
    const completedDate = new Date(completedAt);
    const now = new Date();
    const diffMs = now.getTime() - completedDate.getTime();
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    return diffMs > threeDaysMs;
  })();

  // If expired in history view (more than 3 days after completion), hide everything
  if (isExpired) {
    return null;
  }

  // If POD completed and not from history, hide everything
  if (isPodCompleted && !isFromHistory) {
    return null;
  }

  return (
    <>
      <div className={`grid gap-3 ${hideExpenseButtons ? 'hidden' : hideNonExpenseButtons ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {!hideExpenseButtons && (
          <>
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
          </>
        )}

        {!hideNonExpenseButtons && (
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
