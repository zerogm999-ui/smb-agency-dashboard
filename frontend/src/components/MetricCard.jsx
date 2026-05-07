import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import './MetricCard.css';

const MetricCard = ({ title, value, change, isCurrency = false, prefix = '', suffix = '', inverseColors = false }) => {
  const isPositive = change >= 0;
  
  let changeClass = isPositive ? 'positive' : 'negative';
  if (inverseColors) {
    changeClass = isPositive ? 'negative' : 'positive';
  }

  const formattedValue = isCurrency 
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(value)
    : new Intl.NumberFormat('en-US').format(value);

  return (
    <div className="metric-card glass-panel">
      <div className="metric-header">
        <h3>{title}</h3>
      </div>
      
      <div className="metric-content">
        <div className="metric-value">
          {prefix}{formattedValue}{suffix}
        </div>
        
        {change !== undefined && (
          <div className={`metric-change ${changeClass}`}>
            {isPositive ? <ArrowUpRight size={14} strokeWidth={2.5} /> : <ArrowDownRight size={14} strokeWidth={2.5} />}
            <span>{Math.abs(change)}%</span>
            <span style={{ fontSize: '10px', opacity: 0.5, marginLeft: '4px' }}>vs prev</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default MetricCard;
