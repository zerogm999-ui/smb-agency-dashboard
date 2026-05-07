import { useState, useEffect } from 'react';
import { FileText, Download, Trash2, FilePlus, Calendar } from 'lucide-react';
import Topbar from '../components/Topbar';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import { format, subDays } from 'date-fns';
import './ReportsPage.css';

const ReportsPage = () => {
  const { agency } = useAuthStore();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [reportTitle, setReportTitle] = useState('');
  
  const defaultStart = format(subDays(new Date(), 30), 'yyyy-MM-dd');
  const defaultEnd = format(new Date(), 'yyyy-MM-dd');
  
  const [dateRangeStart, setDateRangeStart] = useState(defaultStart);
  const [dateRangeEnd, setDateRangeEnd] = useState(defaultEnd);

  const fetchReports = async () => {
    if (!agency) return;
    try {
      const res = await api.get(`/reports/${agency.id}`);
      setReports(res.data.reports || []);
    } catch (error) {
      console.error('Failed to fetch reports', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [agency]);

  const handleGenerateReport = async (e) => {
    e.preventDefault();
    if (!agency) return;
    
    setGenerating(true);
    try {
      await api.post(`/reports/${agency.id}/generate`, {
        title: reportTitle || `Performance Report - ${dateRangeStart} to ${dateRangeEnd}`,
        dateRangeStart,
        dateRangeEnd,
        type: 'performance'
      });
      setReportTitle('');
      fetchReports();
    } catch (error) {
      console.error('Failed to generate report', error);
      alert('Failed to generate report. Make sure backend has PDF generation capabilities.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (reportId) => {
    try {
      const response = await api.get(`/reports/${agency.id}/${reportId}/download`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `report_${reportId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Download failed', error);
      alert('Failed to download report.');
    }
  };

  const handleDelete = async (reportId) => {
    if (!window.confirm('Delete this report permanently?')) return;
    
    try {
      await api.delete(`/reports/${agency.id}/${reportId}`);
      fetchReports();
    } catch (error) {
      console.error('Delete failed', error);
    }
  };

  return (
    <div className="main-content">
      <Topbar title="Reports Generator" />
      
      <div className="page-container reports-page">
        <div className="reports-layout">
          
          {/* Generate Report Form */}
          <div className="generate-panel glass-panel">
            <h3>Generate New Report</h3>
            <p>Create a comprehensive PDF report combining data from all connected platforms.</p>
            
            <form onSubmit={handleGenerateReport} className="generate-form">
              <div className="form-group">
                <label className="form-label">Report Title (Optional)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder={`Performance Report - ${dateRangeStart} to ${dateRangeEnd}`}
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Start Date</label>
                  <div className="input-with-icon">
                    <Calendar size={18} className="input-icon" />
                    <input 
                      type="date" 
                      className="form-input" 
                      value={dateRangeStart}
                      onChange={(e) => setDateRangeStart(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">End Date</label>
                  <div className="input-with-icon">
                    <Calendar size={18} className="input-icon" />
                    <input 
                      type="date" 
                      className="form-input" 
                      value={dateRangeEnd}
                      onChange={(e) => setDateRangeEnd(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>
              
              <button 
                type="submit" 
                className="btn btn-primary w-full mt-4"
                disabled={generating}
              >
                {generating ? (
                  <><div className="spinner" style={{width: 16, height: 16, borderWidth: 2}}></div> Generating PDF...</>
                ) : (
                  <><FilePlus size={18} /> Generate PDF Report</>
                )}
              </button>
            </form>
          </div>
          
          {/* Recent Reports List */}
          <div className="reports-list-panel glass-panel">
            <h3>Recent Reports</h3>
            
            {loading ? (
              <div className="table-loader"><div className="spinner"></div></div>
            ) : reports.length === 0 ? (
              <div className="empty-state">
                <FileText size={48} color="var(--text-muted)" style={{marginBottom: '1rem', opacity: 0.5}} />
                <p>No reports generated yet.</p>
              </div>
            ) : (
              <div className="reports-list">
                {reports.map(report => (
                  <div key={report.id} className="report-item">
                    <div className="report-info">
                      <div className="report-icon">
                        <FileText size={20} className={report.status === 'completed' ? 'success' : ''} />
                      </div>
                      <div>
                        <h4>{report.title}</h4>
                        <div className="report-meta">
                          <span className={`badge badge-${report.status === 'completed' ? 'success' : report.status === 'failed' ? 'error' : 'warning'}`}>
                            {report.status}
                          </span>
                          <span>•</span>
                          <span>{format(new Date(report.createdAt || report.created_at || new Date()), 'MMM d, yyyy')}</span>
                          {report.fileSize && (
                            <>
                              <span>•</span>
                              <span>{(report.fileSize / 1024).toFixed(1)} KB</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="report-actions">
                      {report.status === 'completed' && (
                        <button 
                          className="action-btn download"
                          onClick={() => handleDownload(report.id)}
                          title="Download PDF"
                        >
                          <Download size={18} />
                        </button>
                      )}
                      <button 
                        className="action-btn delete"
                        onClick={() => handleDelete(report.id)}
                        title="Delete Report"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
