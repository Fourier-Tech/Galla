"use client";

import React, { useState, useMemo } from "react";
import { Search, ChevronRight, User, Wallet, Calendar, AlertCircle } from "lucide-react";
import { DashboardCustomer, DashboardOrder } from "@/types/dashboard";
import { formatPhoneNumber, formatRupee } from "@/lib/utils";
import { CustomerDetailsView } from "@/components/dashboard/customer-details-view";

interface CustomersTabProps {
  customers: DashboardCustomer[];
  salonName?: string;
  onOpenSettle?: (order: DashboardOrder) => void;
  onOpenRefund?: (order: DashboardOrder) => void;
  onOpenReschedule?: (order: DashboardOrder) => void;
}

export function CustomersTab({
  customers,
  salonName,
  onOpenSettle,
  onOpenRefund,
  onOpenReschedule,
}: CustomersTabProps) {
  const [selectedCustomer, setSelectedCustomer] = useState<DashboardCustomer | null>(null);
  const [search, setSearch] = useState("");

  const formattedCustomers = useMemo(() => {
    return customers.map((c) => ({
      ...c,
      phone: formatPhoneNumber(c.phone),
    }));
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return formattedCustomers;

    const termDigits = term.replace(/\D/g, "");
    return formattedCustomers.filter((c) => {
      const nameMatch = c.name.toLowerCase().includes(term);
      const phoneMatch = c.phone.toLowerCase().includes(term);
      const digitMatch = termDigits.length > 0 && c.phone.replace(/\D/g, "").includes(termDigits);
      return nameMatch || phoneMatch || digitMatch;
    });
  }, [formattedCustomers, search]);

  // Sub-view: Customer Detail View (same pattern as Orders & Bills in Inventory tab)
  if (selectedCustomer) {
    return (
      <CustomerDetailsView
        customer={selectedCustomer}
        onBack={() => setSelectedCustomer(null)}
        salonName={salonName}
        onOpenSettle={onOpenSettle}
        onOpenRefund={onOpenRefund}
        onOpenReschedule={onOpenReschedule}
      />
    );
  }

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-150">
      {/* Header with Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="font-heading font-semibold text-[21px] tracking-[-0.015em] text-galla-ink">
              Customer Directory
            </h2>
            <span className="text-[11px] font-sans font-medium px-2 py-0.5 rounded-[4px] bg-galla-paper border border-galla-line text-galla-ink-soft">
              {customers.length} clients
            </span>
          </div>
          <p className="font-sans text-[13px] text-galla-ink-soft mt-0.5">
            Client visit histories, loyalty metrics &amp; purchase insights &bull; Click any client to view all orders
          </p>
        </div>

        <div className="flex items-center gap-2 px-[13px] py-[8px] rounded-[5px] bg-galla-surface border border-galla-line w-full sm:w-64 focus-within:border-galla-teal focus-within:ring-1 focus-within:ring-galla-teal transition-all">
          <Search className="h-4 w-4 text-galla-ink-soft shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by phone or name"
            className="w-full bg-transparent font-sans text-[13px] text-galla-ink placeholder:text-galla-ink-soft/50 outline-none"
          />
        </div>
      </div>

      {/* Customer List */}
      <div className="bg-galla-surface border border-galla-line rounded-[8px] divide-y divide-galla-line overflow-hidden shadow-2xs">
        {filteredCustomers.map((customer) => {
          const initials = customer.name
            ? customer.name
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()
            : "C";

          return (
            <div
              key={customer.phone}
              onClick={() => setSelectedCustomer(customer)}
              className="flex items-center justify-between px-[20px] py-[15px] hover:bg-galla-paper/40 transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="h-10 w-10 rounded-full bg-galla-teal/10 border border-galla-teal/20 text-galla-teal font-heading font-bold text-[13.5px] flex items-center justify-center shrink-0 group-hover:bg-galla-teal group-hover:text-white transition-colors">
                  {initials}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-sans font-semibold text-[15px] text-galla-ink group-hover:text-galla-teal transition-colors">
                      {customer.name}
                    </span>
                    {customer.outstandingDue && customer.outstandingDue > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-sans px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200">
                        <AlertCircle className="h-3 w-3" />
                        <span>Due: {formatRupee(customer.outstandingDue)}</span>
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 text-[12.5px] text-galla-ink-soft mt-0.5">
                    <span className="font-mono">{customer.phone}</span>
                    {customer.totalSpent && customer.totalSpent > 0 ? (
                      <>
                        <span>&bull;</span>
                        <span>
                          Spent: <strong className="text-galla-ink font-semibold">{formatRupee(customer.totalSpent)}</strong>
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 text-right shrink-0">
                <div>
                  <div className="font-sans font-semibold text-[14px] text-galla-ink">
                    {customer.visits} {customer.visits === 1 ? "visit" : "visits"}
                  </div>
                  <div className="font-sans text-[12px] text-galla-ink-soft mt-0.5">
                    Last visit: {customer.lastVisit}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-galla-ink-soft/40 group-hover:text-galla-teal group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>
          );
        })}

        {filteredCustomers.length === 0 && (
          <div className="p-12 text-center font-sans text-[13px] text-galla-ink-soft">
            No customers match your search criteria.
          </div>
        )}
      </div>
    </div>
  );
}
