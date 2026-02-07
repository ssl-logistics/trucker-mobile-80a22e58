// Fuel type translation utility
// Maps API fuel types to translation keys

const FUEL_TYPE_MAP: Record<string, string> = {
  // English formats
  'diesel': 'fuelType.diesel',
  'gasoline': 'fuelType.gasoline',
  'petrol': 'fuelType.gasoline',
  'gas': 'fuelType.gasoline',
  'lpg': 'fuelType.lpg',
  'cng': 'fuelType.cng',
  'electric': 'fuelType.electric',
  'hybrid': 'fuelType.hybrid',
  
  // Thai formats
  'ดีเซล': 'fuelType.diesel',
  'เบนซิน': 'fuelType.gasoline',
  'น้ำมันดีเซล': 'fuelType.diesel',
  'น้ำมันเบนซิน': 'fuelType.gasoline',
  'แก๊ส': 'fuelType.lpg',
  'ไฟฟ้า': 'fuelType.electric',
  'ไฮบริด': 'fuelType.hybrid',
};

/**
 * Get the translation key for a fuel type
 * @param fuelType - The fuel type from API (can be in Thai or English)
 * @returns Translation key or original value if not found
 */
export const getFuelTypeTranslationKey = (fuelType: string | null | undefined): string => {
  if (!fuelType) return '';
  
  const normalized = fuelType.trim().toLowerCase();
  
  // Try to find exact match first
  for (const [key, value] of Object.entries(FUEL_TYPE_MAP)) {
    if (key.toLowerCase() === normalized) {
      return value;
    }
  }
  
  // Return the original value if no translation found
  return fuelType;
};

/**
 * Get translated fuel type text
 * @param fuelType - The fuel type from API
 * @param t - Translation function from useLanguage hook
 * @returns Translated text
 */
export const getTranslatedFuelType = (
  fuelType: string | null | undefined,
  t: (key: string) => string
): string => {
  if (!fuelType) return '-';
  
  const translationKey = getFuelTypeTranslationKey(fuelType);
  
  // If it's a translation key (starts with fuelType.), translate it
  if (translationKey.startsWith('fuelType.')) {
    const translated = t(translationKey);
    // If translation returns the key itself, it means no translation found
    return translated === translationKey ? fuelType : translated;
  }
  
  // Return original value
  return fuelType;
};
