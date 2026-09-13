import React from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-muted/30">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black tracking-tight text-primary">Galla</h1>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">
            Salon & Parlour Management Platform
          </p>
        </div>
        {children}
      </div>
    </main>
  );
}
