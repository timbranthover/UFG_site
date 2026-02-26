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
  const [autoOpenPicker, setAutoOpenPicker] = React.useState(false);
  const [showMultiAccountHint, setShowMultiAccountHint] = React.useState(false);

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
    setShowMultiAccountHint(true);
    setAutoOpenPicker(true);
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
      setAutoOpenPicker(false);
      setShowMultiAccountHint(false);
    } else if (view === 'formsLibrary' || view === 'savedForms') {
      setFormsLibrarySeed(null);
      setView('landing');
    } else if (view === 'work' || view === 'admin') {
      setView('landing');
    } else if (view === 'multiPackage') {
      setView('results');
    }
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
            showMultiAccountHint={showMultiAccountHint}
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
          autoOpenPicker={autoOpenPicker}
          onPickerOpened={() => {
            setAutoOpenPicker(false);
            setShowMultiAccountHint(false);
          }}
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
