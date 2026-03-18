'use client'

import { useState, useRef, useEffect } from 'react'

function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res((r.result as string).split(',')[1])
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

function getMimeCategory(mime: string) {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  return 'document'
}

type Upload = { file: File; category: string; preview: string | null }
type Message = {
  role: 'user' | 'model'
  text: string
  uploads?: { name: string; category: string; preview: string | null }[]
  error?: boolean
  ts: number
}
type Chat = { id: string; title: string; pinned: boolean; messages: Message[] }

const INITIAL_CHATS: Chat[] = [
  { id: '1', title: 'Welcome Chat', pinned: true, messages: [] },
]
let chatIdCounter = 2

export default function JaboGPT() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [chats, setChats] = useState<Chat[]>(INITIAL_CHATS)
  const [activeChatId, setActiveChatId] = useState('1')
  const [searchQuery, setSearchQuery] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploads, setUploads] = useState<Upload[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const renameRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const activeChat = chats.find((c) => c.id === activeChatId)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeChat?.messages, loading])

  useEffect(() => {
    if (renamingId && renameRef.current) renameRef.current.focus()
  }, [renamingId])

  const newChat = () => {
    const id = String(chatIdCounter++)
    const chat: Chat = { id, title: `Chat ${id}`, pinned: false, messages: [] }
    setChats((prev) => [...prev, chat])
    setActiveChatId(id)
    setUploads([])
  }

  const deleteChat = (id: string) => {
    setChats((prev) => prev.filter((c) => c.id !== id))
    if (activeChatId === id) {
      const remaining = chats.filter((c) => c.id !== id)
      setActiveChatId(remaining.length ? remaining[0].id : '')
    }
  }

  const togglePin = (id: string) => {
    setChats((prev) => prev.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c)))
  }

  const startRename = (chat: Chat) => {
    setRenamingId(chat.id)
    setRenameValue(chat.title)
  }

  const commitRename = () => {
    if (!renameValue.trim()) { setRenamingId(null); return }
    setChats((prev) =>
      prev.map((c) => (c.id === renamingId ? { ...c, title: renameValue.trim() } : c))
    )
    setRenamingId(null)
  }

  const addMessage = (chatId: string, msg: Message) => {
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, messages: [...c.messages, msg] } : c))
    )
  }

  const sendMessage = async () => {
    if (!input.trim() && uploads.length === 0) return

    const userMsg: Message = {
      role: 'user',
      text: input,
      uploads: uploads.map((u) => ({ name: u.file.name, category: u.category, preview: u.preview })),
      ts: Date.now(),
    }
    addMessage(activeChatId, userMsg)
    const currentInput = input
    const currentUploads = [...uploads]
    setInput('')
    setUploads([])
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setLoading(true)

    try {
      const parts: object[] = []
      if (currentInput.trim()) parts.push({ text: currentInput })

      for (const u of currentUploads) {
        const b64 = await fileToBase64(u.file)
        parts.push({ inlineData: { mimeType: u.file.type, data: b64 } })
      }

      const history = (activeChat?.messages || []).map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text || '' }],
      }))

      const body = {
        contents: [...history, { role: 'user', parts }],
        generationConfig: { maxOutputTokens: 8192 },
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok || data.error) throw new Error(data.error || 'Unknown error')

      const text =
        data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).join('') ||
        'No response.'

      addMessage(activeChatId, { role: 'model', text, ts: Date.now() })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      addMessage(activeChatId, { role: 'model', text: `Error: ${msg}`, error: true, ts: Date.now() })
    } finally {
      setLoading(false)
    }
  }

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    Array.from(files)
      .slice(0, 5)
      .forEach((file) => {
        const category = getMimeCategory(file.type)
        const preview =
          category === 'image' || category === 'video' ? URL.createObjectURL(file) : null
        setUploads((prev) => [...prev, { file, category, preview }])
      })
  }

  const filteredChats = chats.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const pinnedChats = filteredChats.filter((c) => c.pinned)
  const unpinnedChats = filteredChats.filter((c) => !c.pinned)

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div style={{
      display: 'flex', height: '100vh', background: '#0a0a0f',
      fontFamily: "'IBM Plex Mono', monospace", color: '#e0e0ff', overflow: 'hidden',
    }}>
      {/* SIDEBAR */}
      <div style={{
        width: sidebarOpen ? 260 : 0,
        minWidth: sidebarOpen ? 260 : 0,
        overflow: 'hidden',
        transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
        background: '#0d0d14',
        borderRight: '1px solid #1e1e2e',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{ padding: '16px 14px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800, color: '#fff', flex: 1, letterSpacing: '-0.3px' }}>
            JaboGPT
          </span>
          <button onClick={() => setSidebarOpen(false)}
            style={{ background: 'none', border: 'none', color: '#555', fontSize: 16, padding: 4 }}>
            ✕
          </button>
        </div>

        <div style={{ padding: '0 10px 10px' }}>
          <button onClick={newChat} style={{
            width: '100%', padding: '9px', background: '#1a1a2e',
            border: '1px solid #2a2a4a', borderRadius: 8,
            color: '#a0a0ff', fontFamily: "'Syne', sans-serif",
            fontWeight: 600, fontSize: 12, letterSpacing: '0.5px',
          }}>+ NEW CHAT</button>
        </div>

        <div style={{ padding: '0 10px 10px' }}>
          <input
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%', padding: '8px 10px',
              background: '#111118', border: '1px solid #222230',
              borderRadius: 7, color: '#aaa', fontSize: 12,
            }}
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px' }}>
          {pinnedChats.length > 0 && (
            <>
              <div style={{ fontSize: 10, color: '#555', letterSpacing: '1px', padding: '4px 4px 6px', fontWeight: 600 }}>PINNED</div>
              {pinnedChats.map((c) => (
                <ChatItem key={c.id} chat={c} active={activeChatId === c.id}
                  onClick={() => setActiveChatId(c.id)}
                  onPin={() => togglePin(c.id)}
                  onRename={() => startRename(c)}
                  onDelete={() => deleteChat(c.id)}
                  renamingId={renamingId}
                  renameValue={renameValue}
                  setRenameValue={setRenameValue}
                  commitRename={commitRename}
                  renameRef={renameRef}
                />
              ))}
            </>
          )}
          {unpinnedChats.length > 0 && (
            <>
              {pinnedChats.length > 0 && (
                <div style={{ fontSize: 10, color: '#555', letterSpacing: '1px', padding: '10px 4px 6px', fontWeight: 600 }}>CHATS</div>
              )}
              {unpinnedChats.map((c) => (
                <ChatItem key={c.id} chat={c} active={activeChatId === c.id}
                  onClick={() => setActiveChatId(c.id)}
                  onPin={() => togglePin(c.id)}
                  onRename={() => startRename(c)}
                  onDelete={() => deleteChat(c.id)}
                  renamingId={renamingId}
                  renameValue={renameValue}
                  setRenameValue={setRenameValue}
                  commitRename={commitRename}
                  renameRef={renameRef}
                />
              ))}
            </>
          )}
          {filteredChats.length === 0 && (
            <div style={{ color: '#444', fontSize: 12, padding: '20px 4px', textAlign: 'center' }}>No chats found</div>
          )}
        </div>

        <div style={{ padding: '12px 14px', borderTop: '1px solid #1e1e2e' }}>
          <div style={{ fontSize: 10, color: '#555' }}>POWERED BY</div>
          <div style={{ fontSize: 11, color: '#6040ff', marginTop: 2 }}>Gemini 2.5 Flash</div>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* TOPBAR */}
        <div style={{
          height: 52, display: 'flex', alignItems: 'center', gap: 12,
          padding: '0 20px', borderBottom: '1px solid #1a1a2a', background: '#0a0a0f',
        }}>
          {!sidebarOpen && (
            <button onClick={() => setSidebarOpen(true)}
              style={{ background: 'none', border: 'none', color: '#666', fontSize: 18, padding: '2px 6px' }}>
              ☰
            </button>
          )}
          <div style={{ flex: 1, fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15, color: '#fff', letterSpacing: '-0.2px' }}>
            {activeChat?.title || 'JaboGPT'}
          </div>
        </div>

        {/* CHAT */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {activeChat?.messages.length === 0 && !loading && (
            <div style={{ margin: 'auto', textAlign: 'center', color: '#333' }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 32, fontWeight: 800, color: '#1e1e30', marginBottom: 8 }}>JABOGPT</div>
              <div style={{ fontSize: 12 }}>Send a message or upload a file to begin</div>
            </div>
          )}
          {activeChat?.messages.map((msg, i) => (
            <div key={i} className="msg-bubble" style={{
              display: 'flex',
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
              gap: 10, alignItems: 'flex-start',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: msg.role === 'user' ? '#3a2a6a' : '#1e2a1e',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, color: msg.role === 'user' ? '#a080ff' : '#60ff80', fontWeight: 700,
              }}>
                {msg.role === 'user' ? 'U' : 'AI'}
              </div>
              <div style={{ maxWidth: '72%' }}>
                {msg.uploads?.map((u, ui) => (
                  <div key={ui} style={{ marginBottom: 6 }}>
                    {u.category === 'image' && u.preview ? (
                      <img src={u.preview} alt={u.name} style={{ maxWidth: 200, borderRadius: 8, border: '1px solid #2a2a3a' }} />
                    ) : (
                      <div style={{ fontSize: 11, color: '#888', background: '#1a1a2a', padding: '4px 10px', borderRadius: 6, display: 'inline-block' }}>
                        📎 {u.name}
                      </div>
                    )}
                  </div>
                ))}
                {msg.text && (
                  <div style={{
                    background: msg.role === 'user' ? '#1a1030' : '#111118',
                    border: `1px solid ${msg.error ? '#5a2020' : msg.role === 'user' ? '#3a2a5a' : '#1e1e2e'}`,
                    borderRadius: msg.role === 'user' ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                    padding: '10px 14px', fontSize: 13, lineHeight: 1.7,
                    color: msg.error ? '#ff8080' : '#ddd',
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  }}>
                    {msg.text}
                  </div>
                )}
                <div style={{ fontSize: 10, color: '#444', marginTop: 4, textAlign: msg.role === 'user' ? 'right' : 'left' }}>
                  {formatTime(msg.ts)}
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="msg-bubble" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', background: '#1e2a1e',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, color: '#60ff80', fontWeight: 700,
              }}>AI</div>
              <div style={{ color: '#555', fontSize: 13, animation: 'pulse 1.2s infinite' }}>Generating...</div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {uploads.length > 0 && (
          <div style={{ padding: '8px 20px 0', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {uploads.map((u, i) => (
              <div key={i} className="upload-chip" style={{
                position: 'relative', background: '#111118',
                border: '1px solid #2a2a3a', borderRadius: 8, overflow: 'hidden',
              }}>
                {u.category === 'image' && u.preview ? (
                  <img src={u.preview} alt={u.file.name} style={{ height: 60, width: 60, objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div style={{ padding: '8px 12px', fontSize: 11, color: '#888', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.category === 'video' ? '🎥' : '📄'} {u.file.name}
                  </div>
                )}
                <button
                  className="remove-chip"
                  onClick={() => setUploads((prev) => prev.filter((_, j) => j !== i))}
                  style={{
                    position: 'absolute', top: 2, right: 2, opacity: 0,
                    background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff',
                    borderRadius: '50%', width: 18, height: 18,
                    fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >✕</button>
              </div>
            ))}
          </div>
        )}

        <div style={{ padding: '12px 20px 20px' }}>
          <div style={{ background: '#111118', border: '1px solid #2a2a3a', borderRadius: 12, overflow: 'hidden' }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
              }}
              placeholder="Message JaboGPT... (Shift+Enter for newline)"
              rows={1}
              style={{
                width: '100%', padding: '14px 16px',
                background: 'transparent', border: 'none',
                color: '#ddd', fontSize: 13, resize: 'none', lineHeight: 1.6,
                maxHeight: 160, overflowY: 'auto',
              }}
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement
                t.style.height = 'auto'
                t.style.height = Math.min(t.scrollHeight, 160) + 'px'
              }}
            />
            <div style={{
              display: 'flex', alignItems: 'center', padding: '8px 12px',
              borderTop: '1px solid #1e1e2e', gap: 8,
            }}>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/*,video/*,.pdf,.txt,.csv,.json,.md"
                style={{ display: 'none' }}
                onChange={(e) => handleFiles(e.target.files)}
              />
              <button
                onClick={() => fileRef.current?.click()}
                style={{
                  background: 'none', border: '1px solid #2a2a3a',
                  borderRadius: 6, color: '#666', padding: '5px 10px', fontSize: 12,
                }}
              >📎 Upload</button>
              <div style={{ flex: 1 }} />
              <button
                onClick={sendMessage}
                disabled={loading || (!input.trim() && uploads.length === 0)}
                style={{
                  background: loading ? '#1a1a2e' : 'linear-gradient(135deg, #6040ff, #9060ff)',
                  border: 'none', borderRadius: 7, color: '#fff',
                  padding: '7px 18px', fontFamily: "'Syne', sans-serif",
                  fontWeight: 700, fontSize: 12, letterSpacing: '0.5px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >{loading ? '...' : 'SEND'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

type ChatItemProps = {
  chat: Chat
  active: boolean
  onClick: () => void
  onPin: () => void
  onRename: () => void
  onDelete: () => void
  renamingId: string | null
  renameValue: string
  setRenameValue: (v: string) => void
  commitRename: () => void
  renameRef: React.RefObject<HTMLInputElement>
}

function ChatItem({ chat, active, onClick, onPin, onRename, onDelete, renamingId, renameValue, setRenameValue, commitRename, renameRef }: ChatItemProps) {
  return (
    <div
      className="chat-item"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2,
        borderRadius: 8, padding: '8px 10px', cursor: 'pointer',
        background: active ? '#1a1a2e' : 'transparent',
        border: active ? '1px solid #2a2a4a' : '1px solid transparent',
        transition: 'background 0.15s',
      }}
    >
      <span style={{ fontSize: 12, color: chat.pinned ? '#a0a0ff' : '#555', flexShrink: 0 }}>
        {chat.pinned ? '📌' : '💬'}
      </span>
      {renamingId === chat.id ? (
        <input
          ref={renameRef}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') commitRename() }}
          onBlur={commitRename}
          onClick={(e) => e.stopPropagation()}
          style={{
            flex: 1, background: '#0d0d14', border: '1px solid #3a3a5a',
            borderRadius: 5, color: '#fff', fontSize: 12, padding: '2px 6px',
          }}
        />
      ) : (
        <span style={{
          flex: 1, fontSize: 12, color: active ? '#ddd' : '#888',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{chat.title}</span>
      )}
      <div className="chat-actions" style={{ display: 'flex', gap: 2, opacity: 0, transition: 'opacity 0.15s', flexShrink: 0 }}>
        <button onClick={(e) => { e.stopPropagation(); onPin() }}
          style={{ background: 'none', border: 'none', color: '#666', fontSize: 11, padding: '1px 3px' }}>
          {chat.pinned ? 'unpin' : 'pin'}
        </button>
        <button onClick={(e) => { e.stopPropagation(); onRename() }}
          style={{ background: 'none', border: 'none', color: '#666', fontSize: 11, padding: '1px 3px' }}>
          ren
        </button>
        <button onClick={(e) => { e.stopPropagation(); onDelete() }}
          style={{ background: 'none', border: 'none', color: '#884444', fontSize: 11, padding: '1px 3px' }}>
          del
        </button>
      </div>
    </div>
  )
}