'use client';

import React, { useState } from 'react';
import { useComplianceFeatures } from '../context/ComplianceProvider';
import {
  useComplianceMetrics,
  useDataSubjectRequests,
  useActivity,
  usePIILocations,
  useActionTasks,
} from '../hooks';
import type { DataSubjectRequest } from '../types/data-subject-request';
import type { PIILocation } from '../types/pii-location';
import type { ActionTask } from '../types/action-task';

export interface ComplianceDashboardProps {
  /** CSS class name for the container */
  className?: string;
  /** Default active tab */
  defaultTab?: 'overview' | 'dsr' | 'data-registry' | 'activity' | 'reports';
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
    { id: 'dsr', label: 'Data Subject Requests', enabled: features.gdprRequests },
    { id: 'data-registry', label: 'Data Registry', enabled: features.gdprRequests },
    { id: 'activity', label: 'Activity', enabled: features.auditLogs },
    { id: 'reports', label: 'Reports', enabled: features.reports },
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
        {activeTab === 'dsr' && <DataSubjectRequestsTab />}
        {activeTab === 'data-registry' && <DataRegistryTab />}
        {activeTab === 'activity' && <ActivityTab />}
        {activeTab === 'reports' && <ReportsTab />}
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
        .badge-neutral { background: #f3f4f6; color: #374151; }
        .btn {
          padding: 0.5rem 1rem;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          border: 1px solid transparent;
        }
        .btn-primary {
          background: #2563eb;
          color: white;
          border-color: #2563eb;
        }
        .btn-primary:hover { background: #1d4ed8; }
        .btn-secondary {
          background: white;
          color: #374151;
          border-color: #d1d5db;
        }
        .btn-secondary:hover { background: #f9fafb; }
        .btn-sm {
          padding: 0.25rem 0.5rem;
          font-size: 0.75rem;
        }
        .btn-group {
          display: flex;
          gap: 0.5rem;
        }
        .form-group {
          margin-bottom: 1rem;
        }
        .form-label {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          color: #374151;
          margin-bottom: 0.25rem;
        }
        .form-input, .form-select {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          font-size: 0.875rem;
        }
        .form-input:focus, .form-select:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
        }
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 50;
        }
        .modal {
          background: white;
          border-radius: 0.5rem;
          padding: 1.5rem;
          max-width: 600px;
          width: 90%;
          max-height: 90vh;
          overflow-y: auto;
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }
        .modal-title {
          font-size: 1.125rem;
          font-weight: 600;
        }
        .modal-close {
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          color: #6b7280;
        }
        .task-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .task-item {
          padding: 0.75rem;
          border: 1px solid #e5e7eb;
          border-radius: 0.375rem;
          margin-bottom: 0.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .task-info {
          flex: 1;
        }
        .task-name {
          font-weight: 500;
          color: #111827;
        }
        .task-meta {
          font-size: 0.75rem;
          color: #6b7280;
          margin-top: 0.25rem;
        }
        .progress-bar {
          height: 8px;
          background: #e5e7eb;
          border-radius: 4px;
          overflow: hidden;
          margin-top: 0.5rem;
        }
        .progress-fill {
          height: 100%;
          background: #22c55e;
          transition: width 0.3s;
        }
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }
        .clickable-row {
          cursor: pointer;
        }
        .clickable-row:hover {
          background: #f9fafb;
        }
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
          <div className="metric-label">Data Subject Requests</div>
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
          <div className="metric-label">Avg Response Time</div>
          <div className="metric-value">{metrics.gdprRequests.avgResponseDays} days</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Audit Events Today</div>
          <div className="metric-value">{metrics.audit.todayEvents}</div>
          <div className="metric-label">
            {metrics.audit.gdprRelevantEvents} privacy relevant
          </div>
        </div>
      </div>
    </div>
  );
}

