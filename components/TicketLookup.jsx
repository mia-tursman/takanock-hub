import { useState } from 'react';

const TICKET_SECTIONS = [
  { type: 'it', title: 'IT Requests' },
  { type: 'gis', title: 'GIS Requests' },
  { type: 'automation', title: 'Automation Ideas' }
];
const TICKET_WINDOW_DAYS = 10;

function truncate(s, n) {
  s = s || '';
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  // Take just the date portion (YYYY-MM-DD) to avoid timezone shifts
  const datePart = dateStr.split('T')[0];
  const [year, month, day] = datePart.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[parseInt(month) - 1] + ' ' + parseInt(day);
}

function statusBadgeClass(status) {
  const s = (status || '').toLowerCase();
  if (s.indexOf('progress') !== -1) return 'in-progress';
  if (s.indexOf('resolved') !== -1) return 'resolved';
  if (s.indexOf('closed') !== -1) return 'closed';
  return 'new';
}

// Tickets with a missing/unparseable date are treated as "older" rather
// than recent, so they only surface behind "View past requests" instead
// of silently mixing into the default recent view.
function isRecentTicket(t) {
  const d = new Date(t.submittedAt);
  if (isNaN(d.getTime())) return false;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - TICKET_WINDOW_DAYS);
  return d >= cutoff;
}

function TicketTable({ tickets }) {
  return (
    <table className="tickets">
      <thead>
        <tr><th>Name</th><th>Request Type</th><th>Status</th><th>Submitted</th><th>Description</th></tr>
      </thead>
      <tbody>
        {tickets.map((t, i) => (
          <tr key={i}>
            <td>{t.name || '—'}</td>
            <td>{t.request || '—'}</td>
            <td><span className={'badge ' + statusBadgeClass(t.status)}>{t.status || 'New'}</span></td>
            <td>{formatDate(t.submittedAt)}</td>
            <td>{truncate(t.description, 60)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TicketSection({ section, tickets, showAll, onToggle }) {
  const sectionTickets = tickets.filter((t) => t.type === section.type);
  const recent = sectionTickets.filter(isRecentTicket);
  const older = sectionTickets.filter((t) => !isRecentTicket(t));
  const visible = showAll ? sectionTickets : recent;

  return (
    <>
      <h2 style={{ fontSize: '15px', margin: '24px 0 12px' }}>{section.title}</h2>
      <div>
        {!visible.length ? (
          <p className="muted">No requests in the past 10 days.</p>
        ) : (
          <TicketTable tickets={visible} />
        )}
        {showAll ? (
          <button type="button" className="link-toggle" onClick={() => onToggle(section.type, false)}>Hide past requests</button>
        ) : (
          older.length > 0 && (
            <button type="button" className="link-toggle" onClick={() => onToggle(section.type, true)}>View past requests</button>
          )
        )}
      </div>
    </>
  );
}

export default function TicketLookup() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | searching | done
  const [tickets, setTickets] = useState([]);
  const [bannerError, setBannerError] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [submitDisabled, setSubmitDisabled] = useState(false);

  function toggleSection(type, showAll) {
    setExpanded((prev) => ({ ...prev, [type]: showAll }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;

    setBannerError(null);
    setStatus('searching');
    setExpanded({});
    setSubmitDisabled(true);

    fetch('/api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lookup_email: trimmed })
    })
      .then((r) => r.json())
      .then((data) => {
        if (data && data.error) {
          setStatus('idle');
          setBannerError('Unable to retrieve tickets. Please try again.');
          return;
        }
        const list = Array.isArray(data) ? data : (data.tickets || []);
        setTickets(list);
        setStatus('done');
      })
      .catch(() => {
        setStatus('idle');
        setBannerError('Unable to retrieve tickets. Please try again.');
      })
      .then(() => setSubmitDisabled(false));
  }

  return (
    <div className="ticket-wrap">
      <form className="ticket-lookup-form" onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="you@takanock.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit" className="submit-btn" disabled={submitDisabled}>Find My Tickets</button>
      </form>
      <div>
        {bannerError && <div className="banner error">{bannerError}</div>}
      </div>
      <div>
        {status === 'searching' && <p className="muted">Searching...</p>}
        {status === 'done' && (
          <>
            <p className="muted">Showing requests from the past 10 days.</p>
            {TICKET_SECTIONS.map((section) => (
              <TicketSection
                key={section.type}
                section={section}
                tickets={tickets}
                showAll={!!expanded[section.type]}
                onToggle={toggleSection}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
