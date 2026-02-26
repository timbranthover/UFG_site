const App = () => {
  const [isAdmin] = React.useState(() => initializeAdminSessionFromUrl());
  const [formsCatalog, setFormsCatalog] = React.useState(() => initializeAdminFormsCatalog());
  const [operationsUpdate, setOperationsUpdate] = React.useState(() => getAdminOperationsUpdate());
  const [view, setView] = React.useState(() => (
    window.location.hash === '#admin' && isAdminUser() ? 'admin' : 'landing'
  ));
  const [currentAccount, setCurrentAccount] = React.useState(null);
  const [selectedForms, setSelectedForms] = React.useState([]);
  const [draftData, setDraftData] = React.useState(null);
  const [multiAccountData, setMultiAccountData] = React.useState(null);
  const [searchError, setSearchError] = React.useState(null);
  const [confetti, setConfetti] = React.useState([]);
  const [savedFormCodes, setSavedFormCodes] = React.useState(() => {
    try {
      const saved = localStorage.getItem('formsLibrary_savedFormCodes');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Error loading saved forms from localStorage:', error);
      return [];
    }
  });
  const [formsLibrarySeed, setFormsLibrarySeed] = React.useState(null);
  const [showMultiStartModal, setShowMultiStartModal] = React.useState(false);
  const [initialAdditionalAccounts, setInitialAdditionalAccounts] = React.useState([]);

  // Konami Code Easter Egg: ↑ ↑ ↓ ↓ ← → ← → B A
  React.useEffect(() => {
    const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
    let konamiIndex = 0;

    const handleKeyDown = (e) => {
      if (e.code === konamiCode[konamiIndex]) {
        konamiIndex++;
        if (konamiIndex === konamiCode.length) {
          // Trigger the party!
          const colors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4'];
          const newConfetti = Array.from({ length: 150 }, (_, i) => ({
            id: i,
            x: Math.random() * 100,
            color: colors[Math.floor(Math.random() * colors.length)],
            delay: Math.random() * 0.5,
            duration: 2 + Math.random() * 2,
            size: 6 + Math.random() * 8,
            rotation: Math.random() * 360
          }));
          setConfetti(newConfetti);
          showToast({ type: 'party', message: '🎉 You found the secret! 🎉', subtitle: 'Nice work, code wizard!' });
          setTimeout(() => setConfetti([]), 4000);
          konamiIndex = 0;
        }
      } else {
        konamiIndex = 0;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const clearAdminHash = React.useCallback(() => {
    const currentUrl = new URL(window.location.href);
    if (currentUrl.hash !== '#admin') return;
    currentUrl.hash = '';
    window.history.replaceState({}, '', currentUrl.toString());
  }, []);

  React.useEffect(() => {
    if (view === 'admin') {
      if (!isAdmin) {
        clearAdminHash();
        setView('landing');
        showToast({
          message: 'Admin access required',
          subtitle: 'This workspace is only available to admin users.'
        });
        return;
      }

      if (window.location.hash !== '#admin') {
        const currentUrl = new URL(window.location.href);
        currentUrl.hash = 'admin';
        window.history.replaceState({}, '', currentUrl.toString());
      }
      return;
    }

    clearAdminHash();
  }, [view, isAdmin, clearAdminHash]);

  React.useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash !== '#admin') return;

      if (isAdmin) {
        setView('admin');
      } else {
        clearAdminHash();
        setView('landing');
        showToast({
          message: 'Admin access required',
          subtitle: 'Direct access to /#admin is blocked for non-admin users.'
        });
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [isAdmin, clearAdminHash]);

  const [workItems, setWorkItems] = React.useState(loadWorkItems);

  React.useEffect(() => {
    saveWorkItems(workItems);
  }, [workItems]);

  React.useEffect(() => {
    try {
      localStorage.setItem('formsLibrary_savedFormCodes', JSON.stringify(savedFormCodes));
    } catch (error) {
      console.error('Error saving saved forms to localStorage:', error);
    }
  }, [savedFormCodes]);

  const handleToggleSavedForm = (formCode) => {
    setSavedFormCodes((prev) => (
      prev.includes(formCode)
        ? prev.filter((code) => code !== formCode)
        : [formCode, ...prev]
    ));
  };

  const handleAdminSaveForm = (formPayload) => {
    const result = upsertAdminForm(formPayload);
    setFormsCatalog(result.formsCatalog);
    return result;
  };

  const handleAdminSaveOperationsUpdate = (nextValue) => {
    const saved = saveAdminOperationsUpdate(nextValue);
    setOperationsUpdate(saved);
    return saved;
  };

  const handleAdminResetOperationsUpdate = () => {
    const reset = resetAdminOperationsUpdate();
    setOperationsUpdate(reset);
    return reset;
  };

  const handleNavigateToAdmin = () => {
    if (!isAdmin) {
      showToast({
        message: 'Admin access required',
        subtitle: 'You do not have permission to open the admin workspace.'
      });
      return;
    }

    setView('admin');
  };

  const handleStartMultiEnvelope = () => {
    setShowMultiStartModal(true);
  };

  const handleMultiEnvelopeStart = (primaryAccount, additionalAccounts) => {
    setCurrentAccount(primaryAccount);
    setInitialAdditionalAccounts(additionalAccounts);
    setView('results');
    setShowMultiStartModal(false);
  };

  const handleSearch = (accountNumber) => {
    // Normalize account number (remove spaces, uppercase)
    const normalizedAccount = accountNumber.trim().toUpperCase();

    // Look up account in MOCK_ACCOUNTS
    const account = MOCK_ACCOUNTS[normalizedAccount];

    if (account) {
      setCurrentAccount(account);
      setSearchError(null);
      setView('results');
    } else {
      setSearchError('Account not found. Verify and retry.');
    }
  };

  const handleContinueToPackage = (forms, mad = null) => {
    setSelectedForms(forms);
    setDraftData(null);
    if (mad) {
      setMultiAccountData(mad);
      setView('multiPackage');
    } else {
      setMultiAccountData(null);
      setView('package');
    }
  };

  const handleMultiPackageSend = async (packageData) => {
    let envelopeId = null;
    try {
      const result = await sendMultiAccountEnvelope(packageData);
      if (result.success) {
        envelopeId = result.envelopeId;
        if (envelopeId) {
          const allSignerNames = [...new Set(
            packageData.accounts.flatMap(({ account }) => account.signers.map(s => s.name))
          )];
          showToast({ type: 'success', message: `DocuSign envelope sent to ${allSignerNames.join(', ')}` });
        }
      } else {
        showToast({ message: 'DocuSign error', subtitle: (result.error || 'Unknown error') + ' — item still added to My Work' });
      }
    } catch (error) {
      showToast({ message: 'DocuSign error', subtitle: error.message + ' — item still added to My Work' });
    }

    const newItem = createMultiAccountInProgressItem(packageData, envelopeId);
    setWorkItems(prev => addInProgressItem(prev, newItem));
    setView('work');
  };

  const handleMultiPackageSaveDraft = (draftName, data) => {
    if (!multiAccountData) return;
    const primaryAccount = multiAccountData.accounts[0].account;
    const allFormCodes = [...new Set(multiAccountData.accounts.flatMap(({ forms }) => forms))];
    const draft = createDraftItem(primaryAccount, allFormCodes, draftName, data);
    setWorkItems(prev => addDraft(prev, draft));
  };

  const handleContinueFromFormsLibrary = (forms, account) => {
    setCurrentAccount(account);
    setSelectedForms(forms);
    setDraftData(null);
    setSearchError(null);
    setView('package');
  };

  const handleBrowseForms = () => {
    setFormsLibrarySeed(null);
    setView('formsLibrary');
  };

  const handleStartScenario = (scenario) => {
    if (!scenario) {
      handleBrowseForms();
      return;
    }

    setFormsLibrarySeed({
      label: scenario.title || 'Scenario',
      seedQuery: scenario.seedQuery || '',
      seedCategory: scenario.seedCategory || null,
      recommendedCodes: Array.isArray(scenario.recommendedCodes) ? scenario.recommendedCodes : []
    });
    setView('formsLibrary');
  };

  const handleLoadDraft = (draftItem) => {
    // Look up the account from the draft
    const account = MOCK_ACCOUNTS[draftItem.account];
    if (!account) {
      showToast({ message: 'Draft account not found', subtitle: `Account ${draftItem.account} no longer exists` });
      return;
    }
    setCurrentAccount(account);
    setSelectedForms(draftItem.forms);
    setDraftData(draftItem.draftData || null);
    setView('package');
  };

  const handleSendForSignature = async (packageData) => {
    let docusignEnvelopeId = null;

    if (shouldUseDocuSign(packageData.forms)) {
      try {
        const signers = buildSignerPayload(packageData);
        console.log('DocuSign: Sending envelope with signers:', signers);

        const result = await sendDocuSignEnvelope(packageData, currentAccount.accountNumber);

        if (result.success) {
          docusignEnvelopeId = result.envelopeId;
          console.log('DocuSign envelope sent successfully:', result.envelopeId);
          const signerNames = signers.map(s => s.name).join(', ');
          showToast({ type: 'success', message: `DocuSign envelope sent to ${signerNames}` });
        } else {
          console.error('DocuSign error:', result.error);
          showToast({ message: 'DocuSign error', subtitle: result.error + ' — item still added to My work' });
        }
      } catch (error) {
        console.error('Error sending DocuSign envelope:', error);
        showToast({ message: 'DocuSign error', subtitle: error.message + ' — item still added to My work' });
      }
    }

    const newItem = createInProgressItem(currentAccount, packageData, docusignEnvelopeId);
    setWorkItems(prev => addInProgressItem(prev, newItem));
    setView('work');
  };

  const handleSaveDraft = (draftName, draftFormData) => {
    const draft = createDraftItem(currentAccount, selectedForms, draftName, draftFormData);
    setWorkItems(prev => addDraft(prev, draft));
  };

  const handleDeleteDraft = (draftItem) => {
    setWorkItems(prev => removeDraft(prev, draftItem.id));
  };

  const handleVoidEnvelope = async (item, reason) => {
    if (!item.docusignEnvelopeId) return;

    const result = await DocuSignService.voidEnvelope(item.docusignEnvelopeId, reason);
    if (result.success) {
      setWorkItems(prev => voidItem(prev, item, reason));
      showToast({ type: 'success', message: 'Envelope voided successfully' });
    } else {
      showToast({ message: 'Failed to void envelope', subtitle: result.error });
    }
  };

  const handleEnvelopeStatusChange = (itemId, envelopeData) => {
    setWorkItems(prev => applyEnvelopeStatusChange(prev, itemId, envelopeData));
  };

  const handleBack = () => {
    if (view === 'package') {
      setView('results');
    } else if (view === 'results') {
      setView('landing');
      setCurrentAccount(null);
      setSearchError(null);
      setInitialAdditionalAccounts([]);
    } else if (view === 'formsLibrary' || view === 'savedForms') {
      setFormsLibrarySeed(null);
      setView('landing');
    } else if (view === 'work' || view === 'admin') {
      setView('landing');
    } else if (view === 'multiPackage') {
      setView('results');
    }
  };

  // ── Multi-account start modal ─────────────────────────────────────────────────
  // Two-step wizard: (1) search for primary account, (2) select compatible extras.
  const MultiEnvelopeStartModal = () => {
    const [step, setStep] = React.useState('search');
    const [searchQuery, setSearchQuery] = React.useState('');
    const [primaryAccount, setPrimaryAccount] = React.useState(null);
    const [pendingAdditional, setPendingAdditional] = React.useState(new Set());

    const searchResults = React.useMemo(() => {
      const q = searchQuery.trim().toUpperCase();
      if (!q) return [];
      return Object.values(MOCK_ACCOUNTS).filter(a =>
        a.accountNumber.toUpperCase().includes(q) ||
        a.accountName.toUpperCase().includes(q)
      ).slice(0, 6);
    }, [searchQuery]);

    const compatibleOptions = React.useMemo(() => {
      if (!primaryAccount) return { compatible: [], incompatible: [] };
      const primarySignerNames = new Set(primaryAccount.signers.map(s => s.name.toLowerCase()));
      const related = Object.values(MOCK_ACCOUNTS).filter(a =>
        a.accountNumber !== primaryAccount.accountNumber &&
        a.signers.some(s => primarySignerNames.has(s.name.toLowerCase()))
      );
      const withCompat = related.map(candidate => {
        const check = canAccountsShareEnvelope([primaryAccount, candidate]);
        return { account: candidate, compatible: check.compatible, reason: check.reason };
      });
      return {
        compatible: withCompat.filter(c => c.compatible),
        incompatible: withCompat.filter(c => !c.compatible)
      };
    }, [primaryAccount]);

    const toggleAdditional = (acctNum) => {
      setPendingAdditional(prev => {
        const next = new Set(prev);
        if (next.has(acctNum)) next.delete(acctNum); else next.add(acctNum);
        return next;
      });
    };

    const handleSelectPrimary = (acct) => {
      setPrimaryAccount(acct);
      setStep('addMore');
    };

    const handleStart = () => {
      const additional = compatibleOptions.compatible
        .filter(c => pendingAdditional.has(c.account.accountNumber))
        .map(c => c.account);
      handleMultiEnvelopeStart(primaryAccount, additional);
    };

    React.useEffect(() => {
      const onKey = (e) => { if (e.key === 'Escape') setShowMultiStartModal(false); };
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    }, []);

    const ModalAccountTypeBadge = ({ acct }) => {
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

    const selectedCompatibleCount = [...pendingAdditional].filter(num =>
      compatibleOptions.compatible.some(c => c.account.accountNumber === num)
    ).length;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black bg-opacity-40" onClick={() => setShowMultiStartModal(false)} />

        {/* Panel */}
        <div
          className="relative bg-white w-full max-w-md flex flex-col overflow-hidden"
          style={{ borderRadius: 'var(--app-radius)', boxShadow: '0 24px 64px -12px rgba(0,0,0,0.35)', border: '1px solid var(--app-card-border)', maxHeight: 'min(76vh, 580px)' }}
        >
          {/* Header */}
          <div className="px-5 pt-4 pb-3.5 border-b flex-shrink-0" style={{ borderColor: 'var(--app-card-border)' }}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                {step === 'addMore' && (
                  <button
                    onClick={() => { setStep('search'); setPrimaryAccount(null); setPendingAdditional(new Set()); }}
                    className="p-1 -ml-1 rounded hover:bg-gray-100 flex-shrink-0"
                    style={{ color: 'var(--app-gray-4)' }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}
                <div>
                  <h2 className="text-base font-semibold" style={{ color: 'var(--app-gray-6)' }}>
                    {step === 'search' ? 'Start a multi-account envelope' : 'Add accounts to envelope'}
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--app-gray-4)' }}>
                    {step === 'search' ? 'Find the primary account to start' : 'Select additional accounts with shared signers'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowMultiStartModal(false)}
                className="p-1 rounded hover:bg-gray-100 ml-3 flex-shrink-0"
                style={{ color: 'var(--app-gray-4)' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Step 1 — search input */}
            {step === 'search' && (
              <div className="mt-3 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-4 h-4" style={{ color: 'var(--app-gray-3)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by account number or name…"
                  className="w-full pl-9 pr-4 py-2.5 text-sm focus:outline-none"
                  style={{ border: '1px solid var(--app-input-border)', borderRadius: 'var(--app-radius)' }}
                  onFocus={e => { e.target.style.boxShadow = '0 0 0 2px rgba(138,0,10,0.18)'; }}
                  onBlur={e => { e.target.style.boxShadow = 'none'; }}
                />
              </div>
            )}

            {/* Step 2 — primary account pill */}
            {step === 'addMore' && primaryAccount && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-md" style={{ backgroundColor: 'var(--app-pastel-1)', border: '1px solid var(--app-card-border)' }}>
                <span className="text-[10px] font-semibold uppercase tracking-widest flex-shrink-0" style={{ color: 'var(--app-gray-4)' }}>Primary</span>
                <span className="font-mono text-xs font-bold" style={{ color: 'var(--app-bordeaux-1)' }}>{primaryAccount.accountNumber}</span>
                <span className="text-xs truncate" style={{ color: 'var(--app-gray-5)' }}>{primaryAccount.accountName}</span>
                <ModalAccountTypeBadge acct={primaryAccount} />
              </div>
            )}
          </div>

          {/* Scrollable body */}
          <div className="overflow-y-auto flex-1 min-h-0">

            {/* ── Step 1: search results ── */}
            {step === 'search' && (
              <>
                {!searchQuery.trim() && (
                  <div className="px-5 py-10 text-center">
                    <svg className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--app-gray-2)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <p className="text-sm" style={{ color: 'var(--app-gray-4)' }}>Enter an account number or name to search</p>
                  </div>
                )}
                {searchQuery.trim() && searchResults.length === 0 && (
                  <div className="px-5 py-10 text-center">
                    <p className="text-sm" style={{ color: 'var(--app-gray-4)' }}>No accounts found matching "{searchQuery}"</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--app-gray-3)' }}>Try searching by account number or account name</p>
                  </div>
                )}
                {searchResults.map(acct => (
                  <button
                    key={acct.accountNumber}
                    onClick={() => handleSelectPrimary(acct)}
                    className="w-full text-left px-5 py-3.5 border-b hover:bg-[#F5F0E1]/70 transition-colors flex items-start gap-3"
                    style={{ borderColor: 'var(--app-card-border)' }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="font-mono text-sm font-bold" style={{ color: 'var(--app-bordeaux-1)' }}>{acct.accountNumber}</span>
                        <span className="text-sm font-medium" style={{ color: 'var(--app-gray-6)' }}>{acct.accountName}</span>
                        <ModalAccountTypeBadge acct={acct} />
                      </div>
                      <p className="text-xs" style={{ color: 'var(--app-gray-4)' }}>{acct.signers.map(s => s.name).join(' · ')}</p>
                    </div>
                    <svg className="w-4 h-4 mt-1 flex-shrink-0" style={{ color: 'var(--app-gray-3)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </>
            )}

            {/* ── Step 2: compatible additional accounts ── */}
            {step === 'addMore' && (
              <>
                {compatibleOptions.compatible.length === 0 && compatibleOptions.incompatible.length === 0 && (
                  <div className="px-5 py-8 text-center">
                    <p className="text-sm" style={{ color: 'var(--app-gray-4)' }}>No other accounts share signers with this account.</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--app-gray-3)' }}>You can continue with just this account, or go back to choose a different one.</p>
                  </div>
                )}
                {compatibleOptions.compatible.map(({ account: cand }) => {
                  const isSelected = pendingAdditional.has(cand.accountNumber);
                  return (
                    <button
                      key={cand.accountNumber}
                      onClick={() => toggleAdditional(cand.accountNumber)}
                      className={`w-full text-left px-5 py-3.5 border-b transition-colors flex items-start gap-3 ${isSelected ? 'bg-[#F5F0E1]' : 'hover:bg-[#F5F0E1]/60'}`}
                      style={{ borderColor: 'var(--app-card-border)' }}
                    >
                      <div className={`mt-0.5 w-4 h-4 rounded flex-shrink-0 border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-[#8A000A] border-[#8A000A]' : 'bg-white border-[#CCCABC]'}`}>
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
                          <ModalAccountTypeBadge acct={cand} />
                        </div>
                        <p className="text-xs" style={{ color: 'var(--app-gray-4)' }}>{cand.signers.map(s => s.name).join(' · ')}</p>
                      </div>
                    </button>
                  );
                })}
                {compatibleOptions.incompatible.length > 0 && (
                  <>
                    <div
                      className="px-5 py-2 text-[11px] font-semibold uppercase tracking-widest"
                      style={{ backgroundColor: 'var(--app-pastel-2)', color: 'var(--app-gray-4)', borderBottom: '1px solid var(--app-card-border)' }}
                    >
                      Not compatible with this envelope
                    </div>
                    {compatibleOptions.incompatible.map(({ account: cand, reason }) => (
                      <div
                        key={cand.accountNumber}
                        className="px-5 py-3.5 border-b opacity-50 flex items-start gap-3"
                        style={{ borderColor: 'var(--app-card-border)' }}
                      >
                        <div className="mt-0.5 w-4 h-4 rounded flex-shrink-0 border-2 bg-white border-[#CCCABC]" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <span className="font-mono text-sm font-bold" style={{ color: 'var(--app-gray-4)' }}>{cand.accountNumber}</span>
                            <span className="text-sm font-medium" style={{ color: 'var(--app-gray-5)' }}>{cand.accountName}</span>
                            <ModalAccountTypeBadge acct={cand} />
                          </div>
                          <p className="text-xs" style={{ color: '#8B5E0A' }}>{reason}</p>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-between px-5 py-3 border-t flex-shrink-0"
            style={{ borderColor: 'var(--app-card-border)', backgroundColor: 'var(--app-pastel-1)' }}
          >
            <button
              onClick={() => setShowMultiStartModal(false)}
              className="text-sm px-3 py-1.5 rounded transition-colors hover:bg-gray-100"
              style={{ color: 'var(--app-gray-4)' }}
            >
              Cancel
            </button>
            {step === 'addMore' && (
              <button
                onClick={handleStart}
                className="text-sm font-semibold px-4 py-1.5 rounded transition-all text-white"
                style={{ backgroundColor: 'var(--app-bordeaux-1)' }}
              >
                {selectedCompatibleCount > 0
                  ? `Start with ${1 + selectedCompatibleCount} account${1 + selectedCompatibleCount > 1 ? 's' : ''} →`
                  : 'Start with this account →'
                }
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderActiveView = () => {
    if (view === 'landing') {
      return (
        <div className="space-y-6">
          <SearchView
            onSearch={handleSearch}
            searchError={searchError}
            onAccountInputChange={() => setSearchError(null)}
            onBrowseForms={handleBrowseForms}
            onBrowseSavedForms={() => setView('savedForms')}
            onStartScenario={handleStartScenario}
            onResumeLastDraft={() => {
              const latestDraft = workItems.drafts[0];
              if (latestDraft) {
                handleLoadDraft(latestDraft);
              }
            }}
            hasSavedDrafts={workItems.drafts.length > 0}
            savedFormsCount={savedFormCodes.length}
            operationsUpdate={operationsUpdate}
            onStartMultiEnvelope={handleStartMultiEnvelope}
          />

          <LandingWorkDashboard
            workItems={workItems}
            onLoadDraft={handleLoadDraft}
            onDeleteDraft={handleDeleteDraft}
            onVoidEnvelope={handleVoidEnvelope}
            onEnvelopeStatusChange={handleEnvelopeStatusChange}
            onOpenFullMyWork={() => setView('work')}
          />
        </div>
      );
    }

    if (view === 'results' && currentAccount) {
      return (
        <ResultsView
          account={currentAccount}
          onBack={handleBack}
          onContinue={handleContinueToPackage}
          initialAdditionalAccounts={initialAdditionalAccounts}
        />
      );
    }

    if (view === 'work') {
      return (
        <MyWorkView
          onBack={handleBack}
          onLoadDraft={handleLoadDraft}
          onDeleteDraft={handleDeleteDraft}
          workItems={workItems}
          onVoidEnvelope={handleVoidEnvelope}
          onEnvelopeStatusChange={handleEnvelopeStatusChange}
        />
      );
    }

    if (view === 'admin') {
      if (!isAdmin) {
        return null;
      }

      return (
        <AdminView
          onBack={handleBack}
          formsCatalog={formsCatalog}
          operationsUpdate={operationsUpdate}
          defaultOperationsUpdate={getAdminDefaultOperationsUpdate()}
          onSaveForm={handleAdminSaveForm}
          onSaveOperationsUpdate={handleAdminSaveOperationsUpdate}
          onResetOperationsUpdate={handleAdminResetOperationsUpdate}
        />
      );
    }

    if (view === 'formsLibrary') {
      return (
        <FormsLibraryView
          onBack={handleBack}
          savedFormCodes={savedFormCodes}
          onToggleSaveForm={handleToggleSavedForm}
          onContinue={handleContinueFromFormsLibrary}
          initialAccountNumber={currentAccount?.accountNumber || ''}
          initialSearchQuery={formsLibrarySeed?.seedQuery || ''}
          initialCategoryId={formsLibrarySeed?.seedCategory || null}
          initialScenarioLabel={formsLibrarySeed?.label || ''}
          initialRecommendedCodes={formsLibrarySeed?.recommendedCodes || []}
        />
      );
    }

    if (view === 'savedForms') {
      return (
        <FormsLibraryView
          mode="saved"
          onBack={handleBack}
          onBrowseForms={handleBrowseForms}
          savedFormCodes={savedFormCodes}
          onToggleSaveForm={handleToggleSavedForm}
          onContinue={handleContinueFromFormsLibrary}
          initialAccountNumber={currentAccount?.accountNumber || ''}
        />
      );
    }

    if (view === 'package' && currentAccount) {
      return (
        <PackageView
          account={currentAccount}
          selectedForms={selectedForms}
          onBack={handleBack}
          initialData={draftData}
          onSendForSignature={handleSendForSignature}
          onSaveDraft={handleSaveDraft}
        />
      );
    }

    if (view === 'multiPackage' && multiAccountData) {
      return (
        <MultiPackageView
          multiAccountData={multiAccountData}
          onBack={handleBack}
          onSendForSignature={handleMultiPackageSend}
          onSaveDraft={handleMultiPackageSaveDraft}
        />
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen site-grid-bg">
      <Header
        onNavigateToWork={() => setView('work')}
        onNavigateToAdmin={handleNavigateToAdmin}
        currentView={view}
        isAdmin={isAdmin}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div key={view} className="view-enter">
          {renderActiveView()}
        </div>
      </div>

      {showMultiStartModal && <MultiEnvelopeStartModal />}

      <Toast />

      {/* Confetti */}
      {confetti.length > 0 && (
        <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
          {confetti.map((piece) => (
            <div
              key={piece.id}
              className="absolute animate-confetti"
              style={{
                left: `${piece.x}%`,
                top: '-20px',
                width: `${piece.size}px`,
                height: `${piece.size}px`,
                backgroundColor: piece.color,
                borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                transform: `rotate(${piece.rotation}deg)`,
                animation: `confetti-fall ${piece.duration}s ease-out ${piece.delay}s forwards`
              }}
            />
          ))}
          <style>{`
            @keyframes confetti-fall {
              0% { transform: translateY(0) rotate(0deg); opacity: 1; }
              100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
            }
          `}</style>
        </div>
      )}
    </div>
  );
};

ReactDOM.render(<App />, document.getElementById('root'));
