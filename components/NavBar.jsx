const TABS = [
  { view: 'assistant', label: 'Assistant' },
  { view: 'request', label: 'Submit a Request' },
  { view: 'ticket', label: 'Check My Ticket' }
];

export default function NavBar({ activeView, onChangeView }) {
  return (
    <header className="topbar">
      <img src="/takanock-logo.png" alt="Takanock" style={{ height: '32px', width: 'auto' }} />
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
    </header>
  );
}
