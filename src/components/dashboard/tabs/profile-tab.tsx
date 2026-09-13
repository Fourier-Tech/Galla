"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import {
  Building2,
  Camera,
  Check,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  Upload,
  User,
} from "lucide-react";
import { DashboardSalonProfile } from "@/types/dashboard";
import {
  updateSalonProfileAction,
  uploadSalonProfileImageAction,
} from "@/app/dashboard/actions";

interface ProfileTabProps {
  salonProfile: DashboardSalonProfile;
  onUpdateProfile: (profile: DashboardSalonProfile) => void;
}

export function ProfileTab({
  salonProfile,
  onUpdateProfile,
}: ProfileTabProps) {
  const [name, setName] = useState(salonProfile.name);
  const [ownerName, setOwnerName] = useState(salonProfile.ownerName);
  const [phone, setPhone] = useState(salonProfile.phone);
  const [address, setAddress] = useState(salonProfile.address);
  const [currentImageUrl, setCurrentImageUrl] = useState(
    salonProfile.profileImageUrl || ""
  );

  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset feedback
    setFeedback(null);
    setIsUploadingImage(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await uploadSalonProfileImageAction(formData);

      if (res.success && res.profileImageUrl) {
        setCurrentImageUrl(res.profileImageUrl);
        onUpdateProfile({
          ...salonProfile,
          name,
          ownerName,
          phone,
          address,
          profileImageUrl: res.profileImageUrl,
          profileImagePublicId: res.profileImagePublicId,
        });
        setFeedback({
          type: "success",
          message:
            "Salon profile photo updated successfully on Cloudinary. Previous storage asset automatically cleared.",
        });
      } else {
        setFeedback({
          type: "error",
          message: res.error || "Failed to upload image to Cloudinary",
        });
      }
    } catch {
      setFeedback({
        type: "error",
        message: "An unexpected error occurred during image upload.",
      });
    } finally {
      setIsUploadingImage(false);
      // Reset input value so re-selecting same file triggers onChange
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingDetails(true);
    setFeedback(null);

    try {
      const res = await updateSalonProfileAction({
        name: name.trim(),
        ownerName: ownerName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        profileImageUrl: currentImageUrl,
      });

      if (res.success && res.profile) {
        onUpdateProfile(res.profile);
        setFeedback({
          type: "success",
          message: "Salon profile information saved successfully.",
        });
      } else {
        setFeedback({
          type: "error",
          message: res.error || "Failed to update salon profile",
        });
      }
    } catch {
      setFeedback({
        type: "error",
        message: "Network error occurred while saving profile details",
      });
    } finally {
      setIsSavingDetails(false);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-4xl">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-1.5 px-[10px] py-[3px] rounded-[3px] bg-galla-teal-soft text-galla-teal text-[11px] font-heading font-semibold uppercase tracking-wider mb-2">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Shop Administration</span>
        </div>
        <h2 className="font-heading font-semibold text-[21px] tracking-[-0.015em] text-galla-ink">
          Salon Profile &amp; Branding
        </h2>
        <p className="font-sans text-[13px] text-galla-ink-soft mt-0.5">
          Manage parlour identity, Cloudinary profile image &amp; registered store details
        </p>
      </div>

      {/* Alert Banner */}
      {feedback && (
        <div
          role="alert"
          className={`p-[14px] rounded-[5px] text-[13px] font-sans flex items-center gap-2.5 shadow-xs ${
            feedback.type === "success"
              ? "bg-emerald-50 border border-emerald-300 text-emerald-900"
              : "bg-red-50 border border-red-300 text-red-900"
          }`}
        >
          {feedback.type === "success" ? (
            <Check className="h-4 w-4 text-emerald-600 shrink-0" />
          ) : null}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Profile Card with Photo Upload */}
      <div className="bg-galla-surface border border-galla-line rounded-[5px] p-[24px]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          {/* Avatar with Upload Trigger */}
          <div className="relative group">
            <div className="relative h-24 w-24 rounded-[8px] bg-galla-paper border border-galla-line overflow-hidden shrink-0 flex items-center justify-center shadow-xs">
              {currentImageUrl ? (
                <Image
                  src={currentImageUrl}
                  alt={name}
                  width={96}
                  height={96}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-galla-ink-soft">
                  <Building2 className="h-10 w-10 stroke-[1.5]" />
                </div>
              )}

              {/* Upload Spinner Overlay */}
              {isUploadingImage && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white text-[11px] gap-1 z-20">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Uploading...</span>
                </div>
              )}
            </div>

            {/* Quick Camera Overlay Button */}
            <button
              type="button"
              disabled={isUploadingImage}
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-2 -right-2 p-2 bg-galla-teal text-white rounded-full shadow-md hover:opacity-95 transition-opacity cursor-pointer disabled:opacity-50"
              title="Change Salon Photo"
            >
              <Camera className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png, image/jpeg, image/webp"
            onChange={handleImageFileChange}
            className="hidden"
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="font-heading font-semibold text-[20px] text-galla-ink tracking-tight truncate">
                {name || "Salon Profile"}
              </h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded-[3px] bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-heading font-semibold uppercase tracking-wider">
                Active Store
              </span>
            </div>
            {(ownerName || salonProfile.email) && (
              <div className="font-sans text-[12.5px] text-galla-ink-soft mt-1">
                {ownerName ? `Registered Owner: ${ownerName}` : ""}
                {ownerName && salonProfile.email ? ` • ` : ""}
                {salonProfile.email ? salonProfile.email : ""}
              </div>
            )}

            {/* Change Photo Action */}
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                disabled={isUploadingImage}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-galla-paper hover:bg-galla-paper/80 border border-galla-line text-galla-ink rounded-[4px] text-[12.5px] font-sans font-medium transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
              >
                <Upload className="h-3.5 w-3.5 text-galla-ink-soft" />
                <span>{isUploadingImage ? "Uploading to Cloudinary..." : "Change Profile Photo"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Salon Details Form */}
      <form onSubmit={handleSaveDetails} className="space-y-6">
        <div className="bg-galla-surface border border-galla-line rounded-[5px] p-[24px] space-y-4">
          <div className="flex items-center gap-2 border-b border-galla-line pb-3">
            <Building2 className="h-4 w-4 text-galla-teal" />
            <h4 className="font-heading font-semibold text-[16px] text-galla-ink">
              Business Information
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-sans text-[12px] font-medium text-galla-ink-soft mb-1">
                Salon Business Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter salon business name"
                className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] px-[13px] py-[8px] text-[14px] text-galla-ink focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-all"
              />
            </div>

            <div>
              <label className="block font-sans text-[12px] font-medium text-galla-ink-soft mb-1">
                Owner / Manager Name
              </label>
              <div className="relative">
                <User className="h-4 w-4 text-galla-ink-soft/60 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Enter owner or manager name"
                  className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] pl-9 pr-3 py-[8px] text-[14px] text-galla-ink focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block font-sans text-[12px] font-medium text-galla-ink-soft mb-1">
                Login / Contact Email (Account ID)
              </label>
              <div className="relative">
                <Mail className="h-4 w-4 text-galla-ink-soft/60 absolute left-3 top-2.5" />
                <input
                  type="email"
                  disabled
                  value={salonProfile.email}
                  placeholder="No email registered"
                  className="w-full bg-galla-paper/30 border border-galla-line/60 rounded-[5px] pl-9 pr-3 py-[8px] text-[14px] text-galla-ink-soft cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label className="block font-sans text-[12px] font-medium text-galla-ink-soft mb-1">
                Store Phone Number
              </label>
              <div className="relative">
                <Phone className="h-4 w-4 text-galla-ink-soft/60 absolute left-3 top-2.5" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Enter store phone number"
                  className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] pl-9 pr-3 py-[8px] text-[14px] text-galla-ink focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-all"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block font-sans text-[12px] font-medium text-galla-ink-soft mb-1">
              Parlour Physical Address
            </label>
            <div className="relative">
              <MapPin className="h-4 w-4 text-galla-ink-soft/60 absolute left-3 top-2.5" />
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter store address"
                className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] pl-9 pr-3 py-[8px] text-[14px] text-galla-ink focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-all"
              />
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="submit"
            disabled={isSavingDetails}
            className="inline-flex items-center gap-2 bg-galla-teal hover:opacity-95 text-white font-sans text-[14px] font-medium px-6 py-2.5 rounded-[5px] shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>{isSavingDetails ? "Saving Details..." : "Save Profile Details"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
