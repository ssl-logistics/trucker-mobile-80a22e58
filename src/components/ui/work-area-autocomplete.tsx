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
    location.displayText.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            className="w-full justify-between h-auto min-h-[2.5rem] px-3 py-2"
          >
            <div className="flex flex-wrap gap-1 flex-1">
              {selectedLocations.length > 0 ? (
                selectedLocations.map((location) => (
                  <Badge
                    key={location.displayText}
                    variant="secondary"
                    className="gap-1 pr-1"
                  >
                    <span>{location.displayText}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemove(location.displayText);
                      }}
                      className="ml-1 rounded-full hover:bg-muted"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))
              ) : (
                <span className="text-muted-foreground">{placeholder}</span>
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0 bg-popover" align="start">
          <Command>
            <CommandInput
              placeholder={placeholder}
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              <CommandEmpty>ไม่พบข้อมูล</CommandEmpty>
              <CommandGroup>
                {filteredLocations.map((location) => {
                  const isSelected = value.includes(location.displayText);
                  return (
                    <CommandItem
                      key={location.displayText}
                      value={location.displayText}
                      onSelect={() => handleSelect(location)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {location.displayText}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
