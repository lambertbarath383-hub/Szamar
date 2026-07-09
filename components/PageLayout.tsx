import Sidebar from "./Sidebar";
import { ReactNode } from "react";

type Props = {
  title: string;
  children?: ReactNode;
};

export default function PageLayout({
  title,
  children,
}: Props) {
  return (
    <main className="min-h-screen bg-[#0b0b0f] text-white">
      <div className="flex">

        <Sidebar />

        <section className="flex-1 p-8 animate-fade-in">
          <h1 className="mb-8 text-4xl font-bold page-title">
            {title}
          </h1>

          {children}
        </section>

      </div>
    </main>
  );
}