"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FiLoader, FiKey, FiCheck, FiSave, FiRefreshCw } from "react-icons/fi";
import { triggerOnboarding } from "@/lib/onboarding";

const FIELDS = [
  {
    name: "REPLICATE_API_TOKEN",
    label: "Replicate API Token",
    hint: "Gera os vídeos e imagens. https://replicate.com/account/api-tokens",
    placeholder: "r8_...",
  },
  {
    name: "ELEVENLABS_API_KEY",
    label: "ElevenLabs API Key",
    hint: "Voz dos avatares. https://elevenlabs.io/app/settings/api-keys",
    placeholder: "sk_...",
  },
  {
    name: "ANTHROPIC_API_KEY",
    label: "Anthropic API Key (opcional)",
    hint: "Roteiros com Claude. Se vazio, usa um modelo de texto do Replicate.",
    placeholder: "sk-ant-...",
  },
];

export default function SettingsPage() {
  const { status } = useSession();
  const router = useRouter();

  const [secretStatus, setSecretStatus] = useState({});
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings");
      if (res.ok) setSecretStatus((await res.json()).status || {});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") load();
  }, [status]);

  const save = async () => {
    // só envia campos que o usuário digitou (não sobrescreve com vazio sem querer)
    const secrets = {};
    for (const f of FIELDS) {
      if (values[f.name] !== undefined) secrets[f.name] = values[f.name];
    }
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secrets }),
      });
      if (!res.ok) throw new Error("Falha ao salvar");
      setSecretStatus((await res.json()).status || {});
      setValues({});
      setSaved(true);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <FiLoader className="w-6 h-6 animate-spin text-muted" />
      </div>
    );
  }
  if (status === "unauthenticated") {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-5 p-6 text-center">
        <h2 className="text-lg font-black text-foreground">Entre para configurar</h2>
        <button onClick={() => router.push("/login")} className="px-6 py-2.5 bg-primary-500 text-white rounded-full font-bold text-xs hover:bg-primary-600 transition-all">
          Entrar / Cadastrar
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-2">
          <FiKey className="text-primary-500" />
          <h1 className="text-xl font-black tracking-tight text-foreground">Configurações</h1>
        </div>
        <p className="text-xs text-muted mb-8">
          Suas chaves ficam guardadas criptografadas no banco (vault). Os valores nunca são exibidos de volta — só o status.
        </p>

        {loading ? (
          <div className="flex justify-center py-20">
            <FiLoader className="w-6 h-6 animate-spin text-muted" />
          </div>
        ) : (
          <div className="space-y-6">
            {FIELDS.map((f) => {
              const st = secretStatus[f.name] || {};
              return (
                <div key={f.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-black uppercase tracking-widest text-foreground">{f.label}</span>
                    {st.configured ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                        <FiCheck /> {st.source === "vault" ? "salvo" : "via .env"} · {st.preview}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-muted">não configurado</span>
                    )}
                  </div>
                  <input
                    type="password"
                    value={values[f.name] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                    placeholder={st.configured ? "•••••••• (deixe em branco pra manter)" : f.placeholder}
                    className="w-full px-3 py-2.5 bg-glass-bg border border-glass-border rounded-lg text-xs text-foreground placeholder-muted outline-none focus:border-primary-500/50"
                  />
                  <p className="text-[10px] text-muted mt-1">{f.hint}</p>
                </div>
              );
            })}

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary-500 text-white rounded-full text-xs font-bold hover:bg-primary-600 transition-all disabled:opacity-50"
              >
                {saving ? <FiLoader className="animate-spin" /> : <FiSave />}
                Salvar
              </button>
              {saved && <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1"><FiCheck /> Salvo!</span>}
            </div>
            <p className="text-[10px] text-muted">
              Dica: deixe um campo em branco pra manter o valor atual. Pra remover uma chave, apague o conteúdo e salve.
            </p>

            <div className="border-t border-glass-border pt-6 mt-2">
              <h2 className="text-[11px] font-black uppercase tracking-widest text-foreground mb-1.5">
                Onboarding
              </h2>
              <p className="text-[11px] text-muted mb-3">
                Quer revisar a configuração inicial? Reinicie o assistente passo a passo.
              </p>
              <button
                onClick={() => {
                  triggerOnboarding();
                  router.push("/");
                }}
                className="flex items-center gap-2 px-5 py-2.5 bg-glass-bg border border-glass-border text-foreground rounded-full text-xs font-bold hover:border-primary-500/40 transition-all"
              >
                <FiRefreshCw /> Reiniciar onboarding
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
