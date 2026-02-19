import { useState, useEffect } from 'react';
import '../../styles/DepartmentsPanel.css';

function DepartmentsPanel({ departments, isLoading, onRegenerateDepartments }) {
  const [selectedDepartments, setSelectedDepartments] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Derive selected departments from incoming data
  useEffect(() => {
    if (departments?.length > 0) {
      const departmentNames = departments.map(d => d.department);
      setSelectedDepartments(departmentNames);
      setIsRegenerating(false);
    }
  }, [departments]);

  // Show loading only if explicitly loading AND no data yet (initial load)
  const showLoading = isLoading && !departments;

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

  const handleRegenerate = () => {
    setIsRegenerating(true);
    onRegenerateDepartments?.(selectedDepartments);
  };

  return (
    <div className="departments-panel">
      <div className="panel-header">
        <span className="panel-title">Departments</span>
      </div>

      <div className="panel-content">
        {showLoading ? (
          <div className="panel-loading">
            <div className="panel-spinner" />
            <span>Detecting...</span>
          </div>
        ) : selectedDepartments.length > 0 ? (
          <div className={`department-boxes ${isRegenerating ? 'disabled' : ''}`}>
            {selectedDepartments.map((dept) => (
              <div key={dept} className="department-plate">
                <span className="plate-screw top-left" />
                <span className="plate-screw top-right" />
                <span className="plate-screw bottom-left" />
                <span className="plate-screw bottom-right" />
                <span className="plate-text">{dept}</span>
                {!isRegenerating && (
                  <button
                    className="plate-remove"
                    onClick={() => handleRemoveDepartment(dept)}
                    aria-label="Remove department"
                  />
                )}
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
            disabled={isRegenerating}
          />
          <button className="panel-add-btn" onClick={handleAddDepartment} disabled={isRegenerating}>
            Add
          </button>
        </div>
        <button
          className="panel-regenerate-btn"
          onClick={handleRegenerate}
          disabled={selectedDepartments.length < 2 || isRegenerating}
        >
          {isRegenerating ? 'Regenerating...' : selectedDepartments.length < 2 ? 'Add at least 2 departments' : 'Regenerate Scores'}
        </button>
      </div>
    </div>
  );
}

export default DepartmentsPanel;
