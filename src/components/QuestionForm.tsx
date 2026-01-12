import React, { useEffect, useState } from 'react';

export type GenderOption = 'Male' | 'Female' | 'Non-binary' | 'All Genders';

export interface NewQuestion {
  text: string;
  category: string;
  applicableFor: GenderOption[];
}

interface QuestionFormProps {
  onSave: (question: NewQuestion) => void;
  onCancel: () => void;
  initialData?: NewQuestion;
  mode?: 'add' | 'edit';
}

const QuestionForm: React.FC<QuestionFormProps> = ({
  onSave,
  onCancel,
  initialData,
  mode = 'add',
}) => {
  const [text, setText] = useState('');
  const [category, setCategory] = useState('');
  const [selectedGenders, setSelectedGenders] = useState<GenderOption[]>([]);

  // When initialData changes (open edit on different question), sync form state
  useEffect(() => {
    setText(initialData?.text ?? '');
    setCategory(initialData?.category ?? '');
    setSelectedGenders(initialData?.applicableFor ?? []);
  }, [initialData]);

  const toggleGender = (gender: GenderOption) => {
    setSelectedGenders((prev) =>
      prev.includes(gender) ? prev.filter((g) => g !== gender) : [...prev, gender]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !category) return;

    onSave({
      text: text.trim(),
      category,
      applicableFor: selectedGenders,
    });
  };

  const submitLabel = mode === 'edit' ? 'Update Question' : 'Save Question';

  return (
    <form className="add-question-form" onSubmit={handleSubmit}>
      {/* Question Text */}
      <div className="form-row">
        <label className="form-label" htmlFor="question-text">
          Question Text
        </label>
        <textarea
          id="question-text"
          className="form-textarea"
          placeholder="Enter the question that will be asked during onboarding..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
        />
      </div>

      {/* Category */}
      <div className="form-row">
        <label className="form-label" htmlFor="question-category">
          Category
        </label>
        <select
          id="question-category"
          className="form-select"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Select a category...</option>
          <option value="Demographics">Demographics</option>
          <option value="Goals & Objectives">Goals & Objectives</option>
          <option value="Health & Conditions">Health & Conditions</option>
          <option value="Lifestyle Factors">Lifestyle Factors</option>
          <option value="Preferences">Preferences</option>
        </select>
      </div>

      {/* Applicable For */}
      <div className="form-row">
        <span className="form-label">Applicable For</span>

        <div className="gender-grid">
          <label className="gender-option">
            <input
              type="checkbox"
              checked={selectedGenders.includes('Male')}
              onChange={() => toggleGender('Male')}
            />
            <span>🧑 Male</span>
          </label>

          <label className="gender-option">
            <input
              type="checkbox"
              checked={selectedGenders.includes('Female')}
              onChange={() => toggleGender('Female')}
            />
            <span>🧑‍🦰 Female</span>
          </label>

          <label className="gender-option">
            <input
              type="checkbox"
              checked={selectedGenders.includes('Non-binary')}
              onChange={() => toggleGender('Non-binary')}
            />
            <span>⚧️ Non-binary</span>
          </label>

          <label className="gender-option">
            <input
              type="checkbox"
              checked={selectedGenders.includes('All Genders')}
              onChange={() => toggleGender('All Genders')}
            />
            <span>🌐 All Genders</span>
          </label>
        </div>
      </div>

      {/* Actions */}
      <div className="form-actions">
        <button type="submit" className="btn btn-success">
          {submitLabel}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

export default QuestionForm;
