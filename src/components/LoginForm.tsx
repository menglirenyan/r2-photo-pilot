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
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, companySlug })
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setMessage(payload.error || "登录失败。");
      return;
    }

    startTransition(() => router.push(redirectTo));
  }

  return (
    <main className="login-page">
      <form className="login-panel" onSubmit={handleSubmit}>
        <div className="login-icon">
          <LockKeyhole size={24} />
        </div>
        <h1>后台登录</h1>
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
        {message ? <div className="form-error">{message}</div> : null}
        <button disabled={isPending} type="submit">
          {isPending ? "进入中..." : "进入后台"}
        </button>
      </form>
    </main>
  );
}
