import React, { useEffect, useState } from 'react';
import QuestionForm from '../components/QuestionForm';
import type { NewQuestion } from '../components/QuestionForm';

export interface Question extends NewQuestion {
  id: number;
  order: number;
  questionId?: string;
  // Make category required to match NewQuestion contract
  category: string;
  // Ensure applicableFor exactly matches NewQuestion's type
  applicableFor: NewQuestion['applicableFor'];
}

const API_BASE = 'https://5ep59flti9.execute-api.us-east-1.amazonaws.com/dev/api/v1';

function getAuthHeaders() {
  const token = localStorage.getItem('accessToken') || '';
  const tenantId = localStorage.getItem('tenantId') || 'default';
  return {
    'Content-Type': 'application/json',
    Authorization: token ? `Bearer ${token}` : '',
    'X-Tenant-ID': tenantId,
  };
}

function toNumber(val: any, fallback = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Derive the GenderOption type from NewQuestion so we stay in sync with your form types.
 * This resolves the "string not assignable to GenderOption" compile errors.
 */
type GenderOption = NewQuestion['applicableFor'][number];

const KNOWN_GENDERS = ['Male', 'Female', 'Non-binary', 'All Genders'] as const;

/** Normalize incoming strings/values into a valid GenderOption */
function normalizeGender(val: any): GenderOption {
  if (val === null || val === undefined) return 'All Genders';
  const s = String(val).trim();

  if (!s) return 'All Genders';

  const lower = s.toLowerCase();

  // common variations mapping
  if (lower === 'm' || lower === 'male' || lower.includes('male')) return 'Male';
  if (lower === 'f' || lower === 'female' || lower.includes('female')) return 'Female';
  if (lower.includes('non') || lower.includes('nonbinary') || lower.includes('non-binary')) return 'Non-binary';
  if (lower.includes('all')) return 'All Genders';

  // If it's already one of known genders (case-sensitive check)
  if ((KNOWN_GENDERS as readonly string[]).includes(s)) return s as GenderOption;

  // fallback: prefer 'All Genders' instead of an arbitrary string
  return 'All Genders';
}

function normalizeQuestion(item: any): Question {
  const id = toNumber(item.id ?? item.ID ?? item.pk_id ?? item.itemId, NaN);
  const questionId = item.questionId ?? item.question_id ?? item.qid ?? undefined;
  const text =
    item.text ??
    item.question_text ??
    item.questionText ??
    item.question ??
    item.body ??
    '';
  const order = toNumber(item.order ?? item.displayOrder ?? item.sort ?? 0);

  // ensure we always produce a string category
  const category = String(item.phase ?? item.phaseName ?? item.category ?? 'Uncategorized');

  // ensure applicableFor exactly matches NewQuestion['applicableFor'] (i.e., GenderOption[])
  let applicableFor: GenderOption[] = [];

  if (Array.isArray(item.applicableFor)) {
    applicableFor = item.applicableFor.map(normalizeGender);
  } else if (Array.isArray(item.applicable_for)) {
    applicableFor = item.applicable_for.map(normalizeGender);
  } else if (typeof item.applicableFor === 'string') {
    // try parse JSON string (e.g. '["Male","Female"]') or treat as single value
    try {
      const parsed = JSON.parse(item.applicableFor);
      if (Array.isArray(parsed)) {
        applicableFor = parsed.map(normalizeGender);
      } else {
        applicableFor = [normalizeGender(parsed)];
      }
    } catch {
      // not JSON: treat as a single comma-separated or single value
      if (item.applicableFor.includes(',')) {
        applicableFor = item.applicableFor.split(',').map((s: string) => normalizeGender(s));
      } else {
        applicableFor = [normalizeGender(item.applicableFor)];
      }
    }
  } else if (typeof item.applicable_for === 'string') {
    if (item.applicable_for.includes(',')) {
      applicableFor = item.applicable_for.split(',').map((s: string) => normalizeGender(s));
    } else {
      applicableFor = [normalizeGender(item.applicable_for)];
    }
  }

  if (!Array.isArray(applicableFor) || applicableFor.length === 0) {
    // default fallback
    applicableFor = ['All Genders'];
  }

  // Ensure uniqueness and stable ordering
  applicableFor = Array.from(new Set(applicableFor));

  return {
    id: Number.isNaN(id) ? 0 : id,
    questionId,
    text,
    order,
    category,
    applicableFor,
  };
}

function normalizeArray(payload: any): Question[] {
  let arr: any[] = [];
  if (Array.isArray(payload)) arr = payload;
  else if (payload && Array.isArray(payload.questions)) arr = payload.questions;
  else arr = [];

  const normalized = arr.map(normalizeQuestion);
  normalized.sort((a, b) => {
    if ((a.order ?? 0) !== (b.order ?? 0)) return (a.order ?? 0) - (b.order ?? 0);
    return (a.id ?? 0) - (b.id ?? 0);
  });
  return normalized;
}

const ManageOnboarding: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editInitialData, setEditInitialData] = useState<NewQuestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingReorder, setSavingReorder] = useState(false);

  const handleAddQuestionClick = () => {
    setEditingId(null);
    setEditInitialData(null);
    setShowForm(true);
  };

  useEffect(() => {
    const loadQuestions = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/admin/questions`, {
          method: 'GET',
          headers: getAuthHeaders(),
        });
        if (!res.ok) {
          console.error('Failed to fetch questions', res.status);
          setLoading(false);
          return;
        }
        const data = await res.json();
        const normalized = normalizeArray(data);
        setQuestions(normalized);
      } catch (err) {
        console.error('Error loading questions:', err);
      } finally {
        setLoading(false);
      }
    };
    loadQuestions();
  }, []);

  const handleSaveQuestion = async (data: NewQuestion) => {
    try {
      // EDIT MODE
      if (editingId !== null) {
        const res = await fetch(`${API_BASE}/admin/questions/${editingId}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(data),
        });

        if (!res.ok) {
          console.error('Failed to update question', res.status);
          return;
        }

        const updatedRaw = await res.json();
        const updated = normalizeQuestion(updatedRaw);

        setQuestions((prev) => prev.map((q) => (q.id === editingId ? updated : q)));
        setEditingId(null);
        setEditInitialData(null);
        setShowForm(false);
        return;
      }

      // ADD MODE
      const res = await fetch(`${API_BASE}/admin/questions`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        console.error('Failed to add question', res.status);
        return;
      }

      const createdRaw = await res.json();
      const created = normalizeQuestion(createdRaw);

      setQuestions((prev) => {
        const arr = [...prev, created];
        arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        return arr;
      });

      setShowForm(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setEditInitialData(null);
  };

  // --- Drag & Drop handlers (native HTML5) ---
  const handleDragStart = (id: number) => {
    setDraggedId(id);
  };

  const handleDragOver = (event: React.DragEvent<HTMLLIElement>) => {
    event.preventDefault();
  };

  const handleDrop = async (targetId: number) => {
    if (draggedId === null || draggedId === targetId) return;

    let updatedSnapshot: Question[] = [];

    // optimistic local reorder
    setQuestions((prev) => {
      const clone = [...prev];
      const fromIndex = clone.findIndex((q) => q.id === draggedId);
      const toIndex = clone.findIndex((q) => q.id === targetId);
      if (fromIndex === -1 || toIndex === -1) return prev;

      const [moved] = clone.splice(fromIndex, 1);
      clone.splice(toIndex, 0, moved);

      const reord = clone.map((q, i) => ({ ...q, order: i + 1 }));
      updatedSnapshot = reord;
      return reord;
    });

    setDraggedId(null);
    setSavingReorder(true);

    try {
      const payload = {
        questions: updatedSnapshot.map((q) => ({
          id: q.id,
          questionId: q.questionId,
        })),
      };

      // prefer the explicit reorder route defined in your OpenAPI
      const res = await fetch(`${API_BASE}/admin/questions/reorder`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        console.error('Failed to reorder questions on server', res.status);
        // fallback: refetch server copy to restore consistency
        const refetch = await fetch(`${API_BASE}/admin/questions`, {
          method: 'GET',
          headers: getAuthHeaders(),
        });
        if (refetch.ok) {
          const data = await refetch.json();
          setQuestions(normalizeArray(data));
        }
        return;
      }

      const result = await res.json();
      // If server replies with updated list, sync it
      if (result && (Array.isArray(result) || Array.isArray(result.questions))) {
        setQuestions(normalizeArray(result));
      } else {
        // Otherwise keep optimistic state (already applied)
      }
    } catch (err) {
      console.error('Error calling reorder API:', err);
      // refetch as safe fallback
      try {
        const refetch = await fetch(`${API_BASE}/admin/questions`, {
          method: 'GET',
          headers: getAuthHeaders(),
        });
        if (refetch.ok) {
          const data = await refetch.json();
          setQuestions(normalizeArray(data));
        }
      } catch (e) {
        console.error('Refetch failed after reorder error', e);
      }
    } finally {
      setSavingReorder(false);
    }
  };

  const handleDragEnd = () => {
    setDraggedId(null);
  };

  const handleEdit = (id: number) => {
    const q = questions.find((q) => q.id === id);
    if (!q) return;

    setEditingId(id);
    // q.category is now guaranteed to be a string and applicableFor matches NewQuestion
    setEditInitialData({
      text: q.text,
      category: q.category,
      applicableFor: q.applicableFor,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/admin/questions/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!res.ok && res.status !== 204) {
        console.error('Failed to delete question', res.status);
        return;
      }

      setQuestions((prev) => prev.filter((q) => q.id !== id));

      if (editingId === id) {
        setEditingId(null);
        setEditInitialData(null);
        setShowForm(false);
      }
    } catch (err) {
      console.error('Error deleting question:', err);
    }
  };

  return (
    <div className="page-wrapper">
      {/* Page title card */}
      <section className="card card-page-header">
        <h1 className="page-title">Manage Onboarding Questions</h1>
        <p className="page-subtitle">Add and reorder questions for the AI chatbot.</p>
      </section>

      {/* Add Question toolbar */}
      <section className="card card-toolbar">
        <button className="btn-add-question" onClick={handleAddQuestionClick}>
          + Add New Question
        </button>
        {savingReorder && <span style={{ marginLeft: 12 }}>Saving order…</span>}
      </section>

      {/* Form appears directly below the red bar */}
      {showForm && (
        <section className="card card-add-form">
          <QuestionForm
            onSave={handleSaveQuestion}
            onCancel={handleCancelForm}
            initialData={editInitialData || undefined}
            mode={editingId ? 'edit' : 'add'}
          />
        </section>
      )}

      {/* Questions list container */}
      <section className="card card-content">
        <div className="questions-header">
          <h2 className="questions-title">Questions List</h2>
          <span className="badge">
            {questions.length} {questions.length === 1 ? 'Question' : 'Questions'}
          </span>
        </div>

        <p className="questions-hint">💡 Drag and drop questions to reorder them</p>

        <div className="questions-list">
          {loading ? (
            <div>Loading…</div>
          ) : questions.length === 0 ? (
            <div className="placeholder-text">No questions yet. Click &quot;Add New Question&quot; to get started.</div>
          ) : (
            <ul className="questions-ul">
              {questions.map((q, index) => (
                <li
                  key={q.id}
                  className={`questions-li question-card ${draggedId === q.id ? 'is-dragging' : ''}`}
                  draggable
                  onDragStart={() => handleDragStart(q.id)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(q.id)}
                  onDragEnd={handleDragEnd}
                >
                  {/* Number circle */}
                  <div className="question-index-circle">{index + 1}</div>

                  {/* Main content */}
                  <div className="question-main">
                    <div className="question-text">{q.text || 'Untitled question'}</div>

                    <div className="question-meta-row">
                      <span className="question-meta-label">Category:</span>
                      <span className="pill pill-category">{q.category || 'Uncategorized'}</span>

                      <span className="question-meta-label" style={{ marginLeft: 12 }}>
                        For:
                      </span>

                      <div className="question-gender-pills">
                        {q.applicableFor.map((g) => (
                          <span key={g} className="pill pill-gender" style={{ marginLeft: 6 }}>
                            {g === 'Male' && '🧑 Male'}
                            {g === 'Female' && '🧑‍🦰 Female'}
                            {g === 'Non-binary' && '⚧️ Non-binary'}
                            {g === 'All Genders' && '🌐 All'}
                            {!['Male', 'Female', 'Non-binary', 'All Genders'].includes(g) && g}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="question-actions">
                    <button type="button" className="btn btn-edit" onClick={() => handleEdit(q.id)}>
                      ✏️ Edit
                    </button>
                    <button type="button" className="btn btn-delete" onClick={() => handleDelete(q.id)}>
                      🗑️ Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
};

export default ManageOnboarding;
