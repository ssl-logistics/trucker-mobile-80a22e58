import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useLanguage } from "@/contexts/LanguageContext";

const VEHICLE_BRANDS = [
  { value: "isuzu", label: "Isuzu" },
  { value: "hino", label: "Hino" },
  { value: "mitsubishi", label: "Mitsubishi Fuso" },
  { value: "ud", label: "UD Trucks" },
  { value: "volvo", label: "Volvo" },
  { value: "scania", label: "Scania" },
  { value: "mercedes", label: "Mercedes-Benz" },
  { value: "man", label: "MAN" },
  { value: "daf", label: "DAF" },
  { value: "iveco", label: "Iveco" },
  { value: "foton", label: "Foton" },
  { value: "sinotruk", label: "Sinotruk" },
  { value: "dongfeng", label: "Dongfeng" },
  { value: "faw", label: "FAW" },
  { value: "tata", label: "Tata" },
  { value: "other", label: "อื่นๆ" },
];

interface VehicleBrandSelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  hasError?: boolean;
}

export function VehicleBrandSelect({
  value,
  onValueChange,
  placeholder,
  disabled,
  hasError,
}: VehicleBrandSelectProps) {
  const [open, setOpen] = React.useState(false);
  const { t } = useLanguage();

  const selectedBrand = VEHICLE_BRANDS.find((b) => b.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal hover:bg-transparent",
            !value && "text-muted-foreground",
            hasError && "border-destructive"
          )}
        >
          {selectedBrand
            ? selectedBrand.label
            : placeholder || t("vehicleInfoStep.selectBrand")}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder="ค้นหายี่ห้อรถ..." />
          <CommandList>
            <CommandEmpty>ไม่พบยี่ห้อรถ</CommandEmpty>
            <CommandGroup className="max-h-64 overflow-auto">
              {VEHICLE_BRANDS.map((brand) => (
                <CommandItem
                  key={brand.value}
                  value={brand.label}
                  onSelect={() => {
                    onValueChange(brand.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === brand.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {brand.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
