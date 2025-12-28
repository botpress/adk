import { useState, useRef, useEffect, type FC } from "react";
import { ChevronDown, Search } from "lucide-react";
import { LANGUAGE_OPTIONS, getFlagUrl } from "@/types/game-settings";
import { cn } from "@/lib/utils";

interface LanguageSelectProps {
  value: string;
  onChange: (value: string) => void;
}

export const LanguageSelect: FC<LanguageSelectProps> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = LANGUAGE_OPTIONS.find((opt) => opt.value === value);

  const filteredOptions = LANGUAGE_OPTIONS.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearch("");
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
          "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700",
          "border border-gray-200 dark:border-gray-700",
          isOpen && "ring-2 ring-blue-500"
        )}
      >
        {selectedOption && (
          <img
            src={getFlagUrl(selectedOption.flag, "w40")}
            alt={selectedOption.label}
            className="w-6 h-4 object-cover rounded-sm shadow-sm"
          />
        )}
        <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300">
          {selectedOption?.label || "Select language"}
        </span>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-gray-500 transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
          {/* Search Input */}
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search languages..."
                className="w-full pl-8 pr-3 py-2 text-base bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 dark:text-gray-300 placeholder-gray-400"
              />
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-sm text-gray-500 text-center">
                No languages found
              </div>
            ) : (
              filteredOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors",
                    "hover:bg-gray-100 dark:hover:bg-gray-800",
                    opt.value === value && "bg-blue-50 dark:bg-blue-900/30"
                  )}
                >
                  <img
                    src={getFlagUrl(opt.flag, "w40")}
                    alt={opt.label}
                    className="w-6 h-4 object-cover rounded-sm shadow-sm"
                  />
                  <span
                    className={cn(
                      "text-sm",
                      opt.value === value
                        ? "font-medium text-blue-600 dark:text-blue-400"
                        : "text-gray-700 dark:text-gray-300"
                    )}
                  >
                    {opt.label}
                  </span>
                  {opt.value === value && (
                    <span className="ml-auto text-blue-500">✓</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LanguageSelect;
