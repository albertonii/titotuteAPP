"use client";

import { FormEvent, useState } from "react";
import type { SessionWarmup } from "@/lib/db-local/db";

interface WarmupFormProps {
  warmup?: SessionWarmup;
  onSubmit: (data: { description: string; resource?: string | null }) => Promise<void>;
  onCancel: () => void;
}

export function WarmupForm({ warmup, onSubmit, onCancel }: WarmupFormProps) {
  const [description, setDescription] = useState(warmup?.description || "");
  const [resource, setResource] = useState(warmup?.resource || "");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!description.trim()) return;
    setLoading(true);
    try {
      await onSubmit({
        description: description.trim(),
        resource: resource.trim() || null,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Descripción *
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={3}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          placeholder="Ej: X1 RESET DE ILÍACOS"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Recurso (URL)
        </label>
        <input
          type="url"
          value={resource}
          onChange={(e) => setResource(e.target.value)}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          placeholder="https://youtu.be/..."
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading || !description.trim()}
          className="rounded bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-accent disabled:opacity-50"
        >
          {loading ? "Guardando..." : warmup ? "Actualizar" : "Crear"}
        </button>
      </div>
    </form>
  );
}

