import React, { useState, useRef, useEffect } from 'react';
import ApiService from '../services/api';
import { outcomeColor, outcomeLabel, formatMillions } from '../utils/currency';

const SUGGESTED_PROMPTS = [
  'What is the root cause of the risk for this submission?',
  'What are the top recommended interventions?',
  'What is the financial impact if this is not resolved?',
  'How does this compare to similar submissions?',
  'What regulatory precedents are relevant here?',
];

const outcomeRiskClass = (outcome, confidence) => {
  if (outcome === 'CRL_Received' || outcome === 'Withdrawn') return 'urgent';
  if (outcome === 'Delayed') return 'high';
  if (parseFloat(confidence) >= 0.7) return 'high';
  return 'watch';
};

// ── Disclaimer bar shown at the bottom of every chat ──
const AIDisclaimer = () => (
  <div style={{
    padding: '6px 16px',
    background: '#0a0f17',
    borderTop: '1px solid #1F2937',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  }}>
    <span style={{ fontSize: 9, color: '#FF5F02', flexShrink: 0 }}>⚠</span>
    <span style={{ fontSize: 9, color: '#4B5563', lineHeight: 1.4 }}>
      AI-generated responses are based on available submission data and may contain errors or omissions.
      Always verify recommendations with your regulatory affairs team before taking action.
    </span>
  </div>
);

