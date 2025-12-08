import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import ReportProblemDrawer from "./ReportProblemDrawer";
import expenseViewIcon from '@/assets/expense-view-icon.svg';
import expenseAddIcon from '@/assets/expense-add-icon.svg';
import reportProblemIcon from '@/assets/report-problem-icon.svg';

interface JobActionButtonsProps {
  jobId?: string;
}

export default function JobActionButtons({ jobId }: JobActionButtonsProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const [isReportDrawerOpen, setIsReportDrawerOpen] = useState(false);

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <button 
          className="flex flex-col items-center gap-1 text-[#0A8778]"
          onClick={() => navigate(`/job/${jobId}/route-expenses`)}
        >
          <img src={expenseViewIcon} alt="" className="w-8 h-8" />
          <span className="text-xs font-medium">{t('jobActions.viewExpenses')}</span>
        </button>

        <button 
          className="flex flex-col items-center gap-1 text-[#0A8778]"
          onClick={() => navigate(`/job/${jobId}/add-expense`, { state: { returnPath: location.pathname } })}
        >
          <img src={expenseAddIcon} alt="" className="w-8 h-8" />
          <span className="text-xs font-medium">{t('jobActions.addExpense')}</span>
        </button>

        <button 
          className="flex flex-col items-center gap-1 text-[#0A8778]"
          onClick={() => setIsReportDrawerOpen(true)}
        >
          <img src={reportProblemIcon} alt="" className="w-8 h-8" />
          <span className="text-xs font-medium">{t('jobActions.reportProblem')}</span>
        </button>
      </div>

      <ReportProblemDrawer
        open={isReportDrawerOpen}
        onOpenChange={setIsReportDrawerOpen}
        jobId={jobId}
      />
    </>
  );
}
