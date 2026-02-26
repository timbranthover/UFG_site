/**
 * MultiPackageView — fill forms and send a multi-account envelope.
 *
 * Props:
 *   multiAccountData  { accounts: [{ account, forms }] }
 *   onBack()          — return to ResultsView
 *   onSendForSignature(packageData)
 *   onSaveDraft(name, data)
 *
 * Layout mirrors PackageView:
 *   Left:  form fill component (account-specific)
 *   Right: sidebar — accounts → forms → signer assignment + signing order
 *   Bottom nav: Previous / Next form across all accounts
 *   Fixed bottom: floating glass CTA
 */
const MultiPackageView = ({ multiAccountData, onBack, onSendForSignature, onSaveDraft }) => {
  const { accounts } = multiAccountData;

  // ── Flat ordered list of all forms across accounts ───────────────────────────
  // [{ code, account }]
  const allForms = React.useMemo(() => {
    const result = [];
    for (const { account, forms } of accounts) {
      for (const code of forms) {
        result.push({ code, account });
      }
    }
    return result;
  }, [accounts]);

  // ── Navigation ───────────────────────────────────────────────────────────────
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const currentEntry   = allForms[currentIndex] || allForms[0];
  const currentFormCode   = currentEntry?.code;
  const currentAccount    = currentEntry?.account;
  const currentDataKey    = currentEntry ? `${currentAccount.accountNumber}_${currentFormCode}` : null;

  // ── Form data ────────────────────────────────────────────────────────────────
  // Keyed by `${accountNumber}_${formCode}` to avoid collision when same code appears on multiple accounts
  const [formDataMap, setFormDataMap] = React.useState({});
  const currentFormData = currentDataKey ? (formDataMap[currentDataKey] || {}) : {};

  const updateFormData = (field, value) => {
    if (!currentDataKey) return;
    setFormDataMap(prev => ({
      ...prev,
      [currentDataKey]: { ...prev[currentDataKey], [field]: value }
    }));
  };

  // ── Union signers (nameKey-based dedup) ──────────────────────────────────────
  const unionSigners = React.useMemo(() => {
    const seen = new Map();
    for (const { account } of accounts) {
      for (const signer of (account.signers || [])) {
        const key = signer.name.toLowerCase();
        if (!seen.has(key)) seen.set(key, { ...signer, _nameKey: key });
      }
    }
    return [...seen.values()];
  }, [accounts]);

  // ── Signer order + details ───────────────────────────────────────────────────
  const [signerOrder, setSignerOrder] = React.useState(() => unionSigners.map(s => s._nameKey));
  const [signerDetails, setSignerDetails] = React.useState(() => {
    const init = {};
    for (const s of unionSigners) {
      init[s._nameKey] = { email: s.emails?.[0] || s.email || '' };
    }
    return init;
  });

  const orderedSigners = signerOrder
    .map(key => unionSigners.find(s => s._nameKey === key))
    .filter(Boolean);

  const moveSignerUp = (idx) => {
    if (idx === 0) return;
    setSignerOrder(prev => { const n = [...prev]; [n[idx-1], n[idx]] = [n[idx], n[idx-1]]; return n; });
  };
  const moveSignerDown = (idx) => {
    if (idx === signerOrder.length - 1) return;
    setSignerOrder(prev => { const n = [...prev]; [n[idx], n[idx+1]] = [n[idx+1], n[idx]]; return n; });
  };
  const handleEmailChange = (nameKey, email) => {
    setSignerDetails(prev => ({ ...prev, [nameKey]: { ...prev[nameKey], email } }));
  };

  // ── Sidebar collapse state ───────────────────────────────────────────────────
  const [expandedAccounts, setExpandedAccounts] = React.useState(() => {
    const init = {};
    for (const { account } of accounts) init[account.accountNumber] = true;
    return init;
  });
  const [expandedForms, setExpandedForms] = React.useState(() => {
    const init = {};
    if (allForms[0]) init[`${allForms[0].account.accountNumber}_${allForms[0].code}`] = true;
    return init;
  });

  const toggleAccountExpansion = (acctNum) =>
    setExpandedAccounts(prev => ({ ...prev, [acctNum]: !prev[acctNum] }));

  const toggleFormExpansion = (acctNum, code) => {
    const key = `${acctNum}_${code}`;
    setExpandedForms(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // When navigation changes, auto-expand the current form's account + form in sidebar
  React.useEffect(() => {
    if (!currentEntry) return;
    const acctNum = currentAccount.accountNumber;
    const key = `${acctNum}_${currentFormCode}`;
    setExpandedAccounts(prev => ({ ...prev, [acctNum]: true }));
    setExpandedForms(prev => ({ ...prev, [key]: true }));
  }, [currentIndex]);

  // ── Send / draft ─────────────────────────────────────────────────────────────
  const [isSending, setIsSending] = React.useState(false);
  const [customMessage, setCustomMessage] = React.useState('');
  const [showSaveDraftModal, setShowSaveDraftModal] = React.useState(false);

  const canSend = orderedSigners.length > 0;

  const handleSend = async () => {
    if (!canSend || isSending) return;
    setIsSending(true);
    const packageData = {
      ...multiAccountData,
      signers: orderedSigners,
      signerOrder,
      signerDetails,
      sequentialSigning: orderedSigners.length >= 2,
      customMessage
    };
    try { await onSendForSignature(packageData); }
    finally { setIsSending(false); }
  };

  const handleSaveDraftConfirm = (draftName) => {
    onSaveDraft(draftName, { formDataMap, signerDetails, customMessage });
    setShowSaveDraftModal(false);
  };

  // ── Form fill renderer ───────────────────────────────────────────────────────
  const renderFormComponent = () => {
    if (!currentEntry) return null;
    const props = {
      formData: currentFormData,
      onUpdateField: updateFormData,
      selectedSigners: orderedSigners,
      account: currentAccount
    };
    switch (currentFormCode) {
      case 'AC-TF':   return <ACTFForm   {...props} />;
      case 'AC-FT':   return <ACFTForm   {...props} />;
      case 'CL-ACRA': return <CLACRAForm {...props} />;
      case 'LA-GEN':  return <LAGENForm  {...props} />;
      default: {
        const form = FORMS_DATA.find(f => f.code === currentFormCode);
        return (
          <div className="mobile-form-shell bg-white shadow-lg max-w-3xl mx-auto p-8">
            <div className="border-b-2 border-[#404040] pb-4">
              <h2 className="text-xl font-bold">{form?.name}</h2>
              <p className="text-sm text-[#7A7870] mt-1">{form?.description}</p>
            </div>
            <div className="mt-6 p-8 bg-[#F5F0E1] rounded text-center">
              <svg className="w-16 h-16 text-[#B8B3A2] mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-[#7A7870]">Form preview coming soon</p>
            </div>
          </div>
        );
      }
    }
  };

  const accountTypeBadge = (acct) => {
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

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="mobile-package-view pb-10">

      {/* Header with back nav */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="text-sm hover:underline flex items-center gap-1"
          style={{ color: '#00759E' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to form selection
        </button>
        <span className="text-sm" style={{ color: 'var(--app-gray-4)' }}>
          Form {currentIndex + 1} of {allForms.length}
        </span>
      </div>

      {/* Main layout: form fill left, sidebar right */}
      <div className="mobile-package-layout flex gap-4">

        {/* ── Left: form fill + navigation ── */}
        <div className="flex-1 space-y-4">
          {/* Account context bar */}
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm"
            style={{ backgroundColor: 'var(--app-pastel-1)', border: '1px solid var(--app-card-border)' }}
          >
            <span className="font-mono font-semibold text-xs" style={{ color: 'var(--app-bordeaux-1)' }}>
              {currentAccount?.accountNumber}
            </span>
            <span style={{ color: 'var(--app-gray-5)' }}>{currentAccount?.accountName}</span>
            {currentAccount && accountTypeBadge(currentAccount)}
          </div>

          {renderFormComponent()}

          {/* Prev / Next navigation */}
          {allForms.length > 1 && (
            <div className="mobile-form-nav flex items-center justify-between bg-white rounded-lg shadow-sm border border-[#CCCABC] p-4">
              <button
                onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
                disabled={currentIndex === 0}
                className={`px-4 py-2 text-sm rounded-lg flex items-center gap-2 ${
                  currentIndex === 0 ? 'text-[#B8B3A2] cursor-not-allowed' : 'text-[#5A5D5C] hover:bg-[#ECEBE4]'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Previous form
              </button>

              {/* Progress dots */}
              <div className="flex items-center gap-1">
                {allForms.map((entry, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    className={`rounded-full transition-all ${
                      idx === currentIndex ? 'w-2 h-2' : 'w-1.5 h-1.5 opacity-40 hover:opacity-70'
                    }`}
                    style={{ backgroundColor: idx === currentIndex ? 'var(--app-bordeaux-1)' : 'var(--app-gray-3)' }}
                    title={`${entry.account.accountNumber} — ${entry.code}`}
                  />
                ))}
              </div>

              <button
                onClick={() => setCurrentIndex(i => Math.min(allForms.length - 1, i + 1))}
                disabled={currentIndex === allForms.length - 1}
                className={`px-4 py-2 text-sm rounded-lg flex items-center gap-2 ${
                  currentIndex === allForms.length - 1 ? 'text-[#B8B3A2] cursor-not-allowed' : 'text-[#5A5D5C] hover:bg-[#ECEBE4] font-medium'
                }`}
              >
                Next form
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* ── Right: sidebar ── */}
        <div className="mobile-package-sidebar w-96 space-y-4">
          <div className="mobile-package-sidebar-panel bg-white rounded-lg shadow-sm border border-[#CCCABC] p-4 sticky top-6">

            {/* ── Account → Form tree ── */}
            <h3 className="text-sm font-semibold text-[#404040] mb-3">Forms in this envelope</h3>
            <div className="space-y-1 mb-5">
              {accounts.map(({ account: acct, forms }) => {
                const isAcctExpanded = expandedAccounts[acct.accountNumber] !== false;
                return (
                  <div key={acct.accountNumber}>
                    {/* Account row */}
                    <div
                      onClick={() => toggleAccountExpansion(acct.accountNumber)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-[#ECEBE4] transition-colors"
                    >
                      <svg
                        className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-150 ${isAcctExpanded ? 'rotate-90' : ''}`}
                        style={{ color: 'var(--app-gray-4)' }}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <span className="font-mono text-xs font-bold" style={{ color: 'var(--app-bordeaux-1)' }}>
                        {acct.accountNumber}
                      </span>
                      <span className="text-xs truncate" style={{ color: 'var(--app-gray-5)' }}>
                        {acct.accountName}
                      </span>
                    </div>

                    {/* Forms under account */}
                    {isAcctExpanded && (
                      <div className="ml-5 space-y-0.5 mt-0.5">
                        {forms.map(code => {
                          const form = FORMS_DATA.find(f => f.code === code);
                          const formKey = `${acct.accountNumber}_${code}`;
                          const flatIdx = allForms.findIndex(f => f.code === code && f.account.accountNumber === acct.accountNumber);
                          const isCurrent = flatIdx === currentIndex;
                          const isFormExpanded = expandedForms[formKey];

                          return (
                            <div key={code} className="border border-[#CCCABC] rounded mt-1">
                              {/* Form header */}
                              <div
                                onClick={() => {
                                  if (flatIdx >= 0) setCurrentIndex(flatIdx);
                                  toggleFormExpansion(acct.accountNumber, code);
                                }}
                                className={`flex items-start gap-2 p-2 cursor-pointer transition-colors rounded ${
                                  isCurrent ? 'bg-[#F5F0E1]' : 'hover:bg-[#ECEBE4]'
                                }`}
                              >
                                <svg
                                  className={`w-3.5 h-3.5 text-[#7A7870] mt-0.5 flex-shrink-0 transition-transform ${isFormExpanded ? 'rotate-90' : ''}`}
                                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs font-medium text-[#404040] truncate">{form?.name || code}</span>
                                    {isCurrent && (
                                      <span className="text-[10px] text-[#5A5D5C] flex-shrink-0">← Viewing</span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-[#7A7870]">{code}</div>
                                </div>
                              </div>

                              {/* Signer assignment — expanded per form, scoped to this account's signers */}
                              {isFormExpanded && (
                                <div className="border-t border-[#CCCABC] px-3 py-2">
                                  <p className="text-[11px] font-medium text-[#7A7870] mb-2">Signers for this form</p>
                                  <div className="space-y-1">
                                    {orderedSigners
                                      .map((signer, orderIdx) => ({ signer, orderIdx }))
                                      .filter(({ signer }) => (acct.signers || []).some(as => as.name.toLowerCase() === signer._nameKey))
                                      .map(({ signer, orderIdx }) => (
                                        <div key={signer._nameKey} className="flex items-center gap-2 py-1">
                                          <span
                                            className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] leading-none font-bold text-white flex-shrink-0 select-none tabular-nums"
                                            style={{ backgroundColor: 'var(--app-bordeaux-1)' }}
                                          >
                                            {orderIdx + 1}
                                          </span>
                                          <span className="text-xs text-[#404040] flex-1 truncate">{signer.name}</span>
                                        </div>
                                      ))
                                    }
                                    {orderedSigners.filter(s => (acct.signers || []).some(as => as.name.toLowerCase() === s._nameKey)).length === 0 && (
                                      <p className="text-xs" style={{ color: 'var(--app-gray-3)' }}>No signers assigned yet</p>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ── Signing order ── */}
            <div className="border-t border-[#CCCABC] pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-[#404040]">Signing order</h3>
                {orderedSigners.length >= 2 && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full border" style={{ color: 'var(--app-gray-4)', borderColor: 'var(--app-gray-1)', backgroundColor: 'var(--app-pastel-2)' }}>
                    Sequential
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {orderedSigners.map((signer, idx) => {
                  const allEmails = signer.emails || (signer.email ? [signer.email] : []);
                  const currentEmail = signerDetails[signer._nameKey]?.email || '';
                  return (
                    <div key={signer._nameKey} className="flex items-center gap-2">
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] leading-none font-bold text-white flex-shrink-0 select-none tabular-nums"
                        style={{ backgroundColor: 'var(--app-bordeaux-1)' }}
                      >
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[#404040] truncate">{signer.name}</p>
                        {allEmails.length > 1 ? (
                          <select
                            value={currentEmail}
                            onChange={e => handleEmailChange(signer._nameKey, e.target.value)}
                            className="w-full text-[11px] border border-[#CCCABC] rounded px-1.5 py-0.5 mt-0.5 focus:outline-none"
                          >
                            {allEmails.map(e => <option key={e} value={e}>{e}</option>)}
                          </select>
                        ) : (
                          <p className="text-[11px] text-[#8E8D83] truncate">{currentEmail}</p>
                        )}
                      </div>
                      {orderedSigners.length > 1 && (
                        <div className="flex flex-col gap-0.5 flex-shrink-0">
                          <button
                            onClick={() => moveSignerUp(idx)}
                            className={`p-0.5 rounded transition-opacity ${idx === 0 ? 'opacity-0 pointer-events-none' : 'opacity-100 hover:bg-[#ECEBE4]'}`}
                          >
                            <svg className="w-3 h-3 text-[#8E8D83]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => moveSignerDown(idx)}
                            className={`p-0.5 rounded transition-opacity ${idx === orderedSigners.length - 1 ? 'opacity-0 pointer-events-none' : 'opacity-100 hover:bg-[#ECEBE4]'}`}
                          >
                            <svg className="w-3 h-3 text-[#8E8D83]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Personal message ── */}
            <div className="border-t border-[#CCCABC] pt-4 mt-4">
              <label className="block text-xs font-medium text-[#5A5D5C] mb-1.5">
                Personal message <span className="font-normal text-[#8E8D83]">(optional)</span>
              </label>
              <textarea
                value={customMessage}
                onChange={e => setCustomMessage(e.target.value.slice(0, 150))}
                placeholder="Add a note for the signers…"
                rows={2}
                className="w-full px-3 py-2 text-sm border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#B8B3A2]"
                style={{ borderColor: '#CCCABC' }}
              />
              <div className="flex justify-end mt-0.5">
                <span className={`text-xs ${customMessage.length >= 150 ? 'text-amber-600' : 'text-[#B8B3A2]'}`}>
                  {customMessage.length}/150
                </span>
              </div>
            </div>

            {/* ── Action buttons ── */}
            <div className="border-t border-[#CCCABC] pt-4 mt-4 space-y-2">
              <button
                onClick={() => setShowSaveDraftModal(true)}
                className="w-full px-4 py-2 text-sm text-[#5A5D5C] bg-white border border-[#CCCABC] rounded-lg hover:bg-[#ECEBE4] flex items-center justify-center gap-2 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Save draft
              </button>
              <button
                onClick={handleSend}
                disabled={!canSend || isSending}
                className={`w-full px-4 py-2 rounded-lg flex items-center justify-center gap-2 font-medium transition-all ${
                  !canSend
                    ? 'bg-[#ECEBE4] text-[#8E8D83] cursor-not-allowed'
                    : isSending
                      ? 'bg-[#E60000] text-white shadow-sm opacity-75 cursor-not-allowed'
                      : 'bg-[#E60000] text-white shadow-sm hover:bg-[#BD000C]'
                }`}
              >
                {isSending ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Sending…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Send for Signature
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Save Draft Modal */}
      {showSaveDraftModal && (
        <SaveDraftModal
          onClose={() => setShowSaveDraftModal(false)}
          onSave={handleSaveDraftConfirm}
          defaultName={`Multi-Envelope: ${accounts.map(a => a.account.accountNumber).join(', ')}`}
        />
      )}
    </div>
  );
};
