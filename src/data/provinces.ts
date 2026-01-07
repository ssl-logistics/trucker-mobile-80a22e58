// Thai provinces data - fetched from external API
export interface Province {
  id: number;
  name_th: string;
  name_en: string;
}

const PROVINCES_API_URL = "https://raw.githubusercontent.com/kongvut/thai-province-data/refs/heads/master/api_province.json";

let cachedProvinces: Province[] | null = null;

export const fetchProvinces = async (): Promise<Province[]> => {
  if (cachedProvinces) {
    return cachedProvinces;
  }

  try {
    const response = await fetch(PROVINCES_API_URL);
    const data = await response.json();
    cachedProvinces = data.map((province: any) => ({
      id: province.id,
      name_th: province.name_th,
      name_en: province.name_en,
    }));
    return cachedProvinces;
  } catch (error) {
    console.error("Failed to fetch provinces:", error);
    // Return fallback data if fetch fails
    return [
      { id: 1, name_th: "กรุงเทพมหานคร", name_en: "Bangkok" },
      { id: 2, name_th: "สมุทรปราการ", name_en: "Samut Prakan" },
      { id: 3, name_th: "นนทบุรี", name_en: "Nonthaburi" },
    ];
  }
};
