"use client";

import { Building2, LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";

type LoginFormProps = {
  redirectTo?: string;
  description?: string;
  companySlug?: string;
  defaultUsername?: string;
  mode?: "auto" | "platform" | "company";
};

export function LoginForm({
  redirectTo = "/admin",
  description,
  companySlug,
  defaultUsername = "admin",
  mode
}: LoginFormProps) {
  const router = useRouter();
  const resolvedMode = mode ?? (companySlug ? "company" : "platform");
  const isCompanyLogin = resolvedMode === "company";
  const isAutoLogin = resolvedMode === "auto";
  const resolvedDescription =
    description ?? (isCompanyLogin ? "请输入企业账号和密码进入产品管理后台。" : "用于平台用户管理。");
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
        body: JSON.stringify({ username, password, companySlug, loginMode: resolvedMode })
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        redirectTo?: string;
      };

      if (!response.ok) {
        setMessage(payload.error || "登录失败，请稍后重试。");
        setIsSubmitting(false);
        return;
      }

      const destination = isAutoLogin ? payload.redirectTo : redirectTo;
      if (!destination || !destination.startsWith("/") || destination.startsWith("//")) {
        setMessage("登录成功，但后台地址无效，请联系平台管理员。");
        setIsSubmitting(false);
        return;
      }

      startTransition(() => router.replace(destination));
    } catch {
      setMessage("无法连接服务器，请检查网络后重试。");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <form
        aria-busy={isSubmitting || isPending}
        aria-label={isAutoLogin ? "后台登录" : isCompanyLogin ? "企业后台登录" : "平台管理员登录"}
        className="login-panel"
        onSubmit={handleSubmit}
      >
        <div className="login-icon">
          {isAutoLogin ? <Building2 size={24} /> : <LockKeyhole size={24} />}
        </div>
        <span className="login-eyebrow">
          货物产品册 · {isAutoLogin ? "统一入口" : isCompanyLogin ? "企业工作台" : "平台运营"}
        </span>
        <h1>{isAutoLogin ? "后台登录" : isCompanyLogin ? "企业后台登录" : "平台管理员登录"}</h1>
        <p>{resolvedDescription}</p>
        <label>
          账号
          <input
            autoComplete="username"
            autoFocus
            maxLength={80}
            name="username"
            onChange={(event) => setUsername(event.target.value)}
            required
            value={username}
          />
        </label>
        <label>
          密码
          <input
            autoComplete="current-password"
            maxLength={512}
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>
        {message ? <div className="form-error" role="alert">{message}</div> : null}
        <button disabled={isSubmitting || isPending || !username.trim() || !password} type="submit">
          {isSubmitting || isPending
            ? "正在验证..."
            : isAutoLogin
              ? "登录"
              : isCompanyLogin
                ? "进入企业后台"
                : "进入平台后台"}
        </button>
      </form>
    </main>
  );
}
