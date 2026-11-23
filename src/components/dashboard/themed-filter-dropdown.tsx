"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface FilterDropdownOption {
  value: string;
  label: string;
  count?: number;
}

interface ThemedFilterDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: FilterDropdownOption[];
  allLabel?: string;
  totalCount?: number;
  className?: string;
}

export function ThemedFilterDropdown({
  value,
  onChange,
  options,
  allLabel = "All Categories",
  totalCount,
  className = "",
}: ThemedFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click and Escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const isFiltered = value !== "all";

  // Find selected option
  const selectedOption = options.find(
    (opt) => opt.value.toLowerCase() === value.toLowerCase()
  );

  const displayLabel =
    value === "all"
      ? `${allLabel}${totalCount !== undefined ? ` (${totalCount})` : ""}`
      : selectedOption
      ? `${selectedOption.label}${selectedOption.count !== undefined ? ` (${selectedOption.count})` : ""}`
      : value;

  return (
    <div ref={dropdownRef} className={`relative w-full ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full bg-galla-surface border rounded-[5px] px-3 py-2 text-[13px] font-sans flex items-center justify-between gap-2 transition-all cursor-pointer shadow-2xs select-none ${
          isFiltered
            ? "bg-galla-teal/10 text-galla-teal border-galla-teal/40 font-semibold"
            : "border-galla-line hover:border-galla-ink-soft/40 text-galla-ink"
        } ${isOpen ? "border-galla-teal ring-1 ring-galla-teal shadow-xs" : ""}`}
      >
        <span className="truncate text-left font-medium text-[13px]">
          {displayLabel}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-galla-teal" : isFiltered ? "text-galla-teal" : "text-galla-ink-soft"
          }`}
        />
      </button>

      {/* Themed Dropdown Menu Panel (Stays 100% within parent bounds) */}
      {isOpen && (
        <div
          role="listbox"
          tabIndex={-1}
          className="absolute z-50 left-0 right-0 mt-1 bg-galla-surface border border-galla-line rounded-[6px] shadow-lg py-1 max-h-60 overflow-y-auto overscroll-contain animate-in fade-in-50 zoom-in-95 duration-100"
        >
          {/* All option */}
          <div
            role="option"
            aria-selected={value === "all"}
            onClick={() => {
              onChange("all");
              setIsOpen(false);
            }}
            className={`px-3 py-2 flex items-center justify-between gap-2 text-[13px] font-sans cursor-pointer transition-colors ${
              value === "all"
                ? "bg-galla-teal/10 text-galla-teal font-semibold"
                : "hover:bg-galla-paper text-galla-ink"
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              {value === "all" && <Check className="h-3.5 w-3.5 text-galla-teal shrink-0" />}
              <span className={`truncate ${value === "all" ? "ml-0" : "ml-5.5"}`}>{allLabel}</span>
            </div>
            {totalCount !== undefined && (
              <span className="text-[11.5px] opacity-70 shrink-0 tabular-nums">
                ({totalCount})
              </span>
            )}
          </div>

          {/* Individual options */}
          {options.map((option) => {
            const isSelected = option.value.toLowerCase() === value.toLowerCase();
            return (
              <div
                key={option.value}
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`px-3 py-2 flex items-center justify-between gap-2 text-[13px] font-sans cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-galla-teal/10 text-galla-teal font-semibold"
                    : "hover:bg-galla-paper text-galla-ink"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  {isSelected && <Check className="h-3.5 w-3.5 text-galla-teal shrink-0" />}
                  <span className={`truncate ${isSelected ? "ml-0" : "ml-5.5"}`}>{option.label}</span>
                </div>
                {option.count !== undefined && (
                  <span className="text-[11.5px] opacity-70 shrink-0 tabular-nums">
                    ({option.count})
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
