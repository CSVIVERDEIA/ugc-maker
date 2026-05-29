"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiArrowLeft,
  FiArrowRight,
  FiLoader,
  FiCheck,
  FiRefreshCw,
  FiZap,
  FiUser,
} from "react-icons/fi";
import { proxiedSrc } from "@/lib/utils";

// Cada passo é um grupo de escolhas guiadas (sem campo de texto livre).
const STEPS = [
  {
    title: "Quem é o seu avatar?",
    subtitle: "Comece pelo básico.",
    fields: [
      {
        key: "gender",
        label: "Gênero",
        options: ["Mulher", "Homem", "Andrógino"],
      },
      {
        key: "age",
        label: "Faixa etária",
        options: ["18-25", "26-35", "36-45", "46-60", "60+"],
      },
    ],
  },
  {
    title: "Aparência",
    subtitle: "Traços físicos gerais.",
    fields: [
      {
        key: "ethnicity",
        label: "Aparência étnica",
        options: ["Caucasiana", "Negra", "Parda / Latina", "Asiática", "Indígena", "Árabe"],
      },
      {
        key: "skin",
        label: "Tom de pele",
        options: ["Clara", "Média", "Morena", "Escura"],
      },
    ],
  },
  {
    title: "Cabelo",
    subtitle: "Cor e estilo.",
    fields: [
      {
        key: "hairColor",
        label: "Cor do cabelo",
        options: ["Preto", "Castanho", "Loiro", "Ruivo", "Grisalho", "Colorido"],
      },
      {
        key: "hairStyle",
        label: "Estilo / comprimento",
        options: ["Curto", "Médio", "Longo", "Cacheado", "Liso", "Preso / coque", "Careca"],
      },
      {
        key: "facialHair",
        label: "Barba",
        optional: true,
        options: ["Sem barba", "Barba por fazer", "Barba cheia", "Cavanhaque", "Bigode"],
      },
    ],
  },
  {
    title: "Corpo e estilo",
    subtitle: "Biotipo e vibe geral.",
    fields: [
      {
        key: "body",
        label: "Biotipo",
        options: ["Magro", "Atlético", "Mediano", "Curvilíneo", "Plus size"],
      },
      {
        key: "style",
        label: "Estilo / vestimenta",
        options: ["Casual", "Fitness", "Executivo", "Streetwear", "Elegante", "Beleza / skincare"],
      },
    ],
  },
  {
    title: "Personalidade e cena",
    subtitle: "Como ele aparece no vídeo.",
    fields: [
      {
        key: "expression",
        label: "Expressão",
        options: ["Sorridente e simpático", "Sério e confiante", "Energético", "Calmo", "Sofisticado"],
      },
      {
        key: "setting",
        label: "Cenário de fundo",
        optional: true,
        options: ["Estúdio neutro", "Em casa", "Rua urbana", "Academia", "Café", "Escritório", "Natureza"],
      },
    ],
  },
];

