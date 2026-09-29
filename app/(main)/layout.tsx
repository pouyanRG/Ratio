import type { ReactNode } from "react";
import { Navbar } from "@/components/navbar";

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Navbar />
      <div className="flex-1">{children}</div>
    </>
  );
}