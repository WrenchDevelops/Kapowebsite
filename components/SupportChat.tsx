"use client";

import { ArrowLeft, Check, MoreHorizontal, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { PublicProduct, SupportWidgetConfig, TranscriptMessage } from "@/lib/support/types";

type ChatLine = TranscriptMessage & { products?: PublicProduct[] };

function renderInline(text: string, key: string) {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+?\*\*|__[^_]+?__|(?<!\*)\*[^*\n]+?\*(?!\*)|(?<!_)_[^_\n]+?_(?!_))/g;
  let last = 0;
  let index = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > last) nodes.push(text.slice(last, start));
    const token = match[0];
    const inner = token.slice(token.startsWith("**") || token.startsWith("__") ? 2 : 1, token.startsWith("**") || token.startsWith("__") ? -2 : -1);
    if (token.startsWith("**") || token.startsWith("__")) nodes.push(<strong key={`${key}-${index}`}>{inner}</strong>);
    else nodes.push(<em key={`${key}-${index}`}>{inner}</em>);
    last = start + token.length;
    index += 1;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function MessageText({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  let block = 0;
  const flush = () => {
    if (!list.length) return;
    const items = list;
    list = [];
    const id = block;
    block += 1;
    blocks.push(
      <ul key={`list-${id}`}>
        {items.map((item, index) => <li key={index}>{renderInline(item, `li-${id}-${index}`)}</li>)}
      </ul>,
    );
  };
  lines.forEach((line, index) => {
    const item = /^\s*[-*]\s+(.+)$/.exec(line);
    if (item) {
      list.push(item[1]);
      return;
    }
    flush();
    if (!line.trim()) return;
    blocks.push(<p key={`p-${index}`}>{renderInline(line, `p-${index}`)}</p>);
  });
  flush();
  return <div className="support-md">{blocks}</div>;
}

function clock(at: number) {
  return new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit" }).format(at);
}

export function SupportChat({ config, accountEmail }: { config: SupportWidgetConfig; accountEmail?: string | null }) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const helpRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [email, setEmail] = useState<string | null>(accountEmail ?? null);
  const [emailDraft, setEmailDraft] = useState(accountEmail ?? "");
  const [emailError, setEmailError] = useState("");
  const [view, setView] = useState<"email" | "chat" | "human">(accountEmail ? "chat" : "email");
  const [helpDraft, setHelpDraft] = useState("");
  const [helpState, setHelpState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [helpError, setHelpError] = useState("");
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const [queuedHelp, setQueuedHelp] = useState<string | null>(null);

  useEffect(() => {
    const onOpen = (event: Event) => {
      const help = (event as CustomEvent<{ help?: string }>).detail?.help;
      setOpen(true);
      if (help) setQueuedHelp(help);
    };
    window.addEventListener("kapo-support", onOpen);
    const params = new URLSearchParams(window.location.search);
    if (params.get("chat") === "1") {
      setOpen(true);
      params.delete("chat");
      const query = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
    }
    return () => window.removeEventListener("kapo-support", onOpen);
  }, []);

  useEffect(() => {
    if (!queuedHelp || !email || view !== "chat") return;
    setHelpDraft(queuedHelp);
    setHelpError("");
    setHelpState((state) => state === "sent" ? "idle" : state);
    setView("human");
    setQueuedHelp(null);
  }, [queuedHelp, email, view]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const response = await fetch("/api/support/session");
      if (!response.ok || cancelled) return;
      const payload = await response.json() as { email?: string | null; messages?: TranscriptMessage[] };
      if (cancelled) return;
      if (payload.email) {
        setEmail(payload.email);
        setEmailDraft(payload.email);
        setLines((payload.messages ?? []).map((message) => ({ ...message, at: message.at || Date.now() })));
        setView((current) => current === "human" ? current : "chat");
      } else {
        setEmail(null);
        setView("email");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (view === "email") emailRef.current?.focus();
    else if (view === "chat") inputRef.current?.focus();
    else helpRef.current?.focus();
  }, [open, view]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (menuOpen) {
        setMenuOpen(false);
        return;
      }
      setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
  }, [menuOpen]);

  useEffect(() => {
    const log = logRef.current;
    if (!log) return;
    log.scrollTop = log.scrollHeight;
  }, [lines, pending, open]);

  const saveEmail = async () => {
    const next = emailDraft.trim();
    setEmailError("");
    const response = await fetch("/api/support/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: next }),
    });
    const payload = await response.json() as { email?: string; message?: string; messages?: TranscriptMessage[] };
    if (!response.ok || !payload.email) {
      setEmailError(payload.message ?? "Enter a valid email address.");
      return;
    }
    setEmail(payload.email);
    setLines((payload.messages ?? []).map((message) => ({ ...message, at: message.at || Date.now() })));
    setView("chat");
  };

  const sendHelp = async () => {
    if (helpDraft.trim().length < 4 || helpState === "sending") return;
    setHelpState("sending");
    setHelpError("");
    try {
      const response = await fetch("/api/support/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: helpDraft.trim(), idempotencyKey: requestKey, company: "" }),
      });
      const payload = await response.json() as { ok?: boolean; message?: string };
      if (!response.ok || !payload.ok) {
        setHelpState("error");
        setHelpError(payload.message ?? "KAPO could not send that request.");
        return;
      }
      setHelpState("sent");
      setHelpDraft("");
      setRequestKey(crypto.randomUUID());
    } catch {
      setHelpState("error");
      setHelpError("KAPO could not send that request. Email support@shopkapo.com and include your order number.");
    }
  };

  const send = async () => {
    const content = draft.trim().slice(0, config.maxInputChars);
    if (!content || pending) return;
    const history = [...lines, { role: "user" as const, content, at: Date.now() }];
    setLines(history);
    setDraft("");
    setPending(true);
    try {
      const response = await fetch("/api/support/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map(({ role, content: text }) => ({ role, content: text })),
        }),
      });
      const payload = await response.json() as { reply?: string; message?: string; products?: PublicProduct[] };
      if (response.status === 401) {
        setEmail(null);
        setView("email");
        setPending(false);
        return;
      }
      const reply = (payload.reply || payload.message || "Something went wrong. Use Get help from a person in this chat.").slice(0, 2000);
      setLines((current) => [...current, {
        role: "assistant",
        content: reply,
        at: Date.now(),
        products: Array.isArray(payload.products) ? payload.products.slice(0, 3) : [],
      }]);
    } catch {
      setLines((current) => [...current, {
        role: "assistant",
        content: "The chat could not send that message. Use Get help from a person in this chat.",
        at: Date.now(),
      }]);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={`support-chat${open ? " is-open" : ""}`}>
      {open ? (
        <div
          ref={panelRef}
          className="support-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <header className="support-panel-head">
            {view === "human" ? (
              <button type="button" className="support-back" aria-label="Back to chat" onClick={() => { setHelpError(""); setView("chat"); }}>
                <ArrowLeft size={18} />
              </button>
            ) : null}
            <div className="support-brand">
              <span className="support-avatar">
                <img src="/kapo-chat-avatar.png" alt="" width="36" height="36" />
              </span>
              <p id={titleId}>Kapo Support</p>
            </div>
            <div className="support-head-actions" ref={menuRef}>
              <button
                type="button"
                aria-label="Chat options"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                onClick={() => setMenuOpen((value) => !value)}
              >
                <MoreHorizontal size={18} />
              </button>
              <button type="button" aria-label="Close chat" onClick={() => setOpen(false)}>
                <X size={18} />
              </button>
              {menuOpen ? (
                <div className="support-menu" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setLines([]);
                      setMenuOpen(false);
                    }}
                  >
                    Clear chat
                  </button>
                  {email ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setHelpError("");
                        setHelpState((state) => state === "sent" ? "idle" : state);
                        setView("human");
                        setMenuOpen(false);
                      }}
                    >
                      Get help from a person
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </header>
          {view === "email" ? (
            <form
              className="support-gate"
              onSubmit={(event) => {
                event.preventDefault();
                void saveEmail();
              }}
            >
              <p>Enter your email to start the chat. KAPO uses it only to reply about this conversation. It is not added to a marketing list.</p>
              <label htmlFor="support-email">Email</label>
              <input
                id="support-email"
                ref={emailRef}
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="you@email.com"
                value={emailDraft}
                onChange={(event) => setEmailDraft(event.target.value)}
                required
              />
              {emailError ? <p className="support-form-error" role="alert">{emailError}</p> : null}
              <button className="button button-dark" type="submit">Continue</button>
            </form>
          ) : null}
          {view === "human" ? (
            <form
              className="support-human"
              onSubmit={(event) => {
                event.preventDefault();
                void sendHelp();
              }}
            >
              <p>Our team typically responds within 24–48 hours.</p>
              <label htmlFor="support-help-email">Email</label>
              <input id="support-help-email" value={email ?? ""} readOnly />
              <label htmlFor="support-help">How can we help?</label>
              <textarea
                id="support-help"
                ref={helpRef}
                value={helpDraft}
                onChange={(event) => setHelpDraft(event.target.value)}
                rows={5}
                required
                disabled={helpState === "sending" || helpState === "sent"}
              />
              <input className="support-honeypot" tabIndex={-1} autoComplete="off" aria-hidden="true" name="company" defaultValue="" />
              {helpState === "error" ? <p className="support-form-error" role="alert">{helpError}</p> : null}
              {helpState === "sent" ? <p className="support-form-ok" role="status">Sent to KAPO Support. Your chat is still here.</p> : null}
              <button className="button button-dark" type="submit" disabled={helpState === "sending" || helpState === "sent" || helpDraft.trim().length < 4}>
                {helpState === "sending" ? "Sending…" : "Send to KAPO Support"}
              </button>
            </form>
          ) : null}
          <div
            ref={logRef}
            className="support-log"
            hidden={view !== "chat"}
            onWheel={(event) => event.stopPropagation()}
          >
            <div className="support-row is-assistant">
              <div className="support-bubble is-assistant">
                <MessageText text={config.welcome} />
              </div>
            </div>
            {lines.map((line, index) => (
              <div key={`${line.at}-${index}`} className={`support-row is-${line.role}`}>
                <div className={`support-bubble is-${line.role}`}>
                  <MessageText text={line.content} />
                  {line.products?.length ? (
                    <ul>
                      {line.products.map((product) => (
                        <li key={product.id}>
                          <Link href={product.href}>{product.name} · {product.style}</Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <p className="support-meta">
                  {line.role === "user" ? <span>Sent {clock(line.at)}</span> : <span>{clock(line.at)}</span>}
                  {line.role === "user" ? <Check size={12} aria-hidden="true" /> : null}
                </p>
              </div>
            ))}
            {pending ? (
              <div className="support-row is-assistant">
                <div className="support-bubble is-assistant is-typing" aria-label="Kapo is replying">
                  <span /><span /><span />
                </div>
              </div>
            ) : null}
            <div data-chat-end />
          </div>
          {view === "chat" ? (
            <div className="support-dock">
              {email ? (
                <button type="button" className="support-person" onClick={() => { setHelpState((state) => state === "sent" ? "idle" : state); setHelpError(""); setView("human"); }}>
                  Get help from a person
                </button>
              ) : null}
              <form
                className="support-composer"
                onSubmit={(event) => {
                  event.preventDefault();
                  void send();
                }}
              >
                <div className="support-field">
                  <textarea
                    ref={inputRef}
                    value={draft}
                    maxLength={config.maxInputChars}
                    rows={1}
                    placeholder="Send a message"
                    aria-label="Message Kapo Support"
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void send();
                      }
                    }}
                  />
                  <button className="support-send" type="submit" aria-label="Send message" disabled={pending || draft.trim().length === 0}>
                    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M8 12.25V3.75M8 3.75 4.25 7.5M8 3.75l3.75 3.75" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </form>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="support-greeting">{config.greeting}</p>
      )}
      {open ? null : (
        <button
          type="button"
          className="support-launcher"
          aria-expanded={open}
          aria-label="Open KAPO support chat"
          onClick={() => setOpen(true)}
        >
          <span className="support-launcher-mark">
            <img src="/kapo-logo-large.png" alt="" />
          </span>
        </button>
      )}
    </div>
  );
}
