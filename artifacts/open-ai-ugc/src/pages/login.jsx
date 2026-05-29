"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FiLoader, FiArrowRight } from "react-icons/fi";
import { FaRocket } from "react-icons/fa";
import { triggerOnboarding } from "@/lib/onboarding";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isRegister = mode === "register";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // On register, create the account first.
      if (isRegister) {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Falha ao cadastrar");
        }
        // primeira vez: abre o wizard de configuração inicial na home
        triggerOnboarding();
      }

      // Then sign in (works for both new and existing accounts).
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        throw new Error("Email ou senha inválidos");
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-glass-bg border border-glass-border rounded-xl shadow-2xl p-8 backdrop-blur-3xl">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary-500 flex items-center justify-center shadow-lg shadow-primary-500/20">
            <FaRocket className="text-white text-xl" />
          </div>
          <h1 className="text-lg font-black tracking-tight text-foreground">
            {isRegister ? "Criar conta" : "Entrar"}
          </h1>
          <p className="text-xs text-muted text-center">
            {isRegister
              ? "Crie sua conta para começar a gerar vídeos."
              : "Acesse sua conta para continuar."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {isRegister && (
            <input
              type="text"
              placeholder="Nome (opcional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 bg-glass-bg border border-glass-border rounded-lg text-xs font-medium text-foreground placeholder-muted outline-none focus:border-primary-500/50 transition-all"
            />
          )}
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2.5 bg-glass-bg border border-glass-border rounded-lg text-xs font-medium text-foreground placeholder-muted outline-none focus:border-primary-500/50 transition-all"
          />
          <input
            type="password"
            required
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2.5 bg-glass-bg border border-glass-border rounded-lg text-xs font-medium text-foreground placeholder-muted outline-none focus:border-primary-500/50 transition-all"
          />

          {error && (
            <p className="text-[11px] font-medium text-rose-500 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-500 text-white rounded-lg font-bold text-xs hover:bg-primary-600 transition-all disabled:opacity-50"
          >
            {loading ? (
              <FiLoader className="animate-spin" />
            ) : (
              <>
                {isRegister ? "Cadastrar" : "Entrar"}
                <FiArrowRight />
              </>
            )}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(isRegister ? "login" : "register");
            setError("");
          }}
          className="w-full mt-5 text-[11px] font-medium text-muted hover:text-foreground transition-colors"
        >
          {isRegister
            ? "Já tem conta? Entrar"
            : "Não tem conta? Cadastre-se"}
        </button>
      </div>
    </div>
  );
}
