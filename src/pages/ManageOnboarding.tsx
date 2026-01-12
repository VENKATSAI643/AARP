import React, { useEffect, useState } from 'react';
import QuestionForm from '../components/QuestionForm';
import type { NewQuestion } from '../components/QuestionForm';

const API_BASE = import.meta.env.VITE_API_BASE;

if (!API_BASE) {
  throw new Error(
    'VITE_API_BASE environment variable is not set. Please add it to your .env file.'
  );
}

// -- TYPES --

export interface Question extends NewQuestion {
  id: string;
  order: number;
  questionId?: string;
  category: string;
  applicableFor: NewQuestion['applicableFor'];
}

type GenderOption = NewQuestion['applicableFor'][number];

const KNOWN_GENDERS = ['Male', 'Female', 'Non-binary', 'All Genders'] as const;

// -- HELPERS --

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

function normalizeGender(val: any): GenderOption {
  if (val === null || val === undefined) return 'All Genders';
  const s = String(val).trim();
  if (!s) return 'All Genders';
  const lower = s.toLowerCase();
  
  if (lower === 'm' || lower === 'male' || lower.includes('male')) return 'Male';
  if (lower === 'f' || lower === 'female' || lower.includes('female')) return 'Female';
  if (lower.includes('non') || lower.includes('nonbinary') || lower.includes('non-binary')) return 'Non-binary';
  if (lower.includes('all')) return 'All Genders';
  
  if ((KNOWN_GENDERS as readonly string[]).includes(s)) return s as GenderOption;
  return 'All Genders';
}

function normalizeQuestion(item: any): Question {
  // Map various potential ID fields to 'id' (string)
  const id = String(item.id ?? item.questionId ?? item.question_id ?? '');
  const questionId = item.questionId ?? item.question_id ?? item.qid ?? id;
  const text = item.text ?? item.question_text ?? item.questionText ?? item.question ?? item.body ?? '';
  const order = toNumber(item.order ?? item.displayOrder ?? item.sort, 0);
  const category = String(item.category ?? item.phase ?? item.phaseName ?? 'Uncategorized');

  // Normalize Gender Array
  let applicableFor: GenderOption[] = [];
  
  // Handle different potential incoming formats (array vs string vs CSV string)
  const rawAppFor = item.applicableFor ?? item.applicable_for;
  
  if (Array.isArray(rawAppFor)) {
    applicableFor = rawAppFor.map(normalizeGender);
  } else if (typeof rawAppFor === 'string') {
    try {
      // Try parsing JSON string (e.g. "[\"Male\"]")
      const parsed = JSON.parse(rawAppFor);
      if (Array.isArray(parsed)) {
        applicableFor = parsed.map(normalizeGender);
      } else {
        applicableFor = [normalizeGender(parsed)];
      }
    } catch {
      // Fallback to comma-separated string
      if (rawAppFor.includes(',')) {
        applicableFor = rawAppFor.split(',').map((s: string) => normalizeGender(s));
      } else {
        applicableFor = [normalizeGender(rawAppFor)];
      }
    }
  }

  // Default fallback
  if (!Array.isArray(applicableFor) || applicableFor.length === 0) {
    applicableFor = ['All Genders'];
  }
  applicableFor = Array.from(new Set(applicableFor)); // Deduplicate

  return { id, questionId, text, order, category, applicableFor };
}

function normalizeArray(payload: any): Question[] {
  let arr: any[] = [];
  if (Array.isArray(payload)) arr = payload;
  else if (payload && Array.isArray(payload.questions)) arr = payload.questions;
  else arr = [];

  const normalized = arr.map(normalizeQuestion);
  normalized.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    // Secondary sort by ID for stability
    return a.id.localeCompare(b.id);
  });
  return normalized;
}

// -- COMPONENT --

