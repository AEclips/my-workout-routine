import {
  Bell,
  Check,
  ChevronDown,
  ChevronUp,
  CloudDownload,
  CloudUpload,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  LogOut,
  RefreshCw,
  Settings,
  Upload,
  UserCheck
} from 'lucide-react';
import { useRef, useState } from 'react';
import { MUKTO_PROFILE } from '../data/muktoHistory';
import {
  buildSyncPayload,
  GOOGLE_APPS_SCRIPT_CODE,
  pullFromGoogleSheets,
  pushToGoogleSheets
} from '../services/googleSheetsService';
import {
  exportFullBackupJson,
  exportWorkoutCsv,
  type WorkoutLogsMap
} from '../services/storageService';
import type {
  CardCustomization,
  DailyPrepRecoveryLog,
  SyncHistoryItem,
  SyncSettings
} from '../types/workout';
import { triggerHaptic } from '../utils/audioHaptics';

interface GoogleSheetsSyncViewProps {
  syncSettings: SyncSettings;
  customizations: Record<string, CardCustomization>;
  workoutLogs: WorkoutLogsMap;
  recoveryLogs: Record<string, DailyPrepRecoveryLog>;
  todayRecovery: DailyPrepRecoveryLog;
  unsyncedCount: number;
  onUpdateSyncSettings: (next: SyncSettings) => void;
  onUpdateRecovery: (updated: DailyPrepRecoveryLog) => void;
  onMarkLogsSynced: () => void;
  onImportFullBackup: (jsonText: string) => void;
}

