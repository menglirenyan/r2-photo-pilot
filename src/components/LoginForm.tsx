"use client";

import { LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";

type LoginFormProps = {
  redirectTo?: string;
  description?: string;
  companySlug?: string;
  defaultUsername?: string;
};

export function LoginForm({
  redirectTo = "/admin",
  description = "用于平台用户管理。",
  companySlug,
  defaultUsername = "admin"
}: LoginFormProps) {
  const router = useRouter();
  const [username, setUsername] = useState(defaultUsername);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, companySlug })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setMessage(payload.error || "登录失败，请稍后重试。");
        setIsSubmitting(false);
        return;
      }

      startTransition(() => router.push(redirectTo));
    } catch {
      setMessage("无法连接服务器，请检查网络后重试。");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <form aria-busy={isSubmitting || isPending} className="login-panel" onSubmit={handleSubmit}>
        <div className="login-icon">
          <LockKeyhole size={24} />
        </div>
        <span className="login-eyebrow">货物产品册 · {companySlug ? "企业工作台" : "平台运营"}</span>
        <h1>{companySlug ? "企业后台登录" : "平台管理员登录"}</h1>
        <p>{description}</p>
        <label>
          账号
          <input
            autoComplete="username"
            autoFocus
            onChange={(event) => setUsername(event.target.value)}
            value={username}
          />
        </label>
        <label>
          密码
          <input
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />
        </label>
        {message ? <div className="form-error" role="alert">{message}</div> : null}
        <button disabled={isSubmitting || isPending || !username.trim() || !password} type="submit">
          {isSubmitting || isPending ? "正在验证..." : companySlug ? "进入企业后台" : "进入平台后台"}
        </button>
      </form>
    </main>
  );
}
