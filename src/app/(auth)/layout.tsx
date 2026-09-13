import React from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-galla-paper text-galla-ink">
      <div className="w-full flex items-center justify-center">
        {children}
      </div>
    </main>
  );
}