const ManageOnboarding: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  
  // Drag & Drop State
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Edit/Delete State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editInitialData, setEditInitialData] = useState<NewQuestion | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // UI State
  const [loading, setLoading] = useState(false);
  const [savingReorder, setSavingReorder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleAddQuestionClick = () => {
    setEditingId(null);
    setEditInitialData(null);
    setShowForm(true);
  };

  // Auto-hide success message after 3s
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Initial Load
  useEffect(() => {
    const loadQuestions = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/admin/questions`, {
          method: 'GET',
          headers: getAuthHeaders(),
        });
        if (!res.ok) {
          throw new Error(`Failed to fetch questions: ${res.status}`);
        }
        const data = await res.json();
        const normalized = normalizeArray(data);
        setQuestions(normalized);
      } catch (err) {
        console.error('Error loading questions:', err);
        setError(err instanceof Error ? err.message : 'Failed to load questions');
      } finally {
        setLoading(false);
      }
    };
    loadQuestions();
  }, []);

  const handleSaveQuestion = async (data: NewQuestion) => {
    try {
      setError(null);
      
      const payload = {
        text: data.text,
        category: data.category,
        applicableFor: data.applicableFor
      };

      console.log('Sending payload:', payload);

      // -- UPDATE EXISTING --
      if (editingId !== null) {
        const res = await fetch(`${API_BASE}/admin/questions/${editingId}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `Failed to update question: ${res.status}`);
        }

        const updatedRaw = await res.json();
        const updated = normalizeQuestion(updatedRaw);

        setQuestions((prev) => prev.map((q) => (q.id === editingId ? updated : q)));
        setEditingId(null);
        setEditInitialData(null);
        setShowForm(false);
        setSuccessMessage(`✅ Question updated successfully!`);
        return;
      }

      // -- CREATE NEW --
      const res = await fetch(`${API_BASE}/admin/questions`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to add question: ${res.status}`);
      }

      const createdRaw = await res.json();
      const created = normalizeQuestion(createdRaw);

      setQuestions((prev) => {
        const arr = [...prev, created];
        arr.sort((a, b) => a.order - b.order);
        return arr;
      });

      setShowForm(false);
      setSuccessMessage(`✅ Question added successfully!`);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to save question');
    }
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setEditInitialData(null);
  };

  // -- DRAG AND DROP HANDLERS --

  const handleDragStart = (e: React.DragEvent<HTMLLIElement>, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    // Firefox requires data to be set
    e.dataTransfer.setData('text/plain', id);
    if (e.currentTarget) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLLIElement>, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverId(id);
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = async (e: React.DragEvent<HTMLLIElement>, targetId: string) => {
    e.preventDefault();
    setDragOverId(null);

    if (draggedId === null || draggedId === targetId) {
      setDraggedId(null);
      return;
    }

    // 1. Optimistic Update
    let previousState: Question[] = [];
    let updatedSnapshot: Question[] = [];

    setQuestions((prev) => {
      previousState = [...prev];
      const clone = [...prev];
      const fromIndex = clone.findIndex((q) => q.id === draggedId);
      const toIndex = clone.findIndex((q) => q.id === targetId);
      
      if (fromIndex === -1 || toIndex === -1) return prev;

      const [moved] = clone.splice(fromIndex, 1);
      clone.splice(toIndex, 0, moved);

      // Update order property locally for UI consistency
      const reord = clone.map((q, i) => ({ ...q, order: i + 1 }));
      updatedSnapshot = reord;
      return reord;
    });

    setDraggedId(null);
    setSavingReorder(true);
    setError(null);

    try {
      const payload = {
        questions: updatedSnapshot.map((q) => ({
          id: q.id,
          questionId: q.questionId ?? q.id, // Ensure backup ID exists
        })),
      };

      const res = await fetch(`${API_BASE}/admin/questions/reorder`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        // Try to get JSON error, else text, else generic
        let errMsg = `Reorder failed: ${res.status}`;
        try {
            const errorText = await res.text();
            console.error("❌ Backend Error Response:", errorText); // Log full error for debugging
            try {
                const errorJson = JSON.parse(errorText);
                if (errorJson.error) errMsg = errorJson.error;
                else if (errorJson.message) errMsg = errorJson.message;
            } catch {
                // Not JSON, use text if short
                if (errorText.length < 100) errMsg = errorText; 
            }
        } catch {}
        
        throw new Error(errMsg);
      }

      const result = await res.json();
      
      // 2. Sync with Backend Response
      if (result && (Array.isArray(result) || Array.isArray(result.questions))) {
        setQuestions(normalizeArray(result));
      }
      
      setSuccessMessage('✅ Questions reordered successfully!');
    } catch (err) {
      console.error('❌ Error reordering:', err);
      // 3. Rollback on Error
      setQuestions(previousState);
      setError(err instanceof Error ? err.message : 'Failed to reorder questions');
    } finally {
      setSavingReorder(false);
    }
  };

  const handleDragEnd = (e: React.DragEvent<HTMLLIElement>) => {
    if (e.currentTarget) {
      e.currentTarget.style.opacity = '1';
    }
    setDraggedId(null);
    setDragOverId(null);
  };

  // -- EDIT & DELETE --

  const handleEdit = (id: string) => {
    const q = questions.find((q) => q.id === id);
    if (!q) return;

    setEditingId(id);
    setEditInitialData({
      text: q.text,
      category: q.category, 
      applicableFor: q.applicableFor,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    const question = questions.find((q) => q.id === id);
    const questionText = question?.text || id;
    const truncatedText = questionText.length > 50 
      ? questionText.substring(0, 50) + '...' 
      : questionText;

    if (!confirm(`Are you sure you want to delete this question?\n\n"${truncatedText}"\n\nThis action cannot be undone.`)) {
      return;
    }

    if (deletingId) return;

    try {
      setError(null);
      setDeletingId(id);
      
      const res = await fetch(`${API_BASE}/admin/questions/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!res.ok && res.status !== 204) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Delete failed: ${res.status}`);
      }

      setQuestions((prev) => prev.filter((q) => q.id !== id));

      if (editingId === id) {
        setEditingId(null);
        setEditInitialData(null);
        setShowForm(false);
      }

      setSuccessMessage(`✅ Question deleted successfully!`);
    } catch (err) {
      console.error('❌ Error deleting question:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete question');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="page-wrapper">
      <section className="card card-page-header">
        <h1 className="page-title">Manage Onboarding Questions</h1>
        <p className="page-subtitle">Add and reorder questions for the AI chatbot.</p>
      </section>

      <section className="card card-toolbar">
        <button className="btn-add-question" onClick={handleAddQuestionClick}>
          + Add New Question
        </button>
        {savingReorder && <span style={{ marginLeft: 12, color: '#0066cc', fontWeight: 500 }}>💾 Saving order…</span>}
      </section>

      {successMessage && (
        <section className="card card-success" style={{ backgroundColor: '#d4edda', border: '1px solid #c3e6cb', padding: '12px 16px', marginBottom: '16px', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>✅</span>
            <span style={{ color: '#155724', fontWeight: 500 }}>{successMessage}</span>
            <button onClick={() => setSuccessMessage(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#155724' }}>✕</button>
          </div>
        </section>
      )}

      {error && (
        <section className="card card-error" style={{ backgroundColor: '#fff3cd', border: '1px solid #ffeeba', padding: '12px 16px', marginBottom: '16px', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>⚠️</span>
            <span style={{ color: '#856404', fontWeight: 500 }}>{error}</span>
            <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}>✕</button>
          </div>
        </section>
      )}

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
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
              <div>Loading questions...</div>
            </div>
          ) : questions.length === 0 ? (
            <div className="placeholder-text">No questions yet. Click &quot;Add New Question&quot; to get started.</div>
          ) : (
            <ul className="questions-ul">
              {questions.map((q, index) => (
                <li
                  key={q.id}
                  className={`questions-li question-card ${draggedId === q.id ? 'is-dragging' : ''} ${dragOverId === q.id ? 'drag-over' : ''} ${deletingId === q.id ? 'deleting' : ''}`}
                  draggable={!deletingId}
                  onDragStart={(e) => handleDragStart(e, q.id)}
                  onDragOver={(e) => handleDragOver(e, q.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, q.id)}
                  onDragEnd={handleDragEnd}
                  style={{
                    cursor: deletingId === q.id ? 'not-allowed' : 'grab',
                    transition: 'all 0.2s ease',
                    opacity: draggedId === q.id ? 0.5 : deletingId === q.id ? 0.6 : 1,
                    border: dragOverId === q.id ? '2px dashed #0066cc' : undefined
                  }}
                >
                  <div className="question-index-circle">{index + 1}</div>
                  <div className="question-main">
                    <div className="question-text">{q.text || 'Untitled question'}</div>
                    <div className="question-meta-row">
                      <span className="question-meta-label">Category:</span>
                      <span className="pill pill-category">{q.category || 'Uncategorized'}</span>
                      <span className="question-meta-label" style={{ marginLeft: 12 }}>For:</span>
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
                  <div className="question-actions">
                    <button type="button" className="btn btn-edit" onClick={() => handleEdit(q.id)} disabled={!!deletingId}>✏️ Edit</button>
                    <button type="button" className="btn btn-delete" onClick={() => handleDelete(q.id)} disabled={!!deletingId}>{deletingId === q.id ? '⏳ Deleting...' : '🗑️ Delete'}</button>
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
