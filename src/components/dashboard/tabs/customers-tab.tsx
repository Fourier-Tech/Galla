"use client";

import React, { useState } from "react";
import { Search } from "lucide-react";
import { DashboardCustomer } from "@/types/dashboard";

interface CustomersTabProps {
  customers: DashboardCustomer[];
}

export function CustomersTab({ customers }: CustomersTabProps) {
  const [search, setSearch] = useState("");

  const filteredCustomers = customers.filter((c) =>
    (c.name + " " + c.phone).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header with Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading font-semibold text-[21px] tracking-[-0.015em] text-galla-ink">
            Customer Directory
          </h2>
          <p className="font-sans text-[13px] text-galla-ink-soft mt-0.5">
            Client visit histories, loyalty metrics &amp; contact profiles
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
      <div className="bg-galla-surface border border-galla-line rounded-[5px] divide-y divide-galla-line overflow-hidden">
        {filteredCustomers.map((customer) => (
          <div
            key={customer.phone}
            className="flex items-center justify-between px-[21px] py-[16px] hover:bg-galla-paper/30 transition-colors"
          >
            <div>
              <div className="font-sans font-semibold text-[15px] text-galla-ink">
                {customer.name}
              </div>
              <div className="font-mono text-[13px] text-galla-ink-soft mt-0.5">
                {customer.phone}
              </div>
            </div>

            <div className="text-right">
              <div className="font-sans font-semibold text-[14px] text-galla-ink">
                {customer.visits} {customer.visits === 1 ? "visit" : "visits"}
              </div>
              <div className="font-sans text-[12px] text-galla-ink-soft mt-0.5">
                Last visit: {customer.lastVisit}
              </div>
            </div>
          </div>
        ))}

        {filteredCustomers.length === 0 && (
          <div className="p-12 text-center font-sans text-[13px] text-galla-ink-soft">
            No customers match your search criteria.
          </div>
        )}
      </div>
    </div>
  );
}
