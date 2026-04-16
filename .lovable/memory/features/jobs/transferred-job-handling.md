---
name: Transferred Job UI Handling
description: Jobs with is_transferred:true are excluded from CurrentJobsPage and shown in JobHistoryPage with grey card styling
type: feature
---
When `get-driver-assigned-jobs` returns jobs with `is_transferred: true`:
1. **CurrentJobsPage**: Filters out transferred jobs from active job list (both internal/external and freelance paths)
2. **JobHistoryPage**: Includes transferred jobs in history alongside completed jobs
3. **HistoryJobCard**: Shows transferred jobs with grey background (`bg-gray-100 opacity-75`), grey badges, and "ถูกโอนงาน" status instead of green "เสร็จสิ้น"
4. Translation key: `jobStatus.transferred` (TH: ถูกโอนงาน, EN: Transferred, KO: 이관됨, ZH: 已转移)
