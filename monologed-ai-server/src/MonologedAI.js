import React, { useState, useEffect, useRef } from 'react';
import { Send, Film, User, Bot as BotIconLucide, AlertTriangle, MessageSquare, PlusCircle, Trash2, Menu as MenuIcon, X as XIcon } from 'lucide-react'; // Menu ve X ikonları eklendi
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './MonologedAI.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001';

const MonologedAI = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [error, setError] = useState(null);
  const [chatSessions, setChatSessions] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Sidebar durumu için state

  const messagesEndRef = useRef(null);
  const sidebarRef = useRef(null); // Sidebar referansı
  const menuButtonRef = useRef(null); // Menü butonu referansı
  const inputRef = useRef(null); // Metin girişi referansı


  // Dışarı tıklamayı dinle
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target) &&
        (!menuButtonRef.current || !menuButtonRef.current.contains(event.target))
      ) {
        if (isSidebarOpen) {
          setIsSidebarOpen(false);
        }
      }
    }
    // Mobil görünümde dışarı tıklamayı dinle
    if (window.innerWidth <= 768) {
        document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isSidebarOpen]); // isSidebarOpen değiştiğinde yeniden dinle


  useEffect(() => {
    const savedSessionId = localStorage.getItem('monologedAiCurrentSessionId');
    const savedSessions = JSON.parse(localStorage.getItem('monologedAiChatSessions') || '[]');
    
    setChatSessions(savedSessions);

    if (savedSessionId) {
      setCurrentSessionId(savedSessionId);
    } else if (savedSessions.length > 0) {
      setCurrentSessionId(savedSessions[0].id);
    } else {
      startNewChat(false); 
    }
  }, []);


  useEffect(() => {
    const loadChatHistory = async () => {
      if (currentSessionId) {
        setIsLoading(true);
        setError(null);
        setMessages([]); 
        try {
          const response = await fetch(`${BACKEND_URL}/api/chat/${currentSessionId}`);
          if (!response.ok) {
            if (response.status === 404) { 
              console.warn(`Session ID ${currentSessionId} için geçmiş bulunamadı.`);
              setMessages([
                { id: 'initial-bot-msg', text: "Merhaba! Ben M Deep Mind. Hangi film hakkında konuşmak istersin?", sender: "bot", timestamp: new Date() }
              ]);
              return;
            }
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const history = await response.json();
          const formattedHistory = history.map(msg => ({
            ...msg,
            id: msg.messageId || msg.id, 
            timestamp: new Date(msg.createdAt || msg.timestamp)
          }));

          if (formattedHistory.length > 0) {
            setMessages(formattedHistory);
          } else {
            setMessages([
              { id: 'initial-bot-msg-empty-history', text: "Merhaba! Bu sohbette henüz mesaj yok. Hangi film hakkında konuşmak istersin?", sender: "bot", timestamp: new Date() }
            ]);
          }
        } catch (err) {
          console.error("Konuşma geçmişi yüklenirken hata:", err);
          setError("Konuşma geçmişi yüklenemedi. Lütfen daha sonra tekrar deneyin.");
           setMessages([
            { id: 'initial-bot-msg-error', text: "Merhaba! Bir sorun oluştu. Hangi film hakkında konuşmak istersin?", sender: "bot", timestamp: new Date() }
          ]);
        } finally {
          setIsLoading(false);
        }
      } else if (messages.length === 0 && !isLoading) { 
        setMessages([
            { id: 'initial-bot-msg-no-session', text: "Merhaba! Ben M Deep Mind. Hangi film hakkında konuşmak istersin?", sender: "bot", timestamp: new Date() }
        ]);
      }
    };

    if (currentSessionId) { 
        loadChatHistory();
    } else if (chatSessions.length === 0 && messages.length === 0 && !isLoading) {
        setMessages([
            { id: 'initial-bot-msg-no-sessions-initial', text: "Merhaba! Ben M Deep Mind. Hangi film hakkında konuşmak istersin?", sender: "bot", timestamp: new Date() }
        ]);
    }
  }, [currentSessionId]);


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus();
    }
  }, [isLoading]);

  const handleSend = async () => {
    if (input.trim() === '') return;

    let tempSessionId = currentSessionId;
    let newSessionCreated = false;

    if (!tempSessionId) {
      newSessionCreated = true; 
    }
    
    const userMessage = {
      id: `user-${Date.now()}`,
      text: input,
      sender: 'user',
      timestamp: new Date(),
    };
    setMessages(prevMessages => [...prevMessages, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: currentInput,
          sessionId: tempSessionId, 
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ detail: "Bilinmeyen sunucu hatası." }));
        throw new Error(errData.error || errData.detail || `Sunucu yanıt vermiyor: ${response.status}`);
      }

      const data = await response.json();
      const returnedSessionId = data.sessionId;

      const botMessage = {
        id: `bot-${Date.now()}`, 
        text: data.reply,
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages(prevMessages => [...prevMessages, botMessage]);

      if (returnedSessionId && (!currentSessionId || newSessionCreated)) {
        setCurrentSessionId(returnedSessionId);
        localStorage.setItem('monologedAiCurrentSessionId', returnedSessionId);
        
        setChatSessions(prevSessions => {
          const sessionExists = prevSessions.find(s => s.id === returnedSessionId);
          if (!sessionExists) {
            const newSession = { 
              id: returnedSessionId, 
              title: userMessage.text.substring(0, 30) + (userMessage.text.length > 30 ? "..." : ""),
              timestamp: new Date().toISOString() 
            };
            const updatedSessions = [newSession, ...prevSessions];
            localStorage.setItem('monologedAiChatSessions', JSON.stringify(updatedSessions));
            return updatedSessions;
          }
          // Eğer oturum zaten varsa ama başlığı "Yeni Sohbet" ise güncelle
          else if (sessionExists.title === "Yeni Sohbet" || (newSessionCreated && sessionExists.id === returnedSessionId)) {
             const updatedSessions = prevSessions.map(s => 
                s.id === returnedSessionId 
                ? { ...s, title: userMessage.text.substring(0, 30) + (userMessage.text.length > 30 ? "..." : ""), timestamp: new Date().toISOString() } 
                : s
            ).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // En yeni üste
            localStorage.setItem('monologedAiChatSessions', JSON.stringify(updatedSessions));
            return updatedSessions;
          }
          return prevSessions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        });
      }

    } catch (err) {
      console.error("Mesaj gönderilirken hata:", err);
      setError(`Mesaj gönderilemedi: ${err.message}. Lütfen internet bağlantınızı kontrol edin veya daha sonra tekrar deneyin.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const startNewChat = (setActive = true) => {
    if (setActive) {
        const newTempId = `tempsession-${Date.now()}`;
        // Yeni sohbeti hemen listeye ekle, backend'den ID gelince güncellenecek
        const newSessionPlaceholder = {
            id: newTempId, // Bu ID geçici, handleSend içinde güncellenecek
            title: "Yeni Sohbet...",
            timestamp: new Date().toISOString()
        };
        setChatSessions(prev => [newSessionPlaceholder, ...prev].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)));
        
        setCurrentSessionId(null); // Backend'den yeni ID bekleyeceğiz
        localStorage.removeItem('monologedAiCurrentSessionId');
        setMessages([
            { id: 'new-chat-bot-msg', text: "Yeni bir sohbete başlıyoruz! Hangi film hakkında konuşmak istersin?", sender: "bot", timestamp: new Date() }
        ]);
        setIsSidebarOpen(false); // Yeni sohbet başlatıldığında mobilde sidebar'ı kapat
    }
    setError(null);
    setIsLoading(false);
  };

  const selectChatSession = (sessionId) => {
    if (sessionId !== currentSessionId) {
      setCurrentSessionId(sessionId);
      localStorage.setItem('monologedAiCurrentSessionId', sessionId);
      setIsSidebarOpen(false); // Oturum seçildiğinde mobilde sidebar'ı kapat
    }
  };

  const deleteChatSession = (sessionIdToDelete, event) => {
    event.stopPropagation(); 
    
    setChatSessions(prevSessions => {
      const updatedSessions = prevSessions.filter(session => session.id !== sessionIdToDelete).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
      localStorage.setItem('monologedAiChatSessions', JSON.stringify(updatedSessions));
      return updatedSessions;
    });

    if (currentSessionId === sessionIdToDelete) {
      localStorage.removeItem('monologedAiCurrentSessionId');
      if (chatSessions.length > 1) { 
        const nextSession = chatSessions.find(s => s.id !== sessionIdToDelete); // Zaten sıralı olduğu için ilkini alabiliriz
        if (nextSession) {
          setCurrentSessionId(nextSession.id);
          localStorage.setItem('monologedAiCurrentSessionId', nextSession.id);
        } else {
          startNewChat(true);
        }
      } else {
        startNewChat(true);
      }
    }
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const markdownComponents = {
    // ... 
  };

  return (
    <div className="monologed-ai-app-layout">
      {/* Sidebar */}
      <aside ref={sidebarRef} className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <img src="/logo_monologed_ai.png" alt="M Deep Mind Logo" className="sidebar-logo" onError={(e) => e.target.style.display='none'}/>
          {/* <Film className="sidebar-logo-icon" size={32} /> */}
          {/* <h2>M Deep Mind</h2> */}
        </div>
        <button onClick={() => startNewChat(true)} className="sidebar-new-chat-button">
          <PlusCircle size={18} />
          <span>Yeni Sohbet</span>
        </button>
        <nav className="chat-sessions-nav">
          <p className="sessions-title">Geçmiş Sohbetler</p>
          <ul>
            {chatSessions.length === 0 && <li className="no-sessions-message">Henüz sohbet yok.</li>}
            {chatSessions.map((session) => (
              <li
                key={session.id}
                className={`session-item ${session.id === currentSessionId ? 'active-session' : ''}`}
                onClick={() => selectChatSession(session.id)}
                title={session.title}
              >
                <MessageSquare size={16} className="session-icon" />
                <span className="session-title-text">{session.title}</span>
                <button
                  className="delete-session-button"
                  onClick={(e) => deleteChatSession(session.id, e)}
                  title="Sohbeti Sil"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="main-content">
        <div className="monologed-ai-container">
          <header className="app-header">
            <button
              ref={menuButtonRef}
              className="mobile-menu-button"
              onClick={toggleSidebar}
            >
              {isSidebarOpen ? <XIcon size={24} /> : <MenuIcon size={24} />}
            </button>
            <h1>{chatSessions.find(s => s.id === currentSessionId)?.title || "M Deep Mind"}</h1>
            <div className="header-placeholder"></div> {/* Sağ tarafta boşluk oluşturmak için */}
          </header>

          {error && (
            <div className="error-message-bar">
              <AlertTriangle size={20} className="error-icon" />
              <p>{error}</p>
              <button onClick={() => setError(null)} className="close-error-button">&times;</button>
            </div>
          )}

          <main className="message-area">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`message-row ${msg.sender === 'user' ? 'user-message-row' : 'bot-message-row'}`}
              >
                <div className={`message-bubble ${msg.sender === 'user' ? 'user-bubble' : 'bot-bubble'}`}>
                  <div className="message-sender-info">
                    {msg.sender === 'bot' && <BotIconLucide size={20} className="sender-icon bot-icon" />}
                    {msg.sender === 'user' && <User size={20} className="sender-icon user-icon" />}
                    <span className="sender-name">
                      {msg.sender === 'user' ? 'Siz' : 'M Deep Mind'}
                    </span>
                  </div>
                  <div className="message-text">
                    {msg.sender === 'bot' ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                        {msg.text}
                      </ReactMarkdown>
                    ) : (
                      msg.text
                    )}
                  </div>
                  <p className="message-timestamp">
                    {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </p>
                </div>
              </div>
            ))}
            {isLoading && messages.length > 0 && messages[messages.length -1].sender === 'user' && (
              <div className="message-row bot-message-row">
                 <div className="message-bubble bot-bubble">
                    <div className="message-sender-info">
                        <BotIconLucide size={20} className="sender-icon bot-icon" />
                        <span className="sender-name">M Deep Mind</span>
                        <div className="typing-indicator">
                            <span>.</span><span>.</span><span>.</span>
                        </div>
                    </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </main>

          <footer className="input-area-footer">
            <div className="input-wrapper">
              <textarea
                placeholder="Filmler, diziler hakkında konuşabilir yada sorularını yanıtlayabilirim..."
                ref={inputRef}
                value={input}
                onKeyDown={handleKeyDown}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading}
                rows={1}
                className="chat-input"
              />
              <button
                onClick={handleSend}
                disabled={isLoading || input.trim() === ''}
                className="send-button"
              >
                {isLoading && messages[messages.length -1]?.sender === 'user' ? (
                  <div className="spinner"></div>
                ) : (
                  <Send size={20} />
                )}
              </button>
            </div>
          </footer>
        </div>
      </div>
      {/* Sidebar açıkken ana içeriği karartmak için overlay */}
      {isSidebarOpen && <div className="sidebar-overlay" onClick={toggleSidebar}></div>}
    </div>
  );
};

export default MonologedAI;

// Define custom components or overrides for ReactMarkdown
// Define custom components or overrides for ReactMarkdown