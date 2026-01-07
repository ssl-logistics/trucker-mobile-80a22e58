import { useState, useEffect } from "react";
import { Province, fetchProvinces } from "@/data/provinces";

export const useProvinces = () => {
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadProvinces = async () => {
      setIsLoading(true);
      const data = await fetchProvinces();
      setProvinces(data);
      setIsLoading(false);
    };

    loadProvinces();
  }, []);

  return { provinces, isLoading };
};
