const SearchView = ({
  onSearch,
  onBrowseForms,
  onBrowseSavedForms = () => {},
  onResumeLastDraft = () => {},
  onStartScenario = () => {},
  onStartMultiEnvelope = () => {},
  onAccountInputChange = () => {},
  searchError = null,
  hasSavedDrafts = false,
  savedFormsCount = 0,
  operationsUpdate = null,
  showMultiAccountHint = false
}) => {
  const [accountSearch, setAccountSearch] = React.useState('');
  const [isLoaded, setIsLoaded] = React.useState(false);
  const eSignEnabledCount = React.useMemo(
    () => FORMS_DATA.filter((form) => form.eSignEnabled).length,
    []
  );

  const scenarios = React.useMemo(() => {
    if (typeof FORM_SCENARIOS === 'undefined' || !Array.isArray(FORM_SCENARIOS)) {
      return [];
    }
    return FORM_SCENARIOS.filter(
      (scenario) => !['special-authorization', 'advisory'].includes(scenario.id)
    );
  }, []);

  const defaultOperationsCallout = {
    label: 'Operations update',
    message: 'AC-DEBIT-CARD is now enabled for eSign on eligible account workflows.',
    updatedAt: 'Updated today'
  };

  const operationsCallout = {
    label: operationsUpdate?.label || defaultOperationsCallout.label,
    message: operationsUpdate?.message || defaultOperationsCallout.message,
    updatedAt: operationsUpdate?.updatedAt || defaultOperationsCallout.updatedAt
  };

  React.useEffect(() => {
    const frame = requestAnimationFrame(() => setIsLoaded(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const handleSearch = () => {
    if (accountSearch.trim()) {
      onSearch(accountSearch);
    }
  };

  const getScenarioInitials = (title = '') =>
    title
      .split(' ')
      .filter(Boolean)
      .map((word) => word[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

  const scenarioAccentClasses = {
    'move-money': 'bg-[var(--app-pastel-1)] text-[var(--app-gray-6)]',
    retirement: 'bg-[var(--app-pastel-2)] text-[var(--app-bronze-3)]',
    'beneficiary-estate': 'bg-[var(--app-pastel-1)] text-[var(--app-gray-5)]',
    advisory: 'bg-[var(--app-pastel-2)] text-[var(--app-gray-6)]',
    'tax-compliance': 'bg-[var(--app-pastel-2)] text-[var(--app-bronze-2)]',
    'special-authorization': 'bg-[var(--app-pastel-1)] text-[var(--app-gray-5)]'
  };

  return (
    <div className="mobile-search-view space-y-6 max-w-5xl">
      <div
        className={`operations-glass mobile-operations-callout px-5 py-3 transition-all duration-500 ${
          isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
        }`}
      >
        <div className="mobile-operations-header flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--app-bronze-1)' }} />
            <p className="text-xs font-semibold tracking-wide" style={{ color: 'var(--app-bronze-3)' }}>{operationsCallout.label}</p>
          </div>
          <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium" style={{ borderColor: 'var(--app-bronze-1)', color: 'var(--app-bronze-3)', backgroundColor: 'rgba(255,255,255,0.7)' }}>
            {operationsCallout.updatedAt}
          </span>
        </div>
        <p className="text-sm mt-1.5" style={{ color: 'var(--app-gray-6)' }}>{operationsCallout.message}</p>
      </div>

      <div className="mobile-search-main-grid grid grid-cols-1 lg:grid-cols-[1.25fr_0.95fr] gap-6 items-stretch">
        <div className="lg:col-start-1 flex flex-col gap-6">
          <div
            className={`mobile-search-card bg-white p-6 lg:p-7 transition-all duration-500 ${
              isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
            }`}
            style={{ borderRadius: 'var(--app-radius)', border: '1px solid var(--app-card-border)', boxShadow: 'var(--app-card-shadow)' }}
          >
            <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--app-gray-6)' }}>Search by account</h2>
            <p className="text-sm mb-4" style={{ color: 'var(--app-gray-4)' }}>Enter account number or UAN to view available forms for eSign.</p>
            <div className="mb-5 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium" style={{ border: '1px solid var(--app-gray-1)', backgroundColor: 'var(--app-pastel-1)', color: 'var(--app-gray-5)' }}>
                <svg className="h-3.5 w-3.5" style={{ color: 'var(--app-gray-3)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                {savedFormsCount} saved form{savedFormsCount === 1 ? '' : 's'}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium" style={{ border: '1px solid var(--app-gray-1)', backgroundColor: 'var(--app-pastel-1)', color: 'var(--app-gray-5)' }}>
                <svg className="h-3.5 w-3.5" style={{ color: 'var(--app-gray-3)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                {eSignEnabledCount} eSign-enabled forms
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Account/UAN"
                  value={accountSearch}
                  onChange={(e) => {
                    setAccountSearch(e.target.value);
                    onAccountInputChange(e.target.value);
                  }}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full px-4 py-2.5 focus:outline-none"
                  style={{
                    border: searchError ? '1px solid var(--app-bordeaux-1)' : '1px solid var(--app-input-border)',
                    borderRadius: 'var(--app-radius)',
                    boxShadow: 'none'
                  }}
                  onFocus={(e) => { e.target.style.outline = 'none'; e.target.style.boxShadow = `0 0 0 2px rgba(138,0,10,0.18)`; }}
                  onBlur={(e) => { e.target.style.boxShadow = 'none'; }}
                />
              </div>
              <button
                onClick={handleSearch}
                className="px-6 py-2.5 text-white flex items-center justify-center gap-2 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{ backgroundColor: '#E60000', borderRadius: 'var(--app-radius)', focusRingColor: 'var(--app-bordeaux-2)' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#BD000C'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#E60000'; }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search
              </button>
            </div>

            <div className="mt-2 h-5" aria-live="polite">
              <div className={`flex items-center gap-1.5 text-[11px] transition-opacity duration-150 ${searchError ? 'opacity-100' : 'opacity-0'}`} style={{ color: 'var(--app-bordeaux-1)' }}>
                <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--app-bordeaux-1)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{searchError || ' '}</span>
              </div>
            </div>
          </div>

          <div
            className={`bg-white p-4 transition-all duration-500 ${
              isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
            }`}
            style={{ borderRadius: 'var(--app-radius)', border: '1px solid var(--app-card-border)', boxShadow: 'var(--app-card-shadow)', transitionDelay: '200ms' }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--app-gray-6)' }}>Quick start</h3>
              <p className="text-xs invisible select-none" style={{ color: 'var(--app-gray-3)' }}>Common advisor actions</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={onResumeLastDraft}
                disabled={!hasSavedDrafts}
                className={`w-full text-left rounded-md border px-4 py-3 text-sm transition-colors ${
                  hasSavedDrafts
                    ? 'quick-wash-surface quick-wash-purple hover:brightness-[1.015] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2'
                    : 'opacity-75 cursor-not-allowed'
                }`}
                style={!hasSavedDrafts ? { borderColor: 'var(--app-gray-1)', backgroundColor: 'var(--app-pastel-1)' } : undefined}
              >
                <p className={`font-medium ${hasSavedDrafts ? '' : ''}`} style={{ color: hasSavedDrafts ? 'var(--app-gray-6)' : 'var(--app-gray-3)' }}>Resume last draft</p>
                <p className="text-xs mt-0.5" style={{ color: hasSavedDrafts ? 'var(--app-gray-4)' : 'var(--app-gray-3)' }}>
                  {hasSavedDrafts ? 'Jump back into your most recent draft' : 'No saved drafts yet'}
                </p>
              </button>
              <button
                onClick={onBrowseSavedForms}
                className="w-full text-left rounded-md border quick-wash-surface quick-wash-blue px-4 py-3 text-sm hover:brightness-[1.015] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              >
                <p className="font-medium" style={{ color: 'var(--app-gray-6)' }}>Open saved forms</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--app-gray-4)' }}>{savedFormsCount} saved form{savedFormsCount === 1 ? '' : 's'}</p>
              </button>
            </div>

            {/* ── Multi-account envelope entry ── */}
            <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--app-card-border)' }}>
              <button
                onClick={onStartMultiEnvelope}
                className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                style={{ borderColor: 'var(--app-gray-1)', backgroundColor: 'white' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--app-pastel-1)'; e.currentTarget.style.borderColor = 'var(--app-gray-2)'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = 'var(--app-gray-1)'; }}
              >
                <div
                  className="flex-shrink-0 w-8 h-8 rounded flex items-center justify-center"
                  style={{ backgroundColor: 'var(--app-pastel-2)' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--app-bordeaux-1)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--app-gray-6)' }}>Multi-account envelope</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--app-gray-4)' }}>Send forms across multiple accounts in one DocuSign envelope</p>
                </div>
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--app-gray-3)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {/* ── Multi-account mode hint banner ── */}
          {showMultiAccountHint && (
            <div
              className="flex items-start gap-3 px-4 py-3 rounded-md text-sm"
              style={{ backgroundColor: '#EEF6FB', border: '1px solid #B3D9EE', color: '#0A5A80' }}
            >
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Search for your <strong>primary account</strong> above to start a multi-account envelope — you can add more accounts on the next screen.</span>
            </div>
          )}
        </div>

        <div
          className={`mobile-search-card lg:col-start-2 h-full bg-white p-6 lg:px-7 lg:pt-7 lg:pb-3 transition-all duration-500 ${
            isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
          }`}
          style={{ borderRadius: 'var(--app-radius)', border: '1px solid var(--app-card-border)', boxShadow: 'var(--app-card-shadow)', transitionDelay: '140ms' }}
        >
          <div className="h-full flex flex-col">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 mt-1" style={{ color: 'var(--app-gray-5)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h10" />
              </svg>
              <div className="flex-1">
                <h3 className="font-semibold mb-1" style={{ color: 'var(--app-gray-6)' }}>Scenario launcher</h3>
                <p className="text-sm" style={{ color: 'var(--app-gray-4)' }}>Start from advisor intent and jump to a pre-filtered forms workflow.</p>
              </div>
            </div>

            <div className="mt-3 flex-1 min-h-0">
              <div className="grid grid-cols-1 gap-2">
                {scenarios.map((scenario) => (
                  <button
                    key={scenario.id}
                    onClick={() => onStartScenario(scenario)}
                    className="group text-left px-3.5 py-3 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                    style={{ borderRadius: 'var(--app-radius)', border: '1px solid var(--app-gray-1)', backgroundColor: 'white' }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--app-gray-2)'; e.currentTarget.style.backgroundColor = 'var(--app-pastel-1)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--app-gray-1)'; e.currentTarget.style.backgroundColor = 'white'; }}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-[11px] font-semibold tracking-wide ${scenarioAccentClasses[scenario.id] || 'bg-[var(--app-pastel-1)] text-[var(--app-gray-6)]'}`}>
                        {getScenarioInitials(scenario.title)}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold" style={{ color: 'var(--app-gray-6)' }}>{scenario.title}</p>
                        <p className="text-[11px] mt-0.5 leading-4" style={{ color: 'var(--app-gray-4)' }}>{scenario.subtitle}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>

      <div
        className={`bg-white p-4 transition-all duration-500 ${
          isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
        }`}
        style={{ borderRadius: 'var(--app-radius)', border: '1px solid var(--app-card-border)', transitionDelay: '260ms' }}
      >
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">

          <button
            onClick={onBrowseForms}
            className="md:col-span-7 w-full text-left bg-white px-4 py-3 text-sm flex items-start gap-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
            style={{ borderRadius: 'var(--app-radius)', border: '1px solid var(--app-gray-1)' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--app-pastel-1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'white'; }}
          >
            <svg className="w-5 h-5 mt-0.5" style={{ color: 'var(--app-gray-3)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <div>
              <p className="font-medium" style={{ color: 'var(--app-gray-6)' }}>General forms search</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--app-gray-3)' }}>Browse all {FORMS_DATA.length} forms in the library</p>
            </div>
          </button>

          <div className="md:col-span-5 w-full px-4 py-3 text-sm flex items-start gap-3 opacity-60 cursor-not-allowed" style={{ borderRadius: 'var(--app-radius)', border: '1px solid var(--app-gray-1)', backgroundColor: 'var(--app-pastel-1)' }}>
            <svg className="w-5 h-5 mt-0.5" style={{ color: 'var(--app-gray-3)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            <div>
              <p className="font-medium" style={{ color: 'var(--app-gray-6)' }}>What&apos;s new</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--app-gray-3)' }}>Coming soon</p>
            </div>
          </div>

          <div className="md:col-span-12 px-4 py-3 text-sm flex items-start gap-3 opacity-60 cursor-not-allowed" style={{ borderRadius: 'var(--app-radius)', border: '1px solid var(--app-gray-1)', backgroundColor: 'var(--app-pastel-1)' }}>
            <svg className="w-5 h-5 mt-0.5" style={{ color: 'var(--app-gray-3)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <div>
              <p className="font-medium" style={{ color: 'var(--app-gray-3)' }}>Forms category search</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--app-gray-2)' }}>Coming soon</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
