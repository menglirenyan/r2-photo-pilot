import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "货物产品册",
  description: "面向企业的多租户产品图片册与出货单后台。"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
