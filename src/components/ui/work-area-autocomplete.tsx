import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { locations, Location } from "@/data/locations";

interface WorkAreaAutocompleteProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}

export function WorkAreaAutocomplete({
  value = [],
  onChange,
  placeholder = "ค้นหาอำเภอ/จังหวัด",
}: WorkAreaAutocompleteProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  const selectedLocations = locations.filter((loc) =>
    value.includes(loc.displayText)
  );

  const handleSelect = (location: Location) => {
    const newValue = value.includes(location.displayText)
      ? value.filter((v) => v !== location.displayText)
      : [...value, location.displayText];
    onChange(newValue);
  };

  const handleRemove = (locationText: string) => {
    onChange(value.filter((v) => v !== locationText));
  };

  const filteredLocations = locations.filter((location) =>
    location.displayText.toLowerCase().includes(searchQuery.toLowerCase()) ||
    location.district.toLowerCase().includes(searchQuery.toLowerCase()) ||
    location.province.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group locations by province
  const groupedLocations = filteredLocations.reduce((acc, location) => {
    if (!acc[location.province]) {
      acc[location.province] = [];
    }
    acc[location.province].push(location);
    return acc;
  }, {} as Record<string, Location[]>);

  return (
    <div className="w-full space-y-2">
      <div className="space-y-1">
        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          พื้นที่วิ่งงาน
        </label>
        <p className="text-xs text-muted-foreground">
          อำเภอ หรือ จังหวัด ที่ถนัดหรือวิ่งงานเป็นประจำ
        </p>
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-auto min-h-[2.5rem] px-3 py-2 bg-white border-gray-200 hover:bg-gray-50 rounded-lg shadow-sm"
          >
            <div className="flex flex-wrap gap-1.5 flex-1">
              {selectedLocations.length > 0 ? (
                selectedLocations.map((location) => (
                  <Badge
                    key={location.displayText}
                    className="gap-1 pr-1 bg-[#1D4ED8] hover:bg-[#1e40af] text-white border-0 rounded-md"
                  >
                    <span className="text-xs">{location.displayText}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemove(location.displayText);
                      }}
                      className="ml-1 rounded-full hover:bg-white/20 p-0.5 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))
              ) : (
                <span className="text-muted-foreground text-sm">{placeholder}</span>
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0 bg-white shadow-lg rounded-lg border border-gray-200" align="start">
          <Command className="rounded-lg">
            <CommandInput
              placeholder={placeholder}
              value={searchQuery}
              onValueChange={setSearchQuery}
              className="border-0 focus:ring-0"
            />
            <CommandList className="max-h-[300px]">
              <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                ไม่พบข้อมูล
              </CommandEmpty>
              {Object.entries(groupedLocations).map(([province, provinceLocations]) => (
                <CommandGroup key={province} heading={province} className="px-2">
                  {provinceLocations.map((location) => {
                    const isSelected = value.includes(location.displayText);
                    return (
                      <CommandItem
                        key={location.displayText}
                        value={location.displayText}
                        onSelect={() => handleSelect(location)}
                        className="rounded-md cursor-pointer"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4 text-[#1D4ED8]",
                            isSelected ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span className="text-sm">{location.district}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
