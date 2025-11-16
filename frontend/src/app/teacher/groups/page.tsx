export default function TeacherGroupsPage() {
  const [groups, setGroups] = useState<Array<{ id: string; name: string; description: string; members: number; updated_at: string }>>([
    { id: 'demo', name: 'サンプルグループ', description: 'UI土台のみ（保存はまだです）', members: 0, updated_at: '-' },
  ]);

  const [form, setForm] = useState({ name: '', description: '' });
  const [editingId, setEditingId] = useState<string | null>(null);

  const resetForm = () => {
    setForm({ name: '', description: '' });
    setEditingId(null);
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    if (editingId) {
      setGroups((prev) =>
        prev.map((g) => (g.id === editingId ? { ...g, name: form.name, description: form.description, updated_at: '編集中' } : g)),
      );
    } else {
      const now = new Date().toLocaleString();
      setGroups((prev) => [
        ...prev,
        { id: `local-${prev.length + 1}`, name: form.name, description: form.description, members: 0, updated_at: now },
      ]);
    }
    resetForm();
  };

  const handleEdit = (id: string) => {
    const target = groups.find((g) => g.id === id);
    if (!target) return;
    setEditingId(id);
    setForm({ name: target.name, description: target.description });
  };

  const handleDelete = (id: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== id));
    if (editingId === id) resetForm();
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">グループ管理</h1>
        <p className="text-slate-600">クラスや講座単位のまとまりを作成し、テスト配信に利用します（UI土台のみ）。</p>
      </header>

      <div className="bg-white shadow rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">グループ一覧</h2>
          <button
            type="button"
            className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
            onClick={() => {
              resetForm();
            }}
          >
            新規グループ
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[720px] w-full text-sm text-slate-800">
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                <th className="px-3 py-2 text-left">グループ名</th>
                <th className="px-3 py-2 text-left">説明</th>
                <th className="px-3 py-2 text-right">所属生徒数</th>
                <th className="px-3 py-2 text-right">最終更新</th>
                <th className="px-3 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-semibold text-slate-900">{g.name}</td>
                  <td className="px-3 py-2 text-slate-700">{g.description || '-'}</td>
                  <td className="px-3 py-2 text-right">{g.members}</td>
                  <td className="px-3 py-2 text-right text-slate-500">{g.updated_at}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-2 text-xs text-slate-600">
                      <button
                        className="px-2 py-1 rounded border border-slate-300 hover:bg-slate-50"
                        onClick={() => handleEdit(g.id)}
                        title="保存APIは未実装です"
                      >
                        編集
                      </button>
                      <button className="px-2 py-1 rounded border border-slate-300 hover:bg-slate-50" title="メンバー編集UIは今後実装">
                        メンバー
                      </button>
                      <button
                        className="px-2 py-1 rounded border border-slate-300 hover:bg-slate-50"
                        onClick={() => handleDelete(g.id)}
                        title="確認ダイアログ省略（UIのみ）"
                      >
                        削除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {groups.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-sm text-slate-500">
                    グループはまだありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-4 space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">グループ編集</h2>
        <p className="text-xs text-slate-500">保存APIは未実装です。UIの骨組みのみ用意しています。</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-slate-600">グループ名</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm"
              placeholder="例: 中3Aクラス"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-600">説明</label>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm"
              placeholder="任意"
            />
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={resetForm}
            className="px-4 py-2 rounded-md border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
          >
            クリア
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
          >
            {editingId ? '更新（UIのみ）' : '追加（UIのみ）'}
          </button>
        </div>
      </div>
    </div>
  );
}
