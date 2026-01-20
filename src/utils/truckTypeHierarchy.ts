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
];

/**
 * Get the hierarchy level of a truck type
 * Returns -1 if truck type is not found (unknown type - will be treated as compatible)
 */
export const getTruckTypeLevel = (truckType: string | null | undefined): number => {
  if (!truckType) return -1;
  
  // Normalize the truck type string
  const normalizedType = truckType.trim();
  
  const index = TRUCK_TYPE_HIERARCHY.findIndex(type => 
    normalizedType.includes(type) || type.includes(normalizedType)
  );
  
  return index;
};

/**
 * Check if a driver's truck can handle a job's required truck type
 * Returns true if:
 * - Driver's truck is same level or higher than required
 * - Either truck type is unknown (returns true to not filter out)
 */
export const canHandleJobTruckType = (
  driverTruckType: string | null | undefined,
  jobTruckType: string | null | undefined
): boolean => {
  const driverLevel = getTruckTypeLevel(driverTruckType);
  const jobLevel = getTruckTypeLevel(jobTruckType);
  
  // If either is unknown (-1), allow the job to be shown
  if (driverLevel === -1 || jobLevel === -1) {
    return true;
  }
  
  // Driver can handle jobs requiring same or smaller trucks
  return driverLevel >= jobLevel;
};
