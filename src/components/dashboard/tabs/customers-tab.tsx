"use client";

import React, { useState, useMemo } from "react";
import { Search, ChevronLeft, ChevronRight, AlertCircle, Phone, MessageSquare } from "lucide-react";
import { DashboardCustomer, DashboardOrder } from "@/types/dashboard";
import { formatPhoneNumber, formatRupee, formatNoteDisplay } from "@/lib/utils";
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
            <h2 className="text-[24px] font-bold tracking-[-0.01em] text-galla-ink">
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
      <div className="md:bg-galla-surface md:border md:border-galla-line md:rounded-[8px] md:shadow-2xs overflow-visible md:overflow-hidden">
        {/* Desktop Customer Table Rows */}
        <div className="hidden sm:block divide-y divide-galla-line">
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
                key={`d-${customer.phone}`}
                onClick={() => setSelectedCustomer(customer)}
                className="flex items-center justify-between px-[20px] py-[15px] hover:bg-galla-paper/40 transition-all cursor-pointer group select-none"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="h-10 w-10 rounded-full bg-galla-teal/10 border border-galla-teal/20 text-galla-teal font-bold text-[13px] flex items-center justify-center shrink-0 group-hover:bg-galla-teal group-hover:text-white transition-colors">
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
                      <span className="tabular-nums text-[13px]">{customer.phone}</span>
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
                        title={`Note: ${formatNoteDisplay(customer.notes)}`}
                      >
                        <span className="font-semibold not-italic text-[10px] bg-amber-200 text-amber-950 px-1.5 py-0.5 rounded shrink-0">
                          Note
                        </span>
                        <span className="truncate font-medium">{formatNoteDisplay(customer.notes)}</span>
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
        </div>

        {/* Mobile Customer Cards Deck (Clean Elevated Cards) */}
        <div className="block sm:hidden space-y-3 p-1 pb-4">
          {paginatedCustomers.map((customer) => {
            const initials = customer.name
              ? customer.name
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()
              : "C";

            const cleanedPhone = customer.phone ? customer.phone.replace(/\D/g, "") : "";
            const standardNumber =
              cleanedPhone.length === 10
                ? `91${cleanedPhone}`
                : cleanedPhone.startsWith("0") && cleanedPhone.length === 11
                ? `91${cleanedPhone.slice(1)}`
                : cleanedPhone;

            return (
              <div
                key={`m-${customer.phone}`}
                onClick={() => setSelectedCustomer(customer)}
                className="bg-galla-surface border border-galla-line/80 rounded-[12px] p-4 shadow-xs space-y-3 active:scale-[0.99] transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-galla-teal/10 border border-galla-teal/20 text-galla-teal font-bold text-[12px] flex items-center justify-center shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-[15px] text-galla-ink leading-tight truncate">
                          {customer.name}
                        </span>
                        {customer.outstandingDue && customer.outstandingDue > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10.5px] font-sans px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200 shrink-0 font-medium">
                            <AlertCircle className="h-3 w-3" />
                            <span>Due: {formatRupee(customer.outstandingDue)}</span>
                          </span>
                        ) : null}
                      </div>
                      <div className="font-sans text-[12px] text-galla-ink-soft tabular-nums mt-0.5">
                        {customer.phone}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-sans font-semibold text-[12.5px] text-galla-ink block">
                      {customer.visits} {customer.visits === 1 ? "visit" : "visits"}
                    </span>
                    <span className="font-sans text-[11px] text-galla-ink-soft block mt-0.5">
                      {customer.lastVisit}
                    </span>
                  </div>
                </div>

                {customer.notes && (
                  <div
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-amber-50/90 border border-amber-200 text-amber-950 font-sans text-[11.5px] max-w-full shadow-2xs"
                    title={`Note: ${formatNoteDisplay(customer.notes)}`}
                  >
                    <span className="font-semibold not-italic text-[10px] bg-amber-200 text-amber-950 px-1.5 py-0.5 rounded shrink-0">
                      Note
                    </span>
                    <span className="truncate font-medium">{formatNoteDisplay(customer.notes)}</span>
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-galla-line/50">
                  <div className="text-[12px] font-sans text-galla-ink-soft">
                    {customer.totalSpent && customer.totalSpent > 0 ? (
                      <span>Spent: <strong className="text-galla-ink font-semibold">{formatRupee(customer.totalSpent)}</strong></span>
                    ) : (
                      <span>No spend recorded</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {cleanedPhone && (
                      <a
                        href={`tel:${cleanedPhone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[11.5px] font-sans font-medium px-2.5 py-1.5 rounded-[5px] bg-galla-surface hover:bg-galla-paper border border-galla-line text-galla-ink transition-colors shadow-2xs active:scale-95"
                        title={`Call ${customer.name}`}
                      >
                        <Phone className="h-3.5 w-3.5 text-galla-teal" />
                        <span>Call</span>
                      </a>
                    )}
                    {cleanedPhone && (
                      <a
                        href={`https://api.whatsapp.com/send/?phone=${standardNumber}`}
                        onClick={(e) => e.stopPropagation()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11.5px] font-sans font-medium px-2.5 py-1.5 rounded-[5px] bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 transition-colors shadow-2xs active:scale-95"
                        title={`Message ${customer.name} on WhatsApp`}
                      >
                        <MessageSquare className="h-3.5 w-3.5 text-emerald-700" />
                        <span>WhatsApp</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredCustomers.length === 0 && (
          <div className="p-12 text-center font-sans text-[13px] text-galla-ink-soft">
            No customers match your search criteria.
          </div>
        )}

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

