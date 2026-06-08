import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/app/components/Sidebar";
import AppProviders from "@/app/components/AppProviders";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "HR System — PT. Global Anugerah Setia",
  description: "Internal HR Management Portal",
};

export default async function RootLayout({ children }) {
  const cookiesStore = await cookies();
  const token = cookiesStore.get("accessToken");

  let user = null;
  if (token) {
    try {
      user = jwt.decode(token.value);
    } catch {
      user = null;
    }
  }
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      data-theme="gas-light"
      suppressHydrationWarning
    >
      {/* Sync theme before first paint — prevents flash for light-mode users */}
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('gas-theme');if(t)document.documentElement.setAttribute('data-theme',t);})();`,
          }}
        />
      </head>
      <body className="min-h-screen" suppressHydrationWarning>
        <AppProviders>
          {user ? (
            <div className="min-h-screen">
              <Sidebar user={user} />
              <main className="ml-64 min-h-screen">{children}</main>
            </div>
          ) : (
            children
          )}
        </AppProviders>
      </body>
    </html>
  );
}
