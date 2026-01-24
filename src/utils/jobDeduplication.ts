/**
 * Utility functions for deduplicating jobs based on order_number/order_code
 * Ensures that jobs from multiple API sources are merged correctly
 */

interface JobWithOrderCode {
  id?: string;
  order_code?: string;
  order_number?: string;
  isFactoryJob?: boolean;
  [key: string]: unknown;
}

/**
 * Deduplicate jobs by order_number/order_code
 * When duplicates are found, factory job data takes priority
 * 
 * @param jobs - Array of jobs to deduplicate
 * @param priorityKey - Key to identify priority source (default: 'isFactoryJob')
 * @returns Deduplicated array of jobs
 */
export function deduplicateJobs<T extends JobWithOrderCode>(
  jobs: T[],
  priorityKey: keyof T = 'isFactoryJob' as keyof T
): T[] {
  const jobMap = new Map<string, T>();

  for (const job of jobs) {
    const key = job.order_number || job.order_code || job.id;
    if (!key) continue;

    const existing = jobMap.get(key);
    
    if (!existing) {
      jobMap.set(key, job);
    } else {
      // If current job has priority (e.g., is a factory job), use it
      // Otherwise keep the existing one
      const currentHasPriority = Boolean(job[priorityKey]);
      const existingHasPriority = Boolean(existing[priorityKey]);
      
      if (currentHasPriority && !existingHasPriority) {
        // Merge data, prioritizing current job
        jobMap.set(key, { ...existing, ...job });
      } else if (!currentHasPriority && existingHasPriority) {
        // Keep existing but merge any missing data
        jobMap.set(key, { ...job, ...existing });
      }
      // If both have same priority, keep the first one
    }
  }

  return Array.from(jobMap.values());
}

/**
 * Filter out jobs that have specific order codes
 * Useful for excluding already-accepted jobs or pending factory jobs
 * 
 * @param jobs - Array of jobs to filter
 * @param excludeOrderCodes - Set of order codes to exclude
 * @returns Filtered array of jobs
 */
export function filterByOrderCodes<T extends JobWithOrderCode>(
  jobs: T[],
  excludeOrderCodes: Set<string>
): T[] {
  return jobs.filter(job => {
    const orderCode = job.order_number || job.order_code;
    return !orderCode || !excludeOrderCodes.has(orderCode);
  });
}

/**
 * Create a set of order codes from jobs
 * 
 * @param jobs - Array of jobs
 * @param filterFn - Optional filter function to select which jobs to include
 * @returns Set of order codes
 */
export function extractOrderCodes<T extends JobWithOrderCode>(
  jobs: T[],
  filterFn?: (job: T) => boolean
): Set<string> {
  const filtered = filterFn ? jobs.filter(filterFn) : jobs;
  return new Set(
    filtered
      .map(job => job.order_number || job.order_code)
      .filter((code): code is string => Boolean(code))
  );
}

/**
 * Check if a job with the given order code already exists in the list
 * 
 * @param jobs - Array of jobs to check
 * @param orderCode - Order code to look for
 * @returns True if job exists, false otherwise
 */
export function hasJobWithOrderCode<T extends JobWithOrderCode>(
  jobs: T[],
  orderCode: string
): boolean {
  return jobs.some(job => 
    (job.order_number === orderCode) || (job.order_code === orderCode)
  );
}

/**
 * Merge jobs from multiple sources with deduplication
 * Factory jobs take priority over company jobs
 * 
 * @param companyJobs - Jobs from company API
 * @param factoryJobs - Jobs from factory API (higher priority)
 * @returns Merged and deduplicated array
 */
export function mergeJobSources<T extends JobWithOrderCode>(
  companyJobs: T[],
  factoryJobs: T[]
): T[] {
  // Mark factory jobs
  const markedFactoryJobs = factoryJobs.map(job => ({
    ...job,
    isFactoryJob: true
  }));

  // Mark company jobs (if not already marked)
  const markedCompanyJobs = companyJobs.map(job => ({
    ...job,
    isFactoryJob: job.isFactoryJob ?? false
  }));

  // Combine and deduplicate, factory jobs take priority
  return deduplicateJobs([...markedCompanyJobs, ...markedFactoryJobs]);
}
