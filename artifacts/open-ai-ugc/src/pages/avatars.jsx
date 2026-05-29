"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  FiPlus,
  FiLoader,
  FiTrash2,
  FiArrowLeft,
  FiImage,
  FiUser,
} from "react-icons/fi";
import { proxiedSrc } from "@/lib/utils";

const EMPTY_FORM = {
  name: "",
  description: "",
  gender: "",
  age: "",
  style: "",
  voice: "",
  photos: [],
};

function avatarToForm(a) {
  const s = a.settings || {};
  return {
    name: a.name || "",
    description: a.description || "",
    gender: s.gender || "",
    age: s.age || "",
    style: s.style || "",
    voice: s.voice || "",
    photos: a.photos || [],
  };
}

function formToPayload(form) {
  return {
    name: form.name,
    description: form.description,
    settings: {
      gender: form.gender,
      age: form.age,
      style: form.style,
      voice: form.voice,
    },
    photos: form.photos,
  };
}

export default function AvatarsPage() {
  const { status } = useSession();
  const router = useRouter();

  const [avatars, setAvatars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("list");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/avatars");
      if (res.ok) setAvatars((await res.json()).avatars || []);
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
  const openEdit = (a) => {
    setEditingId(a.id);
    setForm(avatarToForm(a));
    setView("edit");
  };

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      const tempId = Math.random().toString(36).slice(2);
      setForm((p) => ({ ...p, photos: [...p.photos, { tempId, status: "uploading" }] }));
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        if (!res.ok) throw new Error("upload");
        const data = await res.json();
        setForm((p) => ({
          ...p,
          photos: p.photos.map((x) => (x.tempId === tempId ? data.url : x)),
        }));
      } catch {
        setForm((p) => ({ ...p, photos: p.photos.filter((x) => x.tempId !== tempId) }));
      }
    }
  };

  const removePhoto = (idx) =>
    setForm((p) => ({ ...p, photos: p.photos.filter((_, i) => i !== idx) }));

  const save = async () => {
    if (!form.name.trim()) {
      alert("Dê um nome ao avatar.");
      return;
    }
    setSaving(true);
    try {
      const payload = formToPayload({
        ...form,
        photos: form.photos.filter((p) => typeof p === "string"),
      });
      const url = editingId ? `/api/avatars/${editingId}` : "/api/avatars";
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
    if (!confirm("Excluir este avatar?")) return;
    await fetch(`/api/avatars/${id}`, { method: "DELETE" });
    await load();
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
        <h2 className="text-lg font-black text-foreground">Entre para gerenciar avatares</h2>
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
            {editingId ? "Editar avatar" : "Novo avatar"}
          </h1>

          <div className="space-y-4">
            <Field label="Nome do avatar *">
              <input value={form.name} onChange={(e) => update("name", e.target.value)} className="av-input" />
            </Field>
            <Field label="Descrição / persona">
              <textarea
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="Ex: mulher jovem, simpática, fala como amiga próxima recomendando um produto"
                className="av-input h-20 resize-none"
              />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Gênero">
                <input value={form.gender} onChange={(e) => update("gender", e.target.value)} className="av-input" />
              </Field>
              <Field label="Idade aparente">
                <input value={form.age} onChange={(e) => update("age", e.target.value)} className="av-input" />
              </Field>
              <Field label="Estilo">
                <input value={form.style} onChange={(e) => update("style", e.target.value)} placeholder="casual, fitness, executivo..." className="av-input" />
              </Field>
              <Field label="Voz / tom">
                <input value={form.voice} onChange={(e) => update("voice", e.target.value)} placeholder="animada, calma, séria..." className="av-input" />
              </Field>
            </div>

            <Field label="Fotos de referência (rosto)">
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
              {editingId ? "Salvar alterações" : "Criar avatar"}
            </button>
            <button onClick={() => setView("list")} className="text-xs font-bold text-muted hover:text-foreground">
              Cancelar
            </button>
          </div>
        </div>

        <style>{`
          .av-input {
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
            <h1 className="text-xl font-black tracking-tight text-foreground">Avatares</h1>
            <p className="text-xs text-muted mt-1">Seus "atores" reutilizáveis para os vídeos.</p>
          </div>
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-500 text-white rounded-full text-xs font-bold hover:bg-primary-600 transition-all"
          >
            <FiPlus /> Novo avatar
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <FiLoader className="w-6 h-6 animate-spin text-muted" />
          </div>
        ) : avatars.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <FiUser className="text-4xl text-muted" />
            <p className="text-xs text-muted">Nenhum avatar ainda. Crie o primeiro.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {avatars.map((a) => (
              <div
                key={a.id}
                onClick={() => openEdit(a)}
                className="bg-glass-bg border border-glass-border rounded-xl overflow-hidden cursor-pointer hover:border-primary-500/50 transition-all"
              >
                <div className="aspect-square bg-glass-bg flex items-center justify-center overflow-hidden">
                  {a.photos?.[0] ? (
                    <img src={proxiedSrc(a.photos[0])} className="w-full h-full object-cover" alt={a.name} />
                  ) : (
                    <FiUser className="text-3xl text-muted" />
                  )}
                </div>
                <div className="p-3 flex items-center justify-between gap-2">
                  <h3 className="text-xs font-black text-foreground truncate">{a.name}</h3>
                  <button
                    onClick={(e) => { e.stopPropagation(); remove(a.id); }}
                    className="text-muted hover:text-rose-500 transition-colors"
                  >
                    <FiTrash2 className="text-xs" />
                  </button>
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
