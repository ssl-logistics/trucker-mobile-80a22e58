// Vehicle type translation utility
// Maps API vehicle types to translation keys

const VEHICLE_TYPE_MAP: Record<string, string> = {
  // English formats
  '4-wheel': 'vehicleType.4wheel',
  '4 wheel': 'vehicleType.4wheel',
  '4wheel': 'vehicleType.4wheel',
  '6-wheel': 'vehicleType.6wheel',
  '6 wheel': 'vehicleType.6wheel',
  '6wheel': 'vehicleType.6wheel',
  '10-wheel': 'vehicleType.10wheel',
  '10 wheel': 'vehicleType.10wheel',
  '10wheel': 'vehicleType.10wheel',
  '12-wheel': 'vehicleType.12wheel',
  '12 wheel': 'vehicleType.12wheel',
  '12wheel': 'vehicleType.12wheel',
  '18-wheel': 'vehicleType.18wheel',
  '18 wheel': 'vehicleType.18wheel',
  '18wheel': 'vehicleType.18wheel',
  '22-wheel': 'vehicleType.22wheel',
  '22 wheel': 'vehicleType.22wheel',
  '22wheel': 'vehicleType.22wheel',
  '40-wheel': 'vehicleType.40wheel',
  '40 wheel': 'vehicleType.40wheel',
  '40wheel': 'vehicleType.40wheel',
  'tractor': 'vehicleType.tractor',
  'trailer': 'vehicleType.trailer',
  
  // Thai formats
  '4ล้อ': 'vehicleType.4wheel',
  'รถ 4 ล้อ': 'vehicleType.4wheel',
  '6ล้อ': 'vehicleType.6wheel',
  'รถ 6 ล้อ': 'vehicleType.6wheel',
  '10ล้อ': 'vehicleType.10wheel',
  'รถ 10 ล้อ': 'vehicleType.10wheel',
  '10ล้อตู้': 'vehicleType.10wheelBox',
  '10ล้อพ่วง': 'vehicleType.10wheelTrailer',
  '12ล้อ': 'vehicleType.12wheel',
  'รถ 12 ล้อ': 'vehicleType.12wheel',
  '18ล้อ': 'vehicleType.18wheel',
  'รถ 18 ล้อ': 'vehicleType.18wheel',
  '22ล้อ': 'vehicleType.22wheel',
  'รถ 22 ล้อ': 'vehicleType.22wheel',
  '40ล้อ': 'vehicleType.40wheel',
  'รถ 40 ล้อ': 'vehicleType.40wheel',
  'หัวลาก': 'vehicleType.tractor',
  'รถหัวลาก': 'vehicleType.tractor',
  'พ่วง': 'vehicleType.trailer',
  'รถพ่วง': 'vehicleType.trailer',
};

/**
 * Get the translation key for a vehicle type
 * @param vehicleType - The vehicle type from API (can be in Thai or English)
 * @returns Translation key or original value if not found
 */
export const getVehicleTypeTranslationKey = (vehicleType: string | null | undefined): string => {
  if (!vehicleType) return '';
  
  const normalized = vehicleType.trim().toLowerCase();
  
  // Try to find exact match first
  for (const [key, value] of Object.entries(VEHICLE_TYPE_MAP)) {
    if (key.toLowerCase() === normalized) {
      return value;
    }
  }
  
  // Try to find partial match (for variations like "10-wheel truck")
  for (const [key, value] of Object.entries(VEHICLE_TYPE_MAP)) {
    if (normalized.includes(key.toLowerCase()) || key.toLowerCase().includes(normalized)) {
      return value;
    }
  }
  
  // Return the original value if no translation found
  return vehicleType;
};

/**
 * Get translated vehicle type text
 * @param vehicleType - The vehicle type from API
 * @param t - Translation function from useLanguage hook
 * @returns Translated text
 */
export const getTranslatedVehicleType = (
  vehicleType: string | null | undefined,
  t: (key: string) => string
): string => {
  if (!vehicleType) return '-';
  
  const translationKey = getVehicleTypeTranslationKey(vehicleType);
  
  // If it's a translation key (starts with vehicleType.), translate it
  if (translationKey.startsWith('vehicleType.')) {
    const translated = t(translationKey);
    // If translation returns the key itself, it means no translation found
    return translated === translationKey ? vehicleType : translated;
  }
  
  // Return original value
  return vehicleType;
};
