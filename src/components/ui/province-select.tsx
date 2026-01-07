import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
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
import { useProvinces } from "@/hooks/useProvinces";
import { useLanguage } from "@/contexts/LanguageContext";

interface ProvinceSelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  hasError?: boolean;
}

export function ProvinceSelect({
  value,
  onValueChange,
  placeholder,
  disabled,
  hasError,
}: ProvinceSelectProps) {
  const [open, setOpen] = React.useState(false);
  const { provinces, isLoading } = useProvinces();
  const { t } = useLanguage();

  const selectedProvince = provinces.find((p) => p.name_th === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || isLoading}
          className={cn(
            "w-full justify-between font-normal hover:bg-transparent",
            !value && "text-muted-foreground",
            hasError && "border-destructive"
          )}
        >
          {isLoading
            ? "กำลังโหลด..."
            : selectedProvince
            ? selectedProvince.name_th
            : placeholder || t("vehicleInfoStep.selectProvince")}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder="ค้นหาจังหวัด..." />
          <CommandList>
            <CommandEmpty>ไม่พบจังหวัด</CommandEmpty>
            <CommandGroup className="max-h-64 overflow-auto">
              {provinces.map((province) => (
                <CommandItem
                  key={province.id}
                  value={province.name_th}
                  onSelect={() => {
                    onValueChange(province.name_th);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === province.name_th ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {province.name_th}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
