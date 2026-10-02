"use client";

import React from "react";
import { useDashboard } from "@/context/dashboard-context";
import { ServicesTab } from "@/components/dashboard/tabs/services-tab";

export default function ServicesPage() {
  const {
    services,
    packages,
    products,
    role,
    handleAddService,
    handleUpdateService,
    handleDeleteService,
    handleAddPackage,
    handleUpdatePackage,
    handleDeletePackage,
  } = useDashboard();

  return (
    <ServicesTab
      services={services}
      packages={packages}
      products={products}
      isReadOnly={role !== "owner"}
      onAddService={handleAddService}
      onUpdateService={handleUpdateService}
      onDeleteService={handleDeleteService}
      onAddPackage={handleAddPackage}
      onUpdatePackage={handleUpdatePackage}
      onDeletePackage={handleDeletePackage}
    />
  );
}
