// Truck type hierarchy - higher index = larger truck
// Larger trucks can take jobs requiring smaller trucks, but not vice versa

const TRUCK_TYPE_HIERARCHY: string[] = [
  '4ล้อ',
  '6ล้อ', 
  '10ล้อ',
  '10ล้อตู้',
  '10ล้อพ่วง',
  '18ล้อ',
  '22ล้อ',
  '40ล้อ',
];

// Map English truck types to Thai equivalents
const ENGLISH_TO_THAI_TRUCK_MAP: Record<string, string> = {
  '4-wheel': '4ล้อ',
  '4 wheel': '4ล้อ',
  '4wheel': '4ล้อ',
  '6-wheel': '6ล้อ',
  '6 wheel': '6ล้อ',
  '6wheel': '6ล้อ',
  '10-wheel': '10ล้อ',
  '10 wheel': '10ล้อ',
  '10wheel': '10ล้อ',
  '18-wheel': '18ล้อ',
  '18 wheel': '18ล้อ',
  '18wheel': '18ล้อ',
  '22-wheel': '22ล้อ',
  '22 wheel': '22ล้อ',
  '22wheel': '22ล้อ',
  '40-wheel': '40ล้อ',
  '40 wheel': '40ล้อ',
  '40wheel': '40ล้อ',
};

/**
 * Normalize truck type string to Thai format
 */
const normalizeTruckType = (truckType: string): string => {
  const trimmed = truckType.trim().toLowerCase();
  
  // Check if it's an English format and convert to Thai
  if (ENGLISH_TO_THAI_TRUCK_MAP[trimmed]) {
    return ENGLISH_TO_THAI_TRUCK_MAP[trimmed];
  }
  
  // Return as-is (already Thai or unknown format)
  return truckType.trim();
};

/**
 * Get the hierarchy level of a truck type
 * Returns -1 if truck type is not found (unknown type - will be treated as incompatible)
 */
export const getTruckTypeLevel = (truckType: string | null | undefined): number => {
  if (!truckType) return -1;
  
  // Normalize the truck type string (handle English formats)
  const normalizedType = normalizeTruckType(truckType);
  
  const index = TRUCK_TYPE_HIERARCHY.findIndex(type => 
    normalizedType.includes(type) || type.includes(normalizedType)
  );
  
  return index;
};

/**
 * Check if a driver's truck can handle a job's required truck type
 * Returns true if:
 * - Driver's truck is same level or higher than required
 * Returns false if:
 * - Driver's truck is smaller than required
 * - Either truck type is unknown (safer to not show the job)
 */
export const canHandleJobTruckType = (
  driverTruckType: string | null | undefined,
  jobTruckType: string | null | undefined
): boolean => {
  // If job doesn't specify truck type, show the job
  if (!jobTruckType || jobTruckType === '-') {
    return true;
  }
  
  const driverLevel = getTruckTypeLevel(driverTruckType);
  const jobLevel = getTruckTypeLevel(jobTruckType);
  
  console.log(`🔍 Truck comparison: driver="${driverTruckType}" (level ${driverLevel}), job="${jobTruckType}" (level ${jobLevel})`);
  
  // If driver's truck type is unknown, don't show the job (safer)
  if (driverLevel === -1) {
    console.log('❌ Driver truck type unknown, hiding job');
    return false;
  }
  
  // If job's truck type is unknown but driver's is known, show the job
  if (jobLevel === -1) {
    console.log('✅ Job truck type unknown, showing job');
    return true;
  }
  
  // Driver can handle jobs requiring same or smaller trucks
  const canHandle = driverLevel >= jobLevel;
  console.log(`${canHandle ? '✅' : '❌'} Driver level ${driverLevel} ${canHandle ? '>=' : '<'} job level ${jobLevel}`);
  return canHandle;
};
