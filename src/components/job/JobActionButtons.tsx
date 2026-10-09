import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import ReportProblemDrawer from "./ReportProblemDrawer";
import JobDocumentsSheet from "./JobDocumentsSheet";
import expenseViewIcon from '@/assets/expense-view-icon.svg';
import expenseAddIcon from '@/assets/expense-add-icon.svg';
import reportProblemIcon from '@/assets/report-problem-icon.svg';
import documentsIcon from '@/assets/documents-icon.svg';
import { isHistoryContext } from '@/lib/historyMode';

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
  const [isDocumentsSheetOpen, setIsDocumentsSheetOpen] = useState(false);
  
  const isFromHistory = isHistoryContext(location.search, location.state);

  // Documents menu intro card: shown once per account (every time on preview hosts)
  const docIntroUserId = String(localStorage.getItem('auth_driver_id') || '');
  const docIntroKey = docIntroUserId ? `documents_menu_intro_ack:${docIntroUserId}` : '';
  const isPreviewHost = typeof window !== 'undefined' && window.location.hostname.includes('id-preview--');
  const [showDocsIntro, setShowDocsIntro] = useState(() => !isPreviewHost && !isFromHistory && !!docIntroKey && localStorage.getItem(docIntroKey) !== '1');
  const docsIntroRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (showDocsIntro) {
      const timer = setTimeout(() => docsIntroRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
      return () => clearTimeout(timer);
    }
  }, [showDocsIntro]);
  const ackDocumentsIntro = () => {
    if (docIntroKey) localStorage.setItem(docIntroKey, '1');
    setShowDocsIntro(false);
  };

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

  // Documents are read-only, so they stay visible in history like "ดูค่าใช้จ่าย"
  const visibleCount =
    1 + // documents (always visible while this component renders)
    (!hideExpenseButtons ? 1 : 0) +
    (!hideExpenseButtons && !isFromHistory ? 1 : 0) + // add expense
    (!hideNonExpenseButtons ? 1 : 0); // report problem
  const gridClass =
    visibleCount >= 4 ? 'grid-cols-4' : visibleCount === 3 ? 'grid-cols-3' : visibleCount === 2 ? 'grid-cols-2' : 'grid-cols-1';

  return (
    <>
      <div className={`grid gap-3 ${hideExpenseButtons ? 'grid-cols-1' : gridClass}`}>
        {!hideExpenseButtons && (
          <>
            <button 
              className="flex flex-col items-center gap-1 text-primary"
              onClick={() => navigate(`/job/${encodeURIComponent(jobId)}/expenses${isFromHistory ? '?from=history' : ''}`, { state: { jobData, fromHistory: isFromHistory } })}
            >
              <img src={expenseViewIcon} alt="" className="w-8 h-8" />
              <span className="text-xs font-medium">{t('jobActions.viewExpenses')}</span>
            </button>

            {!isFromHistory && (
              <button 
                className="flex flex-col items-center gap-1 text-primary"
                onClick={() => navigate(`/job/${encodeURIComponent(jobId)}/add-expense`, { state: { returnPath: location.pathname, jobData } })}
              >
                <img src={expenseAddIcon} alt="" className="w-8 h-8" />
                <span className="text-xs font-medium">{t('jobActions.addExpense')}</span>
              </button>
            )}
          </>
        )}

        <div ref={docsIntroRef} className="relative">
          <button
            className={`flex flex-col items-center gap-1 text-primary w-full ${showDocsIntro ? 'ring-2 ring-orange-500 rounded-lg' : ''}`}
            onClick={() => {
              ackDocumentsIntro();
              setIsDocumentsSheetOpen(true);
            }}
          >
            <img src={documentsIcon} alt="" className="w-8 h-8" />
            <span className="text-xs font-medium">{t('jobActions.documents')}</span>
          </button>
          {showDocsIntro && (
            <div
              className="absolute left-1/2 -translate-x-1/2 top-full mt-3 z-30 w-64 max-w-[calc(100vw-2rem)] rounded-xl bg-card border border-orange-300 shadow-xl p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45 bg-card border-l border-t border-orange-300" />
              <p className="font-semibold text-orange-700 mb-1">{t('jobActions.documents_intro_title')}</p>
              <p className="text-sm text-muted-foreground mb-3">{t('jobActions.documents_intro_desc')}</p>
              <Button className="w-full bg-orange-500 hover:bg-orange-600" onClick={ackDocumentsIntro}>
                {t('jobActions.documents_intro_ack')}
              </Button>
            </div>
          )}
        </div>

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

      <JobDocumentsSheet
        open={isDocumentsSheetOpen}
        onOpenChange={setIsDocumentsSheetOpen}
        orderNumber={orderNumber || jobId}
        jobData={jobData}
      />
    </>
  );
}
