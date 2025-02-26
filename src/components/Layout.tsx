import React from 'react';
import { DynamicWidget } from "@dynamic-labs/sdk-react-core";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center">
              <img
                className="h-8 w-auto"
                src="/tars-logo.svg"
                alt="TARS"
              />
            </div>
            <div className="flex items-center">
              <DynamicWidget />
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="w-full pt-16">
        {children}
      </main>
    </div>
  )
} 