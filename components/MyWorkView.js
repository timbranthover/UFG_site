const MyWorkView = ({ onBack, onLoadDraft, onDeleteDraft, workItems = MOCK_HISTORY, onVoidEnvelope, onEnvelopeStatusChange }) => {
  const [workTab, setWorkTab] = React.useState('inProgress');
  const [activeActionMenu, setActiveActionMenu] = React.useState(null);
  const [envelopeStatuses, setEnvelopeStatuses] = React.useState({});
  const [loadingActions, setLoadingActions] = React.useState({});
  const [isPolling, setIsPolling] = React.useState(false);
  const [lastRefreshed, setLastRefreshed] = React.useState(null);
  const [voidModal, setVoidModal] = React.useState({ isOpen: false, item: null });

  // Status badge config
  const STATUS_BADGES = {
    sent:      { bg: 'bg-[#FFF8EC]', text: 'text-[#AF8626]', border: 'border-[#DDB84E]', label: 'Sent' },
    delivered: { bg: 'bg-[#ECEBE4]', text: 'text-[#5A5D5C]', border: 'border-[#B8B3A2]', label: 'Viewed' },
    completed: { bg: 'bg-[#EBF5EF]', text: 'text-[#469A6C]', border: 'border-[#96CEAA]', label: 'Completed' },
    voided:    { bg: 'bg-[#FDF2F3]', text: 'text-[#AD3E4A]', border: 'border-[#EDAAB0]', label: 'Voided' },
    declined:  { bg: 'bg-[#FDF2F3]', text: 'text-[#AD3E4A]', border: 'border-[#EDAAB0]', label: 'Declined' }
  };
  const MAX_VISIBLE_FORM_CHIPS = 3;

  // Fetch status for all items with DocuSign envelope IDs (in parallel)
  const fetchAllStatuses = async () => {
    const allItems = [
      ...workItems.inProgress,
      ...workItems.completed,
      ...workItems.voided
    ].filter(item => item.docusignEnvelopeId);

    if (allItems.length === 0) return;

    setIsPolling(true);

    // Fire all API calls in parallel
    const results = await Promise.all(
      allItems.map(async (item) => {
        try {
          const result = await DocuSignService.getEnvelopeStatus(item.docusignEnvelopeId);
          return { item, result };
        } catch (err) {
          console.error('Error polling status for', item.docusignEnvelopeId, err);
          return { item, result: null };
        }
      })
    );

    // Process all results and batch update state
    const newStatuses = {};
    for (const { item, result } of results) {
      if (result && result.success) {
        newStatuses[item.docusignEnvelopeId] = result;

        // Auto-move items if DocuSign status changed to terminal state
        const isInProgress = workItems.inProgress.some(i => i.id === item.id);
        if (isInProgress && onEnvelopeStatusChange) {
          if (result.status === 'completed' || result.status === 'voided') {
            onEnvelopeStatusChange(item.id, result);
          }
        }
      }
    }

    setEnvelopeStatuses(prev => ({ ...prev, ...newStatuses }));
    setIsPolling(false);
    setLastRefreshed(new Date());
  };

  // Poll on mount and every 30 seconds
  React.useEffect(() => {
    fetchAllStatuses();
    const interval = setInterval(fetchAllStatuses, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close action menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = () => setActiveActionMenu(null);
    if (activeActionMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [activeActionMenu]);

  // Action handlers
  const handleResend = async (item) => {
    if (!item.docusignEnvelopeId) return;
    setLoadingActions(prev => ({ ...prev, [item.id]: 'resending' }));
    setActiveActionMenu(null);

    const result = await DocuSignService.resendEnvelope(item.docusignEnvelopeId);
    if (result.success) {
      showToast({ type: 'success', message: 'Notification resent', subtitle: 'The signer will receive a new email.' });
    } else {
      showToast({ message: 'Failed to resend', subtitle: result.error });
    }

    setLoadingActions(prev => { const next = { ...prev }; delete next[item.id]; return next; });
  };

  const handleVoid = (item) => {
    if (!item.docusignEnvelopeId) return;
    setActiveActionMenu(null);
    setVoidModal({ isOpen: true, item });
  };

  const handleVoidConfirm = async (reason) => {
    const item = voidModal.item;
    if (!item) return;

    setLoadingActions(prev => ({ ...prev, [item.id]: 'voiding' }));

    if (onVoidEnvelope) {
      await onVoidEnvelope(item, reason);
    }

    setLoadingActions(prev => { const next = { ...prev }; delete next[item.id]; return next; });
  };

  const handleDownload = async (item) => {
    if (!item.docusignEnvelopeId) return;
    setLoadingActions(prev => ({ ...prev, [item.id]: 'downloading' }));
    setActiveActionMenu(null);

    const result = await DocuSignService.downloadDocument(item.docusignEnvelopeId);
    if (!result.success) {
      showToast({ message: 'Failed to download', subtitle: result.error });
    }

    setLoadingActions(prev => { const next = { ...prev }; delete next[item.id]; return next; });
  };

  // Get recipient info from envelope status
  const getRecipientInfo = (item) => {
    if (!item.docusignEnvelopeId) return null;
    const status = envelopeStatuses[item.docusignEnvelopeId];
    if (!status || !status.recipients) return null;

    const signers = status.recipients.signers || [];
    const completed = signers.filter(s => s.status === 'completed').length;
    return { signers, completed, total: signers.length };
  };

  // Format relative time
  const formatTime = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  // Format date for saved drafts (M/D/YY format)
  const formatDateTime = (isoString) => {
    if (!isoString) return '—';
    const date = new Date(isoString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = String(date.getFullYear()).slice(-2);
    return `${month}/${day}/${year}`;
  };

  // Format date for sent envelopes (M/D/YY format)
  const formatSentDate = (isoString) => {
    if (!isoString) return '—';
    const date = new Date(isoString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = String(date.getFullYear()).slice(-2);
    return `${month}/${day}/${year}`;
  };

  // Render the hover popup with recipient detail
  const renderDetailPopup = (recipientInfo, envStatus) => {
    if (!recipientInfo && !envStatus) return null;

    return (
      <div className="absolute left-0 top-full mt-1.5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-20 w-60 bg-white rounded-lg shadow-lg border border-[#CCCABC] p-3 pointer-events-none">
        <div className="absolute -top-1 left-3 w-2 h-2 bg-white border-l border-t border-[#CCCABC] transform rotate-45"></div>
        {envStatus && envStatus.voidedReason && (
          <div className="text-xs text-[#7A7870] mb-2">
            <span className="font-medium">Reason:</span> {envStatus.voidedReason}
          </div>
        )}
        {recipientInfo && recipientInfo.signers.map(signer => (
          <div key={signer.recipientId || signer.email} className="flex items-center gap-1.5 text-xs text-[#7A7870] py-0.5">
            {signer.status === 'completed' ? (
              <svg className="w-3 h-3 text-[#469A6C] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : signer.status === 'delivered' ? (
              <svg className="w-3 h-3 text-[#8E8D83] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            ) : (
              <svg className="w-3 h-3 text-[#B8B3A2] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <span>{signer.name}: {signer.status === 'completed' ? 'Signed' : signer.status === 'delivered' ? 'Viewed' : 'Pending'}</span>
            {signer.signedDateTime && (
              <span className="text-[#B8B3A2] ml-auto flex-shrink-0">({formatTime(signer.signedDateTime)})</span>
            )}
          </div>
        ))}
      </div>
    );
  };

  // Render status cell for an item
  const renderStatusCell = (item) => {
    const envStatus = item.docusignEnvelopeId ? envelopeStatuses[item.docusignEnvelopeId] : null;
    const recipientInfo = getRecipientInfo(item);
    const loading = loadingActions[item.id];

    // Loading state
    if (loading) {
      const labels = { voiding: 'Voiding...', resending: 'Resending...', downloading: 'Downloading...' };
      return (
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-[#8E8D83] animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm" style={{ color: 'var(--app-gray-4)' }}>{labels[loading]}</span>
        </div>
      );
    }

    if (workTab === 'inProgress') {
      const signedCount = recipientInfo
        ? recipientInfo.completed
        : item.progress
          ? item.progress.signed
          : 0;
      const totalCount = recipientInfo
        ? recipientInfo.total
        : item.progress
          ? item.progress.total
          : 1;
      const progressPct = totalCount > 0 ? (signedCount / totalCount) * 100 : 0;
      const hasDetailPopup = !!(envStatus && (recipientInfo || envStatus.voidedReason));

      return (
        <div className="inline-flex items-center gap-2.5">
          <div className="relative group">
            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-[#FFF8EC] text-[#AF8626] cursor-default">
              Sent
            </span>
            {hasDetailPopup && renderDetailPopup(recipientInfo, envStatus)}
          </div>
          <div className="w-32 h-2.5 bg-[#ECEBE4] rounded-full">
            <div
              className="h-full bg-[#AF8626] rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-xs text-[#7A7870]">{signedCount}/{totalCount}</span>
        </div>
      );
    }

    // Real DocuSign status (or pending fetch for DocuSign items)
    if (item.docusignEnvelopeId) {
      // If we have status from API, use it; otherwise default to 'sent' while loading
      const status = envStatus?.status || 'sent';
      const badge = STATUS_BADGES[status] || { bg: 'bg-[#ECEBE4]', text: 'text-[#404040]', border: 'border-[#B8B3A2]', label: status };

      return (
        <div className="relative group inline-flex items-center gap-2">
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border cursor-default ${badge.bg} ${badge.text} ${badge.border}`}>
            {badge.label}
          </span>
          {/* Always show progress bar for in-progress items to prevent layout shift */}
          {workTab === 'inProgress' && status !== 'completed' && status !== 'voided' && (
            <div className="flex items-center gap-2">
              <div className="w-32 h-2.5 bg-[#ECEBE4] rounded-full">
                <div
                  className="h-full bg-[#AF8626] rounded-full transition-all duration-500"
                  style={{ width: `${recipientInfo && recipientInfo.total > 0 ? (recipientInfo.completed / recipientInfo.total) * 100 : 0}%` }}
                />
              </div>
              <span className="text-xs text-[#8E8D83]">
                {recipientInfo ? `${recipientInfo.completed}/${recipientInfo.total}` : '0/1'}
              </span>
            </div>
          )}
          {envStatus && (recipientInfo || envStatus.voidedReason) && renderDetailPopup(recipientInfo, envStatus)}
        </div>
      );
    }

    // Default mock display
    return (
      <div className="flex items-center gap-2">
        {workTab === 'completed' && (
          <svg className="w-4 h-4 text-[#469A6C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
        <span className="text-sm text-[#404040]">{item.status}</span>
      </div>
    );
  };

  // Render action buttons for an item
  const renderActionMenu = (item) => {
    const hasEnvelope = !!item.docusignEnvelopeId;

    return (
      <div className="mobile-actions-menu absolute right-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-[#CCCABC] py-1 z-10">
        {workTab === 'drafts' && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); onLoadDraft(item); setActiveActionMenu(null); }}
              className="w-full text-left px-4 py-2 text-sm text-[#5A5D5C] hover:bg-[#ECEBE4] flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Resume editing
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Delete draft "${item.draftName || 'Untitled'}"?`)) {
                  if (onDeleteDraft) onDeleteDraft(item);
                }
                setActiveActionMenu(null);
              }}
              className="w-full text-left px-4 py-2 text-sm text-[#AD3E4A] hover:bg-[#ECEBE4] flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete draft
            </button>
          </>
        )}
        {workTab === 'inProgress' && (
          <>
            {hasEnvelope && (
              <button
                onClick={(e) => { e.stopPropagation(); handleResend(item); }}
                className="w-full text-left px-4 py-2 text-sm text-[#5A5D5C] hover:bg-[#ECEBE4] flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Resend notification
              </button>
            )}
            {!hasEnvelope && (
              <button className="w-full text-left px-4 py-2 text-sm text-[#5A5D5C] hover:bg-[#ECEBE4] flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                View envelope
              </button>
            )}
            {hasEnvelope ? (
              <button
                onClick={(e) => { e.stopPropagation(); handleVoid(item); }}
                className="w-full text-left px-4 py-2 text-sm text-[#AD3E4A] hover:bg-[#ECEBE4] flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                Void envelope
              </button>
            ) : (
              <button className="w-full text-left px-4 py-2 text-sm text-[#AD3E4A] hover:bg-[#ECEBE4] flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Void envelope
              </button>
            )}
          </>
        )}
        {workTab === 'completed' && (
          <>
            {hasEnvelope && (
              <button
                onClick={(e) => { e.stopPropagation(); handleDownload(item); }}
                className="w-full text-left px-4 py-2 text-sm text-[#5A5D5C] hover:bg-[#ECEBE4] flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download signed PDF
              </button>
            )}
            <button className="w-full text-left px-4 py-2 text-sm text-[#5A5D5C] hover:bg-[#ECEBE4] flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              View details
            </button>
          </>
        )}
        {workTab === 'voided' && (
          <button className="w-full text-left px-4 py-2 text-sm text-[#5A5D5C] hover:bg-[#ECEBE4] flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            View details
          </button>
        )}
      </div>
    );
  };

  const tabConfig = [
    { key: 'drafts', label: 'Drafts' },
    { key: 'inProgress', label: 'In progress' },
    { key: 'completed', label: 'Completed' },
    { key: 'voided', label: 'Voided' }
  ];

  const renderFormChips = (forms = []) => {
    const visibleForms = forms.slice(0, MAX_VISIBLE_FORM_CHIPS);
    const hiddenForms = forms.slice(MAX_VISIBLE_FORM_CHIPS);

    return (
      <div className="flex flex-wrap items-start gap-1.5">
        {visibleForms.map(form => (
          <span key={form} className="inline-flex items-center rounded-md border border-[#CCCABC] bg-[#F5F0E1] px-2 py-0.5 text-xs font-medium text-[#5A5D5C]">
            {form}
          </span>
        ))}
        {hiddenForms.length > 0 && (
          <span className="relative group inline-flex">
            <span className="inline-flex items-center rounded-md border border-[#CCCABC] bg-white px-2 py-0.5 text-xs font-medium text-[#8E8D83] cursor-default">
              +{hiddenForms.length}
            </span>
            <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-gray-900 bg-opacity-90 text-white text-[11px] rounded px-2 py-1 whitespace-nowrap z-20">
              {forms.join(' · ')}
            </div>
          </span>
        )}
      </div>
    );
  };

  return (
    <>
    <div className="mobile-my-work-view space-y-6">
      <div className="mobile-work-header flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-semibold text-[#404040]">My work</h2>
          {isPolling && (
            <svg className="w-4 h-4 text-[#8E8D83] animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          )}
        </div>
        <div className="mobile-work-header-actions flex items-center gap-3">
          {lastRefreshed && (
            <span className="text-xs text-[#B8B3A2]">Updated {formatTime(lastRefreshed.toISOString())}</span>
          )}
          <button
            onClick={fetchAllStatuses}
            disabled={isPolling}
            className="text-sm hover:underline flex items-center gap-1 disabled:opacity-50"
            style={{ color: '#00759E' }}
          >
            <svg className={`w-4 h-4 ${isPolling ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
          <button
            onClick={onBack}
            className="text-sm hover:underline"
            style={{ color: '#00759E' }}
          >
            Back to search
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-[#CCCABC]">
        <div className="mobile-work-tabs border-b border-[#CCCABC] flex gap-1 p-2">
          {tabConfig.map(tab => (
            <button
              key={tab.key}
              onClick={() => setWorkTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium rounded ${
                workTab === tab.key
                  ? 'bg-[#ECEBE4] text-[#5A5D5C]'
                  : 'text-[#7A7870] hover:bg-[#ECEBE4]'
              }`}
            >
              {tab.label} ({workItems[tab.key].length})
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
        <table className="mobile-work-table w-full table-fixed min-w-[560px]">
          <thead className="bg-[#F5F0E1]/90 border-b border-[#CCCABC]">
            <tr className="h-11">
              <th className="w-[30%] text-left px-6 py-3 text-[11px] font-semibold tracking-[0.08em] text-[#8E8D83]">To</th>
              <th className="w-[23%] text-left px-6 py-3 text-[11px] font-semibold tracking-[0.08em] text-[#8E8D83]">Forms</th>
              <th className="w-[23%] text-left px-6 py-3 text-[11px] font-semibold tracking-[0.08em] text-[#8E8D83]">Status</th>
              {workTab === 'drafts' && (
                <th className="w-[14%] text-left px-6 py-3 text-[11px] font-semibold tracking-[0.08em] text-[#8E8D83]">Saved</th>
              )}
              {workTab === 'inProgress' && (
                <th className="w-[14%] text-left px-6 py-3 text-[11px] font-semibold tracking-[0.08em] text-[#8E8D83]">Sent</th>
              )}
              <th className="w-[10%] whitespace-nowrap text-right px-6 py-3 text-[11px] font-semibold tracking-[0.08em] text-[#8E8D83]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#CCCABC]/90">
            {workItems[workTab].length === 0 && (
              <tr>
                <td colSpan={(workTab === 'drafts' || workTab === 'inProgress') ? 5 : 4} className="px-6 py-8 text-center text-sm text-[#8E8D83]">
                  No items in this tab
                </td>
              </tr>
            )}
            {workItems[workTab].map((item) => (
              <tr key={item.id} className="odd:bg-white even:bg-[#F5F0E1]/20 hover:bg-[#ECEBE4]/30 transition-colors">
                <td data-label="To" className="px-6 py-4 align-middle">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center rounded-md border border-[#CCCABC] bg-[#F5F0E1] px-2 py-0.5 text-xs font-semibold tracking-wide text-[#5A5D5C]">
                        {item.account}
                      </span>
                      {item.isMultiAccount && item.accounts && item.accounts.length > 1 && (
                        <span className="relative group inline-flex">
                          <span className="inline-flex items-center rounded-md border border-[#CCCABC] bg-white px-2 py-0.5 text-xs font-medium text-[#8E8D83] cursor-default">
                            +{item.accounts.length - 1}
                          </span>
                          <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-gray-900 bg-opacity-90 text-white text-[11px] rounded px-2 py-1 whitespace-nowrap z-20">
                            {item.accounts.join(' · ')}
                          </div>
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-[#404040] leading-5">{item.names}</p>
                  </div>
                  {item.draftName && workTab === 'drafts' && (
                    <div className="text-xs text-[#5A5D5C] mt-1.5 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      {item.draftName}
                    </div>
                  )}
                </td>
                <td data-label="Forms" className="px-6 py-4 align-middle">
                  {renderFormChips(item.forms)}
                </td>
                <td data-label="Status" className="px-6 py-4 align-middle">
                  {renderStatusCell(item)}
                </td>
                {workTab === 'drafts' && (
                  <td data-label="Saved" className="px-6 py-4 text-sm text-[#8E8D83] align-middle">
                    {formatDateTime(item.savedAt)}
                  </td>
                )}
                {workTab === 'inProgress' && (
                  <td data-label="Sent" className="px-6 py-4 text-sm text-[#8E8D83] align-middle">
                    {formatSentDate(item.sentAt)}
                  </td>
                )}
                <td data-label="Actions" className="px-6 py-4 text-right align-middle relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setActiveActionMenu(activeActionMenu === item.id ? null : item.id); }}
                    aria-label="Open row actions"
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
                      activeActionMenu === item.id
                        ? 'border-[#CCCABC] bg-[#ECEBE4] text-[#5A5D5C]'
                        : 'border-[#CCCABC] bg-white text-[#8E8D83] hover:border-[#B8B3A2] hover:bg-[#ECEBE4] hover:text-[#5A5D5C]'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </button>

                  {activeActionMenu === item.id && renderActionMenu(item)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>

    {/* Void Reason Modal */}
    <VoidReasonModal
      isOpen={voidModal.isOpen}
      onClose={() => setVoidModal({ isOpen: false, item: null })}
      onConfirm={handleVoidConfirm}
      envelopeName={voidModal.item ? `${voidModal.item.account} — ${voidModal.item.names}` : ''}
    />

    </>
  );
};
