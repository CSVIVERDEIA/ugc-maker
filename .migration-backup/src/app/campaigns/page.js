"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FiPlus, FiLoader, FiTrash2, FiArrowLeft, FiTarget } from "react-icons/fi";

const OBJECTIVES = ["Venda", "Awareness", "Lançamento", "Reengajamento", "Educação"];

const EMPTY_FORM = {
  name: "",
  objective: "",
  angle: "",
  audience: "",
  cta: "",
  productId: "",
};

export default function CampaignsPage() {
  const { status } = useSession();
  const router = useRouter();

  const [campaigns, setCampaigns] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("list");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [c, p] = await Promise.all([fetch("/api/campaigns"), fetch("/api/products")]);
      if (c.ok) setCampaigns((await c.json()).campaigns || []);
      if (p.ok) setProducts((await p.json()).products || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") load();
  }, [status]);

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const openNew = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setView("edit");
  };
  const openEdit = (c) => {
    setEditingId(c.id);
    setForm({
      name: c.name || "",
      objective: c.objective || "",
      angle: c.angle || "",
      audience: c.audience || "",
      cta: c.cta || "",
      productId: c.productId || "",
    });
    setView("edit");
  };

  const save = async () => {
    if (!form.name.trim()) {
      alert("Dê um nome à campanha.");
      return;
    }
    setSaving(true);
    try {
      const url = editingId ? `/api/campaigns/${editingId}` : "/api/campaigns";
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Falha ao salvar");
      await load();
      setView("list");
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!confirm("Excluir esta campanha?")) return;
    await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
    await load();
  };

  const productName = (id) => products.find((p) => p.id === id)?.name;

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
        <h2 className="text-lg font-black text-foreground">Entre para gerenciar campanhas</h2>
        <button
          onClick={() => router.push("/login")}
          className="px-6 py-2.5 bg-primary-500 text-white rounded-full font-bold text-xs hover:bg-primary-600 transition-all"
        >
          Entrar / Cadastrar
        </button>
      </div>
    );
  }

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
            {editingId ? "Editar campanha" : "Nova campanha"}
          </h1>

          <div className="space-y-4">
            <Field label="Nome da campanha *">
              <input value={form.name} onChange={(e) => update("name", e.target.value)} className="cp-input" />
            </Field>
            <Field label="Objetivo">
              <select value={form.objective} onChange={(e) => update("objective", e.target.value)} className="cp-input">
                <option value="">Selecione...</option>
                {OBJECTIVES.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </Field>
            <Field label="Produto vinculado">
              <select value={form.productId} onChange={(e) => update("productId", e.target.value)} className="cp-input">
                <option value="">Nenhum</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Ângulo / abordagem">
              <textarea
                value={form.angle}
                onChange={(e) => update("angle", e.target.value)}
                placeholder="Ex: focar na dor de pele oleosa e mostrar antes/depois"
                className="cp-input h-20 resize-none"
              />
            </Field>
            <Field label="Público-alvo">
              <input value={form.audience} onChange={(e) => update("audience", e.target.value)} className="cp-input" />
            </Field>
            <Field label="Chamada pra ação (CTA)">
              <input value={form.cta} onChange={(e) => update("cta", e.target.value)} placeholder="Ex: link na bio, compre agora..." className="cp-input" />
            </Field>
          </div>

          <div className="flex items-center gap-3 mt-8">
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary-500 text-white rounded-full text-xs font-bold hover:bg-primary-600 transition-all disabled:opacity-50"
            >
              {saving ? <FiLoader className="animate-spin" /> : null}
              {editingId ? "Salvar alterações" : "Criar campanha"}
            </button>
            <button onClick={() => setView("list")} className="text-xs font-bold text-muted hover:text-foreground">
              Cancelar
            </button>
          </div>
        </div>

        <style jsx>{`
          .cp-input {
            width: 100%;
            padding: 0.6rem 0.85rem;
            background: var(--glass-bg, rgba(255, 255, 255, 0.5));
            border: 1px solid var(--glass-border, rgba(0, 0, 0, 0.1));
            border-radius: 0.5rem;
            font-size: 0.75rem;
            color: inherit;
            outline: none;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-black tracking-tight text-foreground">Campanhas</h1>
            <p className="text-xs text-muted mt-1">Defina o foco e reuse na geração de vídeos.</p>
          </div>
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-500 text-white rounded-full text-xs font-bold hover:bg-primary-600 transition-all"
          >
            <FiPlus /> Nova campanha
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <FiLoader className="w-6 h-6 animate-spin text-muted" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <FiTarget className="text-4xl text-muted" />
            <p className="text-xs text-muted">Nenhuma campanha ainda. Crie a primeira.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {campaigns.map((c) => (
              <div
                key={c.id}
                onClick={() => openEdit(c)}
                className="bg-glass-bg border border-glass-border rounded-xl p-4 cursor-pointer hover:border-primary-500/50 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-xs font-black text-foreground truncate">{c.name}</h3>
                  <button
                    onClick={(e) => { e.stopPropagation(); remove(c.id); }}
                    className="text-muted hover:text-rose-500 transition-colors"
                  >
                    <FiTrash2 className="text-xs" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {c.objective && (
                    <span className="px-2 py-0.5 rounded bg-primary-500/10 text-primary-600 text-[10px] font-bold">{c.objective}</span>
                  )}
                  {c.productId && productName(c.productId) && (
                    <span className="px-2 py-0.5 rounded bg-glass-bg border border-glass-border text-muted text-[10px] font-bold">
                      📦 {productName(c.productId)}
                    </span>
                  )}
                </div>
                {c.angle && <p className="text-[11px] text-muted mt-2 line-clamp-2">{c.angle}</p>}
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
      <span className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1.5">{label}</span>
      {children}
    </label>
  );
}
