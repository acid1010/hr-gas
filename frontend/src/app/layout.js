import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/app/components/Sidebar";
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
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      data-theme="gas-dark"
    >
      <body className="min-h-screen bg-[#0b0d14]">
        {user ? (
          <div className="flex min-h-screen">
            <Sidebar user={user} />
            <main className="flex-1 ml-64 min-h-screen">{children}</main>
          </div>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
