import { BookOpen } from "lucide-react";

export default function Home() {
  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="login-icon">
          <BookOpen size={24} />
        </div>
        <span className="login-eyebrow">货物产品册</span>
        <h1>企业产品目录</h1>
        <p>请使用企业提供的专属链接访问产品册，或联系企业获取最新访问地址。</p>
        <a className="primary-action" href="/admin/login">
          平台管理员登录
        </a>
      </section>
    </main>
  );
}
