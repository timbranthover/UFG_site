const ResultsView = ({ account, onBack, onContinue }) => {
  // ── Single-mode state ────────────────────────────────────────────────────────
  const [selectedForms, setSelectedForms] = React.useState([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const debouncedQuery = useDebounce(searchQuery);

  // ── Multi-mode state ─────────────────────────────────────────────────────────
  const [additionalAccounts, setAdditionalAccounts] = React.useState([]);
  const [perAccountForms, setPerAccountForms] = React.useState({});
  const [showAccountPicker, setShowAccountPicker] = React.useState(false);
  const [sectionQueries, setSectionQueries] = React.useState({});
  const [expandedSections, setExpandedSections] = React.useState({});

  const isMultiMode = additionalAccounts.length > 0;

  const allAccounts = React.useMemo(
    () => [account, ...additionalAccounts],
    [account, additionalAccounts]
  );

  const compatibilityInfo = React.useMemo(
    () => canAccountsShareEnvelope(allAccounts),
    [allAccounts]
  );

  // ── Multi-mode CTA logic ─────────────────────────────────────────────────────
  const multiFormCount = isMultiMode
    ? Object.values(perAccountForms).reduce((sum, arr) => sum + arr.length, 0)
    : 0;

  const allAccountsHaveForms = isMultiMode
    ? allAccounts.every(a => (perAccountForms[a.accountNumber] || []).length > 0)
    : true;

  const canContinueMulti = isMultiMode && allAccountsHaveForms && multiFormCount > 0 && compatibilityInfo.compatible;

  // ── Single-mode catalog search ───────────────────────────────────────────────
  const searchResult = React.useMemo(
    () => searchFormsCatalog(debouncedQuery, { limit: debouncedQuery.trim() ? 40 : FORMS_DATA.length }),
    [debouncedQuery]
  );
  const filteredForms = searchResult.items;

  // ── Form toggle handlers ─────────────────────────────────────────────────────
  const toggleFormSelection = (form) => {
    if (!isFormSelectableForAccount(form, account)) return;
    setSelectedForms(prev =>
      prev.includes(form.code) ? prev.filter(f => f !== form.code) : [...prev, form.code]
    );
  };

  const togglePerAccountForm = (accountNumber, form) => {
    const acct = MOCK_ACCOUNTS[accountNumber] || account;
    if (!isFormSelectableForAccount(form, acct)) return;
    setPerAccountForms(prev => {
      const current = prev[accountNumber] || [];
      return {
        ...prev,
        [accountNumber]: current.includes(form.code)
          ? current.filter(c => c !== form.code)
          : [...current, form.code]
      };
    });
  };

  // ── Add / remove accounts ────────────────────────────────────────────────────
  const handleAddAccounts = (newAccts) => {
    const seedPrimary = additionalAccounts.length === 0;
    const newPerAccount = {};
    const newExpanded = {};
    for (const acct of newAccts) {
      newPerAccount[acct.accountNumber] = [];
      newExpanded[acct.accountNumber] = true;
    }
    if (seedPrimary) {
      setPerAccountForms({ [account.accountNumber]: [...selectedForms], ...newPerAccount });
    } else {
      setPerAccountForms(prev => ({ ...prev, ...newPerAccount }));
    }
    setAdditionalAccounts(prev => [...prev, ...newAccts]);
    setExpandedSections(prev => ({ ...prev, ...newExpanded }));
    setShowAccountPicker(false);
  };

  const handleRemoveAccount = (acctToRemove) => {
    const newAdditional = additionalAccounts.filter(a => a.accountNumber !== acctToRemove.accountNumber);
    if (newAdditional.length === 0) {
      setSelectedForms(perAccountForms[account.accountNumber] || []);
      setPerAccountForms({});
    } else {
      setPerAccountForms(prev => {
        const next = { ...prev };
        delete next[acctToRemove.accountNumber];
        return next;
      });
    }
    setAdditionalAccounts(newAdditional);
  };

  // ── Continue handler ─────────────────────────────────────────────────────────
  const handleContinue = () => {
    if (isMultiMode) {
      if (!canContinueMulti) return;
      onContinue(
        Object.values(perAccountForms).flat(),
        { accounts: allAccounts.map(a => ({ account: a, forms: perAccountForms[a.accountNumber] || [] })) }
      );
    } else {
      const selectableForms = selectedForms.filter(code => {
        const form = FORMS_DATA.find(item => item.code === code);
        return form ? isFormSelectableForAccount(form, account) : false;
      });
      if (!selectableForms.length) return;
      onContinue(selectableForms, null);
    }
  };

  const isIncompatible = (acct) =>
    Array.isArray(compatibilityInfo.incompatibleAccounts) &&
    compatibilityInfo.incompatibleAccounts.includes(acct.accountNumber);

  // ── Account type badge ───────────────────────────────────────────────────────
  const AccountTypeBadge = ({ acct }) => {
    const typeColors = {
      RMA_INDIVIDUAL: 'bg-blue-50 text-blue-700 border-blue-200',
      RMA_JOINT:      'bg-purple-50 text-purple-700 border-purple-200',
      TRUST:          'bg-amber-50 text-amber-700 border-amber-200',
      IRA_ROTH:       'bg-emerald-50 text-emerald-700 border-emerald-200',
      IRA_TRADITIONAL:'bg-teal-50 text-teal-700 border-teal-200',
    };
    const cls = typeColors[acct.accountTypeKey] || 'bg-gray-50 text-gray-600 border-gray-200';
    return (
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border tracking-wide ${cls}`}>
        {acct.accountType}
      </span>
    );
  };

  // ── Account Picker Modal ─────────────────────────────────────────────────────
  const AccountPickerModal = () => {
    const [pendingSelections, setPendingSelections] = React.useState(new Set());

    const existingNumbers = new Set(allAccounts.map(a => a.accountNumber));
    // Only show accounts that share at least one signer name with the primary account
    const primarySignerNames = new Set(account.signers.map(s => s.name.toLowerCase()));
    const related = Object.values(MOCK_ACCOUNTS).filter(a =>
      !existingNumbers.has(a.accountNumber) &&
      a.signers.some(s => primarySignerNames.has(s.name.toLowerCase()))
    );
    const withCompat = related.map(candidate => {
      const check = canAccountsShareEnvelope([...allAccounts, candidate]);
      return { account: candidate, compatible: check.compatible, reason: check.reason };
    });
    const compatible = withCompat.filter(c => c.compatible);
    const incompatible = withCompat.filter(c => !c.compatible);

    const toggleSelection = (acctNum) => {
      setPendingSelections(prev => {
        const next = new Set(prev);
        if (next.has(acctNum)) next.delete(acctNum); else next.add(acctNum);
        return next;
      });
    };

    const selectedCount = [...pendingSelections].filter(num =>
      compatible.some(c => c.account.accountNumber === num)
    ).length;

    const handleConfirm = () => {
      if (selectedCount === 0) return;
      const newAccts = compatible
        .filter(c => pendingSelections.has(c.account.accountNumber))
        .map(c => c.account);
      if (newAccts.length === 0) return;
      handleAddAccounts(newAccts);
    };

    React.useEffect(() => {
      const onKey = (e) => { if (e.key === 'Escape') setShowAccountPicker(false); };
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    }, []);

    return (
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black bg-opacity-40"
          onClick={() => setShowAccountPicker(false)}
        />

        {/* Panel */}
        <div
          className="relative bg-white w-full max-w-md flex flex-col overflow-hidden"
          style={{ borderRadius: 'var(--app-radius)', boxShadow: '0 24px 64px -12px rgba(0,0,0,0.35)', border: '1px solid var(--app-card-border)', maxHeight: 'min(72vh, 540px)' }}
        >
          {/* Header */}
          <div className="px-5 pt-4 pb-3.5 border-b flex items-start justify-between flex-shrink-0" style={{ borderColor: 'var(--app-card-border)' }}>
            <div>
              <h2 className="text-base font-semibold" style={{ color: 'var(--app-gray-6)' }}>Add accounts to envelope</h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--app-gray-4)' }}>
                Showing related accounts with shared signers. Select one or more.
              </p>
            </div>
            <button
              onClick={() => setShowAccountPicker(false)}
              className="p-1 rounded hover:bg-gray-100 ml-3 flex-shrink-0"
              style={{ color: 'var(--app-gray-4)' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Scrollable account list */}
          <div className="overflow-y-auto flex-1 min-h-0">
            {related.length === 0 && (
              <div className="px-5 py-8 text-center">
                <p className="text-sm" style={{ color: 'var(--app-gray-4)' }}>No related accounts available to add.</p>
              </div>
            )}

            {compatible.map(({ account: cand }) => {
              const isSelected = pendingSelections.has(cand.accountNumber);
              return (
                <button
                  key={cand.accountNumber}
                  onClick={() => toggleSelection(cand.accountNumber)}
                  className={`w-full text-left px-5 py-3.5 border-b transition-colors flex items-start gap-3 ${
                    isSelected ? 'bg-[#F5F0E1]' : 'hover:bg-[#F5F0E1]/60'
                  }`}
                  style={{ borderColor: 'var(--app-card-border)' }}
                >
                  {/* Checkbox */}
                  <div
                    className={`mt-0.5 w-4 h-4 rounded flex-shrink-0 border-2 flex items-center justify-center transition-all ${
                      isSelected ? 'bg-[#8A000A] border-[#8A000A]' : 'bg-white border-[#CCCABC]'
                    }`}
                  >
                    {isSelected && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-mono text-sm font-bold" style={{ color: 'var(--app-bordeaux-1)' }}>{cand.accountNumber}</span>
                      <span className="text-sm font-medium" style={{ color: 'var(--app-gray-6)' }}>{cand.accountName}</span>
                      <AccountTypeBadge acct={cand} />
                    </div>
                    <p className="text-xs" style={{ color: 'var(--app-gray-4)' }}>
                      {cand.signers.map(s => s.name).join(' · ')}
                    </p>
                  </div>
                </button>
              );
            })}

            {incompatible.length > 0 && (
              <>
                <div
                  className="px-5 py-2 text-[11px] font-semibold uppercase tracking-widest"
                  style={{ backgroundColor: 'var(--app-pastel-2)', color: 'var(--app-gray-4)', borderBottom: '1px solid var(--app-card-border)' }}
                >
                  Not compatible with this envelope
                </div>
                {incompatible.map(({ account: cand, reason }) => (
                  <div
                    key={cand.accountNumber}
                    className="px-5 py-3.5 border-b opacity-50 flex items-start gap-3"
                    style={{ borderColor: 'var(--app-card-border)' }}
                  >
                    {/* Disabled checkbox placeholder for alignment */}
                    <div className="mt-0.5 w-4 h-4 rounded flex-shrink-0 border-2 bg-white border-[#CCCABC]" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="font-mono text-sm font-bold" style={{ color: 'var(--app-gray-4)' }}>{cand.accountNumber}</span>
                        <span className="text-sm font-medium" style={{ color: 'var(--app-gray-5)' }}>{cand.accountName}</span>
                        <AccountTypeBadge acct={cand} />
                      </div>
                      <p className="text-xs" style={{ color: '#8B5E0A' }}>{reason}</p>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Footer with confirm button */}
          <div
            className="flex items-center justify-between px-5 py-3 border-t flex-shrink-0"
            style={{ borderColor: 'var(--app-card-border)', backgroundColor: 'var(--app-pastel-1)' }}
          >
            <button
              onClick={() => setShowAccountPicker(false)}
              className="text-sm px-3 py-1.5 rounded transition-colors hover:bg-gray-100"
              style={{ color: 'var(--app-gray-4)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedCount === 0}
              className="text-sm font-semibold px-4 py-1.5 rounded transition-all text-white"
              style={{
                backgroundColor: selectedCount > 0 ? 'var(--app-bordeaux-1)' : 'var(--app-gray-2)',
                opacity: selectedCount === 0 ? 0.55 : 1,
                cursor: selectedCount === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              {selectedCount === 0
                ? 'Select accounts'
                : `Add ${selectedCount} account${selectedCount > 1 ? 's' : ''} →`
              }
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="mobile-results-view space-y-6 max-w-5xl pb-24">

      {/* Account picker modal */}
      {showAccountPicker && <AccountPickerModal />}

      {/* Nav row */}
      <div className="mobile-results-header flex items-center justify-between">
        <button onClick={onBack} className="text-sm hover:underline" style={{ color: '#00759E' }}>
          ← Back to search
        </button>
        <div className={`min-h-[24px] flex items-center transition-opacity duration-150 ${!isMultiMode && selectedForms.length > 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <span className="text-sm" style={{ color: 'var(--app-gray-4)' }}>
            {selectedForms.length} form{selectedForms.length > 1 ? 's' : ''} selected
          </span>
        </div>
      </div>

      {/* ── SINGLE MODE ── */}
      {!isMultiMode && (
        <div className="mobile-results-card bg-white p-6" style={{ borderRadius: 'var(--app-radius)', border: '1px solid var(--app-card-border)', boxShadow: 'var(--app-card-shadow)' }}>

          {/* Account header */}
          <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
            <div>
              <h2 className="text-lg font-medium" style={{ color: 'var(--app-gray-6)' }}>Account {account.accountNumber}</h2>
              <p className="text-sm" style={{ color: 'var(--app-gray-4)' }}>{account.accountName} · {account.accountType}</p>
            </div>
            <button
              onClick={() => setShowAccountPicker(true)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors hover:bg-blue-50"
              style={{ color: '#00759E', borderColor: '#00759E' }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add account to envelope
            </button>
          </div>

          {/* Search bar */}
          <div className="mb-6">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="w-5 h-5" style={{ color: 'var(--app-gray-3)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search forms by name, code, or keyword (e.g., 'acat', 'transfer', 'ira')..."
                className="w-full pl-10 pr-4 py-3 text-sm focus:outline-none"
                style={{ border: '1px solid var(--app-input-border)', borderRadius: 'var(--app-radius)' }}
                onFocus={e => { e.target.style.boxShadow = '0 0 0 2px rgba(138,0,10,0.18)'; }}
                onBlur={e => { e.target.style.boxShadow = 'none'; }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <svg className="w-5 h-5" style={{ color: 'var(--app-gray-3)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <p className="mt-2 text-xs" style={{ color: 'var(--app-gray-3)' }}>
              Showing {filteredForms.length}{searchResult.limited ? ' top' : ''} of {searchResult.totalMatches} matching forms from {FORMS_DATA.length} total
              {debouncedQuery && ` matching "${debouncedQuery}"`}
            </p>
          </div>

          {/* Form rows */}
          <div className="space-y-3">
            {filteredForms.length > 0 ? (
              filteredForms.map(form => {
                const isSelected = selectedForms.includes(form.code);
                const canSelectForm = isFormSelectableForAccount(form, account);
                const disabledReason = getFormSelectionDisabledReason(form, account);
                return (
                  <div
                    key={form.code}
                    onClick={() => toggleFormSelection(form)}
                    className={`mobile-results-row flex items-center gap-4 p-4 border rounded-md transition-all motion-press ${
                      canSelectForm ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                    } ${isSelected ? 'border-[#B8B3A2] bg-[#F5F0E1]' : 'border-[#CCCABC] hover:border-[#B8B3A2] hover:bg-[#ECEBE4]/40'}`}
                  >
                    <input type="checkbox" checked={isSelected} onChange={() => {}} disabled={!canSelectForm} className="w-5 h-5 rounded pointer-events-none accent-[#404040]" />
                    <div className="mobile-results-row-main flex-1 min-w-0">
                      <div className="mobile-results-row-title flex items-center gap-3">
                        <span className="font-mono text-sm font-medium" style={{ color: 'var(--app-gray-6)' }}>{form.code}</span>
                        <span className="text-sm" style={{ color: '#00759E' }}>{form.name}</span>
                      </div>
                      <p className="text-xs mt-1" style={{ color: 'var(--app-gray-3)' }}>{form.description}</p>
                      {disabledReason && <p className="text-xs mt-1" style={{ color: 'var(--app-bronze-2)' }}>{disabledReason}</p>}
                    </div>
                    {!form.eSignEnabled ? (
                      <div className="mobile-results-badge flex items-center gap-2 px-3 py-1 rounded text-sm" style={{ backgroundColor: 'var(--app-pastel-1)', color: 'var(--app-gray-4)' }}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                        Print only
                      </div>
                    ) : canSelectForm ? (
                      <div className="mobile-results-badge flex items-center gap-2 px-3 py-1 rounded text-sm font-medium" style={{ backgroundColor: '#EDF6FD', color: '#0C7EC6' }}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                        eSign
                      </div>
                    ) : (
                      <div className="mobile-results-badge flex items-center gap-2 px-3 py-1 rounded text-sm font-medium" style={{ backgroundColor: 'var(--app-pastel-2)', color: 'var(--app-bronze-2)' }}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M4.93 19h14.14c1.54 0 2.5-1.67 1.73-3L13.73 3.7c-.77-1.33-2.69-1.33-3.46 0L3.2 16c-.77 1.33.19 3 1.73 3z" /></svg>
                        Unavailable
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12">
                <svg className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--app-gray-2)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="mb-2" style={{ color: 'var(--app-gray-4)' }}>No forms found matching "{searchQuery}"</p>
                <p className="text-sm" style={{ color: 'var(--app-gray-3)' }}>Try searching by form code, name, or keyword</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MULTI MODE ── */}
      {isMultiMode && (
        <div className="space-y-2">

          {/* Multi-mode header card */}
          <div
            className="bg-white px-5 py-4"
            style={{ borderRadius: 'var(--app-radius)', border: '1px solid var(--app-card-border)', boxShadow: 'var(--app-card-shadow)' }}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold" style={{ color: 'var(--app-gray-6)' }}>
                  Multi-account envelope
                </h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--app-gray-4)' }}>
                  {allAccounts.length} accounts · {multiFormCount} form{multiFormCount !== 1 ? 's' : ''} selected
                </p>
              </div>
              {allAccounts.length < 5 && (
                <button
                  onClick={() => setShowAccountPicker(true)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors hover:bg-blue-50 flex-shrink-0"
                  style={{ color: '#00759E', borderColor: '#00759E' }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add account
                </button>
              )}
            </div>

            {/* Compatibility warning */}
            {!compatibilityInfo.compatible && (
              <div
                className="flex items-start gap-2 px-3 py-2.5 rounded-md text-sm mt-3"
                style={{ backgroundColor: '#FFF8E1', color: '#8B5E0A', border: '1px solid #F5C842' }}
              >
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M4.93 19h14.14c1.54 0 2.5-1.67 1.73-3L13.73 3.7c-.77-1.33-2.69-1.33-3.46 0L3.2 16c-.77 1.33.19 3 1.73 3z" />
                </svg>
                <span>{compatibilityInfo.reason} — remove the highlighted account to continue.</span>
              </div>
            )}
          </div>

          {/* Per-account collapsible form sections */}
          {allAccounts.map((acct, acctIdx) => {
            const selected = perAccountForms[acct.accountNumber] || [];
            const bad = isIncompatible(acct);
            const isExpanded = expandedSections[acct.accountNumber] !== false;
            const sectionQuery = sectionQueries[acct.accountNumber] || '';
            const sectionResult = searchFormsCatalog(sectionQuery, { limit: sectionQuery.trim() ? 40 : FORMS_DATA.length });
            const sectionForms = sectionResult.items;

            return (
              <div
                key={acct.accountNumber}
                className="bg-white overflow-hidden"
                style={{
                  borderRadius: 'var(--app-radius)',
                  border: `1px solid ${bad ? '#F5C842' : 'var(--app-card-border)'}`,
                  boxShadow: 'var(--app-card-shadow)'
                }}
              >
                {/* Section header — click to collapse */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
                  style={{ backgroundColor: bad ? '#FFFBF0' : 'var(--app-pastel-1)' }}
                  onClick={() => setExpandedSections(prev => ({ ...prev, [acct.accountNumber]: !isExpanded }))}
                >
                  <svg
                    className={`w-4 h-4 flex-shrink-0 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
                    style={{ color: 'var(--app-gray-4)' }}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>

                  <span className="font-mono text-sm font-bold" style={{ color: bad ? '#8B5E0A' : 'var(--app-bordeaux-1)' }}>
                    {acct.accountNumber}
                  </span>
                  <span className="text-sm font-medium" style={{ color: 'var(--app-gray-6)' }}>{acct.accountName}</span>
                  <AccountTypeBadge acct={acct} />

                  <div className="ml-auto flex items-center gap-3">
                    {selected.length > 0 && (
                      <span className="text-xs font-medium" style={{ color: '#00759E' }}>
                        {selected.length} form{selected.length !== 1 ? 's' : ''} selected
                      </span>
                    )}
                    {acct.accountNumber !== account.accountNumber && (
                      <button
                        onClick={e => { e.stopPropagation(); handleRemoveAccount(acct); }}
                        className="p-1 rounded hover:bg-red-50 transition-colors"
                        style={{ color: 'var(--app-gray-3)' }}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Section body — full form search */}
                {isExpanded && (
                  <div className="p-5 border-t" style={{ borderColor: bad ? '#F5C842' : 'var(--app-card-border)' }}>

                    {/* Search input */}
                    <div className="relative mb-4">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="w-4 h-4" style={{ color: 'var(--app-gray-3)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        value={sectionQuery}
                        onChange={e => setSectionQueries(prev => ({ ...prev, [acct.accountNumber]: e.target.value }))}
                        placeholder={`Search forms for ${acct.accountNumber}…`}
                        className="w-full pl-9 pr-9 py-2.5 text-sm focus:outline-none"
                        style={{ border: '1px solid var(--app-input-border)', borderRadius: 'var(--app-radius)' }}
                        onFocus={e => { e.target.style.boxShadow = '0 0 0 2px rgba(138,0,10,0.18)'; }}
                        onBlur={e => { e.target.style.boxShadow = 'none'; }}
                        onClick={e => e.stopPropagation()}
                      />
                      {sectionQuery && (
                        <button
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                          onClick={e => { e.stopPropagation(); setSectionQueries(prev => ({ ...prev, [acct.accountNumber]: '' })); }}
                        >
                          <svg className="w-4 h-4" style={{ color: 'var(--app-gray-3)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>

                    {/* Form rows */}
                    <div className="space-y-2">
                      {sectionForms.length > 0 ? (
                        sectionForms.map(form => {
                          const isSelected = selected.includes(form.code);
                          const canSelectForm = isFormSelectableForAccount(form, acct);
                          const disabledReason = getFormSelectionDisabledReason(form, acct);

                          return (
                            <div
                              key={form.code}
                              onClick={() => togglePerAccountForm(acct.accountNumber, form)}
                              className={`flex items-center gap-3 p-3 border rounded-md transition-all motion-press ${
                                canSelectForm ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                              } ${isSelected ? 'border-[#B8B3A2] bg-[#F5F0E1]' : 'border-[#CCCABC] hover:border-[#B8B3A2] hover:bg-[#ECEBE4]/40'}`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                disabled={!canSelectForm}
                                className="w-4 h-4 rounded pointer-events-none accent-[#404040] flex-shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-xs font-semibold" style={{ color: 'var(--app-gray-6)' }}>{form.code}</span>
                                  <span className="text-sm" style={{ color: '#00759E' }}>{form.name}</span>
                                </div>
                                <p className="text-xs mt-0.5" style={{ color: 'var(--app-gray-3)' }}>{form.description}</p>
                                {disabledReason && <p className="text-xs mt-0.5" style={{ color: 'var(--app-bronze-2)' }}>{disabledReason}</p>}
                              </div>
                              {!form.eSignEnabled ? (
                                <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--app-pastel-1)', color: 'var(--app-gray-4)' }}>Print only</span>
                              ) : canSelectForm ? (
                                <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded font-medium" style={{ backgroundColor: '#EDF6FD', color: '#0C7EC6' }}>eSign</span>
                              ) : (
                                <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--app-pastel-2)', color: 'var(--app-bronze-2)' }}>Unavailable</span>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-sm" style={{ color: 'var(--app-gray-4)' }}>No forms found matching "{sectionQuery}"</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Floating CTA ── */}
      {(isMultiMode || selectedForms.length > 0) && (
        <div className="mobile-floating-action-wrap fixed bottom-5 inset-x-4 sm:inset-x-auto sm:right-6 z-30 flex justify-end pointer-events-none">
          <div className="pointer-events-auto floating-glass">
            {!isMultiMode && (
              <button onClick={() => setSelectedForms([])} className="floating-clear hidden sm:inline-flex">
                Clear selection
              </button>
            )}
            <button
              onClick={handleContinue}
              disabled={isMultiMode && !canContinueMulti}
              className={`floating-action ${isMultiMode && !canContinueMulti ? 'is-disabled' : ''}`}
            >
              {isMultiMode
                ? canContinueMulti
                  ? `Continue · ${multiFormCount} form${multiFormCount !== 1 ? 's' : ''} · ${allAccounts.length} accounts`
                  : !compatibilityInfo.compatible
                    ? 'Resolve account conflicts'
                    : 'Select forms for each account'
                : `Continue with ${selectedForms.length} form${selectedForms.length > 1 ? 's' : ''}`
              }
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
