"use client";

import React from "react";
import { formatRupee } from "@/lib/utils";
import { ClientRetentionData, TopVipClientItem } from "@/types/analytics";
import { Users, Crown, UserX, Phone } from "lucide-react";

interface ClientRetentionCardProps {
  retention: ClientRetentionData;
  vipClients: TopVipClientItem[];
}

export function ClientRetentionCard({ retention, vipClients }: ClientRetentionCardProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-[21px]">
      {/* Retention Ratio & At-Risk Callout */}
      <div className="bg-galla-surface border border-galla-line rounded-[5px] p-[21px] flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-galla-teal" />
            <h3 className="text-[15px] font-bold text-galla-ink">
              Client Retention &amp; Repeat Footfall
            </h3>
          </div>
          <p className="font-sans text-[12px] text-galla-ink-soft mb-5">
            Proportion of first-time new clients versus returning regulars served in this period
          </p>

          {/* Repeat Rate KPI Banner */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="p-3 rounded-[5px] bg-galla-paper border border-galla-line">
              <span className="font-sans text-[11px] text-galla-ink-soft block">
                Returning Regulars
              </span>
              <div className="font-semibold text-[20px] text-galla-teal mt-0.5 tabular-nums">
                {retention.returningClientsCount}
              </div>
              <span className="font-sans text-[11px] text-galla-teal font-medium tabular-nums">
                {retention.repeatRatePercent}% repeat rate
              </span>
            </div>

            <div className="p-3 rounded-[5px] bg-galla-paper border border-galla-line">
              <span className="font-sans text-[11px] text-galla-ink-soft block">
                First-Time Walk-Ins
              </span>
              <div className="font-semibold text-[20px] text-galla-ink mt-0.5 tabular-nums">
                {retention.newClientsCount}
              </div>
              <span className="font-sans text-[11px] text-galla-ink-soft">
                New client intake
              </span>
            </div>
          </div>

          {/* Ratio Bar */}
          <div className="space-y-1.5 mb-6">
            <div className="flex justify-between font-sans text-[11px] text-galla-ink-soft tabular-nums">
              <span>{retention.repeatRatePercent}% Regulars</span>
              <span>{100 - retention.repeatRatePercent}% First-Timers</span>
            </div>
            <div className="h-2 w-full bg-galla-paper rounded-full overflow-hidden flex">
              <div
                className="h-full bg-galla-teal transition-all duration-500"
                style={{ width: `${retention.repeatRatePercent}%` }}
              />
              <div
                className="h-full bg-galla-line transition-all duration-500"
                style={{ width: `${100 - retention.repeatRatePercent}%` }}
              />
            </div>
          </div>

          {/* Dormant / At-Risk Callout */}
          <div className="p-3.5 rounded-[5px] bg-red-50/60 border border-red-200/70 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <UserX className="w-4 h-4 text-red-600 shrink-0" />
              <div>
                <div className="font-sans text-[12px] font-semibold text-red-900 leading-tight">
                  <span className="tabular-nums">{retention.dormantClientsCount}</span> Dormant / At-Risk Clients
                </div>
                <div className="font-sans text-[11px] text-red-700/80">
                  Regulars with 2+ visits who haven&apos;t visited in 45+ days
                </div>
              </div>
            </div>
            <span className="font-sans text-[10px] font-semibold px-2 py-0.5 rounded-[3px] bg-white text-red-700 border border-red-200 shrink-0">
              Needs Follow-up
            </span>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-galla-line text-[11px] font-sans text-galla-ink-soft">
          High repeat rates indicate healthy treatment satisfaction and client loyalty
        </div>
      </div>

      {/* Top VIP Clients */}
      <div className="bg-galla-surface border border-galla-line rounded-[5px] p-[21px] flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Crown className="w-4 h-4 text-galla-brass" />
            <h3 className="text-[15px] font-bold text-galla-ink">
              Top Salon Clients
            </h3>
          </div>
          <p className="font-sans text-[12px] text-galla-ink-soft mb-4">
            Most valuable parlour regulars ranked by cumulative spend and visit frequency
          </p>

          {vipClients.length === 0 ? (
            <div className="py-8 text-center font-sans text-[12px] text-galla-ink-soft">
              No client profile records found
            </div>
          ) : (
            <div className="space-y-3">
              {vipClients.map((client, idx) => (
                <div
                  key={client.id || idx}
                  className="flex items-center justify-between p-2.5 rounded-[5px] bg-galla-paper border border-galla-line/60"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-galla-surface border border-galla-line flex items-center justify-center font-sans text-[11px] font-semibold text-galla-ink tabular-nums">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="font-sans text-[13px] font-semibold text-galla-ink leading-tight">
                        {client.name}
                      </div>
                      <div className="font-sans text-[11px] text-galla-ink-soft flex items-center gap-1.5 mt-0.5">
                        <Phone className="w-2.5 h-2.5" />
                        <span className="tabular-nums">{client.phone}</span>
                        <span>&bull;</span>
                        <span className="tabular-nums">{client.totalVisits} visits</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-sans text-[13px] font-semibold text-galla-brass tabular-nums">
                      {formatRupee(client.lifetimeSpend)}
                    </div>
                    <div className="font-sans text-[10px] text-galla-ink-soft">
                      Lifetime Spend
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-galla-line text-[11px] font-sans text-galla-ink-soft">
          Personalized concierge follow-ups for VIPs safeguard recurring monthly revenue
        </div>
      </div>
    </div>
  );
}
