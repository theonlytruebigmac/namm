import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { WebSocketProvider } from "@/components/providers/WebSocketProvider";
import { MQTTProvider } from "@/components/providers/MQTTProvider";
import { KeyboardShortcutsProvider } from "@/components/providers/KeyboardShortcutsProvider";
import { ToastProvider } from "@/components/ui/toast";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { NotificationInitializer } from "@/components/NotificationInitializer";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NAMM - Not Another Meshtastic Monitor",
  description: "Modern Meshtastic mesh network monitoring application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('theme') || 'dark';
                document.documentElement.classList.add(theme);
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className={`${inter.className} bg-[hsl(var(--background))] text-[hsl(var(--foreground))] antialiased`}>
        <QueryProvider>
          <WebSocketProvider>
            <MQTTProvider>
              <ToastProvider>
                <NotificationInitializer />
                <KeyboardShortcutsProvider />
                <div className="min-h-screen">
                  <Sidebar />
                  <main className="lg:pl-64 pb-16 lg:pb-0">
                    <div className="px-4 py-6 sm:px-6 lg:px-8">
                      {children}
                    </div>
                  </main>
                  <MobileNav />
                </div>
              </ToastProvider>
            </MQTTProvider>
          </WebSocketProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
