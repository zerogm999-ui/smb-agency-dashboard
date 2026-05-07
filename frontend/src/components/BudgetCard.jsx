import './BudgetCard.css';

const BudgetCard = ({ currentSpend, monthlyBudget }) => {
  const percentUsed = monthlyBudget > 0 ? (currentSpend / monthlyBudget) * 100 : 0;
  
  // Simple projection: if we are at day 15 of 30, we should be at 50%
  const today = new Date();
  const dayOfMonth = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const expectedPercent = (dayOfMonth / daysInMonth) * 100;
  
  const isOverpacing = percentUsed > expectedPercent + 5;
  const isUnderpacing = percentUsed < expectedPercent - 10;
  
  let status = 'On Track';
  let statusClass = 'on-track';
  
  if (isOverpacing) {
    status = 'Overpacing';
    statusClass = 'overpacing';
  } else if (isUnderpacing) {
    status = 'Underpacing';
    statusClass = 'underpacing';
  }

  const projectedSpend = (currentSpend / dayOfMonth) * daysInMonth;

  return (
    <div className="budget-card glass-panel">
      <div className="budget-header">
        <div className="budget-title">
          <h3>Monthly Budget Pacing</h3>
          <span className={`budget-status ${statusClass}`}>{status}</span>
        </div>
        <div className="budget-amount">
          ${monthlyBudget.toLocaleString()}
        </div>
      </div>
      
      <div className="budget-progress-container">
        <div className="budget-progress-bar">
          <div 
            className={`budget-progress-fill ${statusClass}`} 
            style={{ width: `${Math.min(percentUsed, 100)}%` }}
          ></div>
          <div 
            className="budget-progress-marker" 
            style={{ left: `${expectedPercent}%` }}
            title="Today's Ideal Position"
          ></div>
        </div>
        <div className="budget-progress-labels">
          <span>${currentSpend.toLocaleString()} spent</span>
          <span>{Math.round(percentUsed)}%</span>
        </div>
      </div>
      
      <div className="budget-footer">
        <div className="projection-item">
          <span className="label">Projected End:</span>
          <span className={`value ${projectedSpend > monthlyBudget ? 'warning' : ''}`}>
            ${Math.round(projectedSpend).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
};

export default BudgetCard;