const VOICE_OPTIONS = ["Animada", "Calma", "Séria", "Amigável", "Confiante", "Suave"];

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3.5 py-2 rounded-full text-xs font-bold border transition-all ${
        active
          ? "bg-primary-500 text-white border-primary-500 shadow-sm"
          : "bg-glass-bg text-foreground border-glass-border hover:border-primary-500/40"
      }`}
    >
      {children}
    </button>
  );
}

function personaFromAttrs(a) {
  const bits = [
    a.gender,
    a.age && `(${a.age})`,
    a.ethnicity,
    a.style && `estilo ${a.style.toLowerCase()}`,
    a.expression && a.expression.toLowerCase(),
  ].filter(Boolean);
  return bits.join(", ");
}

export function AvatarCreator({ onCancel, onCreated }) {
  const [step, setStep] = useState(0);
  const [attrs, setAttrs] = useState({});
  const [customKeys, setCustomKeys] = useState({}); // {fieldKey: true} quando o campo está em modo "Personalizado"
  const [voiceCustom, setVoiceCustom] = useState(false);
  const [name, setName] = useState("");
  const [voice, setVoice] = useState("");

  const [image, setImage] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [saving, setSaving] = useState(false);

  const previewRef = useRef(null);

  const TOTAL = STEPS.length + 1; // passos + tela final de geração
  const isFinal = step === STEPS.length;
  const current = STEPS[step];

  const selectPreset = (key, value) => {
    setCustomKeys((p) => ({ ...p, [key]: false }));
    setAttrs((p) => ({ ...p, [key]: p[key] === value ? "" : value }));
  };

  const toggleCustom = (key) => {
    setCustomKeys((p) => ({ ...p, [key]: !p[key] }));
    setAttrs((p) => ({ ...p, [key]: "" }));
  };

  // todo passo exige que os campos obrigatórios estejam preenchidos
  const stepComplete =
    isFinal ||
    current.fields.every(
      (f) => f.optional || String(attrs[f.key] ?? "").trim().length > 0,
    );

  const next = () => {
    if (!stepComplete) return;
    setStep((s) => Math.min(TOTAL - 1, s + 1));
  };
  const back = () => setStep((s) => Math.max(0, s - 1));

  const generate = async () => {
    setGenerating(true);
    setGenError("");
    requestAnimationFrame(() => {
      previewRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    try {
      const res = await fetch("/api/avatars/generate-portrait", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attributes: attrs, aspectRatio: "3:4" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao gerar o retrato");
      setImage(data.image);
    } catch (err) {
      setGenError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const save = async () => {
    if (!name.trim()) {
      setGenError("Dê um nome ao avatar.");
      return;
    }
    if (!image) {
      setGenError("Gere o retrato antes de salvar.");
      return;
    }
    setSaving(true);
    setGenError("");
    try {
      const res = await fetch("/api/avatars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: personaFromAttrs(attrs),
          settings: {
            gender: attrs.gender || "",
            age: attrs.age || "",
            style: attrs.style || "",
            voice: voice || "",
          },
          photos: [image],
        }),
      });
      if (!res.ok) throw new Error("Falha ao salvar o avatar");
      onCreated?.();
    } catch (err) {
      setGenError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={onCancel}
          className="flex items-center gap-2 text-xs font-bold text-muted hover:text-foreground mb-6 transition-colors"
        >
          <FiArrowLeft /> Voltar
        </button>

        <div className="flex items-center gap-2 mb-1">
          <FiZap className="text-primary-500" />
          <h1 className="text-xl font-black tracking-tight text-foreground">
            Criar avatar com IA
          </h1>
        </div>
        <p className="text-xs text-muted mb-6">
          Monte um ator do zero respondendo umas perguntas — a IA gera o retrato pra você.
        </p>

        {/* progresso */}
        <div className="flex items-center gap-1.5 mb-8">
          {Array.from({ length: TOTAL }).map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                i <= step ? "bg-primary-500" : "bg-glass-border"
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {!isFinal ? (
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <span className="text-[10px] font-black uppercase tracking-widest text-primary-500">
                Passo {step + 1} de {STEPS.length}
              </span>
              <h2 className="text-lg font-black tracking-tight text-foreground mt-1">
                {current.title}
              </h2>
              <p className="text-xs text-muted mt-1 mb-6">{current.subtitle}</p>

              <div className="space-y-6">
                {current.fields.map((f) => (
                  <div key={f.key}>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted block mb-2.5">
                      {f.label} {f.optional && <span className="text-muted/70">(opcional)</span>}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {f.options.map((opt) => (
                        <Chip
                          key={opt}
                          active={!customKeys[f.key] && attrs[f.key] === opt}
                          onClick={() => selectPreset(f.key, opt)}
                        >
                          {opt}
                        </Chip>
                      ))}
                      <Chip active={!!customKeys[f.key]} onClick={() => toggleCustom(f.key)}>
                        + Personalizado
                      </Chip>
                    </div>
                    {customKeys[f.key] && (
                      <input
                        autoFocus
                        value={attrs[f.key] || ""}
                        onChange={(e) => setAttrs((p) => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={`Descreva ${f.label.toLowerCase()}...`}
                        className="mt-2.5 w-full px-3 py-2 bg-glass-bg border border-glass-border rounded-lg text-xs text-foreground placeholder-muted outline-none focus:border-primary-500/50"
                      />
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="final"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <h2 className="text-lg font-black tracking-tight text-foreground">
                Quase lá!
              </h2>
              <p className="text-xs text-muted mt-1 mb-6">
                Dê um nome, escolha o tom de voz e gere o retrato.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-5">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1.5">
                      Nome do avatar *
                    </span>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: Júlia, Marcos..."
                      className="w-full px-3 py-2.5 bg-glass-bg border border-glass-border rounded-lg text-xs text-foreground placeholder-muted outline-none focus:border-primary-500/50"
                    />
                  </div>

                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted block mb-2.5">
                      Tom de voz
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {VOICE_OPTIONS.map((v) => (
                        <Chip
                          key={v}
                          active={!voiceCustom && voice === v}
                          onClick={() => { setVoiceCustom(false); setVoice(voice === v ? "" : v); }}
                        >
                          {v}
                        </Chip>
                      ))}
                      <Chip
                        active={voiceCustom}
                        onClick={() => { setVoiceCustom((c) => !c); setVoice(""); }}
                      >
                        + Personalizado
                      </Chip>
                    </div>
                    {voiceCustom && (
                      <input
                        autoFocus
                        value={voice}
                        onChange={(e) => setVoice(e.target.value)}
                        placeholder="Descreva o tom de voz..."
                        className="mt-2.5 w-full px-3 py-2 bg-glass-bg border border-glass-border rounded-lg text-xs text-foreground placeholder-muted outline-none focus:border-primary-500/50"
                      />
                    )}
                  </div>

                  <button
                    onClick={generate}
                    disabled={generating}
                    className="flex items-center gap-2 px-5 py-2.5 bg-primary-500 text-white rounded-full text-xs font-bold hover:bg-primary-600 transition-all disabled:opacity-50"
                  >
                    {generating ? <FiLoader className="animate-spin" /> : image ? <FiRefreshCw /> : <FiZap />}
                    {generating ? "Gerando..." : image ? "Gerar outro" : "Gerar retrato"}
                  </button>
                </div>

                {/* preview */}
                <div
                  ref={previewRef}
                  className="aspect-[3/4] rounded-xl border border-glass-border bg-glass-bg overflow-hidden flex items-center justify-center"
                >
                  {generating ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
                      <span className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">
                        Criando seu avatar
                      </span>
                    </div>
                  ) : image ? (
                    <img src={proxiedSrc(image)} alt="Retrato gerado" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted">
                      <FiUser className="text-3xl" />
                      <span className="text-[10px] font-bold">O retrato aparece aqui</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {genError && <p className="text-[11px] text-rose-500 mt-4">{genError}</p>}

        {/* navegação */}
        <div className="flex items-center justify-between gap-3 mt-8 pt-6 border-t border-glass-border">
          <button
            onClick={step === 0 ? onCancel : back}
            disabled={saving || generating}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-muted hover:text-foreground transition-all disabled:opacity-50"
          >
            <FiArrowLeft /> {step === 0 ? "Cancelar" : "Voltar"}
          </button>

          {isFinal ? (
            <button
              onClick={save}
              disabled={saving || !image || !name.trim()}
              className="flex items-center gap-1.5 px-6 py-2.5 bg-primary-500 text-white rounded-full text-xs font-bold hover:bg-primary-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <FiLoader className="animate-spin" /> : <FiCheck />}
              Salvar avatar
            </button>
          ) : (
            <button
              onClick={next}
              disabled={!stepComplete}
              className="flex items-center gap-1.5 px-6 py-2.5 bg-primary-500 text-white rounded-full text-xs font-bold hover:bg-primary-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Próximo <FiArrowRight />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