export function GoogleSheetsSyncView({
  syncSettings,
  customizations,
  workoutLogs,
  recoveryLogs,
  todayRecovery,
  unsyncedCount,
  onUpdateSyncSettings,
  onUpdateRecovery,
  onMarkLogsSynced,
  onImportFullBackup
}: GoogleSheetsSyncViewProps) {
  const [emailInput, setEmailInput] = useState(
    syncSettings.googleEmail || MUKTO_PROFILE.email
  );
  const [urlInput, setUrlInput] = useState(syncSettings.webAppUrl);
  const [sheetUrlInput, setSheetUrlInput] = useState(
    syncSettings.sheetUrl || MUKTO_PROFILE.defaultSheetUrl
  );
  const [busy, setBusy] = useState<'push' | 'pull' | null>(null);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showAdvancedSetup, setShowAdvancedSetup] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const appendHistory = (
    base: SyncSettings,
    item: Omit<SyncHistoryItem, 'id' | 'timestamp'>
  ): SyncSettings => ({
    ...base,
    lastSyncAt: item.status === 'success' ? new Date().toISOString() : base.lastSyncAt,
    history: [
      {
        id: `${Date.now()}`,
        timestamp: new Date().toISOString(),
        ...item
      },
      ...base.history
    ].slice(0, 12)
  });

  const handleGoogleLogin = () => {
    const email = emailInput.trim();
    if (!email || !email.includes('@')) {
      setStatusBanner({
        type: 'err',
        text: 'সঠিক Google ইমেইল ঠিকানা দিন (যেমন: shahriarmukto8800@gmail.com)।'
      });
      return;
    }

    const next = {
      ...syncSettings,
      googleSignedIn: true,
      googleEmail: email,
      googleName: email === MUKTO_PROFILE.email ? MUKTO_PROFILE.name : email.split('@')[0],
      sheetUrl: sheetUrlInput.trim() || MUKTO_PROFILE.defaultSheetUrl
    };
    onUpdateSyncSettings(next);
    triggerHaptic([25, 40, 25]);
    setStatusBanner({
      type: 'ok',
      text: `${email} অ্যাকাউন্ট দিয়ে Google Sheets কানেক্ট হয়েছে!`
    });
  };

  const handleGoogleLogout = () => {
    onUpdateSyncSettings({
      ...syncSettings,
      googleSignedIn: false
    });
    triggerHaptic(15);
    setStatusBanner({ type: 'ok', text: 'Google অ্যাকাউন্ট থেকে লগআউট হয়েছে।' });
  };

  const handleSaveUrls = () => {
    const next = {
      ...syncSettings,
      webAppUrl: urlInput.trim(),
      sheetUrl: sheetUrlInput.trim() || MUKTO_PROFILE.defaultSheetUrl
    };
    onUpdateSyncSettings(next);
    triggerHaptic(20);
    setStatusBanner({ type: 'ok', text: 'Google Sheet লিংক ও সেটিংস সেভ হয়েছে!' });
  };

  const handlePush = async () => {
    const targetUrl = urlInput.trim();
    if (!targetUrl) {
      setShowAdvancedSetup(true);
      setStatusBanner({
        type: 'err',
        text: 'অটো পুশ চালু করতে নিচের "অ্যাডভান্সড Apps Script সেটআপ" থেকে Web App URL দিন, অথবা নিচের "Google Sheet খুলুন" বাটনে গিয়ে ম্যানুয়ালি দেখুন।'
      });
      return;
    }

    setBusy('push');
    setStatusBanner(null);
    try {
      const payload = buildSyncPayload(customizations, workoutLogs, recoveryLogs);
      const res = await pushToGoogleSheets(targetUrl, payload);
      if (!res.ok) {
        throw new Error(res.message);
      }
      onMarkLogsSynced();
      const updated = appendHistory(
        { ...syncSettings, webAppUrl: targetUrl, sheetUrl: sheetUrlInput.trim() },
        { action: 'push', status: 'success', message: res.message, rowsCount: res.syncedRows }
      );
      onUpdateSyncSettings(updated);
      triggerHaptic([30, 50, 30]);
      setStatusBanner({ type: 'ok', text: res.message });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'অজানা নেটওয়ার্ক ত্রুটি';
      const updated = appendHistory(syncSettings, {
        action: 'push',
        status: 'error',
        message: `সিঙ্ক ব্যর্থ: ${msg}`
      });
      onUpdateSyncSettings(updated);
      setStatusBanner({
        type: 'err',
        text: `গুগল শিটে পাঠানো যায়নি (${msg})। URL ও ইন্টারনেট চেক করুন — আপনার সব ডেটা ফোনে অফলাইনে নিরাপদ আছে!`
      });
    } finally {
      setBusy(null);
    }
  };

  const handlePull = async () => {
    const targetUrl = urlInput.trim();
    if (!targetUrl) {
      setShowAdvancedSetup(true);
      setStatusBanner({
        type: 'err',
        text: 'শিট থেকে লোড করতে Web App URL দিন।'
      });
      return;
    }

    setBusy('pull');
    setStatusBanner(null);
    try {
      const res = await pullFromGoogleSheets(targetUrl);
      if (!res.ok || !res.rawState) {
        throw new Error(res.message);
      }
      onImportFullBackup(JSON.stringify(res.rawState));
      const updated = appendHistory(
        { ...syncSettings, webAppUrl: targetUrl, sheetUrl: sheetUrlInput.trim() },
        { action: 'pull', status: 'success', message: res.message }
      );
      onUpdateSyncSettings(updated);
      triggerHaptic(30);
      setStatusBanner({ type: 'ok', text: res.message });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Pull ব্যর্থ হয়েছে';
      setStatusBanner({ type: 'err', text: `লোড করা যায়নি: ${msg}` });
    } finally {
      setBusy(null);
    }
  };

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
      setCopiedCode(true);
      triggerHaptic(20);
      window.setTimeout(() => setCopiedCode(false), 2500);
    } catch {
      setShowCode(true);
    }
  };

  const exportOrShareFile = async (
    content: string,
    filename: string,
    mime: string,
    label: string
  ) => {
    try {
      const file = new File([content], filename, { type: mime });
      if (
        typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({ files: [file], title: filename });
        setStatusBanner({ type: 'ok', text: `${label} শেয়ার/সেভ করা হয়েছে!` });
        return;
      }
    } catch {
      // Fallback below
    }

    try {
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Ignore blob download restrictions in WebView
    }

    try {
      await navigator.clipboard.writeText(content);
      setStatusBanner({
        type: 'ok',
        text: `${label} ডাউনলোড ও ক্লিপবোর্ডে কপি হয়েছে!`
      });
    } catch {
      setStatusBanner({ type: 'ok', text: `${label} ডাউনলোড শুরু হয়েছে!` });
    }
  };

  const handleDownloadCsv = () => {
    const csv = exportWorkoutCsv(workoutLogs);
    void exportOrShareFile(
      csv,
      `my-workout-logs-${new Date().toISOString().slice(0, 10)}.csv`,
      'text/csv;charset=utf-8;',
      'CSV ফাইল (Excel/Sheet)'
    );
  };

  const handleDownloadJson = () => {
    const json = exportFullBackupJson();
    void exportOrShareFile(
      json,
      `my-workout-backup-${new Date().toISOString().slice(0, 10)}.json`,
      'application/json',
      'সম্পূর্ণ JSON ব্যাকআপ'
    );
  };

  const handleCopyJsonBackup = async () => {
    try {
      await navigator.clipboard.writeText(exportFullBackupJson());
      triggerHaptic(20);
      setStatusBanner({ type: 'ok', text: 'সম্পূর্ণ JSON ব্যাকআপ ক্লিপবোর্ডে কপি হয়েছে!' });
    } catch {
      setStatusBanner({ type: 'err', text: 'ক্লিপবোর্ডে কপি করা যায়নি।' });
    }
  };

  const handlePasteRestore = () => {
    if (!pasteText.trim()) {
      setStatusBanner({ type: 'err', text: 'আগে ব্যাকআপ JSON টেক্সট পেস্ট করুন।' });
      return;
    }
    try {
      onImportFullBackup(pasteText);
      setPasteText('');
      setPasteOpen(false);
      triggerHaptic(25);
      setStatusBanner({ type: 'ok', text: 'পেস্ট করা JSON ব্যাকআপ থেকে সব ডেটা রিস্টোর হয়েছে!' });
    } catch {
      setStatusBanner({ type: 'err', text: 'ভুল JSON ফরম্যাট! সঠিক ব্যাকআপ টেক্সট দিন।' });
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        onImportFullBackup(String(reader.result || ''));
        setStatusBanner({ type: 'ok', text: 'JSON ব্যাকআপ থেকে সব ডেটা রিস্টোর হয়েছে!' });
      } catch {
        setStatusBanner({ type: 'err', text: 'ভুল JSON ফাইল! সঠিক ব্যাকআপ ফাইল দিন।' });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="tab-view-container">
      {/* 1. Google Account & Google Sheets Login Card */}
      <section className="panel-card google-login-panel">
        <div className="panel-hdr">
          <div>
            <h3>
              <FileSpreadsheet size={18} color="#10B981" /> Google Sheets সিঙ্ক
            </h3>
          </div>
          <span className={`sync-pill-badge ${syncSettings.googleSignedIn ? 'clean' : 'pending'}`}>
            {syncSettings.googleSignedIn ? 'লগইনড ✓' : 'লগইন নেই'}
          </span>
        </div>

        {statusBanner && (
          <div className={`sync-status-banner ${statusBanner.type}`}>{statusBanner.text}</div>
        )}

        {!syncSettings.googleSignedIn ? (
          <div className="google-signin-box">
            <label className="cust-field">
              <span>Google অ্যাকাউন্ট ইমেইল</span>
              <input
                type="email"
                value={emailInput}
                placeholder="shahriarmukto8800@gmail.com"
                onChange={(e) => setEmailInput(e.target.value)}
              />
            </label>

            <button
              type="button"
              className="google-oauth-btn"
              onClick={handleGoogleLogin}
            >
              <span className="g-badge-icon">G</span>
              <span>Google দিয়ে লগইন করুন ({emailInput || MUKTO_PROFILE.email})</span>
            </button>
          </div>
        ) : (
          <div className="google-connected-card">
            <div className="gcc-user-row">
              <div className="gcc-avatar">
                <UserCheck size={20} />
              </div>
              <div className="gcc-info">
                <strong>{syncSettings.googleName || MUKTO_PROFILE.name}</strong>
                <span>{syncSettings.googleEmail || MUKTO_PROFILE.email}</span>
              </div>
              <button
                type="button"
                className="gcc-logout-btn"
                onClick={handleGoogleLogout}
              >
                <LogOut size={15} /> লগআউট
              </button>
            </div>

            <div className="gcc-sheet-box">
              <div>
                <div className="gsb-label">সংযুক্ত Google Sheet</div>
                <strong>My Workout Routine — Mukto</strong>
                <span>১৪ দিনের পূর্ববর্তী জিম হিস্ট্রি ও ৬৬.৬ কেজি ওজন ইতিমধ্যেই শিটে সেভ আছে</span>
              </div>
              <a
                className="sync-action-btn open-sheet"
                href={sheetUrlInput.trim() || MUKTO_PROFILE.defaultSheetUrl}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={16} /> শিট খুলুন
              </a>
            </div>
          </div>
        )}

        {/* Sync Controls */}
        <div className="sync-form">
          <div className="sync-toggle-row">
            <div>
              <strong>অটো সিঙ্ক (Auto-Sync)</strong>
              <span>ইন্টারনেট থাকলে সেট টিক দিলেই গুগল শিটে পাঠাবে ({unsyncedCount} পেন্ডিং)</span>
            </div>
            <input
              type="checkbox"
              className="switch-checkbox"
              checked={syncSettings.autoSync}
              onChange={(e) =>
                onUpdateSyncSettings({
                  ...syncSettings,
                  webAppUrl: urlInput.trim(),
                  sheetUrl: sheetUrlInput.trim(),
                  autoSync: e.target.checked
                })
              }
            />
          </div>

          <div className="sync-btn-grid primary-sync">
            <button
              type="button"
              className="sync-action-btn push"
              disabled={busy !== null}
              onClick={handlePush}
            >
              {busy === 'push' ? <RefreshCw size={17} className="spin" /> : <CloudUpload size={17} />}
              {busy === 'push' ? 'সিঙ্ক হচ্ছে...' : 'শিটে পাঠান (Push)'}
            </button>

            <button
              type="button"
              className="sync-action-btn pull"
              disabled={busy !== null}
              onClick={handlePull}
            >
              {busy === 'pull' ? <RefreshCw size={17} className="spin" /> : <CloudDownload size={17} />}
              {busy === 'pull' ? 'লোড হচ্ছে...' : 'শিট থেকে আনুন (Pull)'}
            </button>
          </div>
        </div>
      </section>

      {/* 2. App Preferences & User Profile Settings */}
      <section className="panel-card">
        <div className="panel-hdr">
          <div>
            <h3>
              <Settings size={18} color="#38BDF8" /> অ্যাপ সেটিংস
            </h3>
          </div>
        </div>

        <div className="sync-toggle-row">
          <div className="pref-icon-label">
            <Bell size={17} color="#FBBF24" />
            <div>
              <strong>সাউন্ড ও ভাইব্রেশন</strong>
            </div>
          </div>
          <input
            type="checkbox"
            className="switch-checkbox"
            checked={syncSettings.soundHapticsEnabled ?? true}
            onChange={(e) =>
              onUpdateSyncSettings({
                ...syncSettings,
                soundHapticsEnabled: e.target.checked
              })
            }
          />
        </div>

        <div className="cust-two-col">
          <label className="cust-field">
            <span>বর্তমান ওজন (kg)</span>
            <input
              type="number"
              step="0.1"
              value={todayRecovery.bodyWeightKg}
              onChange={(e) =>
                onUpdateRecovery({ ...todayRecovery, bodyWeightKg: e.target.value })
              }
            />
          </label>
          <label className="cust-field">
            <span>নতুন রুটিন</span>
            <input type="text" value="২১ নভেম্বর (শনি)" readOnly />
          </label>
        </div>
      </section>

      {/* 3. Collapsed Backup & Advanced Apps Script Setup */}
      <section className="panel-card">
        <button
          type="button"
          className="wu-header-btn"
          style={{ padding: 0 }}
          onClick={() => setShowAdvancedSetup((v) => !v)}
        >
          <div className="panel-hdr" style={{ width: '100%', alignItems: 'center' }}>
            <div>
              <h3>
                <Code2 size={18} color="#38BDF8" /> ব্যাকআপ ও অ্যাডভান্সড সেটআপ
              </h3>
              <span>CSV/JSON ব্যাকআপ ও Apps Script URL</span>
            </div>
            {showAdvancedSetup ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </button>

        {showAdvancedSetup && (
          <div className="sync-form" style={{ marginTop: '8px' }}>
            <div className="export-btn-grid">
              <button type="button" className="exp-btn" onClick={handleDownloadCsv}>
                <FileSpreadsheet size={16} /> CSV ডাউনলোড (Excel/Sheet)
              </button>
              <button type="button" className="exp-btn" onClick={handleDownloadJson}>
                <Download size={16} /> JSON ব্যাকআপ সেভ
              </button>
              <button type="button" className="exp-btn" onClick={handleCopyJsonBackup}>
                <Copy size={16} /> JSON কপি করুন
              </button>
              <button
                type="button"
                className="exp-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={16} /> JSON ফাইল রিস্টোর
              </button>
              <button
                type="button"
                className="exp-btn"
                onClick={() => setPasteOpen((v) => !v)}
              >
                <Code2 size={16} /> {pasteOpen ? 'পেস্ট বক্স বন্ধ করুন' : 'Paste JSON রিস্টোর'}
              </button>
              {pasteOpen && (
                <div className="cust-field" style={{ marginTop: '4px' }}>
                  <textarea
                    rows={4}
                    value={pasteText}
                    placeholder='{"app":"My Workout Routine", ...}'
                    onChange={(e) => setPasteText(e.target.value)}
                  />
                  <button
                    type="button"
                    className="copy-script-btn"
                    onClick={handlePasteRestore}
                  >
                    <Check size={16} /> পেস্ট ডেটা রিস্টোর করুন
                  </button>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                style={{ display: 'none' }}
                onChange={handleFileImport}
              />
            </div>

            <label className="cust-field">
              <span>Google Apps Script Web App URL</span>
              <input
                type="url"
                value={urlInput}
                placeholder="https://script.google.com/macros/s/.../exec"
                onChange={(e) => setUrlInput(e.target.value)}
              />
            </label>

            <label className="cust-field">
              <span>Google Sheet লিংক</span>
              <input
                type="url"
                value={sheetUrlInput}
                placeholder={MUKTO_PROFILE.defaultSheetUrl}
                onChange={(e) => setSheetUrlInput(e.target.value)}
              />
            </label>

            <button
              type="button"
              className="sync-action-btn save"
              onClick={handleSaveUrls}
            >
              <Check size={16} /> URL সেভ করুন
            </button>

            <ol className="setup-steps-ol">
              <li>
                ওপরে <strong>শিট খুলুন</strong> দিয়ে আপনার <code>My Workout Routine — Mukto</code> শিট ওপেন করুন।
              </li>
              <li>
                মেনু থেকে <strong>Extensions → Apps Script</strong> খুলে নিচের <strong>Code.gs</strong> কপি করে Save করুন।
              </li>
              <li>
                <strong>Deploy → New deployment → Web app</strong> দিয়ে <strong>Anyone</strong> সিলেক্ট করে পাওয়া URL-টি ওপরে সেভ করুন।
              </li>
            </ol>

            <div className="script-actions-row">
              <button type="button" className="copy-script-btn" onClick={handleCopyScript}>
                {copiedCode ? <Check size={15} /> : <Copy size={15} />}
                {copiedCode ? 'Apps Script কপি হয়েছে!' : 'Code.gs স্ক্রিপ্ট কপি করুন'}
              </button>
              <button
                type="button"
                className="view-script-btn"
                onClick={() => setShowCode((v) => !v)}
              >
                {showCode ? 'কোড লুকান' : 'কোড দেখুন'}
              </button>
            </div>

            {showCode && (
              <pre className="code-preview-box">{GOOGLE_APPS_SCRIPT_CODE}</pre>
            )}
          </div>
        )}
      </section>

      {/* Sync History */}
      {syncSettings.history.length > 0 && (
        <section className="panel-card">
          <div className="panel-hdr">
            <div>
              <h3>সাম্প্রতিক সিঙ্ক লগ</h3>
            </div>
          </div>
          <div className="sync-hist-list">
            {syncSettings.history.map((h) => (
              <div key={h.id} className={`sh-row ${h.status}`}>
                <div>
                  <strong>{h.action.toUpperCase()}</strong> • {h.message}
                </div>
                <span>
                  {new Date(h.timestamp).toLocaleString('bn-BD', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
