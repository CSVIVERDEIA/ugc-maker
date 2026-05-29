"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiArrowRight,
  FiArrowLeft,
  FiCheck,
  FiLoader,
  FiKey,
  FiX,
  FiExternalLink,
} from "react-icons/fi";
import logoUrl from "@assets/VIA_app_icon_1780089502703.png";

const STEPS = [
  {
    name: "REPLICATE_API_TOKEN",
    title: "Replicate",
    label: "Replicate API Token",
    hint: "Gera os vídeos e imagens. É a chave principal pra criar conteúdo.",
    placeholder: "r8_...",
    link: "https://replicate.com/account/api-tokens",
    optional: false,
  },
  {
    name: "ELEVENLABS_API_KEY",
    title: "ElevenLabs",
    label: "ElevenLabs API Key",
    hint: "Dá voz aos avatares com áudio realista.",
    placeholder: "sk_...",
    link: "https://elevenlabs.io/app/settings/api-keys",
    optional: false,
  },
  {
    name: "ANTHROPIC_API_KEY",
    title: "Anthropic",
    label: "Anthropic API Key (opcional)",
    hint: "Escreve os roteiros com o Claude. Se deixar vazio, usamos um modelo de texto do Replicate.",
    placeholder: "sk-ant-...",
    link: "https://console.anthropic.com/settings/keys",
    optional: true,
  },
];

// total de telas = boas-vindas + 1 por chave
const TOTAL = STEPS.length + 1;

export function OnboardingWizard({ open, onClose }) {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState({});
  const [status, setStatus] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // carrega o status atual das chaves pra mostrar o que já está configurado
  useEffect(() => {
    if (!open) return;
    setStep(0);
    setError("");
    setValues({});
    (async () => {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) setStatus((await res.json()).status || {});
      } catch {}
    })();
  }, [open]);

  const finish = async () => {
    const secrets = {};
    for (const f of STEPS) {
      const v = values[f.name];
      if (v !== undefined && v.trim() !== "") secrets[f.name] = v.trim();
    }
    setSaving(true);
    setError("");
    try {
      if (Object.keys(secrets).length > 0) {
        const res = await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ secrets }),
        });
        if (!res.ok) throw new Error("Falha ao salvar as chaves. Tente de novo.");
      }
      onClose?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const isWelcome = step === 0;
  const field = isWelcome ? null : STEPS[step - 1];
  const isLast = step === TOTAL - 1;

  // passo obrigatório só avança se a chave foi digitada ou já está configurada
  const fieldFilled =
    !field ||
    field.optional ||
    (values[field.name] ?? "").trim() !== "" ||
    (status[field.name] || {}).configured;

  const next = () => {
    if (!fieldFilled) {
      setError("Essa chave é obrigatória pra continuar.");
      return;
    }
    setError("");
    if (isLast) finish();
    else setStep((s) => s + 1);
  };
  const back = () => {
    setError("");
    setStep((s) => Math.max(0, s - 1));
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: "spring", damping: 24, stiffness: 280 }}
            className="relative w-full max-w-md bg-solid-bg border border-glass-border rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* topo: logo + progresso */}
            <div className="p-6 pb-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <img src={logoUrl} alt="UGC Maker" className="w-9 h-9 rounded-lg" />
                  <span className="font-black text-sm tracking-tighter uppercase text-foreground">
                    UGC Maker
                  </span>
                </div>
                <button
                  onClick={() => onClose?.()}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-foreground hover:bg-glass-hover transition-all"
                  aria-label="Fechar"
                >
                  <FiX />
                </button>
              </div>

              {/* barra de progresso */}
              <div className="flex items-center gap-1.5 mt-5">
                {Array.from({ length: TOTAL }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                      i <= step ? "bg-primary-500" : "bg-glass-border"
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="p-6 min-h-[260px] flex flex-col">
              <AnimatePresence mode="wait">
                {isWelcome ? (
                  <motion.div
                    key="welcome"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="flex-1 flex flex-col justify-center"
                  >
                    <h2 className="text-xl font-black tracking-tight text-foreground">
                      Bem-vindo ao UGC Maker 👋
                    </h2>
                    <p className="text-sm text-muted mt-3 leading-relaxed">
                      Vamos configurar suas chaves de API pra você começar a gerar vídeos.
                      Leva menos de um minuto.
                    </p>
                    <div className="mt-5 space-y-2">
                      {STEPS.map((s) => (
                        <div key={s.name} className="flex items-center gap-2.5 text-xs">
                          <div className="w-6 h-6 rounded-lg bg-primary-50 text-primary-500 flex items-center justify-center">
                            <FiKey className="text-[11px]" />
                          </div>
                          <span className="font-bold text-foreground">{s.title}</span>
                          {s.optional && (
                            <span className="text-[10px] font-bold text-muted">opcional</span>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted mt-5">
                      Suas chaves ficam criptografadas no banco (vault) e nunca são exibidas de volta.
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key={field.name}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="flex-1 flex flex-col"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-primary-500">
                        Passo {step} de {STEPS.length}
                      </span>
                      {(status[field.name] || {}).configured && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                          <FiCheck /> já configurado
                        </span>
                      )}
                    </div>
                    <h2 className="text-lg font-black tracking-tight text-foreground">
                      {field.label}
                    </h2>
                    <p className="text-xs text-muted mt-2 leading-relaxed">{field.hint}</p>

                    <input
                      type="password"
                      autoFocus
                      value={values[field.name] ?? ""}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [field.name]: e.target.value }))
                      }
                      onKeyDown={(e) => e.key === "Enter" && next()}
                      placeholder={
                        (status[field.name] || {}).configured
                          ? "•••••••• (deixe em branco pra manter)"
                          : field.placeholder
                      }
                      className="w-full mt-4 px-3 py-2.5 bg-glass-bg border border-glass-border rounded-lg text-xs text-foreground placeholder-muted outline-none focus:border-primary-500/50"
                    />

                    <a
                      href={field.link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-[11px] font-bold text-primary-500 hover:text-primary-600 mt-3 w-fit"
                    >
                      Pegar minha chave <FiExternalLink className="text-[10px]" />
                    </a>
                  </motion.div>
                )}
              </AnimatePresence>

              {error && <p className="text-[11px] text-rose-500 mt-3">{error}</p>}

              {/* navegação */}
              <div className="flex items-center justify-between gap-3 mt-6">
                {step > 0 ? (
                  <button
                    onClick={back}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-muted hover:text-foreground transition-all disabled:opacity-50"
                  >
                    <FiArrowLeft /> Voltar
                  </button>
                ) : (
                  <span />
                )}

                <div className="flex items-center gap-2">
                  {field?.optional && !isLast && (
                    <button
                      onClick={() => setStep((s) => s + 1)}
                      disabled={saving}
                      className="px-4 py-2.5 text-xs font-bold text-muted hover:text-foreground transition-all disabled:opacity-50"
                    >
                      Pular
                    </button>
                  )}
                  <button
                    onClick={next}
                    disabled={saving || !fieldFilled}
                    className="flex items-center gap-1.5 px-6 py-2.5 bg-primary-500 text-white rounded-full text-xs font-bold hover:bg-primary-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? (
                      <FiLoader className="animate-spin" />
                    ) : isWelcome ? (
                      <>
                        Começar <FiArrowRight />
                      </>
                    ) : isLast ? (
                      <>
                        Concluir <FiCheck />
                      </>
                    ) : (
                      <>
                        Próximo <FiArrowRight />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
