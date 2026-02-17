import { useState } from 'react';
import './DepartmentsPanel.css';

// Mock AI-generated departments
const MOCK_AI_DEPARTMENTS = [
  'Front Desk',
  'Housekeeping',
  'Room Service',
  'Concierge',
  'Restaurant',
  'Spa & Wellness'
];

function DepartmentsPanel({ isLoading, onSimulateComplete }) {
  const [selectedDepartments, setSelectedDepartments] = useState([]);
  const [inputValue, setInputValue] = useState('');

  const handleAddDepartment = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !selectedDepartments.includes(trimmed)) {
      setSelectedDepartments([...selectedDepartments, trimmed]);
      setInputValue('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddDepartment();
    }
  };

  const handleRemoveDepartment = (dept) => {
    setSelectedDepartments(selectedDepartments.filter(d => d !== dept));
  };

  const handleSimulateComplete = () => {
    setSelectedDepartments(MOCK_AI_DEPARTMENTS);
    onSimulateComplete?.();
  };

  const handleRegenerate = () => {
    // TODO: Trigger regeneration
  };

  return (
    <div className="departments-panel">
      <div className="panel-header">
        <span className="panel-title">Departments</span>
      </div>

      <div className="panel-content">
        {isLoading ? (
          <div className="panel-loading">
            <div className="panel-spinner" />
            <span>Detecting...</span>
            <button className="panel-simulate-btn" onClick={handleSimulateComplete}>
              Simulate
            </button>
          </div>
        ) : selectedDepartments.length > 0 ? (
          <div className="department-boxes">
            {selectedDepartments.map((dept) => (
              <div key={dept} className="department-plate">
                <span className="plate-screw top-left" />
                <span className="plate-screw top-right" />
                <span className="plate-screw bottom-left" />
                <span className="plate-screw bottom-right" />
                <span className="plate-text">{dept}</span>
                <button
                  className="plate-remove"
                  onClick={() => handleRemoveDepartment(dept)}
                  aria-label="Remove department"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="panel-empty">No departments</div>
        )}
      </div>

      <div className="panel-footer">
        <div className="panel-input-area">
          <input
            type="text"
            className="panel-input"
            placeholder="Add department"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button className="panel-add-btn" onClick={handleAddDepartment}>
            Add
          </button>
        </div>
        <button
          className="panel-regenerate-btn"
          onClick={handleRegenerate}
          disabled={selectedDepartments.length < 2}
        >
          {selectedDepartments.length < 2 ? 'Add at least 2 departments' : 'Regenerate Scores'}
        </button>
      </div>
    </div>
  );
}

export default DepartmentsPanel;
