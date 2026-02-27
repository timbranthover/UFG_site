const LandingWorkDashboard = ({
  workItems = MOCK_HISTORY,
  onLoadDraft = () => {},
  onDeleteDraft = () => {},
  onVoidEnvelope = async () => {},
  onEnvelopeStatusChange = () => {},
  onOpenFullMyWork = () => {}
}) => {
  const FIXED_VISIBLE_ROWS = 5;
  const PREVIEW_VIEWPORT_HEIGHT = 404;
  const MAX_VISIBLE_FORM_CHIPS = 1;
  const POLL_INTERVAL_MS = 60000;

  const [activeTab, setActiveTab] = React.useState('inProgress');
  const [envelopeStatuses, setEnvelopeStatuses] = React.useState({});
  const [loadingActions, setLoadingActions] = React.useState({});
  const [isPolling, setIsPolling] = React.useState(false);
  const [lastRefreshed, setLastRefreshed] = React.useState(null);
  const [voidModal, setVoidModal] = React.useState({ isOpen: false, item: null });

  const workItemsRef = React.useRef(workItems);
  React.useEffect(() => {
    workItemsRef.current = workItems;
  }, [workItems]);
  const onEnvelopeStatusChangeRef = React.useRef(onEnvelopeStatusChange);
  React.useEffect(() => {
    onEnvelopeStatusChangeRef.current = onEnvelopeStatusChange;
  }, [onEnvelopeStatusChange]);

  const STATUS_BADGES = {
    draft:     { bg: 'bg-[#ECEBE4]', text: 'text-[#5A5D5C]', border: 'border-[#B8B3A2]', label: 'Draft' },
    sent:      { bg: 'bg-[#FFF8EC]', text: 'text-[#AF8626]', border: 'border-[#DDB84E]', label: 'Sent' },
    delivered: { bg: 'bg-[#ECEBE4]', text: 'text-[#5A5D5C]', border: 'border-[#B8B3A2]', label: 'Viewed' },
    completed: { bg: 'bg-[#EBF5EF]', text: 'text-[#469A6C]', border: 'border-[#96CEAA]', label: 'Completed' },
    voided:    { bg: 'bg-[#FDF2F3]', text: 'text-[#AD3E4A]', border: 'border-[#EDAAB0]', label: 'Voided' },
    declined:  { bg: 'bg-[#FDF2F3]', text: 'text-[#AD3E4A]', border: 'border-[#EDAAB0]', label: 'Declined' }
  };

  const tabConfig = [
    { key: 'drafts', label: 'Drafts' },
    { key: 'inProgress', label: 'In progress' },
    { key: 'completed', label: 'Completed' },
    { key: 'voided', label: 'Voided' }
  ];

  const hasEnvelopeItems = React.useMemo(() => {
    const all = [
      ...(workItems.inProgress || []),
      ...(workItems.completed || []),
      ...(workItems.voided || [])
    ];
    return all.some((item) => item && item.docusignEnvelopeId);
  }, [workItems]);

  const setActionLoading = (itemId, actionName) => {
    setLoadingActions((prev) => ({ ...prev, [itemId]: actionName }));
  };

  const clearActionLoading = (itemId) => {
    setLoadingActions((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  const formatTimeAgo = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return null;

    const now = Date.now();
    const diffMs = Math.max(0, now - date.getTime());
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const formatDateShort = (isoString) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '-';
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = String(date.getFullYear()).slice(-2);
    return `${month}/${day}/${year}`;
  };

  const getRecipientInfo = (item) => {
    if (!item?.docusignEnvelopeId) return null;
    const envStatus = envelopeStatuses[item.docusignEnvelopeId];
    if (!envStatus || !envStatus.recipients) return null;

    const signers = envStatus.recipients.signers || [];
    const completed = signers.filter((signer) => signer.status === 'completed').length;
    return { signers, completed, total: signers.length };
  };

  const fetchAllStatuses = React.useCallback(async () => {
    const current = workItemsRef.current || MOCK_HISTORY;
    const itemsWithEnvelope = [
      ...(current.inProgress || []),
      ...(current.completed || []),
      ...(current.voided || [])
    ].filter((item) => item?.docusignEnvelopeId);

    if (!itemsWithEnvelope.length) {
      setLastRefreshed(new Date());
      return;
    }

    setIsPolling(true);
    try {
      const results = await Promise.all(
        itemsWithEnvelope.map(async (item) => {
          try {
            const result = await DocuSignService.getEnvelopeStatus(item.docusignEnvelopeId);
            return { item, result };
          } catch (error) {
            console.error('Error polling status for', item.docusignEnvelopeId, error);
            return { item, result: null };
          }
        })
      );

      const nextStatuses = {};
      results.forEach(({ item, result }) => {
        if (!result || !result.success) return;

        nextStatuses[item.docusignEnvelopeId] = result;

        const movedToTerminal = result.status === 'completed' || result.status === 'voided';
        if (!movedToTerminal) return;

        const isStillInProgress = (workItemsRef.current?.inProgress || []).some((entry) => entry.id === item.id);
        if (isStillInProgress && typeof onEnvelopeStatusChangeRef.current === 'function') {
          onEnvelopeStatusChangeRef.current(item.id, result);
        }
      });

      if (Object.keys(nextStatuses).length > 0) {
        setEnvelopeStatuses((prev) => ({ ...prev, ...nextStatuses }));
      }
      setLastRefreshed(new Date());
    } finally {
      setIsPolling(false);
    }
  }, []);

  React.useEffect(() => {
    if (!hasEnvelopeItems) return undefined;
    fetchAllStatuses();
    const intervalId = setInterval(fetchAllStatuses, POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [hasEnvelopeItems, fetchAllStatuses]);

  const currentItems = Array.isArray(workItems[activeTab]) ? workItems[activeTab] : [];
  const hasOverflow = currentItems.length > FIXED_VISIBLE_ROWS;
  const visibleItems = currentItems;

  const getDateColumnLabel = () => {
    if (activeTab === 'drafts') return 'Saved';
    if (activeTab === 'inProgress') return 'Sent';
    return 'Updated';
  };

  const getDateValue = (item) => {
    if (activeTab === 'drafts') return formatDateShort(item.savedAt);
    if (activeTab === 'inProgress') return formatDateShort(item.sentAt);

    if (activeTab === 'completed') {
      const completedAt = envelopeStatuses[item.docusignEnvelopeId]?.completedDateTime;
      return formatDateShort(completedAt || item.sentAt || item.lastUpdatedAt);
    }

    if (activeTab === 'voided') {
      const voidedAt = envelopeStatuses[item.docusignEnvelopeId]?.voidedDateTime;
      return formatDateShort(voidedAt || item.sentAt || item.lastUpdatedAt);
    }

    return '-';
  };

  const getStatusBadge = (item) => {
    if (activeTab === 'drafts') return STATUS_BADGES.draft;

    if (item?.docusignEnvelopeId) {
      const fallbackStatus = activeTab === 'completed'
        ? 'completed'
        : activeTab === 'voided'
          ? 'voided'
          : 'sent';
      const envStatus = envelopeStatuses[item.docusignEnvelopeId]?.status || fallbackStatus;
      return STATUS_BADGES[envStatus] || { bg: 'bg-[#ECEBE4]', text: 'text-[#5A5D5C]', border: 'border-[#B8B3A2]', label: envStatus };
    }

    if (activeTab === 'inProgress') return STATUS_BADGES.sent;
    if (activeTab === 'completed') return STATUS_BADGES.completed;
    if (activeTab === 'voided') return STATUS_BADGES.voided;

    return STATUS_BADGES.draft;
  };

  const renderFormChips = (forms = []) => {
    const visibleForms = forms.slice(0, MAX_VISIBLE_FORM_CHIPS);
    const hiddenCount = Math.max(0, forms.length - visibleForms.length);

    return (
      <div className="flex flex-nowrap items-center gap-1.5 overflow-hidden whitespace-nowrap">
        {visibleForms.map((formCode) => (
          <span
            key={formCode}
            className="inline-flex shrink-0 items-center rounded-md border border-[#CCCABC] bg-[#F5F0E1] px-2 py-0.5 text-[11px] font-medium text-[#5A5D5C]"
          >
            {formCode}
          </span>
        ))}
        {hiddenCount > 0 && (
          <span className="relative group shrink-0 inline-flex">
            <span className="inline-flex items-center rounded-md border border-[#CCCABC] bg-white px-2 py-0.5 text-[11px] font-medium text-[#8E8D83] cursor-default">
              +{hiddenCount}
            </span>
            <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-gray-900 bg-opacity-90 text-white text-[11px] rounded px-2 py-1 whitespace-nowrap z-20">
              {forms.join(' · ')}
            </div>
          </span>
        )}
      </div>
    );
  };

  const renderStatusCell = (item) => {
    const loadingAction = loadingActions[item.id];
    if (loadingAction) {
      return (
        <div className="inline-flex items-center gap-2 text-xs text-[#5A5D5C]">
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Working...
        </div>
      );
    }

    const badge = getStatusBadge(item);
    if (activeTab !== 'inProgress') {
      return (
        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${badge.bg} ${badge.text} ${badge.border}`}>
          {badge.label}
        </span>
      );
    }

    const recipientInfo = getRecipientInfo(item);
    const signedCount = recipientInfo ? recipientInfo.completed : (item.progress?.signed || 0);
    const totalCount = recipientInfo ? recipientInfo.total : (item.progress?.total || 1);
    const progressPct = totalCount > 0 ? Math.min(100, (signedCount / totalCount) * 100) : 0;

    return (
      <div className="inline-flex items-center gap-2.5 whitespace-nowrap">
        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${badge.bg} ${badge.text} ${badge.border}`}>
          {badge.label}
        </span>
        <div className="flex items-center gap-1.5">
          <div className="w-16 h-1 rounded-full bg-[#ECEBE4] overflow-hidden">
            <div className="h-full rounded-full bg-[#AF8626] transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="text-[11px] text-[#8E8D83]">{signedCount}/{totalCount}</span>
        </div>
      </div>
    );
  };

  const runRowAction = async (item, actionName, actionFn) => {
    setActionLoading(item.id, actionName);
    try {
      await actionFn();
    } finally {
      clearActionLoading(item.id);
    }
  };

  const handleResend = async (item) => {
    if (!item?.docusignEnvelopeId) return;
    await runRowAction(item, 'resend', async () => {
      const result = await DocuSignService.resendEnvelope(item.docusignEnvelopeId);
      if (result.success) {
        showToast({ type: 'success', message: 'Notification resent' });
      } else {
        showToast({ message: 'Failed to resend', subtitle: result.error });
      }
    });
  };

  const handleDownload = async (item) => {
    if (!item?.docusignEnvelopeId) return;
    await runRowAction(item, 'download', async () => {
      const result = await DocuSignService.downloadDocument(item.docusignEnvelopeId);
      if (!result.success) {
        showToast({ message: 'Failed to download', subtitle: result.error });
      }
    });
  };

  const handleDeleteDraft = async (item) => {
    const draftName = item?.draftName || 'Untitled';
    if (!confirm(`Delete draft "${draftName}"?`)) return;

    await runRowAction(item, 'delete', async () => {
      if (typeof onDeleteDraft === 'function') {
        onDeleteDraft(item);
      }
    });
  };

  const handleVoidConfirm = async (reason) => {
    const item = voidModal.item;
    if (!item) return;

    await runRowAction(item, 'void', async () => {
      if (typeof onVoidEnvelope === 'function') {
        await onVoidEnvelope(item, reason);
      }
    });
  };

  const renderActionButton = ({ label, onClick, tone = 'default', disabled = false, loading = false }) => {
    const toneClass = tone === 'danger'
      ? 'border-[#AD3E4A]/30 text-[#AD3E4A] hover:bg-[#FDF2F3] hover:border-[#AD3E4A]/50'
      : 'border-[#CCCABC] text-[#5A5D5C] hover:bg-[#ECEBE4] hover:border-[#B8B3A2]';

    return (
      <button
        title={label}
        aria-label={label}
        onClick={onClick}
        disabled={disabled || loading}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${toneClass}`}
      >
        {loading ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <>
            {label === 'Resume draft' && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            )}
            {label === 'Delete draft' && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            )}
            {label === 'Resend notification' && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            )}
            {label === 'Void envelope' && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            )}
            {label === 'Download signed PDF' && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            )}
            {label === 'View details' && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </>
        )}
      </button>
    );
  };

  const renderActions = (item) => {
    const loadingAction = loadingActions[item.id];

    if (activeTab === 'drafts') {
      return (
        <div className="flex items-center justify-end gap-1">
          {renderActionButton({
            label: 'Resume draft',
            onClick: () => onLoadDraft(item),
            disabled: Boolean(loadingAction)
          })}
          {renderActionButton({
            label: 'Delete draft',
            tone: 'danger',
            onClick: () => handleDeleteDraft(item),
            loading: loadingAction === 'delete'
          })}
        </div>
      );
    }

    if (activeTab === 'inProgress') {
      const hasEnvelope = Boolean(item.docusignEnvelopeId);
      return (
        <div className="flex items-center justify-end gap-1">
          {renderActionButton({
            label: 'Resend notification',
            onClick: () => handleResend(item),
            disabled: !hasEnvelope,
            loading: loadingAction === 'resend'
          })}
          {renderActionButton({
            label: 'Void envelope',
            tone: 'danger',
            onClick: () => setVoidModal({ isOpen: true, item }),
            disabled: !hasEnvelope,
            loading: loadingAction === 'void'
          })}
        </div>
      );
    }

    if (activeTab === 'completed') {
      return (
        <div className="flex items-center justify-end gap-1">
          {renderActionButton({
            label: 'Download signed PDF',
            onClick: () => handleDownload(item),
            disabled: !item.docusignEnvelopeId,
            loading: loadingAction === 'download'
          })}
        </div>
      );
    }

    return (
      <div className="flex items-center justify-end gap-1">
        {renderActionButton({
          label: 'View details',
          onClick: () => showToast({ message: 'Details view coming soon' }),
          disabled: Boolean(loadingAction)
        })}
      </div>
    );
  };

  return (
    <>
      <div className="mobile-landing-work-view mobile-my-work-view max-w-5xl">
        <div className="bg-white p-5 sm:p-6" style={{ borderRadius: 'var(--app-radius)', border: '1px solid var(--app-card-border)', boxShadow: 'var(--app-card-shadow)' }}>
          <div className="mobile-work-header flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-[#404040]">Work dashboard</h2>
              <p className="text-sm text-[#7A7870] mt-1">
                Monitor drafts, active signature packages, and completed outcomes from home.
              </p>
            </div>
            <div className="mobile-work-header-actions flex items-center gap-3">
              {lastRefreshed && (
                <span className="text-xs text-[#B8B3A2]">
                  Updated {formatTimeAgo(lastRefreshed.toISOString())}
                </span>
              )}
              <button
                onClick={fetchAllStatuses}
                disabled={isPolling || !hasEnvelopeItems}
                className="inline-flex items-center gap-1.5 text-sm text-[#5A5D5C] hover:text-[#5A5D5C] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg className={`w-4 h-4 ${isPolling ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
              <button
                onClick={onOpenFullMyWork}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#CCCABC] bg-[#ECEBE4] px-3 py-1.5 text-sm font-medium text-[#5A5D5C] hover:bg-[#ECEBE4]"
              >
                Open full My work
              </button>
            </div>
          </div>

          <div className="mobile-work-tabs mt-5 border-b border-[#CCCABC] flex flex-wrap gap-0">
            {tabConfig.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'text-[#404040] border-b-2 border-[#BD000C]'
                    : 'text-[#8E8D83] hover:text-[#5A5D5C]'
                }`}
              >
                {tab.label} ({(workItems[tab.key] || []).length})
              </button>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-[#8E8D83]">
              {currentItems.length} {tabConfig.find((tab) => tab.key === activeTab)?.label.toLowerCase()} item{currentItems.length === 1 ? '' : 's'}
            </p>
            {hasOverflow && (
              <span className="text-xs text-[#B8B3A2]">Scroll to view more</span>
            )}
          </div>

          <div className="mt-3 rounded-lg border border-[#CCCABC] bg-white">
            <div className="work-dashboard-scroll overflow-y-scroll overflow-x-auto" style={{ height: `${PREVIEW_VIEWPORT_HEIGHT}px` }}>
              <table className="mobile-work-table w-full table-fixed min-w-[560px]">
                <thead className="sticky top-0 z-10 bg-[#F5F0E1] border-b border-[#CCCABC]">
                  <tr className="h-10">
                    <th className="w-[31%] text-left px-4 py-2 text-[11px] font-semibold tracking-[0.08em] text-[#8E8D83]">To</th>
                    <th className="w-[21%] text-left px-3 py-2 text-[11px] font-semibold tracking-[0.08em] text-[#8E8D83]">Forms</th>
                    <th className="w-[24%] text-left px-3 py-2 text-[11px] font-semibold tracking-[0.08em] text-[#8E8D83]">Status</th>
                    <th className="w-[9%] text-right px-2 py-2 text-[11px] font-semibold tracking-[0.08em] text-[#8E8D83]">{getDateColumnLabel()}</th>
                    <th className="w-[15%] text-right px-4 py-2 text-[11px] font-semibold tracking-[0.08em] text-[#8E8D83]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#CCCABC]/90">
                  {visibleItems.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-7 text-center text-sm text-[#8E8D83]">
                        No items in this tab
                      </td>
                    </tr>
                  )}

                  {visibleItems.map((item) => (
                    <tr key={item.id} className="h-[72px] odd:bg-white even:bg-[#F5F0E1]/20 hover:bg-[#ECEBE4]/30 transition-colors">
                      <td data-label="To" className="px-4 py-2 align-middle">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="inline-flex shrink-0 items-center rounded-md border border-[#CCCABC] bg-[#F5F0E1] px-2 py-0.5 text-[11px] font-semibold tracking-wide text-[#5A5D5C]">
                              {item.account}
                            </span>
                            {item.isMultiAccount && item.accounts && item.accounts.length > 1 && (
                              <span className="relative group inline-flex shrink-0">
                                <span className="inline-flex items-center rounded-md border border-[#CCCABC] bg-white px-2 py-0.5 text-[11px] font-medium text-[#8E8D83] cursor-default">
                                  +{item.accounts.length - 1}
                                </span>
                                <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-gray-900 bg-opacity-90 text-white text-[11px] rounded px-2 py-1 whitespace-nowrap z-20">
                                  {item.accounts.join(' · ')}
                                </div>
                              </span>
                            )}
                            {activeTab === 'drafts' && item.draftName && (
                              <span
                                title={item.draftName}
                                className="min-w-0 truncate text-[11px] font-medium text-[#5A5D5C]"
                              >
                                {item.draftName}
                              </span>
                            )}
                          </div>
                          <p
                            title={item.names}
                            className="text-sm font-medium text-[#404040] leading-5 truncate"
                          >
                            {item.names}
                          </p>
                        </div>
                      </td>
                      <td data-label="Forms" className="px-3 py-2 align-middle">
                        {renderFormChips(item.forms || [])}
                      </td>
                      <td data-label="Status" className="px-3 py-2 align-middle">
                        {renderStatusCell(item)}
                      </td>
                      <td data-label={getDateColumnLabel()} className="px-2 py-2 align-middle text-right text-sm text-[#8E8D83]">
                        {getDateValue(item)}
                      </td>
                      <td data-label="Actions" className="px-4 py-2 align-middle">
                        {renderActions(item)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <VoidReasonModal
        isOpen={voidModal.isOpen}
        onClose={() => setVoidModal({ isOpen: false, item: null })}
        onConfirm={handleVoidConfirm}
        envelopeName={voidModal.item ? `${voidModal.item.account} - ${voidModal.item.names}` : ''}
      />
    </>
  );
};
