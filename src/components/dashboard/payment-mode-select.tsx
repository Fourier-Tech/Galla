"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Banknote,
  QrCode,
  CreditCard,
  Landmark,
  Receipt,
  MoreHorizontal,
  ChevronDown,
  Check,
} from "lucide-react";

export type PaymentModeKey =
  | "cash"
  | "upi"
  | "card"
  | "bank_transfer"
  | "reduce_due"
  | "other";

export interface PaymentModeOption {
  value: string;
  label: string;
  sublabel?: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "teal" | "emerald" | "amber" | "rose" | "indigo" | "default";
}

// Global master registry of standard payment modes
export const DEFAULT_PAYMENT_MODE_OPTIONS: Record<string, PaymentModeOption> = {
  cash: {
    value: "cash",
    label: "Cash",
    sublabel: "Cash register / counter intake",
    icon: Banknote,
    tone: "emerald",
  },
  upi: {
    value: "upi",
    label: "UPI / QR Code",
    sublabel: "Google Pay, PhonePe, Paytm, QR",
    icon: QrCode,
    tone: "teal",
  },
  card: {
    value: "card",
    label: "Card / POS",
    sublabel: "Debit / Credit card swipe terminal",
    icon: CreditCard,
    tone: "indigo",
  },
  bank_transfer: {
    value: "bank_transfer",
    label: "Bank Transfer",
    sublabel: "NEFT / RTGS / IMPS net banking",
    icon: Landmark,
    tone: "amber",
  },
  reduce_due: {
    value: "reduce_due",
    label: "Reduce Due / Balance",
    sublabel: "Deduct against pending dues",
    icon: Receipt,
    tone: "rose",
  },
  other: {
    value: "other",
    label: "Other",
    sublabel: "Alternative payment method",
    icon: MoreHorizontal,
    tone: "default",
  },
};

export interface PaymentModeSelectProps {
  value: string;
  onChange: (value: any) => void;
  allowedModes?: (string | PaymentModeOption)[];
  label?: React.ReactNode;
  badge?: React.ReactNode;
  placeholder?: string;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function PaymentModeSelect({
  value,
  onChange,
  allowedModes,
  label,
  badge,
  placeholder = "Select payment mode...",
  helperText,
  required = false,
  disabled = false,
  className = "",
  id,
}: PaymentModeSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Normalize allowed modes to array of PaymentModeOption objects
  const options: PaymentModeOption[] = React.useMemo(() => {
    if (!allowedModes || allowedModes.length === 0) {
      return [
        DEFAULT_PAYMENT_MODE_OPTIONS.cash,
        DEFAULT_PAYMENT_MODE_OPTIONS.upi,
        DEFAULT_PAYMENT_MODE_OPTIONS.card,
      ];
    }

    return allowedModes.map((item) => {
      if (typeof item === "string") {
        return (
          DEFAULT_PAYMENT_MODE_OPTIONS[item] || {
            value: item,
            label: item.replace("_", " ").toUpperCase(),
            sublabel: undefined,
            icon: Banknote,
            tone: "default",
          }
        );
      }
      // If it's a custom option object, fill any missing properties from defaults
      const defaultOption = DEFAULT_PAYMENT_MODE_OPTIONS[item.value];
      return {
        value: item.value,
        label: item.label || defaultOption?.label || item.value,
        sublabel: item.sublabel !== undefined ? item.sublabel : defaultOption?.sublabel,
        icon: item.icon || defaultOption?.icon || Banknote,
        tone: item.tone || defaultOption?.tone || "default",
      };
    });
  }, [allowedModes]);

  // Find currently active option
  const selectedOption = options.find((opt) => opt.value === value) || {
    value,
    label: value ? value.replace("_", " ").toUpperCase() : placeholder,
    icon: DEFAULT_PAYMENT_MODE_OPTIONS[value]?.icon || Banknote,
    sublabel: undefined,
    tone: "default" as const,
  };

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
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
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const SelectedIcon = selectedOption.icon || Banknote;

  return (
    <div className={`space-y-1.5 w-full ${className}`} ref={containerRef}>
      {(label || badge) && (
        <div className="flex items-center justify-between gap-2">
          {label && (
            <label
              htmlFor={id}
              className="block font-heading text-[11.5px] font-semibold text-galla-ink uppercase tracking-wider"
            >
              {label} {required && <span className="text-red-500">*</span>}
            </label>
          )}
          {badge && <div>{badge}</div>}
        </div>
      )}

      <div className="relative">
        {/* Trigger Button */}
        <button
          type="button"
          id={id}
          disabled={disabled}
          onClick={() => !disabled && setIsOpen((prev) => !prev)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          className={`w-full bg-galla-surface border rounded-[5px] px-3 py-2 text-[13px] font-sans flex items-center justify-between gap-2 transition-all cursor-pointer shadow-2xs select-none ${
            disabled ? "opacity-50 cursor-not-allowed bg-galla-paper/50" : ""
          } ${
            isOpen
              ? "border-galla-teal ring-1 ring-galla-teal"
              : "border-galla-line hover:border-galla-ink-soft/40"
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-6 w-6 rounded-[4px] bg-galla-teal-soft/80 border border-galla-teal/20 text-galla-teal flex items-center justify-center shrink-0">
              <SelectedIcon className="h-3.5 w-3.5" />
            </div>
            <div className="flex items-center gap-2 truncate text-left">
              <span className="font-semibold text-galla-ink text-[13px] truncate">
                {selectedOption.label}
              </span>
              {selectedOption.sublabel && (
                <span className="text-[11px] text-galla-ink-soft/70 truncate hidden sm:inline">
                  &bull; {selectedOption.sublabel}
                </span>
              )}
            </div>
          </div>

          <ChevronDown
            className={`h-4 w-4 text-galla-ink-soft shrink-0 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-galla-teal" : ""
            }`}
          />
        </button>

        {/* Dropdown Menu Panel */}
        {isOpen && (
          <div
            role="listbox"
            tabIndex={-1}
            className="absolute z-50 left-0 right-0 mt-1 bg-galla-surface border border-galla-line rounded-[6px] shadow-lg py-1 max-h-64 overflow-y-auto overscroll-contain animate-in fade-in-50 zoom-in-95 duration-100 divide-y divide-galla-line/40"
          >
            {options.map((option) => {
              const isSelected = option.value === value;
              const Icon = option.icon || Banknote;

              return (
                <div
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`px-3 py-2 flex items-center justify-between gap-3 cursor-pointer transition-colors text-left group ${
                    isSelected
                      ? "bg-galla-teal-soft/70 text-galla-teal font-medium"
                      : "hover:bg-galla-paper text-galla-ink"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`h-6 w-6 rounded-[4px] border flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? "bg-galla-teal text-white border-galla-teal"
                          : "bg-galla-paper border-galla-line text-galla-ink-soft group-hover:text-galla-teal group-hover:border-galla-teal/40"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div
                        className={`text-[13px] truncate ${
                          isSelected
                            ? "font-semibold text-galla-teal"
                            : "font-medium text-galla-ink"
                        }`}
                      >
                        {option.label}
                      </div>
                      {option.sublabel && (
                        <div className="text-[11px] text-galla-ink-soft/80 truncate">
                          {option.sublabel}
                        </div>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <Check className="h-4 w-4 text-galla-teal shrink-0 ml-1" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {helperText && (
        <p className="text-[11px] text-galla-ink-soft font-sans">{helperText}</p>
      )}
    </div>
  );
}

export default PaymentModeSelect;
