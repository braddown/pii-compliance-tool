'use client';

import React, { useState } from 'react';
import { useComplianceFeatures } from '../context/ComplianceProvider';
import {
  useComplianceMetrics,
  useGDPRRequests,
  useAuditLogs,
  useConsent,
} from '../hooks';

export interface ComplianceDashboardProps {
  /** CSS class name for the container */
  className?: string;
  /** Default active tab */
  defaultTab?: 'overview' | 'gdpr' | 'audit' | 'consent' | 'reports' | 'privacy';
  /** Custom tab renderer */
  renderTab?: (tab: string, content: React.ReactNode) => React.ReactNode;
}

/**
 * Main compliance dashboard component
 *
 * This is a basic implementation. For production use, you may want to
 * customize the styling and add your own UI components.
 *
 * @example
 * ```tsx
 * import { ComplianceProvider, ComplianceDashboard } from '@conversr/compliance';
 *
 * export default function Page() {
 *   return (
 *     <ComplianceProvider config={{ supabase, tenantId }}>
 *       <ComplianceDashboard />
 *     </ComplianceProvider>
 *   );
 * }
 * ```
 */
export function ComplianceDashboard({
  className = '',
  defaultTab = 'overview',
}: ComplianceDashboardProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const features = useComplianceFeatures();

  const tabs = [
    { id: 'overview', label: 'Overview', enabled: true },
    { id: 'gdpr', label: 'GDPR Requests', enabled: features.gdprRequests },
    { id: 'audit', label: 'Audit Logs', enabled: features.auditLogs },
    { id: 'consent', label: 'Consent', enabled: features.consentManagement },
    { id: 'reports', label: 'Reports', enabled: features.reports },
    { id: 'privacy', label: 'Privacy', enabled: features.privacyDashboard },
  ].filter((tab) => tab.enabled);

  return (
    <div className={`compliance-dashboard ${className}`}>
      {/* Tab Navigation */}
      <div className="compliance-tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`compliance-tab ${activeTab === tab.id ? 'active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="compliance-content" role="tabpanel">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'gdpr' && <GDPRTab />}
        {activeTab === 'audit' && <AuditTab />}
        {activeTab === 'consent' && <ConsentTab />}
        {activeTab === 'reports' && <ReportsTab />}
        {activeTab === 'privacy' && <PrivacyTab />}
      </div>

      {/* Basic styles */}
      <style>{`
        .compliance-dashboard {
          font-family: system-ui, -apple-system, sans-serif;
        }
        .compliance-tabs {
          display: flex;
          border-bottom: 1px solid #e5e7eb;
          margin-bottom: 1rem;
        }
        .compliance-tab {
          padding: 0.75rem 1rem;
          border: none;
          background: none;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          color: #6b7280;
        }
        .compliance-tab:hover {
          color: #374151;
        }
        .compliance-tab.active {
          color: #2563eb;
          border-bottom-color: #2563eb;
        }
        .compliance-content {
          padding: 1rem 0;
        }
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        .metric-card {
          padding: 1rem;
          border: 1px solid #e5e7eb;
          border-radius: 0.5rem;
          background: white;
        }
        .metric-label {
          font-size: 0.875rem;
          color: #6b7280;
          margin-bottom: 0.25rem;
        }
        .metric-value {
          font-size: 1.5rem;
          font-weight: 600;
          color: #111827;
        }
        .data-table {
          width: 100%;
          border-collapse: collapse;
        }
        .data-table th, .data-table td {
          padding: 0.75rem;
          text-align: left;
          border-bottom: 1px solid #e5e7eb;
        }
        .data-table th {
          background: #f9fafb;
          font-weight: 500;
          color: #374151;
        }
        .loading {
          color: #6b7280;
          padding: 2rem;
          text-align: center;
        }
        .error {
          color: #dc2626;
          padding: 1rem;
          background: #fef2f2;
          border-radius: 0.5rem;
        }
        .badge {
          display: inline-block;
          padding: 0.25rem 0.5rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 500;
        }
        .badge-success { background: #dcfce7; color: #166534; }
        .badge-warning { background: #fef3c7; color: #92400e; }
        .badge-danger { background: #fee2e2; color: #991b1b; }
        .badge-info { background: #dbeafe; color: #1e40af; }
      `}</style>
    </div>
  );
}

function OverviewTab() {
  const { metrics, loading, error } = useComplianceMetrics();

  if (loading) return <div className="loading">Loading metrics...</div>;
  if (error) return <div className="error">Error: {error.message}</div>;
  if (!metrics) return <div className="loading">No data available</div>;

  return (
    <div>
      <h2>Compliance Overview</h2>
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">GDPR Requests</div>
          <div className="metric-value">{metrics.gdprRequests.total}</div>
          <div className="metric-label">
            {metrics.gdprRequests.pending} pending, {metrics.gdprRequests.overdue} overdue
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Compliance Rate</div>
          <div className="metric-value">{metrics.gdprRequests.complianceRate}%</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Consent Rate</div>
          <div className="metric-value">{metrics.consent.consentRate}%</div>
          <div className="metric-label">
            {metrics.consent.totalActive} active consents
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Audit Events Today</div>
          <div className="metric-value">{metrics.audit.todayEvents}</div>
          <div className="metric-label">
            {metrics.audit.gdprRelevantEvents} GDPR relevant
          </div>
        </div>
      </div>
    </div>
  );
}

