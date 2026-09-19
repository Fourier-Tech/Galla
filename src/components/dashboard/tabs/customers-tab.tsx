"use client";

import React, { useState, useMemo } from "react";
import { Search, ChevronLeft, ChevronRight, User, Wallet, Calendar, AlertCircle } from "lucide-react";
import { DashboardCustomer, DashboardOrder } from "@/types/dashboard";
import { formatPhoneNumber, formatRupee } from "@/lib/utils";
import { CustomerDetailsView } from "@/components/dashboard/customer-details-view";
import { CustomerModal } from "@/components/dashboard/modals/customer-modal";

interface CustomersTabProps {
  customers: DashboardCustomer[];
  orders?: DashboardOrder[];
  salonName?: string;
  onOpenSettle?: (order: DashboardOrder) => void;
  onOpenRefund?: (order: DashboardOrder) => void;
  onOpenReschedule?: (order: DashboardOrder) => void;
  onUpdateCustomer?: (customer: DashboardCustomer) => void;
}

export function CustomersTab({
  customers,
  orders,
  salonName,
  onOpenSettle,
  onOpenRefund,
  onOpenReschedule,
  onUpdateCustomer,
}: CustomersTabProps) {
  const [selectedCustomer, setSelectedCustomer] = useState<DashboardCustomer | null>(null);
  const [customerToEdit, setCustomerToEdit] = useState<DashboardCustomer | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const formattedCustomers = useMemo(() => {
    return customers.map((c) => ({
      ...c,
      phone: formatPhoneNumber(c.phone),
      outstandingDue: typeof c.outstandingDue === "number" ? c.outstandingDue : 0,
      totalSpent: typeof c.totalSpent === "number" ? c.totalSpent : 0,
    }));
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    const term = search.toLowerCase().trim();
    const baseList = !term
      ? formattedCustomers
      : (() => {
          const termDigits = term.replace(/\D/g, "");
          return formattedCustomers.filter((c) => {
            const nameMatch = c.name.toLowerCase().includes(term);
            const phoneMatch = c.phone.toLowerCase().includes(term);
            const digitMatch = termDigits.length > 0 && c.phone.replace(/\D/g, "").includes(termDigits);
            return nameMatch || phoneMatch || digitMatch;
          });
        })();

    return [...baseList].sort((a, b) => {
      const aDue = Boolean(a.outstandingDue && a.outstandingDue > 0);
      const bDue = Boolean(b.outstandingDue && b.outstandingDue > 0);

      // Prioritize customers with pending dues first
      if (aDue && !bDue) return -1;
      if (!aDue && bDue) return 1;

      // Then sort alphabetically A-Z / a-z
      const nameComp = (a.name || "").localeCompare(b.name || "", undefined, {
        sensitivity: "base",
        numeric: true,
      });
      if (nameComp !== 0) return nameComp;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [formattedCustomers, search]);

  const totalCount = filteredCustomers.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(page, totalPages);

  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCustomers.slice(start, start + pageSize);
  }, [filteredCustomers, currentPage, pageSize]);

  // Sub-view: Customer Detail View (same pattern as Orders & Bills in Inventory tab)
  if (selectedCustomer) {
    return (
      <>
        <CustomerDetailsView
          customer={selectedCustomer}
          onBack={() => setSelectedCustomer(null)}
          salonName={salonName}
          globalOrders={orders}
          onOpenSettle={onOpenSettle}
          onOpenRefund={onOpenRefund}
          onOpenReschedule={onOpenReschedule}
          onOpenEditCustomer={(c) => {
            setCustomerToEdit(c);
            setIsEditModalOpen(true);
          }}
        />

        <CustomerModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setCustomerToEdit(null);
          }}
          customerToEdit={customerToEdit}
          onSaveCustomer={(updated) => {
            setSelectedCustomer(updated);
            onUpdateCustomer?.(updated);
          }}
        />
      </>
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
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by phone or name"
            className="w-full bg-transparent font-sans text-[13px] text-galla-ink placeholder:text-galla-ink-soft/50 outline-none"
          />
        </div>
      </div>

      {/* Customer List Container */}
      <div className="bg-galla-surface border border-galla-line rounded-[8px] shadow-2xs overflow-hidden">
        <div className="divide-y divide-galla-line">
          {paginatedCustomers.map((customer) => {
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
                    {customer.notes && (
                      <div
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-amber-50/90 border border-amber-200 text-amber-950 font-sans text-[11.5px] mt-1 max-w-full shadow-2xs"
                        title={`Note: ${customer.notes}`}
                      >
                        <span className="font-bold not-italic text-[9.5px] uppercase tracking-wider bg-amber-200 text-amber-950 px-1 py-0.2 rounded shrink-0">
                          Note
                        </span>
                        <span className="truncate font-medium">{customer.notes}</span>
                      </div>
                    )}
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

        {/* Pagination Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3 bg-galla-paper/50 border-t border-galla-line">
          <div className="font-sans text-[12.5px] text-galla-ink-soft">
            {totalCount > 0 ? (
              <>
                Showing <span className="font-medium text-galla-ink">{(currentPage - 1) * pageSize + 1}</span> to{" "}
                <span className="font-medium text-galla-ink">{Math.min(currentPage * pageSize, totalCount)}</span> of{" "}
                <span className="font-medium text-galla-ink">{totalCount}</span> customers
              </>
            ) : (
              "0 customers to display"
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-[12px] font-sans font-medium rounded-[5px] bg-galla-surface border border-galla-line text-galla-ink hover:bg-galla-paper transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
              title="Load previous 20 customers"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Previous</span>
            </button>

            <div className="flex items-center px-2 font-sans text-[12px] text-galla-ink font-medium">
              Page {currentPage} of {totalPages}
            </div>

            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-[12px] font-sans font-medium rounded-[5px] bg-galla-surface border border-galla-line text-galla-ink hover:bg-galla-paper transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
              title="Load next 20 customers"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

