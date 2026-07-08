"use client";

import { useState } from "react";
import { useData } from "@/store/data";

export default function CategoryManager({ onClose }: { onClose: () => void }) {
  const { categories, addCategory, updateCategory, deleteCategory } = useData();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [editId, setEditId] = useState<string | null>(null);

  function save() {
    if (!name) return;
    if (editId) {
      updateCategory(editId, { name, slug: slug || name.toLowerCase() });
    } else {
      addCategory({ name, slug: slug || name.toLowerCase() });
    }
    setName("");
    setSlug("");
    setEditId(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-[420px] max-w-full rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold">Kelola Kategori</h3>
          <button onClick={onClose} className="text-gray-400">✕</button>
        </div>

        <div className="mb-3 flex gap-2">
          <input className="inp" placeholder="Nama kategori" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="inp" placeholder="slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
        </div>
        <button onClick={save} className="mb-3 w-full rounded-lg bg-apricot px-3 py-2 text-sm font-bold text-white">
          {editId ? "Update" : "Tambah Kategori"}
        </button>

        <ul className="space-y-1">
          {categories.map((c) => (
            <li key={c.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
              <span>{c.name} <span className="text-gray-400">({c.slug})</span></span>
              <div className="flex gap-1">
                <button onClick={() => { setEditId(c.id); setName(c.name); setSlug(c.slug); }} className="rounded bg-beige px-2 py-1 text-xs">Edit</button>
                <button onClick={() => deleteCategory(c.id)} className="rounded bg-red-100 px-2 py-1 text-xs text-red-700">Hapus</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
