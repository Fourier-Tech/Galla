"use client";

import React, { useState, useMemo } from "react";
import {
  Package,
  Plus,
  Search,
  Scissors,
  ShoppingBag,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Tag,
  AlertTriangle,
  Percent,
  X,
} from "lucide-react";
import {
  DashboardService,
  DashboardPackage,
  DashboardProduct,
} from "@/types/dashboard";
import { ServiceModal } from "@/components/dashboard/modals/service-modal";
import { PackageModal } from "@/components/dashboard/modals/package-modal";
import {
  toggleServiceStatusAction,
  deleteServiceAction,
  togglePackageStatusAction,
  deletePackageAction,
} from "@/app/dashboard/actions";
import { formatRupee } from "@/lib/utils";

interface ServicesTabProps {
  services: DashboardService[];
  packages: DashboardPackage[];
  products: DashboardProduct[];
  onAddService: (service: DashboardService) => void;
  onUpdateService: (service: DashboardService) => void;
  onDeleteService: (serviceId: string) => void;
  onAddPackage: (pkg: DashboardPackage) => void;
  onUpdatePackage: (pkg: DashboardPackage) => void;
  onDeletePackage: (packageId: string) => void;
}

export function ServicesTab({
  services,
  packages,
  products,
  onAddService,
  onUpdateService,
  onDeleteService,
  onAddPackage,
  onUpdatePackage,
  onDeletePackage,
}: ServicesTabProps) {
  const [subView, setSubView] = useState<"services" | "packages">("services");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [packageFilter, setPackageFilter] = useState<"all" | "active" | "fixed">("all");

  // Modals state
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [serviceToEdit, setServiceToEdit] = useState<DashboardService | null>(null);

  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
  const [packageToEdit, setPackageToEdit] = useState<DashboardPackage | null>(null);

  // Deletion confirm state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: "service" | "package";
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Extract unique categories
  const existingCategories = useMemo(() => {
    const set = new Set<string>();
    services.forEach((s) => {
      if (s.category) set.add(s.category);
    });
    return Array.from(set).sort();
  }, [services]);

  // Filter services
  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      const matchesCategory =
        selectedCategory === "all" || s.category.toLowerCase() === selectedCategory.toLowerCase();
      const matchesSearch =
        !searchQuery.trim() ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.description && s.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [services, selectedCategory, searchQuery]);

  // Filter packages
  const filteredPackages = useMemo(() => {
    return packages.filter((pkg) => {
      const matchesFilter =
        packageFilter === "all" ||
        (packageFilter === "active" && pkg.isActive) ||
        (packageFilter === "fixed" && pkg.pricingType === "fixed");

      const matchesSearch =
        !searchQuery.trim() ||
        pkg.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (pkg.description && pkg.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        pkg.services.some((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        pkg.products.some((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesFilter && matchesSearch;
    });
  }, [packages, packageFilter, searchQuery]);

  // Quick stats
  const activePackagesCount = packages.filter((p) => p.isActive).length;

  // Handlers for Services
  const handleToggleService = async (service: DashboardService) => {
    // Optimistic update
    const updated: DashboardService = { ...service, isActive: !service.isActive };
    onUpdateService(updated);
    try {
      const res = await toggleServiceStatusAction(service.id);
      if (!res.success) {
        // Rollback
        onUpdateService(service);
      }
    } catch {
      onUpdateService(service);
    }
  };

  const handleEditService = (service: DashboardService) => {
    setServiceToEdit(service);
    setIsServiceModalOpen(true);
  };

  // Handlers for Packages
  const handleTogglePackage = async (pkg: DashboardPackage) => {
    const updated: DashboardPackage = { ...pkg, isActive: !pkg.isActive };
    onUpdatePackage(updated);
    try {
      const res = await togglePackageStatusAction(pkg.id);
      if (!res.success) {
        onUpdatePackage(pkg);
      }
    } catch {
      onUpdatePackage(pkg);
    }
  };

  const handleEditPackage = (pkg: DashboardPackage) => {
    setPackageToEdit(pkg);
    setIsPackageModalOpen(true);
  };

  // Delete handler
  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    setIsDeleting(true);
    try {
      if (deleteConfirm.type === "service") {
        const res = await deleteServiceAction(deleteConfirm.id);
        if (res.success) {
          onDeleteService(deleteConfirm.id);
          setDeleteConfirm(null);
        }
      } else {
        const res = await deletePackageAction(deleteConfirm.id);
        if (res.success) {
          onDeletePackage(deleteConfirm.id);
          setDeleteConfirm(null);
        }
      }
    } catch (err) {
      console.error("Deletion failed:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading font-semibold text-[21px] tracking-[-0.015em] text-galla-ink">
            Services &amp; Packages Catalog
          </h2>
          <p className="font-sans text-[13px] text-galla-ink-soft mt-0.5">
            Manage parlour treatment menu, pricing, and promotional bundled packages
          </p>
        </div>

        {subView === "services" ? (
          <button
            type="button"
            onClick={() => {
              setServiceToEdit(null);
              setIsServiceModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 bg-galla-teal hover:opacity-95 text-white font-sans text-[14px] font-medium px-[13px] py-[8px] rounded-[5px] shadow-sm transition-all cursor-pointer shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Add Service</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setPackageToEdit(null);
              setIsPackageModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 bg-galla-teal hover:opacity-95 text-white font-sans text-[14px] font-medium px-[13px] py-[8px] rounded-[5px] shadow-sm transition-all cursor-pointer shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Create Package</span>
          </button>
        )}
      </div>

      {/* Search Bar & View Switcher Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-[5px] bg-galla-surface border border-galla-line w-full md:w-72 focus-within:border-galla-teal focus-within:ring-1 focus-within:ring-galla-teal transition-all shadow-xs">
          <Search className="h-4 w-4 text-galla-ink-soft shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              subView === "services"
                ? "Search services by name, category..."
                : "Search packages by bundle title..."
            }
            className="w-full bg-transparent font-sans text-[13px] text-galla-ink placeholder:text-galla-ink-soft/50 outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-galla-ink-soft hover:text-galla-ink cursor-pointer p-0.5"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-galla-surface border border-galla-line rounded-[5px] shadow-xs self-start md:self-auto">
          <button
            type="button"
            onClick={() => {
              setSubView("services");
              setSearchQuery("");
              setSelectedCategory("all");
            }}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-[4px] text-[12.5px] font-sans font-medium transition-all cursor-pointer ${
              subView === "services"
                ? "bg-galla-teal text-white shadow-xs"
                : "text-galla-ink-soft hover:text-galla-ink hover:bg-galla-paper/60"
            }`}
          >
            <Scissors className="h-3.5 w-3.5" />
            <span>Services Menu ({services.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSubView("packages");
              setSearchQuery("");
              setPackageFilter("all");
            }}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-[4px] text-[12.5px] font-sans font-medium transition-all cursor-pointer ${
              subView === "packages"
                ? "bg-galla-teal text-white shadow-xs"
                : "text-galla-ink-soft hover:text-galla-ink hover:bg-galla-paper/60"
            }`}
          >
            <Package className="h-3.5 w-3.5" />
            <span>Package Deals ({packages.length})</span>
          </button>
        </div>
      </div>

      {/* Filter Pills & Reset Action */}
      {subView === "services" ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className={`px-[13px] py-[6px] rounded-[5px] text-[13px] font-sans font-medium transition-all cursor-pointer border ${
                selectedCategory === "all"
                  ? "bg-galla-teal text-white border-galla-teal shadow-xs"
                  : "bg-galla-surface text-galla-ink-soft border-galla-line hover:text-galla-ink hover:border-galla-ink-soft/40"
              }`}
            >
              All Categories ({services.length})
            </button>
            {existingCategories.map((cat) => {
              const count = services.filter((s) => s.category === cat).length;
              const isSelected = selectedCategory.toLowerCase() === cat.toLowerCase();
              return (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-[13px] py-[6px] rounded-[5px] text-[13px] font-sans font-medium transition-all cursor-pointer border ${
                    isSelected
                      ? "bg-galla-teal text-white border-galla-teal shadow-xs"
                      : "bg-galla-surface text-galla-ink-soft border-galla-line hover:text-galla-ink hover:border-galla-ink-soft/40"
                  }`}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>

          {(searchQuery || selectedCategory !== "all") && (
            <button
              type="button"
              onClick={() => {
                setSelectedCategory("all");
                setSearchQuery("");
              }}
              className="text-[12px] font-sans text-galla-ink-soft hover:text-galla-ink underline cursor-pointer"
            >
              Reset filters
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {[
              { id: "all", label: `All Packages (${packages.length})` },
              { id: "active", label: `Active Deals (${activePackagesCount})` },
              { id: "fixed", label: `Fixed Deals (${packages.filter((p) => p.pricingType === "fixed").length})` },
            ].map((opt) => {
              const isActive = packageFilter === opt.id;
              return (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => setPackageFilter(opt.id as "all" | "active" | "fixed")}
                  className={`px-[13px] py-[6px] rounded-[5px] text-[13px] font-sans font-medium transition-all cursor-pointer border ${
                    isActive
                      ? "bg-galla-teal text-white border-galla-teal shadow-xs"
                      : "bg-galla-surface text-galla-ink-soft border-galla-line hover:text-galla-ink hover:border-galla-ink-soft/40"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {(searchQuery || packageFilter !== "all") && (
            <button
              type="button"
              onClick={() => {
                setPackageFilter("all");
                setSearchQuery("");
              }}
              className="text-[12px] font-sans text-galla-ink-soft hover:text-galla-ink underline cursor-pointer"
            >
              Reset filters
            </button>
          )}
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      {subView === "services" ? (
        /* SERVICES VIEW */
        <div className="bg-galla-surface border border-galla-line rounded-[6px] overflow-hidden shadow-xs">
          {/* Header Row */}
          <div className="hidden sm:grid grid-cols-[1.5fr_130px_110px_90px_90px] gap-4 items-center px-5 py-3 bg-galla-paper/70 border-b border-galla-line font-heading text-[11px] font-semibold text-galla-ink-soft uppercase tracking-[0.05em]">
            <span>Service &amp; Notes</span>
            <span>Category</span>
            <span className="text-right">Price</span>
            <span className="text-center">Status</span>
            <span className="text-right">Actions</span>
          </div>

          {/* Rows */}
          {filteredServices.length > 0 ? (
            <div className="divide-y divide-galla-line">
              {filteredServices.map((service) => (
                <div
                  key={service.id}
                  className="flex flex-col sm:grid sm:grid-cols-[1.5fr_130px_110px_90px_90px] gap-3 sm:gap-4 sm:items-center px-5 py-3.5 hover:bg-galla-paper/20 transition-colors"
                >
                  {/* Name & description */}
                  <div className="min-w-0">
                    <div className="font-heading font-semibold text-[14.5px] text-galla-ink truncate">
                      {service.name}
                    </div>
                    {service.description && (
                      <div className="font-sans text-[12px] text-galla-ink-soft truncate mt-0.5">
                        {service.description}
                      </div>
                    )}
                  </div>

                  {/* Category */}
                  <div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] bg-galla-paper border border-galla-line text-[11.5px] font-sans text-galla-ink">
                      <Tag className="h-3 w-3 text-galla-ink-soft" />
                      <span>{service.category}</span>
                    </span>
                  </div>

                  {/* Price */}
                  <div className="sm:text-right font-heading font-semibold text-[15px] text-galla-ink tabular-nums">
                    {formatRupee(service.price)}
                  </div>

                  {/* Status Toggle */}
                  <div className="sm:text-center">
                    <button
                      type="button"
                      onClick={() => handleToggleService(service)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] text-[11px] font-semibold transition-colors cursor-pointer ${
                        service.isActive
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : "bg-gray-100 text-gray-600 border border-gray-200"
                      }`}
                      title="Click to toggle availability"
                    >
                      {service.isActive ? (
                        <>
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          <span>Active</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3 text-gray-400" />
                          <span>Disabled</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center sm:justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleEditService(service)}
                      className="p-1.5 rounded-[4px] hover:bg-galla-paper text-galla-ink-soft hover:text-galla-ink transition-colors cursor-pointer"
                      title="Edit Service"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteConfirm({
                          type: "service",
                          id: service.id,
                          name: service.name,
                        })
                      }
                      className="p-1.5 rounded-[4px] hover:bg-red-50 text-galla-ink-soft hover:text-red-600 transition-colors cursor-pointer"
                      title="Delete Service"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-10 text-center space-y-2">
              <div className="inline-flex p-3 rounded-full bg-galla-paper text-galla-ink-soft mb-1">
                <Scissors className="h-6 w-6" />
              </div>
              <div className="font-heading font-medium text-[15px] text-galla-ink">
                No services found
              </div>
              <p className="font-sans text-[12.5px] text-galla-ink-soft max-w-md mx-auto">
                {searchQuery || selectedCategory !== "all"
                  ? "No services match your current filters. Try changing keywords or category."
                  : "Start creating your salon's treatment and styling menu by clicking 'Add Service'."}
              </p>
            </div>
          )}
        </div>
      ) : (
        /* PACKAGES VIEW */
        <div>
          {filteredPackages.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {filteredPackages.map((pkg) => {
                const totalServicesValue = pkg.services.reduce(
                  (sum, s) => sum + (s.componentPrice || 0),
                  0
                );
                const totalProductsValue = pkg.products.reduce(
                  (sum, p) => sum + (p.componentPrice || 0) * (p.quantity || 1),
                  0
                );
                const standaloneTotal = totalServicesValue + totalProductsValue;
                const savingsAmount = Math.max(0, standaloneTotal - pkg.packagePrice);
                const savingsPercent =
                  standaloneTotal > 0 && savingsAmount > 0
                    ? Math.round((savingsAmount / standaloneTotal) * 100)
                    : 0;

                return (
                  <div
                    key={pkg.id}
                    className="bg-galla-surface border border-galla-line rounded-[6px] p-5 space-y-4 hover:border-galla-ink-soft/40 transition-colors shadow-2xs flex flex-col justify-between"
                  >
                    {/* Header: Title & Badges */}
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-heading font-semibold text-[17px] text-galla-ink tracking-tight truncate">
                            {pkg.name}
                          </h3>
                          {pkg.description && (
                            <p className="font-sans text-[12.5px] text-galla-ink-soft line-clamp-2 mt-0.5">
                              {pkg.description}
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleTogglePackage(pkg)}
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[3px] text-[11px] font-semibold shrink-0 transition-colors cursor-pointer ${
                            pkg.isActive
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : "bg-gray-100 text-gray-600 border border-gray-200"
                          }`}
                        >
                          {pkg.isActive ? "Active Deal" : "Disabled"}
                        </button>
                      </div>

                      {/* Pricing Tagline */}
                      <div className="flex items-baseline justify-between pt-1">
                        <div>
                          <div className="font-heading font-bold text-[22px] text-galla-teal tabular-nums">
                            {formatRupee(pkg.packagePrice)}
                          </div>
                          {pkg.pricingType === "fixed" && standaloneTotal > pkg.packagePrice && (
                            <div className="text-[12px] text-galla-ink-soft font-heading font-medium tabular-nums">
                              Worth <span className="line-through">{formatRupee(standaloneTotal)}</span>
                            </div>
                          )}
                        </div>

                        {savingsAmount > 0 && (
                          <div className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-[4px] border border-emerald-200 tabular-nums">
                            <Percent className="h-3 w-3" />
                            <span>
                              Save {formatRupee(savingsAmount)} ({savingsPercent}% OFF)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Included Items Breakdown */}
                    <div className="space-y-2 pt-2 border-t border-galla-line/60">
                      {/* Services List */}
                      {pkg.services.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-[11px] font-heading font-semibold uppercase tracking-wider text-galla-ink-soft">
                            Included Services ({pkg.services.length})
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {pkg.services.map((s, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] bg-galla-paper border border-galla-line text-[11.5px] font-sans text-galla-ink"
                              >
                                <CheckCircle2 className="h-3 w-3 text-galla-teal" />
                                <span>{s.name}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Products List */}
                      {pkg.products.length > 0 && (
                        <div className="space-y-1 pt-1">
                          <div className="text-[11px] font-heading font-semibold uppercase tracking-wider text-galla-ink-soft">
                            Included Retail Products ({pkg.products.length})
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {pkg.products.map((p, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] bg-galla-paper border border-galla-line text-[11.5px] font-sans text-galla-ink"
                              >
                                <ShoppingBag className="h-3 w-3 text-galla-brass" />
                                <span>
                                  {p.quantity}x {p.name}
                                </span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-galla-line text-[12px] text-galla-ink-soft">
                      <span className="font-sans">
                        {pkg.pricingType === "fixed" ? "Fixed Combo Price" : "Sum of Items"}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleEditPackage(pkg)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[4px] bg-galla-paper hover:bg-galla-paper/80 border border-galla-line text-galla-ink text-[12px] transition-colors cursor-pointer"
                        >
                          <Edit2 className="h-3 w-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteConfirm({
                              type: "package",
                              id: pkg.id,
                              name: pkg.name,
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[4px] hover:bg-red-50 border border-transparent text-galla-ink-soft hover:text-red-600 text-[12px] transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-12 text-center bg-galla-surface border border-galla-line rounded-[6px] space-y-3">
              <div className="inline-flex p-3 rounded-full bg-galla-paper text-galla-ink-soft mb-1">
                <Package className="h-7 w-7" />
              </div>
              <div className="font-heading font-medium text-[16px] text-galla-ink">
                No package deals created yet
              </div>
              <p className="font-sans text-[13px] text-galla-ink-soft max-w-md mx-auto">
                Package deals help sell combinations of high-margin services &amp; retail products
                with bundled pricing. Click &apos;Create Package&apos; to build your first offer.
              </p>
            </div>
          )}
        </div>
      )}

      {/* SERVICE MODAL */}
      <ServiceModal
        key={serviceToEdit?.id || (isServiceModalOpen ? "service-open" : "service-closed")}
        isOpen={isServiceModalOpen}
        onClose={() => setIsServiceModalOpen(false)}
        serviceToEdit={serviceToEdit}
        existingCategories={existingCategories}
        onSaveService={(saved) => {
          if (serviceToEdit) {
            onUpdateService(saved);
          } else {
            onAddService(saved);
          }
        }}
      />

      {/* PACKAGE MODAL */}
      <PackageModal
        key={packageToEdit?.id || (isPackageModalOpen ? "pkg-open" : "pkg-closed")}
        isOpen={isPackageModalOpen}
        onClose={() => setIsPackageModalOpen(false)}
        packageToEdit={packageToEdit}
        availableServices={services}
        availableProducts={products}
        onSavePackage={(saved) => {
          if (packageToEdit) {
            onUpdatePackage(saved);
          } else {
            onAddPackage(saved);
          }
        }}
      />

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-galla-surface border border-galla-line rounded-[8px] p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2 rounded-full bg-red-50 border border-red-200">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h3 className="font-heading font-semibold text-[17px] text-galla-ink">
                Confirm Deletion
              </h3>
            </div>

            <p className="font-sans text-[13px] text-galla-ink-soft">
              Are you sure you want to permanently delete{" "}
              <strong className="text-galla-ink">{deleteConfirm.name}</strong> from your salon
              catalog? This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-[5px] border border-galla-line text-galla-ink font-sans text-[13px] font-medium hover:bg-galla-paper transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-5 py-2 rounded-[5px] bg-red-600 hover:bg-red-700 text-white font-sans text-[13px] font-medium shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
