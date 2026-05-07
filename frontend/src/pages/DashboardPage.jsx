import { useState, useEffect } from 'react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area 
} from 'recharts';
import useAuthStore from '../store/authStore';
import api from '../services/api';
import Topbar from '../components/Topbar';
import MetricCard from '../components/MetricCard';
import CampaignTable from '../components/CampaignTable';
import SyncStatus from '../components/SyncStatus';
import BudgetCard from '../components/BudgetCard';
import LeadFunnel from '../components/LeadFunnel';
import './DashboardPage.css';

const DashboardPage = () => {
  const { agency } = useAuthStore();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const fetchDashboardData = async () => {
    if (!agency) return;
    setLoading(true);
    try {
      const [overviewRes, campaignsRes, trendsRes, integrationsRes, crmRes] = await Promise.all([
        api.get(`/dashboard/${agency.id}/overview?days=${days}`),
        api.get(`/dashboard/${agency.id}/campaigns?limit=5`),
        api.get(`/dashboard/${agency.id}/trends?days=${days}`),
        api.get(`/integrations/${agency.id}`),
        api.get(`/crm/${agency.id}/funnel`)
      ]);

      setData({
        overview: overviewRes.data.overview,
        changes: overviewRes.data.changes,
        campaigns: campaignsRes.data.campaigns,
        trends: trendsRes.data.trends,
        integrations: integrationsRes.data.integrations,
        funnel: crmRes.data.funnel
      });
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [agency, days]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">
            {new Date(label).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
          {payload.map((entry, index) => (
            <div key={index} className="tooltip-item">
              <span className="tooltip-key">{entry.name}</span>
              <span className="tooltip-value" style={{ color: entry.color }}>
                {entry.name === 'Spend' || entry.name === 'Revenue' ? '$' : ''}
                {Number(entry.value).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="main-content">
        <Topbar title="Dashboard Overview" />
        <div className="page-loader">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  const { overview, changes, campaigns, trends, integrations, funnel } = data || {};

  return (
    <div className="main-content">
      <Topbar title="Dashboard Overview" />
      
      <div className="page-container dashboard-page">
        {/* Header with Period Selector */}
        <div className="dashboard-header-row">
          <div className="period-selector">
            <button className={days === 7 ? 'active' : ''} onClick={() => setDays(7)}>7D</button>
            <button className={days === 30 ? 'active' : ''} onClick={() => setDays(30)}>30D</button>
            <button className={days === 60 ? 'active' : ''} onClick={() => setDays(60)}>60D</button>
            <button className={days === 90 ? 'active' : ''} onClick={() => setDays(90)}>90D</button>
          </div>
        </div>

        {/* Top Metrics Row */}
        <div className="metrics-grid">
          <MetricCard 
            title="Total Ad Spend" 
            value={overview?.totalSpend || 0} 
            change={changes?.spendChange || 0} 
            isCurrency={true} 
            inverseColors={true}
          />
          <MetricCard 
            title="Total Revenue" 
            value={overview?.totalRevenue || 0} 
            change={changes?.revenueChange || 0} 
            isCurrency={true} 
          />
          <MetricCard 
            title="Total Conversions" 
            value={overview?.totalConversions || 0} 
            change={changes?.conversionsChange || 0} 
          />
          <MetricCard 
            title="Avg. ROAS" 
            value={overview?.roas || 0} 
            suffix="x" 
            change={0} 
          />
        </div>

        <div className="dashboard-row-2">
          {/* Main Chart Column */}
          <div className="dashboard-main-col">
            <div className="chart-container glass-panel">
              <div className="chart-header">
                <h3>Performance Trends</h3>
              </div>
              <div className="chart-body">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#5E6AD2" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#5E6AD2" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="0" stroke="rgba(255,255,255,0.03)" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      stroke="rgba(255,255,255,0.3)" 
                      tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
                      tick={{fontSize: 10, fontWeight: 500}}
                      tickMargin={12}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis 
                      stroke="rgba(255,255,255,0.3)" 
                      tickFormatter={(val) => `$${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}`}
                      tick={{fontSize: 10, fontWeight: 500}}
                      tickMargin={12}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }} />
                    <Area 
                      type="monotone" 
                      dataKey="revenue" 
                      name="Revenue" 
                      stroke="#10B981" 
                      strokeWidth={2} 
                      fillOpacity={1} 
                      fill="url(#colorRevenue)" 
                      animationDuration={1500}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="spend" 
                      name="Spend" 
                      stroke="#5E6AD2" 
                      strokeWidth={2} 
                      fillOpacity={1} 
                      fill="url(#colorSpend)" 
                      animationDuration={1500}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Side Panels Column */}
          <div className="dashboard-side-col">
            <LeadFunnel data={funnel} loading={false} />
            
            <BudgetCard 
              currentSpend={overview?.totalSpend || 0} 
              monthlyBudget={overview?.monthlyBudget || 0} 
            />
            
            <SyncStatus 
              integrations={integrations} 
              onSyncComplete={fetchDashboardData} 
            />
          </div>
        </div>

        {/* Bottom Row - Campaign Table */}
        <div className="dashboard-row-3">
          <CampaignTable campaigns={campaigns} loading={false} />
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
