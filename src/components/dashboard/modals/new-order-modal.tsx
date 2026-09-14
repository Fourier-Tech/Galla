"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { X, AlertCircle } from "lucide-react";
import { DashboardCustomer, DashboardOrder, OrderType } from "@/types/dashboard";
import { createOrderAction } from "@/app/dashboard/actions";
import { formatPhoneNumber } from "@/lib/utils";

function getPhoneDigits(val: string): string {
  const digits = val.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

interface NewOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddOrder: (order: DashboardOrder, customerPhone?: string) => void;
  customers?: DashboardCustomer[];
}

export function NewOrderModal({
  isOpen,
  onClose,
  onAddOrder,
  customers = [],
}: NewOrderModalProps) {
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [type, setType] = useState<OrderType>("Product sale");
  const [amount, setAmount] = useState("");
  const [advance, setAdvance] = useState("");
  const [paidNow, setPaidNow] = useState<"full" | "advance">("full");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // ponytail: in-memory linear filter holds for salon scale (<10k clients); upgrade to debounced server search if client base exceeds memory budget
  // Suggestions only appear when counter staff types a name
  const filteredCustomers = useMemo(() => {
    const query = customer.trim().toLowerCase();
    if (!query || !customers || customers.length === 0) return [];

    return customers
      .filter((c) => c && c.name && c.name.toLowerCase().includes(query))
      .slice(0, 5);
  }, [customer, customers]);

  // Check if entered phone is already registered to a different customer name
  const phoneConflictCustomer = useMemo(() => {
    const digits = getPhoneDigits(phone);
    if (digits.length !== 10 || !customers || customers.length === 0) return null;

    const match = customers.find((c) => getPhoneDigits(c.phone) === digits);
    if (!match) return null;

    const currentName = customer.trim().toLowerCase();
    const registeredName = (match.name || "").trim().toLowerCase();

    // If different name, return registered customer info to alert staff
    if (currentName && registeredName && currentName !== registeredName) {
      return match;
    }
    return null;
  }, [phone, customer, customers]);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        nameInputRef.current &&
        !nameInputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!customer.trim() || !amount) return;

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg("Please enter a valid total amount");
      return;
    }

    const isPaidFull = paidNow === "full";
    const parsedAdvance = advance ? Number(advance) : Math.round(parsedAmount * 0.3);
    const paidAmount = isPaidFull ? parsedAmount : parsedAdvance;
    const status = isPaidFull ? "paid_full" : "advance_paid";

    setIsSubmitting(true);
    try {
      const formattedPhone = phone.trim() ? formatPhoneNumber(phone) : undefined;
      const res = await createOrderAction({
        customerName: customer.trim(),
        customerPhone: formattedPhone,
        orderType: type,
        totalAmount: parsedAmount,
        paidAmount: paidAmount,
        status: status,
      });

      if (res.success && res.order) {
        onAddOrder(res.order, formattedPhone);
        setCustomer("");
        setPhone("");
        setAmount("");
        setAdvance("");
        setPaidNow("full");
        setShowSuggestions(false);
        onClose();
      } else {
        setErrorMsg(res.error || "Failed to save order");
      }
    } catch {
      setErrorMsg("Network error occurred while creating order");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div className="w-full max-w-[377px] bg-galla-surface border border-galla-line rounded-[5px] p-[21px] shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading font-semibold text-[18px] text-galla-ink">
            New Order
          </h3>
          <button
            onClick={onClose}
            type="button"
            disabled={isSubmitting}
            className="text-galla-ink-soft hover:text-galla-ink p-1 rounded transition-colors disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-2.5 bg-red-50 border border-red-200 text-red-700 text-[12px] rounded-[4px]">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <label className="block font-sans text-[12px] font-medium text-galla-ink-soft mb-1">
              Customer Name
            </label>
            <input
              ref={nameInputRef}
              type="text"
              required
              value={customer}
              onChange={(e) => {
                setCustomer(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => {
                if (customer.trim().length > 0) {
                  setShowSuggestions(true);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setShowSuggestions(false);
                }
              }}
              autoComplete="off"
              placeholder="e.g. Krish Butani"
              className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] px-[13px] py-[8px] text-[14px] text-galla-ink placeholder:text-galla-ink-soft/50 focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-colors"
            />

            {showSuggestions && filteredCustomers.length > 0 && (
              <div
                ref={dropdownRef}
                className="absolute left-0 right-0 top-full mt-1 z-30 bg-galla-surface border border-galla-line rounded-[5px] shadow-lg overflow-hidden py-1 max-h-48 overflow-y-auto"
              >
                {filteredCustomers.map((c, index) => (
                  <button
                    key={`${c.phone || c.name}-${index}`}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setCustomer(c.name);
                      if (c.phone) {
                        setPhone(c.phone);
                      }
                      setShowSuggestions(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-galla-paper/80 transition-colors flex items-center justify-between group cursor-pointer border-b border-galla-line/40 last:border-b-0"
                  >
                    <span className="font-heading font-medium text-[13px] text-galla-ink group-hover:text-galla-teal transition-colors">
                      {c.name}
                    </span>
                    <span className="font-mono text-[12px] text-galla-ink-soft">
                      {c.phone || "No phone"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block font-sans text-[12px] font-medium text-galla-ink-soft mb-1">
              Customer Phone (Optional)
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={() => {
                if (phone.trim()) {
                  setPhone(formatPhoneNumber(phone));
                }
              }}
              placeholder="e.g. +91 98250 12345"
              className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] px-[13px] py-[8px] text-[14px] text-galla-ink placeholder:text-galla-ink-soft/50 focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-colors"
            />

            {phoneConflictCustomer && (
              <div className="mt-1.5 flex items-start gap-1.5 text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-[4px] p-2">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <div className="leading-tight">
                  <span>This mobile number is already registered with </span>
                  <span className="font-semibold">{phoneConflictCustomer.name}</span>.
                  <button
                    type="button"
                    onClick={() => setCustomer(phoneConflictCustomer.name)}
                    className="ml-1 underline font-medium text-amber-800 hover:text-amber-900 cursor-pointer"
                  >
                    Use {phoneConflictCustomer.name}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block font-sans text-[12px] font-medium text-galla-ink-soft mb-1">
              Order Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as OrderType)}
              className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] px-[13px] py-[8px] text-[14px] text-galla-ink focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-colors"
            >
              <option value="Product sale">Product sale</option>
              <option value="Service booking">Service booking</option>
              <option value="Package sale">Package sale</option>
            </select>
          </div>

          <div>
            <label className="block font-sans text-[12px] font-medium text-galla-ink-soft mb-1">
              Total Amount (₹)
            </label>
            <input
              type="text"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
              placeholder="e.g. 1200"
              className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] px-[13px] py-[8px] text-[14px] text-galla-ink placeholder:text-galla-ink-soft/50 focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-colors"
            />
          </div>

          <div>
            <label className="block font-sans text-[12px] font-medium text-galla-ink-soft mb-1.5">
              Settlement Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaidNow("full")}
                className={`py-[8px] px-[13px] text-[13px] font-sans font-medium rounded-[5px] border transition-all cursor-pointer ${
                  paidNow === "full"
                    ? "bg-galla-teal-soft border-galla-teal text-galla-teal"
                    : "bg-galla-paper/40 border-galla-line text-galla-ink-soft hover:text-galla-ink"
                }`}
              >
                Paid in full
              </button>
              <button
                type="button"
                onClick={() => setPaidNow("advance")}
                className={`py-[8px] px-[13px] text-[13px] font-sans font-medium rounded-[5px] border transition-all cursor-pointer ${
                  paidNow === "advance"
                    ? "bg-galla-brass-soft border-galla-brass text-galla-brass"
                    : "bg-galla-paper/40 border-galla-line text-galla-ink-soft hover:text-galla-ink"
                }`}
              >
                Advance only
              </button>
            </div>
          </div>

          {paidNow === "advance" && (
            <div>
              <label className="block font-sans text-[12px] font-medium text-galla-ink-soft mb-1">
                Advance Amount Paid (₹)
              </label>
              <input
                type="text"
                value={advance}
                onChange={(e) => setAdvance(e.target.value.replace(/\D/g, ""))}
                placeholder={`e.g. ${amount ? Math.round(Number(amount) * 0.3) : "300"}`}
                className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] px-[13px] py-[8px] text-[14px] text-galla-ink placeholder:text-galla-ink-soft/50 focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-colors"
              />
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-galla-teal hover:opacity-95 text-white font-sans text-[14px] font-medium py-[10px] rounded-[5px] shadow-sm transition-opacity cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? "Saving to Database..." : "Save Order"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
