"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  FiPlus,
  FiLoader,
  FiTrash2,
  FiArrowLeft,
  FiZap,
  FiImage,
  FiPackage,
  FiX,
} from "react-icons/fi";
import { proxiedSrc } from "@/lib/utils";

const EMPTY_FORM = {
  name: "",
  description: "",
  benefits: "",
  audience: "",
  price: "",
  differentials: "",
  tone: "",
  photos: [],
};

// info (objeto/arrays) <-> form (strings de textarea)
function infoToForm(product) {
  const info = product.info || {};
  return {
    name: product.name || "",
    description: product.description || "",
    benefits: (info.benefits || []).join("\n"),
    audience: info.audience || "",
    price: info.price || "",
    differentials: (info.differentials || []).join("\n"),
    tone: info.tone || "",
    photos: product.photos || [],
  };
}

function formToPayload(form) {
  const lines = (s) => s.split("\n").map((x) => x.trim()).filter(Boolean);
  return {
    name: form.name,
    description: form.description,
    info: {
      benefits: lines(form.benefits),
      audience: form.audience,
      price: form.price,
      differentials: lines(form.differentials),
      tone: form.tone,
    },
    photos: form.photos,
  };
}

export default function ProductsPage() {
  const { status } = useSession();
  const router = useRouter();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("list"); // "list" | "edit"
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Onboarding IA
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiQuestions, setAiQuestions] = useState([]);
  const [aiError, setAiError] = useState("");

  const fileInputRef = useRef(null);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/products");
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") loadProducts();
  }, [status]);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const openNew = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setAiText("");
    setAiQuestions([]);
    setAiError("");
    setView("edit");
  };

  const openEdit = (product) => {
    setEditingId(product.id);
    setForm(infoToForm(product));
    setAiText("");
    setAiQuestions([]);
    setAiError("");
    setView("edit");
  };

  const runOnboarding = async () => {
    if (!aiText.trim()) return;
    setAiLoading(true);
    setAiError("");
    try {
      const res = await fetch("/api/products/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: aiText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha na IA");

      const info = data.info || {};
      setForm((prev) => ({
        ...prev,
        name: data.name || prev.name,
        description: data.description || prev.description,
        benefits: (info.benefits || []).join("\n") || prev.benefits,
        audience: info.audience || prev.audience,
        price: info.price || prev.price,
        differentials: (info.differentials || []).join("\n") || prev.differentials,
        tone: info.tone || prev.tone,
      }));
      setAiQuestions(data.questions || []);
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      const tempId = Math.random().toString(36).slice(2);
      setForm((prev) => ({
        ...prev,
        photos: [...prev.photos, { tempId, status: "uploading" }],
      }));
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        if (!res.ok) throw new Error("upload");
        const data = await res.json();
        setForm((prev) => ({
          ...prev,
          photos: prev.photos.map((p) =>
            p.tempId === tempId ? data.url : p
          ),
        }));
      } catch {
        setForm((prev) => ({
          ...prev,
          photos: prev.photos.filter((p) => p.tempId !== tempId),
        }));
      }
    }
  };

  const removePhoto = (idx) =>
    setForm((prev) => ({ ...prev, photos: prev.photos.filter((_, i) => i !== idx) }));

  const save = async () => {
    if (!form.name.trim()) {
      alert("Dê um nome ao produto.");
      return;
    }
    setSaving(true);
    try {
      const payload = formToPayload({
        ...form,
        // só salva URLs já prontas (descarta uploads pendentes)
        photos: form.photos.filter((p) => typeof p === "string"),
      });
      const url = editingId ? `/api/products/${editingId}` : "/api/products";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Falha ao salvar");
      await loadProducts();
      setView("list");
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!confirm("Excluir este produto?")) return;
    await fetch(`/api/products/${id}`, { method: "DELETE" });
    await loadProducts();
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
        <h2 className="text-lg font-black text-foreground">Entre para gerenciar produtos</h2>
        <button
          onClick={() => router.push("/login")}
          className="px-6 py-2.5 bg-primary-500 text-white rounded-full font-bold text-xs hover:bg-primary-600 transition-all"
        >
          Entrar / Cadastrar
        </button>
      </div>
    );
  }

  // ---------- EDITOR ----------
  if (view === "edit") {
    return (
      <div className="flex-1 overflow-y-auto p-6 md:p-10">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => setView("list")}
            className="flex items-center gap-2 text-xs font-bold text-muted hover:text-foreground mb-6 transition-colors"
          >
            <FiArrowLeft /> Voltar
          </button>

          <h1 className="text-xl font-black tracking-tight text-foreground mb-6">
            {editingId ? "Editar produto" : "Novo produto"}
          </h1>

          {/* Onboarding IA */}
          <div className="bg-glass-bg border border-glass-border rounded-xl p-5 mb-8">
            <div className="flex items-center gap-2 mb-3">
              <FiZap className="text-primary-500" />
              <h3 className="text-xs font-black uppercase tracking-widest text-foreground">
                Descrever com IA
              </h3>
            </div>
            <p className="text-[11px] text-muted mb-3">
              Escreva tudo que souber do produto. A IA organiza nos campos abaixo e sugere o que falta.
            </p>
            <textarea
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              placeholder="Ex: É um sérum facial com vitamina C, pra pele oleosa, reduz manchas em 4 semanas, custa R$89..."
              className="w-full h-24 px-3 py-2 bg-glass-bg border border-glass-border rounded-lg text-xs text-foreground placeholder-muted outline-none focus:border-primary-500/50 resize-none"
            />
            {aiError && <p className="text-[11px] text-rose-500 mt-2">{aiError}</p>}
            <button
              onClick={runOnboarding}
              disabled={aiLoading || !aiText.trim()}
              className="mt-3 flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg text-xs font-bold hover:bg-primary-600 transition-all disabled:opacity-50"
            >
              {aiLoading ? <FiLoader className="animate-spin" /> : <FiZap />}
              Estruturar com IA
            </button>
            {aiQuestions.length > 0 && (
              <div className="mt-4 pt-4 border-t border-glass-border">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted mb-2">
                  A IA sugere preencher também:
                </p>
                <ul className="list-disc list-inside space-y-1">
                  {aiQuestions.map((q, i) => (
                    <li key={i} className="text-[11px] text-foreground">{q}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Campos */}
          <div className="space-y-4">
            <Field label="Nome do produto *">
              <input
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                className="input"
              />
            </Field>
            <Field label="Descrição">
              <textarea
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                className="input h-20 resize-none"
              />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Público-alvo">
                <input value={form.audience} onChange={(e) => update("audience", e.target.value)} className="input" />
              </Field>
              <Field label="Preço">
                <input value={form.price} onChange={(e) => update("price", e.target.value)} className="input" />
              </Field>
            </div>
            <Field label="Benefícios (um por linha)">
              <textarea value={form.benefits} onChange={(e) => update("benefits", e.target.value)} className="input h-20 resize-none" />
            </Field>
            <Field label="Diferenciais (um por linha)">
              <textarea value={form.differentials} onChange={(e) => update("differentials", e.target.value)} className="input h-20 resize-none" />
            </Field>
            <Field label="Tom de voz sugerido">
              <input value={form.tone} onChange={(e) => update("tone", e.target.value)} className="input" />
            </Field>

            {/* Fotos */}
            <Field label="Fotos do produto">
              <div className="flex flex-wrap gap-3">
                {form.photos.map((p, idx) => (
                  <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-glass-border group">
                    {typeof p === "string" ? (
                      <img src={proxiedSrc(p)} className="w-full h-full object-cover" alt={`Foto ${idx + 1}`} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-glass-bg">
                        <FiLoader className="animate-spin text-primary-500" />
                      </div>
                    )}
                    {typeof p === "string" && (
                      <button
                        onClick={() => removePhoto(idx)}
                        className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <FiTrash2 className="text-white" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-20 h-20 rounded-lg border-2 border-dashed border-glass-border flex flex-col items-center justify-center text-muted hover:text-foreground hover:border-primary-500/50 transition-all"
                >
                  <FiImage className="text-lg" />
                  <span className="text-[9px] font-bold mt-1">Adicionar</span>
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" />
              </div>
            </Field>
          </div>

          <div className="flex items-center gap-3 mt-8">
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary-500 text-white rounded-full text-xs font-bold hover:bg-primary-600 transition-all disabled:opacity-50"
            >
              {saving ? <FiLoader className="animate-spin" /> : null}
              {editingId ? "Salvar alterações" : "Criar produto"}
            </button>
            <button onClick={() => setView("list")} className="text-xs font-bold text-muted hover:text-foreground">
              Cancelar
            </button>
          </div>
        </div>

        <style>{`
          .input {
            width: 100%;
            padding: 0.6rem 0.85rem;
            background: var(--glass-bg, rgba(255,255,255,0.5));
            border: 1px solid var(--glass-border, rgba(0,0,0,0.1));
            border-radius: 0.5rem;
            font-size: 0.75rem;
            color: inherit;
            outline: none;
          }
        `}</style>
      </div>
    );
  }

  // ---------- LISTA ----------
  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-black tracking-tight text-foreground">Produtos</h1>
            <p className="text-xs text-muted mt-1">Cadastre seus produtos uma vez e reuse na geração.</p>
          </div>
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-500 text-white rounded-full text-xs font-bold hover:bg-primary-600 transition-all"
          >
            <FiPlus /> Novo produto
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <FiLoader className="w-6 h-6 animate-spin text-muted" />
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <FiPackage className="text-4xl text-muted" />
            <p className="text-xs text-muted">Nenhum produto ainda. Crie o primeiro.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((p) => (
              <div
                key={p.id}
                onClick={() => openEdit(p)}
                className="bg-glass-bg border border-glass-border rounded-xl overflow-hidden cursor-pointer hover:border-primary-500/50 transition-all group"
              >
                <div className="aspect-video bg-glass-bg flex items-center justify-center overflow-hidden">
                  {p.photos?.[0] ? (
                    <img src={proxiedSrc(p.photos[0])} className="w-full h-full object-cover" alt={p.name} />
                  ) : (
                    <FiPackage className="text-3xl text-muted" />
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-xs font-black text-foreground truncate">{p.name}</h3>
                    <button
                      onClick={(e) => { e.stopPropagation(); remove(p.id); }}
                      className="text-muted hover:text-rose-500 transition-colors"
                    >
                      <FiTrash2 className="text-xs" />
                    </button>
                  </div>
                  <p className="text-[11px] text-muted mt-1 line-clamp-2">
                    {p.description || "Sem descrição"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}
