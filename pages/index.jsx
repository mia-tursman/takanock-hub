import { useEffect, useState } from 'react';
import Head from 'next/head';
import NavBar from '../components/NavBar';
import ChatInterface from '../components/ChatInterface';
import ITChat from '../components/ITChat';
import GISChat from '../components/GISChat';
import AutomationChat from '../components/AutomationChat';
import TicketLookup from '../components/TicketLookup';

export default function Home() {
  const [activeView, setActiveView] = useState('assistant');
  const [requestType, setRequestType] = useState('it');

  // main's height is calc(100vh - var(--topbar-height)) — measure the
  // topbar for real instead of guessing a constant, since its rendered
  // height varies with font metrics/loading.
  useEffect(() => {
    const topbarEl = document.querySelector('.topbar');
    function setTopbarHeightVar() {
      if (!topbarEl) return;
      document.documentElement.style.setProperty('--topbar-height', topbarEl.offsetHeight + 'px');
    }
    setTopbarHeightVar();
    window.addEventListener('resize', setTopbarHeightVar);
    return () => window.removeEventListener('resize', setTopbarHeightVar);
  }, []);

  function openIntakeForm(type) {
    setActiveView('request');
    setRequestType(type);
  }

  return (
    <>
      <Head>
        <title>Takanock Assistant Hub</title>
      </Head>

      <NavBar activeView={activeView} onChangeView={setActiveView} />

      <main>
        {/* MODE 1: ASSISTANT */}
        <section id="view-assistant" className={'view' + (activeView === 'assistant' ? ' active' : '')}>
          <ChatInterface onOpenIntakeForm={openIntakeForm} />
        </section>

        {/* MODE 2: SUBMIT A REQUEST */}
        <section id="view-request" className={'view' + (activeView === 'request' ? ' active' : '')}>
          <div className="form-wrap chat-flow-active">
            <div id="request-banner"></div>
            <select
              id="request-type-select"
              className="select-type"
              value={requestType}
              onChange={(e) => setRequestType(e.target.value)}
            >
              <option value="it">IT Help Desk</option>
              <option value="gis">GIS Request</option>
              <option value="automation">Automation Idea</option>
            </select>
            <div id="it-flow" style={{ display: requestType === 'it' ? 'flex' : 'none' }}>
              <ITChat />
            </div>
            <div id="gis-flow" style={{ display: requestType === 'gis' ? 'flex' : 'none' }}>
              <GISChat />
            </div>
            <div id="automation-flow" style={{ display: requestType === 'automation' ? 'flex' : 'none' }}>
              <AutomationChat />
            </div>
          </div>
        </section>

        {/* MODE 3: CHECK MY TICKET */}
        <section id="view-ticket" className={'view' + (activeView === 'ticket' ? ' active' : '')}>
          <TicketLookup />
        </section>
      </main>
    </>
  );
}