// ── Reusable chat panel content — used in both inline and fullscreen ──
const ChatPanel = ({
  selected,
  chatContext,
  messages,
  isLoading,
  contextLoading,
  inputValue,
  setInputValue,
  sendMessage,
  messagesRef,
  chatEndRef,
  isFullscreen,
  onToggleFullscreen,
}) => {
  if (!selected) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 12,
      }}>
        <div style={{ fontSize: 32 }}>💬</div>
        <div style={{ fontSize: 13, color: '#6B7280', textAlign: 'center', maxWidth: 280 }}>
          Select a submission from the queue to start an AI-assisted intervention analysis
        </div>
      </div>
    );
  }

  const oColor = outcomeColor(selected.Predicted_Outcome);

  return (
    <>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #1F2937',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0,
        background: '#0D1117',
      }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#F9FAFB' }}>
            {selected.Product} — {selected.Protocol_ID}
          </div>
          <div style={{ fontSize: 10, color: '#6B7280' }}>
            {selected.Country_Code} · {selected.Regulatory_Authority}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            fontSize: 9, color: oColor,
            background: `${oColor}22`,
            border: `1px solid ${oColor}44`,
            borderRadius: 4, padding: '3px 8px', fontWeight: 700,
          }}>
            {outcomeLabel(selected.Predicted_Outcome)} · {Math.round((parseFloat(selected.Confidence) || 0) * 100)}% conf
          </div>
          {/* Fullscreen toggle button */}
          <button
            onClick={onToggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen' : 'Open fullscreen'}
            style={{
              background: 'transparent',
              border: '1px solid #374151',
              color: '#9CA3AF',
              borderRadius: 4,
              width: 28, height: 28,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13,
              transition: 'all 0.15s',
              flexShrink: 0,
            }}
            onMouseEnter={e => { e.target.style.borderColor = '#FF5F02'; e.target.style.color = '#FF5F02'; }}
            onMouseLeave={e => { e.target.style.borderColor = '#374151'; e.target.style.color = '#9CA3AF'; }}
          >
            {isFullscreen ? '⊠' : '⛶'}
          </button>
        </div>
      </div>

      {/* ── Scrollable message area ── */}
      <div
        ref={messagesRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          minHeight: 0,
          scrollbarWidth: 'thin',
          scrollbarColor: '#374151 #0D1117',
        }}
      >
        {contextLoading ? (
          <div style={{ color: '#6B7280', fontSize: 12, textAlign: 'center', marginTop: 20 }}>
            Loading submission context...
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}>
              {msg.role !== 'system' && (
                <div style={{
                  fontSize: 9, color: '#4B5563', marginBottom: 3,
                  paddingLeft: msg.role === 'user' ? 0 : 4,
                  paddingRight: msg.role === 'user' ? 4 : 0,
                }}>
                  {msg.role === 'user' ? 'You' : '🤖 AI Assistant'}
                </div>
              )}
              <div style={{
                maxWidth: '85%',
                padding: '10px 14px',
                borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                background: msg.role === 'user'
                  ? 'rgba(255,95,2,0.15)'
                  : msg.role === 'system'
                  ? '#161B22'
                  : '#1F2937',
                border: msg.role === 'user'
                  ? '1px solid rgba(255,95,2,0.3)'
                  : '1px solid #374151',
                fontSize: 12,
                lineHeight: 1.6,
                color: msg.role === 'system' ? '#6B7280' : '#F9FAFB',
                fontStyle: msg.role === 'system' ? 'italic' : 'normal',
                whiteSpace: 'pre-wrap',
              }}>
                {msg.text}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <div style={{ fontSize: 9, color: '#4B5563', marginBottom: 3, paddingLeft: 4 }}>🤖 AI Assistant</div>
            <div style={{
              padding: '10px 14px', background: '#1F2937', border: '1px solid #374151',
              borderRadius: '12px 12px 12px 4px', fontSize: 12, color: '#6B7280',
            }}>
              <span style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>Analyzing...</span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Suggested prompts */}
      {messages.length <= 1 && !isLoading && (
        <div style={{
          padding: '8px 16px',
          display: 'flex', flexWrap: 'wrap', gap: 6,
          flexShrink: 0,
          borderTop: '1px solid #1F2937',
          background: '#0D1117',
        }}>
          <div style={{ width: '100%', fontSize: 9, color: '#4B5563', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Suggested prompts
          </div>
          {SUGGESTED_PROMPTS.map((prompt, i) => (
            <button
              key={i}
              onClick={() => sendMessage(prompt)}
              style={{
                background: 'transparent', border: '1px solid #374151', color: '#9CA3AF',
                borderRadius: 20, padding: '5px 12px', fontSize: 11, cursor: 'pointer',
                transition: 'all 0.15s', fontFamily: 'Inter, sans-serif',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#FF5F02'; e.currentTarget.style.color = '#FF5F02'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#374151'; e.currentTarget.style.color = '#9CA3AF'; }}
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input row */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid #1F2937',
        display: 'flex', gap: 8,
        flexShrink: 0,
        background: '#0D1117',
      }}>
        <input
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage(inputValue)}
          placeholder="Ask about this submission..."
          disabled={isLoading || contextLoading}
          style={{
            flex: 1, background: '#161B22', border: '1px solid #374151',
            borderRadius: 6, color: '#F9FAFB', padding: '9px 14px',
            fontSize: 13, outline: 'none', fontFamily: 'Inter, sans-serif',
          }}
        />
        <button
          onClick={() => sendMessage(inputValue)}
          disabled={isLoading || !inputValue.trim()}
          style={{
            background: isLoading || !inputValue.trim() ? '#374151' : '#FF5F02',
            color: 'white', border: 'none', borderRadius: 6, padding: '0 16px',
            cursor: isLoading || !inputValue.trim() ? 'default' : 'pointer',
            fontSize: 13, fontWeight: 600, transition: 'background 0.15s',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          Send
        </button>
      </div>

      {/* AI Disclaimer */}
      <AIDisclaimer />
    </>
  );
};

// ── Main component ──
const InterventionChat = ({ interventions, selectedCard }) => {
  const [selected, setSelected]             = useState(null);
  const [chatContext, setChatContext]        = useState(null);
  const [messages, setMessages]             = useState([]);
  const [inputValue, setInputValue]         = useState('');
  const [isLoading, setIsLoading]           = useState(false);
  const [contextLoading, setContextLoading] = useState(false);
  const [isFullscreen, setIsFullscreen]     = useState(false);
  const chatEndRef  = useRef(null);
  const messagesRef = useRef(null);

  useEffect(() => {
    if (selectedCard) handleSelectIntervention(selectedCard);
  }, [selectedCard]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Lock body scroll when fullscreen is open
  useEffect(() => {
    document.body.style.overflow = isFullscreen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isFullscreen]);

  const normalizeToIntervention = (item) => ({
    Protocol_ID:              item.Protocol_ID          || item.Actv_Id,
    Country_Code:             item.Country_Code         || item.Ctry_Cd_Iso3,
    Product:                  item.Product              || item.Prod_Brnd_Nm,
    Regulatory_Authority:     item.Regulatory_Authority,
    Confidence:               item.Confidence,
    Predicted_Outcome:        item.Predicted_Outcome,
    Prob_Approved:            item.Prob_Approved,
    Prob_Delayed:             item.Prob_Delayed,
    Prob_CRL:                 item.Prob_CRL,
    Prob_Withdrawn:           item.Prob_Withdrawn,
    Revenue_At_Risk_Millions: item.Revenue_At_Risk_Millions,
    Days_Overdue:             item.Days_Overdue,
    Recommended_Action:       item.Recommended_Action,
    Open_Deficiencies_Cnt:    item.Open_Deficiencies_Cnt,
    CMC_Readiness_Score:      item.CMC_Readiness_Score,
    GMP_Site_Status:          item.GMP_Site_Status,
  });

  const handleSelectIntervention = async (intervention) => {
    const normalized = normalizeToIntervention(intervention);
    setSelected(normalized);
    setMessages([]);
    setContextLoading(true);
    try {
      const ctx = await ApiService.getInterventionChatContext(
        normalized.Protocol_ID,
        normalized.Country_Code
      );
      setChatContext(ctx);
      const confPct = Math.round((parseFloat(normalized.Confidence) || 0) * 100);
      setMessages([{
        role: 'system',
        text: `Context loaded for ${normalized.Product} (${normalized.Protocol_ID} · ${normalized.Country_Code}).\nPredicted outcome: ${outcomeLabel(normalized.Predicted_Outcome)} — ${confPct}% confidence.\nRevenue at risk: ${formatMillions(normalized.Revenue_At_Risk_Millions)}.\nAsk a question below or use a suggested prompt.`,
      }]);
    } catch (err) {
      console.error('Failed to load chat context:', err);
      setChatContext(null);
      setMessages([{ role: 'system', text: 'Failed to load context for this submission.' }]);
    } finally {
      setContextLoading(false);
    }
  };

  const sendMessage = async (text) => {
    if (!text.trim() || isLoading) return;
    setMessages(prev => [...prev, { role: 'user', text }]);
    setInputValue('');
    setIsLoading(true);

    try {
      const contextPayload = chatContext
        ? `SUBMISSION CONTEXT:
Protocol ID: ${selected.Protocol_ID}
Product: ${selected.Product}
Country: ${selected.Country_Code}
Predicted Outcome: ${selected.Predicted_Outcome} (${Math.round((parseFloat(selected.Confidence) || 0) * 100)}% confidence)
Prob Approved: ${Math.round((parseFloat(selected.Prob_Approved) || 0) * 100)}%
Prob Delayed: ${Math.round((parseFloat(selected.Prob_Delayed) || 0) * 100)}%
Prob CRL: ${Math.round((parseFloat(selected.Prob_CRL) || 0) * 100)}%
Prob Withdrawn: ${Math.round((parseFloat(selected.Prob_Withdrawn) || 0) * 100)}%
Recommended Action: ${selected.Recommended_Action || 'N/A'}
Days Overdue: ${selected.Days_Overdue}
Revenue At Risk: ${formatMillions(selected.Revenue_At_Risk_Millions)}
GMP Site Status: ${selected.GMP_Site_Status || 'N/A'}
CMC Readiness: ${selected.CMC_Readiness_Score || 'N/A'}/10
Open Deficiencies: ${selected.Open_Deficiencies_Cnt || 0}
${chatContext.context ? `Additional context: ${JSON.stringify(chatContext.context)}` : ''}`
        : `Protocol: ${selected?.Protocol_ID}, Product: ${selected?.Product}`;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: `You are a pharmaceutical regulatory affairs expert assistant analyzing submission data from a Teradata regulatory intelligence platform.
You help regulatory operations teams understand submission risks, root causes of delays, and recommended interventions.
Be specific, concise, and actionable. Reference the submission context data provided.
Cite specific risk factors from the context. Suggest concrete next steps.
Format your response in plain text without markdown headers. Keep answers to 3-5 sentences unless more detail is clearly needed.`,
          messages: [
            ...messages
              .filter(m => m.role !== 'system' && m.text && m.text.trim())
              .map(m => ({
                role:    m.role === 'assistant' ? 'assistant' : 'user',
                content: m.text.trim(),
              })),
            { role: 'user', content: `${contextPayload}\n\nQuestion: ${text}` },
          ],
        }),
      });

      const data = await response.json();
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: data.response || data.error || 'No response received.',
      }]);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: 'Unable to connect to the AI service. Please check your network and try again.',
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const urgentCount = interventions.filter(i =>
    i.Predicted_Outcome === 'CRL_Received' || i.Predicted_Outcome === 'Withdrawn'
  ).length;

  const sharedChatProps = {
    selected, chatContext, messages, isLoading, contextLoading,
    inputValue, setInputValue, sendMessage,
    messagesRef, chatEndRef,
    isFullscreen, onToggleFullscreen: () => setIsFullscreen(f => !f),
  };

  return (
    <>
      {/* ── INLINE PANEL ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', height: 600, overflow: 'hidden' }}>

        {/* LEFT: Queue */}
        <div style={{ borderRight: '1px solid #1F2937', overflowY: 'auto', background: '#0D1117', display: 'flex', flexDirection: 'column' }}>
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid #1F2937',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            position: 'sticky', top: 0, background: '#0D1117', zIndex: 1,
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Queue ({interventions.length})
            </span>
            {urgentCount > 0 && (
              <span style={{
                fontSize: 9, background: 'rgba(239,68,68,0.15)', color: '#EF4444',
                border: '1px solid rgba(239,68,68,0.3)', borderRadius: 3, padding: '2px 6px', fontWeight: 700,
              }}>
                {urgentCount} URGENT
              </span>
            )}
          </div>

          {interventions.map((item, i) => {
            const outcome  = item.Predicted_Outcome;
            const color    = outcomeColor(outcome);
            const urgency  = outcomeRiskClass(outcome, item.Confidence);
            const isActive = selected?.Protocol_ID === item.Protocol_ID && selected?.Country_Code === item.Country_Code;
            const confPct  = Math.round((parseFloat(item.Confidence) || 0) * 100);

            return (
              <div
                key={i}
                onClick={() => handleSelectIntervention(item)}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #161B22',
                  borderLeft: `3px solid ${urgency === 'urgent' ? '#EF4444' : urgency === 'high' ? '#F59E0B' : '#3B82F6'}`,
                  background: isActive ? '#161B22' : 'transparent',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                  flexShrink: 0,
                }}
                onMouseEnter={e => !isActive && (e.currentTarget.style.background = '#0F1923')}
                onMouseLeave={e => !isActive && (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: '#FF5F02', fontWeight: 600 }}>{item.Protocol_ID}</span>
                  <span style={{
                    fontSize: 9, color,
                    background: `${color}22`, border: `1px solid ${color}44`,
                    borderRadius: 3, padding: '1px 5px', fontWeight: 700,
                  }}>
                    {outcomeLabel(outcome)}
                  </span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#F9FAFB', marginBottom: 2 }}>{item.Product}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <div style={{ flex: 1, height: 3, background: '#1F2937', borderRadius: 2 }}>
                    <div style={{ height: '100%', width: `${confPct}%`, background: color, borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: 9, color: '#6B7280', whiteSpace: 'nowrap' }}>{confPct}% conf</span>
                </div>
                <div style={{ fontSize: 10, color: '#6B7280' }}>{item.Country_Code} · {item.Regulatory_Authority}</div>
                {parseFloat(item.Revenue_At_Risk_Millions) > 0 && (
                  <div style={{ fontSize: 10, color: '#EF4444', marginTop: 4, fontWeight: 600 }}>
                    {formatMillions(item.Revenue_At_Risk_Millions)} at risk
                  </div>
                )}
                {isActive && (
                  <div style={{ marginTop: 5, fontSize: 9, color: '#FF5F02', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#FF5F02', display: 'inline-block' }} />
                    SELECTED
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* RIGHT: Chat panel */}
        <div style={{ display: 'flex', flexDirection: 'column', background: '#0D1117', minHeight: 0, overflow: 'hidden' }}>
          <ChatPanel {...sharedChatProps} />
        </div>
      </div>

      {/* ── FULLSCREEN OVERLAY ── */}
      {isFullscreen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 9999,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
          onClick={(e) => { if (e.target === e.currentTarget) setIsFullscreen(false); }}
        >
          <div style={{
            width: '100%',
            maxWidth: 900,
            height: '90vh',
            background: '#0D1117',
            border: '1px solid #1F2937',
            borderRadius: 10,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          }}>
            {/* Fullscreen title bar */}
            <div style={{
              padding: '10px 16px',
              background: '#00233C',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'white', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                🤖 AI Intervention Analysis
                {selected && (
                  <span style={{ color: '#FF5F02', marginLeft: 10, fontWeight: 400 }}>
                    — {selected.Product} · {selected.Protocol_ID}
                  </span>
                )}
              </div>
              <button
                onClick={() => setIsFullscreen(false)}
                style={{
                  background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white',
                  borderRadius: 4, width: 28, height: 28, cursor: 'pointer',
                  fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                ✕
              </button>
            </div>
            <ChatPanel {...sharedChatProps} />
          </div>
        </div>
      )}
    </>
  );
};

export default InterventionChat;
