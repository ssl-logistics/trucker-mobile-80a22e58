/**
 * Extract district and province from a Thai full address string.
 * For Bangkok: returns "เขตXXX, กรุงเทพมหานคร"
 * For other provinces: returns "อำเภอXXX, จังหวัดYYY" (short form)
 * Falls back to the original address if extraction fails.
 */
export function extractDistrictProvince(fullAddress: string | null | undefined): string {
  if (!fullAddress) return '-';

  const addr = fullAddress.trim();

  // Bangkok pattern: extract เขต (khet)
  const bangkokMatch = addr.match(/เขต([\u0E00-\u0E7F\s]+?)[\s,]*(กรุงเทพ(?:มหานคร)?)/);
  if (bangkokMatch) {
    const khet = bangkokMatch[1].trim();
    return `เขต${khet}, กรุงเทพมหานคร`;
  }

  // Province pattern: extract อำเภอ and จังหวัด
  const provinceMatch = addr.match(/อำเภอ([\u0E00-\u0E7F\s]+?)[\s,]*จังหวัด([\u0E00-\u0E7F\s]+?)(?:\s*\d|$)/);
  if (provinceMatch) {
    const amphoe = provinceMatch[1].trim();
    const province = provinceMatch[2].trim();
    return `อ.${amphoe}, จ.${province}`;
  }

  // Alternate pattern: ตำบล...อำเภอ...จังหวัด
  const altMatch = addr.match(/อำเภอ([\u0E00-\u0E7F\s]+?)[\s,]+จังหวัด([\u0E00-\u0E7F\s]+)/);
  if (altMatch) {
    const amphoe = altMatch[1].trim();
    const province = altMatch[2].trim();
    return `อ.${amphoe}, จ.${province}`;
  }

  // Fallback: return original address
  return addr;
}