function GDPRTab() {
  const { requests, loading, error, metrics } = useGDPRRequests({
    includeMetrics: true,
    pageSize: 10,
  });

  if (loading) return <div className="loading">Loading GDPR requests...</div>;
  if (error) return <div className="error">Error: {error.message}</div>;

  return (
    <div>
      <h2>GDPR Requests</h2>
      {metrics && (
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-label">Pending</div>
            <div className="metric-value">{metrics.pending}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">In Progress</div>
            <div className="metric-value">{metrics.inProgress}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Overdue</div>
            <div className="metric-value" style={{ color: metrics.overdue > 0 ? '#dc2626' : 'inherit' }}>
              {metrics.overdue}
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Avg Response</div>
            <div className="metric-value">{metrics.avgResponseDays} days</div>
          </div>
        </div>
      )}
      <table className="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Type</th>
            <th>Status</th>
            <th>Priority</th>
            <th>Due Date</th>
            <th>Requester</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((req) => (
            <tr key={req.id}>
              <td>{req.id.slice(0, 8)}...</td>
              <td>{req.requestType}</td>
              <td>
                <span className={`badge badge-${getStatusColor(req.status)}`}>
                  {req.status}
                </span>
              </td>
              <td>
                <span className={`badge badge-${getPriorityColor(req.priority)}`}>
                  {req.priority}
                </span>
              </td>
              <td>{new Date(req.dueDate).toLocaleDateString()}</td>
              <td>{req.requesterEmail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AuditTab() {
  const { logs, loading, error, total } = useAuditLogs({ pageSize: 20 });

  if (loading) return <div className="loading">Loading audit logs...</div>;
  if (error) return <div className="error">Error: {error.message}</div>;

  return (
    <div>
      <h2>Audit Logs ({total} total)</h2>
      <table className="data-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Action</th>
            <th>Resource</th>
            <th>Actor</th>
            <th>IP Address</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>{new Date(log.createdAt).toLocaleString()}</td>
              <td>{log.action}</td>
              <td>{log.resourceType}{log.resourceId ? `: ${log.resourceId.slice(0, 8)}` : ''}</td>
              <td>{log.actorType}{log.userId ? `: ${log.userId.slice(0, 8)}` : ''}</td>
              <td>{log.ipAddress || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConsentTab() {
  const { records, loading, error, metrics } = useConsent({ includeMetrics: true, pageSize: 20 });

  if (loading) return <div className="loading">Loading consent records...</div>;
  if (error) return <div className="error">Error: {error.message}</div>;

  return (
    <div>
      <h2>Consent Management</h2>
      {metrics && (
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-label">Active Consents</div>
            <div className="metric-value">{metrics.totalActive}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Consent Rate</div>
            <div className="metric-value">{metrics.consentRate}%</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Recent Withdrawals</div>
            <div className="metric-value">{metrics.recentWithdrawals}</div>
          </div>
        </div>
      )}
      <table className="data-table">
        <thead>
          <tr>
            <th>Customer</th>
            <th>Type</th>
            <th>Status</th>
            <th>Method</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id}>
              <td>{record.customerId.slice(0, 8)}...</td>
              <td>{record.consentType}</td>
              <td>
                <span className={`badge ${record.consentGranted ? 'badge-success' : 'badge-danger'}`}>
                  {record.consentGranted ? 'Granted' : 'Revoked'}
                </span>
              </td>
              <td>{record.method}</td>
              <td>{new Date(record.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReportsTab() {
  return (
    <div>
      <h2>Reports</h2>
      <p>Report generation functionality coming soon.</p>
      <p>Available report types:</p>
      <ul>
        <li>GDPR Compliance Report</li>
        <li>Audit Trail Export</li>
        <li>Consent Analytics</li>
        <li>Data Retention Status</li>
      </ul>
    </div>
  );
}

function PrivacyTab() {
  const { metrics, loading, error } = useComplianceMetrics();

  if (loading) return <div className="loading">Loading privacy dashboard...</div>;
  if (error) return <div className="error">Error: {error.message}</div>;
  if (!metrics) return <div className="loading">No data available</div>;

  return (
    <div>
      <h2>Privacy Dashboard</h2>
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">Data Subject Requests This Month</div>
          <div className="metric-value">{metrics.gdprRequests.total}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Average Response Time</div>
          <div className="metric-value">{metrics.gdprRequests.avgResponseDays} days</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">On-Time Completion</div>
          <div className="metric-value">{metrics.gdprRequests.complianceRate}%</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">High Risk Events</div>
          <div className="metric-value">{metrics.audit.highRiskEvents}</div>
        </div>
      </div>
    </div>
  );
}

// Helper functions
function getStatusColor(status: string): string {
  switch (status) {
    case 'completed': return 'success';
    case 'pending': return 'warning';
    case 'in_progress': case 'review': return 'info';
    case 'rejected': case 'cancelled': return 'danger';
    default: return 'info';
  }
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'urgent': case 'high': return 'danger';
    case 'medium': return 'warning';
    case 'low': return 'info';
    default: return 'info';
  }
}
