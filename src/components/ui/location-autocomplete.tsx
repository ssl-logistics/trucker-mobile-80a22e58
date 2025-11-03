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
import { locations, Location } from "@/data/locations";

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  description?: string;
}

export function LocationAutocomplete({
  value = "",
  onChange,
  placeholder = "ค้นหาอำเภอ/จังหวัด",
  label,
  description,
}: LocationAutocompleteProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");

  // Debounce search query
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const selectedLocation = locations.find((loc) => loc.displayText === value);

  const handleSelect = (location: Location) => {
    onChange(location.displayText);
    setOpen(false);
  };

  const filteredLocations = locations.filter((location) =>
    location.displayText.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
    location.district.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
    location.province.toLowerCase().includes(debouncedQuery.toLowerCase())
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
      {(label || description) && (
        <div className="space-y-1">
          {label && (
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              {label}
            </label>
          )}
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-auto min-h-[2.5rem] px-3 py-2 bg-white border-gray-200 hover:bg-gray-50 rounded-lg shadow-sm"
          >
            <span className={cn("text-sm", !selectedLocation && "text-muted-foreground")}>
              {selectedLocation ? selectedLocation.displayText : placeholder}
            </span>
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
                    const isSelected = value === location.displayText;
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
