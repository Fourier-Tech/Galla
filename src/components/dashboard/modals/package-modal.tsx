"use client";

import React, { useState, useMemo } from "react";
import {
  X,
  Package,
  Plus,
  Trash2,
  AlertCircle,
  Scissors,
  ShoppingBag,
  IndianRupee,
  Percent,
} from "lucide-react";
import {
  DashboardPackage,
  DashboardService,
  DashboardProduct,
  DashboardPackageServiceItem,
  DashboardPackageProductItem,
} from "@/types/dashboard";
import { createPackageAction, updatePackageAction } from "@/app/dashboard/actions";
import { formatRupee } from "@/lib/utils";
import { ConfirmModal } from "./confirm-modal";

interface PackageModalProps {
  isOpen: boolean;
  onClose: () => void;
  packageToEdit?: DashboardPackage | null;
  availableServices: DashboardService[];
  availableProducts: DashboardProduct[];
  onSavePackage: (pkg: DashboardPackage) => void;
}

export function PackageModal({
  isOpen,
  onClose,
  packageToEdit,
  availableServices,
  availableProducts,
  onSavePackage,
}: PackageModalProps) {
  const [name, setName] = useState(packageToEdit?.name || "");
  const [description, setDescription] = useState(packageToEdit?.description || "");
  const [packagePrice, setPackagePrice] = useState(
    packageToEdit ? String(packageToEdit.packagePrice) : ""
  );
  const [selectedServices, setSelectedServices] = useState<DashboardPackageServiceItem[]>(
    packageToEdit?.services || []
  );
  const [selectedProducts, setSelectedProducts] = useState<DashboardPackageProductItem[]>(
    packageToEdit?.products || []
  );
  const [isActive, setIsActive] = useState(packageToEdit?.isActive ?? true);

  const [serviceToAdd, setServiceToAdd] = useState("");
  const [productToAdd, setProductToAdd] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = React.useRef(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Calculate total standalone value of all included items
  const standaloneServicesTotal = selectedServices.reduce(
    (sum, s) => sum + (Number(s.componentPrice) || 0),
    0
  );
  const standaloneProductsTotal = selectedProducts.reduce(
    (sum, p) => sum + (Number(p.componentPrice) || 0) * (Number(p.quantity) || 1),
    0
  );
  const standaloneTotal = standaloneServicesTotal + standaloneProductsTotal;

  const enteredPrice = Number(packagePrice) || 0;
  const savingsAmount =
    enteredPrice > 0 ? Math.max(0, standaloneTotal - enteredPrice) : 0;
  const savingsPercent =
    standaloneTotal > 0 && savingsAmount > 0
      ? Math.round((savingsAmount / standaloneTotal) * 100)
      : 0;

  // Alphabetically sorted products for selection dropdown
  const sortedAvailableProducts = useMemo<DashboardProduct[]>(() => {
    return [...(availableProducts || [])].sort((a, b) =>
      (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" })
    );
  }, [availableProducts]);

  if (!isOpen) return null;

  const handleAddServiceItem = () => {
    if (!serviceToAdd) return;
    const service = availableServices.find((s) => s.id === serviceToAdd);
    if (!service) return;

    // Check if already added
    if (selectedServices.some((s) => s.serviceId === service.id)) {
      setErrorMsg("This service is already in the package bundle");
      return;
    }

    setSelectedServices((prev) => [
      ...prev,
      {
        serviceId: service.id,
        name: service.name,
        componentPrice: service.price,
      },
    ]);
    setServiceToAdd("");
    setErrorMsg(null);
  };

  const handleRemoveServiceItem = (serviceId: string) => {
    setSelectedServices((prev) => prev.filter((s) => s.serviceId !== serviceId));
  };

  const handleUpdateServicePrice = (serviceId: string, newPrice: number) => {
    setSelectedServices((prev) =>
      prev.map((s) => (s.serviceId === serviceId ? { ...s, componentPrice: newPrice } : s))
    );
  };

  const handleAddProductItem = () => {
    if (!productToAdd) return;
    const product = availableProducts.find((p) => String(p.id) === productToAdd);
    if (!product) return;

    // Check if already added
    if (selectedProducts.some((p) => p.productId === String(product.id))) {
      setErrorMsg("This product is already in the package bundle");
      return;
    }

    setSelectedProducts((prev) => [
      ...prev,
      {
        productId: String(product.id),
        name: product.name,
        quantity: 1,
        componentPrice: product.price,
      },
    ]);
    setProductToAdd("");
    setErrorMsg(null);
  };

  const handleRemoveProductItem = (productId: string) => {
    setSelectedProducts((prev) => prev.filter((p) => p.productId !== productId));
  };

  const handleUpdateProductQuantity = (productId: string, qty: number) => {
    const validQty = Math.max(1, qty);
    setSelectedProducts((prev) =>
      prev.map((p) => (p.productId === productId ? { ...p, quantity: validQty } : p))
    );
  };

  const handleUpdateProductPrice = (productId: string, newPrice: number) => {
    setSelectedProducts((prev) =>
      prev.map((p) => (p.productId === productId ? { ...p, componentPrice: newPrice } : p))
    );
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMsg("Please enter a package name");
      return;
    }

    if (selectedServices.length === 0 && selectedProducts.length === 0) {
      setErrorMsg("Please add at least one service or product to this package");
      return;
    }

    const finalPrice = Number(packagePrice);
    if (packagePrice.trim() === "" || isNaN(finalPrice) || finalPrice < 0) {
      setErrorMsg("Please enter a valid non-negative package price");
      return;
    }

    setShowConfirm(true);
  };

  const executeSavePackage = async () => {
    setShowConfirm(false);
    setErrorMsg(null);

    const trimmedName = name.trim();
    const finalPrice = Number(packagePrice);

    if (isSubmittingRef.current) return; isSubmittingRef.current = true; setIsSubmitting(true);

    try {
      if (packageToEdit) {
        const res = await updatePackageAction({
          id: packageToEdit.id,
          name: trimmedName,
          description: description.trim(),
          pricingType: "fixed",
          packagePrice: finalPrice,
          services: selectedServices,
          products: selectedProducts,
          isActive,
        });

        if (res.success && res.package) {
          onSavePackage(res.package);
          onClose();
        } else {
          setErrorMsg(res.error || "Failed to update package");
        }
      } else {
        const res = await createPackageAction({
          name: trimmedName,
          description: description.trim() || undefined,
          pricingType: "fixed",
          packagePrice: finalPrice,
          services: selectedServices,
          products: selectedProducts,
        });

        if (res.success && res.package) {
          onSavePackage(res.package);
          onClose();
        } else {
          setErrorMsg(res.error || "Failed to create package");
        }
      }
    } catch {
      setErrorMsg("Network error occurred. Please try again.");
    } finally {
      isSubmittingRef.current = false; setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-galla-surface border border-galla-line rounded-[8px] shadow-xl my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-galla-line">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-[5px] bg-galla-teal-soft text-galla-teal">
              <Package className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-galla-ink">
                {packageToEdit ? "Edit Package Deal" : "Create Package Deal"}
              </h3>
              <p className="font-sans text-[12px] text-galla-ink-soft">
                Bundle salon services &amp; retail products into attractive discounted packages
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-galla-ink-soft hover:text-galla-ink p-1 rounded-md transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleFormSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto overflow-x-hidden">
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-[12.5px] rounded-[5px]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Package Name & Description */}
          <div className="space-y-3">
            <div>
              <label className="block text-[12px] font-medium text-galla-ink mb-1.5">
                Package Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                autoFocus
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Bridal Glow Deluxe, Pre-Bridal Makeover, Grooming Combo"
                className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] px-[13px] py-[8px] text-[13.5px] text-galla-ink focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-all"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-galla-ink mb-1.5">
                Description / Highlights (Optional)
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Details on sessions, included treatments, or ideal occasion..."
                className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] px-[13px] py-[8px] text-[13px] text-galla-ink focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-all resize-none"
              />
            </div>
          </div>

          {/* Bundled Services Section */}
          <div className="pt-4 border-t border-galla-line/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scissors className="h-4 w-4 text-galla-teal" />
                <span className="text-[14px] font-semibold text-galla-ink">
                  Included Salon Services ({selectedServices.length})
                </span>
              </div>
              <span className="text-[12.5px] font-semibold text-galla-ink-soft tabular-nums">
                Subtotal: {formatRupee(standaloneServicesTotal)}
              </span>
            </div>

            {/* Add Service Picker */}
            <div className="flex gap-2">
              <select
                value={serviceToAdd}
                onChange={(e) => setServiceToAdd(e.target.value)}
                className="w-full max-w-full min-w-0 flex-1 bg-galla-paper/50 border border-galla-line rounded-[5px] px-3 py-2 text-[13px] text-galla-ink focus:outline-none focus:border-galla-teal cursor-pointer"
              >
                <option value="">-- Choose a service to bundle --</option>
                {availableServices
                  .filter((s) => s.isActive)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.category}) — {formatRupee(s.price)}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                onClick={handleAddServiceItem}
                disabled={!serviceToAdd}
                className="shrink-0 inline-flex items-center gap-1 px-3 py-2 bg-galla-teal text-white rounded-[5px] text-[12.5px] font-sans font-medium hover:opacity-95 disabled:opacity-40 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add</span>
              </button>
            </div>

            {/* Selected Services List */}
            {selectedServices.length > 0 ? (
              <div className="divide-y divide-galla-line/60 bg-galla-surface rounded-[5px] border border-galla-line overflow-hidden">
                {selectedServices.map((item) => (
                  <div
                    key={item.serviceId}
                    className="flex items-center justify-between px-3 py-2.5 text-[13px] gap-2"
                  >
                    <div className="min-w-0 flex-1 pr-3">
                      <div
                        title={item.name}
                        className="font-sans text-galla-ink font-medium line-clamp-2 break-words"
                      >
                        {item.name}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11.5px] text-galla-ink-soft shrink-0">Value ₹</span>
                      <input
                        type="number"
                        min="0"
                        value={item.componentPrice}
                        onChange={(e) =>
                          handleUpdateServicePrice(item.serviceId, Number(e.target.value))
                        }
                        className="w-20 bg-galla-paper border border-galla-line rounded-[4px] px-2 py-1 text-right font-medium text-[12.5px] text-galla-ink focus:outline-none focus:border-galla-teal tabular-nums shrink-0"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveServiceItem(item.serviceId)}
                        className="text-galla-ink-soft hover:text-red-600 p-1 transition-colors cursor-pointer shrink-0"
                        title="Remove service"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-3 text-[12px] text-galla-ink-soft border border-dashed border-galla-line rounded-[5px] bg-galla-paper/20">
                No services added yet. Select a service above to bundle.
              </div>
            )}
          </div>

          {/* Bundled Retail Products Section */}
          <div className="pt-4 border-t border-galla-line/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-galla-brass" />
                <span className="text-[14px] font-semibold text-galla-ink">
                  Included Retail Products ({selectedProducts.length})
                </span>
              </div>
              <span className="text-[12.5px] font-semibold text-galla-ink-soft tabular-nums">
                Subtotal: {formatRupee(standaloneProductsTotal)}
              </span>
            </div>

            {/* Add Product Picker */}
            <div className="flex gap-2">
              <select
                value={productToAdd}
                onChange={(e) => setProductToAdd(e.target.value)}
                className="w-full max-w-full min-w-0 flex-1 bg-galla-paper/50 border border-galla-line rounded-[5px] px-3 py-2 text-[13px] text-galla-ink focus:outline-none focus:border-galla-teal cursor-pointer"
              >
                <option value="">-- Choose an inventory product to bundle (optional) --</option>
                {sortedAvailableProducts.map((p) => (
                  <option key={String(p.id)} value={String(p.id)}>
                    {p.name} — {formatRupee(p.price)} (In-Use: {p.use || 0} pcs, Retail: {p.sell || 0} pcs)
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAddProductItem}
                disabled={!productToAdd}
                className="shrink-0 inline-flex items-center gap-1 px-3 py-2 bg-galla-teal text-white rounded-[5px] text-[12.5px] font-sans font-medium hover:opacity-95 disabled:opacity-40 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add</span>
              </button>
            </div>

            {/* Selected Products List */}
            {selectedProducts.length > 0 ? (
              <div className="divide-y divide-galla-line/60 bg-galla-surface rounded-[5px] border border-galla-line overflow-hidden">
                {selectedProducts.map((item) => (
                  <div
                    key={item.productId}
                    className="flex items-center justify-between px-3 py-2.5 text-[13px] gap-2"
                  >
                    <div className="min-w-0 flex-1 pr-3">
                      <div
                        title={item.name}
                        className="font-sans text-galla-ink font-medium line-clamp-2 break-words"
                      >
                        {item.name}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11.5px] text-galla-ink-soft shrink-0">Qty</span>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) =>
                          handleUpdateProductQuantity(item.productId, Number(e.target.value))
                        }
                        className="w-14 bg-galla-paper border border-galla-line rounded-[4px] px-2 py-1 text-center font-medium text-[12.5px] text-galla-ink focus:outline-none focus:border-galla-teal tabular-nums shrink-0"
                      />
                      <span className="text-[11.5px] text-galla-ink-soft ml-1 shrink-0">₹/ea</span>
                      <input
                        type="number"
                        min="0"
                        value={item.componentPrice}
                        onChange={(e) =>
                          handleUpdateProductPrice(item.productId, Number(e.target.value))
                        }
                        className="w-20 bg-galla-paper border border-galla-line rounded-[4px] px-2 py-1 text-right font-medium text-[12.5px] text-galla-ink focus:outline-none focus:border-galla-teal tabular-nums shrink-0"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveProductItem(item.productId)}
                        className="text-galla-ink-soft hover:text-red-600 p-1 transition-colors cursor-pointer shrink-0"
                        title="Remove product"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-2.5 text-[12px] text-galla-ink-soft border border-dashed border-galla-line rounded-[5px] bg-galla-paper/20">
                No retail products added (packages can be services-only or combo deals).
              </div>
            )}
          </div>

          {/* Pricing Strategy */}
          <div className="pt-4 border-t border-galla-line/80 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-semibold text-galla-ink">
                Package Pricing
              </span>
            </div>

            {/* Price Input & Value Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <div>
                <label className="block text-[12px] font-medium text-galla-ink mb-1.5">
                  Final Package Selling Price (₹) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <IndianRupee className="h-4 w-4 text-galla-ink-soft/60 absolute left-3 top-2.5" />
                  <input
                    type="number"
                    required
                    min="0"
                    step="1"
                    value={packagePrice}
                    onChange={(e) => setPackagePrice(e.target.value)}
                    placeholder="0"
                    className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] pl-9 pr-3 py-[8px] text-[15px] font-semibold text-galla-ink focus:outline-none focus:border-galla-teal tabular-nums"
                  />
                </div>
              </div>

              {/* Value & Discount summary pill */}
              <div className="p-3 rounded-[6px] bg-galla-paper/70 border border-galla-line flex flex-col justify-center">
                <div className="flex items-center justify-between text-[12px] text-galla-ink-soft">
                  <span>Total Price:</span>
                  <span
                    className={`font-semibold tabular-nums ${enteredPrice > 0 && savingsAmount > 0
                        ? "line-through text-galla-ink-soft"
                        : "text-galla-ink"
                      }`}
                  >
                    {formatRupee(standaloneTotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[13px] text-galla-ink font-medium mt-1">
                  <span>Selling Price:</span>
                  <span className="font-bold text-galla-teal tabular-nums">
                    {formatRupee(enteredPrice)}
                  </span>
                </div>
                {enteredPrice > 0 && savingsAmount > 0 && (
                  <div className="mt-1 inline-flex items-center gap-1 text-[11.5px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-[4px] border border-emerald-200 self-start">
                    <Percent className="h-3 w-3" />
                    <span>
                      Save {formatRupee(savingsAmount)} ({savingsPercent}% OFF)
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Active Status Toggle (if editing) */}
          {packageToEdit && (
            <div className="flex items-center justify-between p-3 rounded-[5px] bg-galla-paper/60 border border-galla-line">
              <div>
                <div className="font-sans text-[13px] font-medium text-galla-ink">
                  Package Availability
                </div>
                <div className="font-sans text-[11.5px] text-galla-ink-soft">
                  Enable or disable this package on counter sales
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                className={`px-3 py-1 rounded-[4px] text-[12px] font-medium transition-colors cursor-pointer ${isActive
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                    : "bg-gray-100 text-gray-600 border border-gray-300"
                  }`}
              >
                {isActive ? "Active" : "Inactive"}
              </button>
            </div>
          )}

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-galla-line">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 rounded-[5px] border border-galla-line text-galla-ink font-sans text-[13px] font-medium hover:bg-galla-paper transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-[5px] bg-galla-teal text-white font-sans text-[13px] font-medium hover:opacity-95 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting
                ? "Saving..."
                : packageToEdit
                  ? "Save Changes"
                  : "Create Package"}
            </button>
          </div>
        </form>

        <ConfirmModal
          isOpen={showConfirm}
          title={packageToEdit ? "Confirm Update Package" : "Confirm Create Package"}
          description={
            <span>
              {packageToEdit ? (
                <>
                  Are you sure you want to save changes to <strong className="font-semibold text-galla-ink">&ldquo;{name.trim()}&rdquo;</strong>?
                </>
              ) : (
                <>
                  Are you sure you want to create package <strong className="font-semibold text-galla-ink">&ldquo;{name.trim()}&rdquo;</strong> with{" "}
                  <strong className="font-semibold text-galla-ink">{selectedServices.length + selectedProducts.length} item(s)</strong> for{" "}
                  <strong className="font-semibold text-galla-ink">{formatRupee(enteredPrice)}</strong>?
                </>
              )}
            </span>
          }
          confirmLabel={packageToEdit ? "Yes, Save Changes" : "Yes, Create Package"}
          cancelLabel="Cancel"
          isLoading={isSubmitting}
          onConfirm={executeSavePackage}
          onClose={() => setShowConfirm(false)}
        />
      </div>
    </div>
  );
}