function DataSubjectRequestsTab() {
  const { requests, loading, error, metrics, createRequest, refresh } = useDataSubjectRequests({
    includeMetrics: true,
    pageSize: 10,
  });
  const [selectedRequest, setSelectedRequest] = useState<DataSubjectRequest | null>(null);
  const [showNewRequestForm, setShowNewRequestForm] = useState(false);

  if (loading) return <div className="loading">Loading data subject requests...</div>;
  if (error) return <div className="error">Error: {error.message}</div>;

  return (
    <div>
      <div className="section-header">
        <h2>Data Subject Requests</h2>
        <button className="btn btn-primary" onClick={() => setShowNewRequestForm(true)}>
          + New Request
        </button>
      </div>
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
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((req) => (
            <tr key={req.id} className="clickable-row" onClick={() => setSelectedRequest(req)}>
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
              <td>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={(e) => { e.stopPropagation(); setSelectedRequest(req); }}
                >
                  View Tasks
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedRequest && (
        <RequestTasksModal
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
        />
      )}

      {showNewRequestForm && (
        <NewRequestModal
          onClose={() => setShowNewRequestForm(false)}
          onSubmit={async (data) => {
            await createRequest(data);
            setShowNewRequestForm(false);
          }}
        />
      )}
    </div>
  );
}

function NewRequestModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (data: {
    requestType: 'access' | 'rectification' | 'erasure' | 'restriction' | 'portability' | 'objection';
    requesterEmail: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    notes?: string;
  }) => Promise<void>;
}) {
  const [formData, setFormData] = useState({
    requestType: 'access' as const,
    requesterEmail: '',
    priority: 'medium' as const,
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        requestType: formData.requestType as 'access' | 'rectification' | 'erasure' | 'restriction' | 'portability' | 'objection',
        requesterEmail: formData.requesterEmail,
        priority: formData.priority as 'low' | 'medium' | 'high' | 'urgent',
        notes: formData.notes || undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">New Data Subject Request</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Request Type *</label>
            <select
              className="form-select"
              value={formData.requestType}
              onChange={(e) => setFormData({ ...formData, requestType: e.target.value as typeof formData.requestType })}
              required
            >
              <option value="access">Access (Right to Access)</option>
              <option value="erasure">Erasure (Right to be Forgotten)</option>
              <option value="rectification">Rectification (Correct Data)</option>
              <option value="portability">Portability (Export Data)</option>
              <option value="restriction">Restriction (Limit Processing)</option>
              <option value="objection">Objection (Stop Processing)</option>
              <option value="consent">Consent (Request Consent Records)</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Requester Email *</label>
            <input
              type="email"
              className="form-input"
              value={formData.requesterEmail}
              onChange={(e) => setFormData({ ...formData, requesterEmail: e.target.value })}
              placeholder="user@example.com"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Priority</label>
            <select
              className="form-select"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value as typeof formData.priority })}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea
              className="form-input"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder="Additional details about the request..."
            />
          </div>
          <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#f3f4f6', borderRadius: '0.375rem', fontSize: '0.875rem' }}>
            <strong>Typical intake channels:</strong>
            <ul style={{ margin: '0.5rem 0 0 1rem', padding: 0 }}>
              <li>Email to privacy@company.com</li>
              <li>Web form on privacy page</li>
              <li>Customer support ticket</li>
              <li>In-app privacy settings</li>
            </ul>
          </div>
          <div className="btn-group" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ActivityTab() {
  const { activities, loading, error, total } = useActivity({ pageSize: 50 });

  if (loading) return <div className="loading">Loading activity...</div>;
  if (error) return <div className="error">Error: {error.message}</div>;

  const formatActivityType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'request_created': return '📝';
      case 'request_verified': return '✓';
      case 'request_assigned': return '👤';
      case 'request_status_changed': return '🔄';
      case 'request_completed': return '✅';
      case 'request_rejected': return '❌';
      case 'task_created': return '📋';
      case 'task_started': return '▶️';
      case 'task_completed': return '✅';
      case 'task_failed': return '❌';
      case 'task_skipped': return '⏭️';
      case 'note_added': return '💬';
      default: return '•';
    }
  };

  return (
    <div>
      <h2>Activity Log ({total} entries)</h2>
      {activities.length === 0 ? (
        <p className="empty-state">No activity recorded yet. Activities will appear here as requests are processed.</p>
      ) : (
        <div className="activity-list">
          {activities.map((activity) => (
            <div key={activity.id} className="activity-item">
              <span className="activity-icon">{getActivityIcon(activity.activityType)}</span>
              <div className="activity-content">
                <div className="activity-description">
                  <strong>{activity.description}</strong>
                  {activity.piiLocationName && (
                    <span className="activity-location"> on {activity.piiLocationName}</span>
                  )}
                </div>
                <div className="activity-meta">
                  <span className="activity-type">{formatActivityType(activity.activityType)}</span>
                  {activity.actorName && (
                    <span className="activity-actor"> by {activity.actorName}</span>
                  )}
                  {!activity.actorName && activity.actorType === 'system' && (
                    <span className="activity-actor"> by System</span>
                  )}
                  <span className="activity-time">
                    {new Date(activity.createdAt).toLocaleString()}
                  </span>
                </div>
                {activity.previousStatus && activity.newStatus && (
                  <div className="activity-status-change">
                    Status: {activity.previousStatus} → {activity.newStatus}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <style>{`
        .activity-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .activity-item {
          display: flex;
          gap: 0.75rem;
          padding: 0.75rem;
          background: #f9fafb;
          border-radius: 0.5rem;
          border-left: 3px solid #e5e7eb;
        }
        .activity-item:hover {
          background: #f3f4f6;
        }
        .activity-icon {
          font-size: 1.25rem;
          flex-shrink: 0;
        }
        .activity-content {
          flex: 1;
          min-width: 0;
        }
        .activity-description {
          font-size: 0.875rem;
          color: #111827;
        }
        .activity-location {
          color: #6b7280;
          font-weight: normal;
        }
        .activity-meta {
          font-size: 0.75rem;
          color: #6b7280;
          margin-top: 0.25rem;
        }
        .activity-type {
          background: #e5e7eb;
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
          margin-right: 0.5rem;
        }
        .activity-time {
          margin-left: 0.5rem;
        }
        .activity-status-change {
          font-size: 0.75rem;
          color: #4b5563;
          margin-top: 0.25rem;
          font-family: monospace;
        }
        .empty-state {
          color: #6b7280;
          text-align: center;
          padding: 2rem;
        }
      `}</style>
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
        <li>Privacy Compliance Report</li>
        <li>Audit Trail Export</li>
        <li>Consent Analytics</li>
        <li>Data Retention Status</li>
      </ul>
    </div>
  );
}

function DataRegistryTab() {
  const {
    locations,
    loading,
    error,
    summary,
    createLocation,
    updateLocation,
    deleteLocation,
    verifyLocation,
  } = usePIILocations({ includeSummary: true });
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingLocation, setEditingLocation] = useState<PIILocation | null>(null);

  if (loading) return <div className="loading">Loading PII locations...</div>;
  if (error) return <div className="error">Error: {error.message}</div>;

  return (
    <div>
      <div className="section-header">
        <h2>PII Data Registry</h2>
        <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>
          + Add Location
        </button>
      </div>

      {summary && (
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-label">Total Locations</div>
            <div className="metric-value">{summary.total}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Active</div>
            <div className="metric-value">{summary.active}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Automated</div>
            <div className="metric-value">{summary.byExecutionType.automated}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Needs Verification</div>
            <div className="metric-value" style={{ color: summary.needsVerification > 0 ? '#dc2626' : 'inherit' }}>
              {summary.needsVerification}
            </div>
          </div>
        </div>
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>System Type</th>
            <th>Execution</th>
            <th>Supported Types</th>
            <th>Owner</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {locations.map((location) => (
            <tr key={location.id}>
              <td>
                <strong>{location.name}</strong>
                {location.description && (
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                    {location.description}
                  </div>
                )}
              </td>
              <td>
                <span className={`badge badge-${getSystemTypeColor(location.systemType)}`}>
                  {location.systemType}
                </span>
              </td>
              <td>
                <span className={`badge badge-${getExecutionTypeColor(location.executionType)}`}>
                  {location.executionType}
                </span>
              </td>
              <td>
                {location.supportedRequestTypes.map((type) => (
                  <span key={type} className="badge badge-neutral" style={{ marginRight: '0.25rem' }}>
                    {type}
                  </span>
                ))}
              </td>
              <td>{location.ownerTeam || location.ownerEmail || '-'}</td>
              <td>
                {location.isActive ? (
                  <span className="badge badge-success">Active</span>
                ) : (
                  <span className="badge badge-danger">Inactive</span>
                )}
              </td>
              <td>
                <div className="btn-group">
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => setEditingLocation(location)}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => verifyLocation(location.id)}
                  >
                    Verify
                  </button>
                  <button
                    className="btn btn-sm btn-secondary"
                    style={{ color: '#dc2626' }}
                    onClick={() => {
                      if (confirm(`Delete "${location.name}"? This will deactivate the location.`)) {
                        deleteLocation(location.id);
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showAddForm && (
        <LocationFormModal
          onClose={() => setShowAddForm(false)}
          onSave={async (data) => {
            await createLocation(data);
            setShowAddForm(false);
          }}
        />
      )}

      {editingLocation && (
        <LocationFormModal
          location={editingLocation}
          onClose={() => setEditingLocation(null)}
          onSave={async (data) => {
            await updateLocation(editingLocation.id, data);
            setEditingLocation(null);
          }}
          onDelete={async () => {
            await deleteLocation(editingLocation.id);
            setEditingLocation(null);
          }}
        />
      )}
    </div>
  );
}

function LocationFormModal({
  location,
  onClose,
  onSave,
  onDelete,
}: {
  location?: PIILocation;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [formData, setFormData] = useState({
    name: location?.name || '',
    description: location?.description || '',
    systemType: location?.systemType || 'database',
    executionType: location?.executionType || 'manual',
    supportedRequestTypes: location?.supportedRequestTypes || ['erasure', 'access'],
    ownerEmail: location?.ownerEmail || '',
    ownerTeam: location?.ownerTeam || '',
    priorityOrder: location?.priorityOrder || 100,
    piiFields: location?.piiFields?.join(', ') || '',
    consentFields: location?.consentFields?.join(', ') || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const piiFieldsArray = formData.piiFields
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const consentFieldsArray = formData.consentFields
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      await onSave({
        ...formData,
        piiFields: piiFieldsArray,
        consentFields: consentFieldsArray,
        actionConfig: formData.executionType === 'manual'
          ? { instructions: [{ step: 1, title: 'Manual process', description: 'Follow internal procedures' }] }
          : { endpoint: { url: '', method: 'DELETE', authType: 'none' } },
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{location ? 'Edit Location' : 'Add PII Location'}</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Name *</label>
            <input
              type="text"
              className="form-input"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <input
              type="text"
              className="form-input"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">System Type</label>
            <select
              className="form-select"
              value={formData.systemType}
              onChange={(e) => setFormData({ ...formData, systemType: e.target.value as any })}
            >
              <option value="database">Database</option>
              <option value="api">API</option>
              <option value="saas_platform">SaaS Platform</option>
              <option value="crm">CRM</option>
              <option value="cdp">CDP</option>
              <option value="file_storage">File Storage</option>
              <option value="manual">Manual System</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Execution Type</label>
            <select
              className="form-select"
              value={formData.executionType}
              onChange={(e) => setFormData({ ...formData, executionType: e.target.value as any })}
            >
              <option value="automated">Automated (API)</option>
              <option value="semi_automated">Semi-Automated</option>
              <option value="manual">Manual Process</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Owner Team</label>
            <input
              type="text"
              className="form-input"
              value={formData.ownerTeam}
              onChange={(e) => setFormData({ ...formData, ownerTeam: e.target.value })}
              placeholder="e.g., Engineering, Support"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Owner Email</label>
            <input
              type="email"
              className="form-input"
              value={formData.ownerEmail}
              onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Priority Order</label>
            <input
              type="number"
              className="form-input"
              value={formData.priorityOrder}
              onChange={(e) => setFormData({ ...formData, priorityOrder: parseInt(e.target.value) })}
              min={1}
              max={1000}
            />
          </div>
          <div className="form-group">
            <label className="form-label">PII Fields</label>
            <input
              type="text"
              className="form-input"
              value={formData.piiFields}
              onChange={(e) => setFormData({ ...formData, piiFields: e.target.value })}
              placeholder="email, name, phone, address (comma-separated)"
            />
            <small style={{ color: '#6b7280', fontSize: '0.75rem' }}>Personal data stored in this system</small>
          </div>
          <div className="form-group">
            <label className="form-label">Consent Fields</label>
            <input
              type="text"
              className="form-input"
              value={formData.consentFields}
              onChange={(e) => setFormData({ ...formData, consentFields: e.target.value })}
              placeholder="email_marketing, sms_opt_in (comma-separated)"
            />
            <small style={{ color: '#6b7280', fontSize: '0.75rem' }}>Consent records tracked in this system</small>
          </div>
          <div className="btn-group" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
            {onDelete && (
              <button type="button" className="btn btn-secondary" onClick={onDelete} style={{ marginRight: 'auto', color: '#dc2626' }}>
                Deactivate
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RequestTasksModal({
  request,
  onClose,
}: {
  request: DataSubjectRequest;
  onClose: () => void;
}) {
  const {
    tasks,
    loading,
    error,
    summary,
    startTask,
    completeTask,
    skipTask,
    initiateTasksForRequest,
  } = useActionTasks({
    dsrRequestId: request.id,
    includeSummary: true,
  });
  const { locations } = usePIILocations({ initialFilters: { isActive: true } });
  const [actioningTask, setActioningTask] = useState<string | null>(null);

  const locationMap = new Map(locations.map((l) => [l.id, l]));

  const handleInitiateTasks = async () => {
    await initiateTasksForRequest(request.id, request.requestType);
  };

  const handleStartTask = async (taskId: string) => {
    setActioningTask(taskId);
    try {
      await startTask(taskId);
    } finally {
      setActioningTask(null);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    setActioningTask(taskId);
    try {
      await completeTask(taskId, { result: { manualConfirmation: 'Completed via dashboard' } });
    } finally {
      setActioningTask(null);
    }
  };

  const handleSkipTask = async (taskId: string) => {
    setActioningTask(taskId);
    try {
      await skipTask(taskId, 'Skipped via dashboard');
    } finally {
      setActioningTask(null);
    }
  };

  const completedCount = summary ? summary.byStatus.completed + summary.byStatus.skipped : 0;
  const progressPercent = summary && summary.total > 0 ? (completedCount / summary.total) * 100 : 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">
              Action Tasks: {request.requestType.toUpperCase()} Request
            </h3>
            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              {request.requesterEmail} &bull; Due: {new Date(request.dueDate).toLocaleDateString()}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        {loading ? (
          <div className="loading">Loading tasks...</div>
        ) : error ? (
          <div className="error">Error: {error.message}</div>
        ) : (
          <>
            {summary && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                  <span>Progress: {completedCount} of {summary.total} tasks complete</span>
                  <span>{Math.round(progressPercent)}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
                </div>
                {summary.hasFailures && (
                  <div style={{ color: '#dc2626', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                    {summary.byStatus.failed} failed, {summary.byStatus.blocked} blocked
                  </div>
                )}
              </div>
            )}

            {tasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <p style={{ marginBottom: '1rem', color: '#6b7280' }}>
                  No action tasks have been created for this request yet.
                </p>
                <button className="btn btn-primary" onClick={handleInitiateTasks}>
                  Initialize Action Tasks
                </button>
              </div>
            ) : (
              <ul className="task-list">
                {tasks.map((task) => {
                  const location = locationMap.get(task.piiLocationId);
                  return (
                    <li key={task.id} className="task-item">
                      <div className="task-info">
                        <div className="task-name">
                          {location?.name || 'Unknown Location'}
                        </div>
                        <div className="task-meta">
                          {location?.systemType} &bull; {location?.executionType}
                          {task.assignedTo && ` • Assigned`}
                        </div>
                      </div>
                      <div className="btn-group" style={{ alignItems: 'center' }}>
                        <span className={`badge badge-${getTaskStatusColor(task.status)}`}>
                          {task.status.replace('_', ' ')}
                        </span>
                        {task.status === 'pending' && (
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => handleStartTask(task.id)}
                            disabled={actioningTask === task.id}
                          >
                            Start
                          </button>
                        )}
                        {(task.status === 'in_progress' || task.status === 'manual_action') && (
                          <>
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => handleCompleteTask(task.id)}
                              disabled={actioningTask === task.id}
                            >
                              Complete
                            </button>
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() => handleSkipTask(task.id)}
                              disabled={actioningTask === task.id}
                            >
                              Skip
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
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

function getTaskStatusColor(status: string): string {
  switch (status) {
    case 'completed': return 'success';
    case 'pending': case 'awaiting_callback': return 'warning';
    case 'in_progress': case 'manual_action': case 'verification': return 'info';
    case 'failed': case 'blocked': return 'danger';
    case 'skipped': return 'neutral';
    default: return 'info';
  }
}

function getSystemTypeColor(type: string): string {
  switch (type) {
    case 'database': return 'info';
    case 'api': return 'success';
    case 'saas_platform': return 'info';
    case 'crm': return 'success';
    case 'cdp': return 'success';
    case 'file_storage': return 'neutral';
    case 'manual': return 'warning';
    default: return 'info';
  }
}

function getExecutionTypeColor(type: string): string {
  switch (type) {
    case 'automated': return 'success';
    case 'semi_automated': return 'info';
    case 'manual': return 'warning';
    default: return 'info';
  }
}
