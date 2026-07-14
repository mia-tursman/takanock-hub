import { useEffect, useState } from 'react';

const TABS = [
  { view: 'assistant', label: 'Assistant' },
  { view: 'request', label: 'Submit a Request' },
  { view: 'ticket', label: 'Check My Ticket' }
];

export default function NavBar({ activeView, onChangeView }) {
  const [installPrompt, setInstallPrompt] = useState(null);

  useEffect(() => {
    function handleBeforeInstallPrompt(e) {
      e.preventDefault();
      setInstallPrompt(e);
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  function handleInstallClick() {
    if (!installPrompt) return;
    installPrompt.prompt();
    installPrompt.userChoice.then(() => {
      setInstallPrompt(null);
    });
  }

  return (
    <header className="topbar">
      <img src="/takanock-logo.png" alt="Takanock" style={{ height: '24px', width: 'auto' }} />
      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.view}
            className={'tab' + (activeView === t.view ? ' active' : '')}
            onClick={() => onChangeView(t.view)}
          >
            {t.label}
          </button>
        ))}
      </nav>
      {installPrompt && (
        <button type="button" className="link-toggle" onClick={handleInstallClick}>
          Install App
        </button>
      )}
    </header>
  );
}
