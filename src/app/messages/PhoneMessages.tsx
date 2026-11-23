"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PHONE_UNLOCK_COOKIE } from "@/lib/phone";

// Simulated iPhone: a passcode lock screen (code 0000) that opens straight into
// the Messages conversation with the Cancer Centre. Only the Messages view exists.

const PASSCODE = "0000";

type Text = { id: string; html: string; time: string };

const KEYS: { d: string; l: string }[] = [
  { d: "1", l: "" }, { d: "2", l: "ABC" }, { d: "3", l: "DEF" },
  { d: "4", l: "GHI" }, { d: "5", l: "JKL" }, { d: "6", l: "MNO" },
  { d: "7", l: "PQRS" }, { d: "8", l: "TUV" }, { d: "9", l: "WXYZ" },
];

function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function StatusBar({ dark }: { dark: boolean }) {
  const now = useClock();
  const time = now ? now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).replace(/\s?[AP]M$/, "") : "9:41";
  const color = dark ? "#fff" : "#000";
  return (
    <div className="ios-status" style={{ color }} aria-hidden="true">
      <span className="ios-status-time">{time}</span>
      <span className="ios-status-icons">
        {/* signal */}
        <svg width="18" height="12" viewBox="0 0 18 12" fill={color}><rect x="0" y="8" width="3" height="4" rx="1" /><rect x="5" y="5.5" width="3" height="6.5" rx="1" /><rect x="10" y="3" width="3" height="9" rx="1" /><rect x="15" y="0" width="3" height="12" rx="1" /></svg>
        {/* wifi */}
        <svg width="16" height="12" viewBox="0 0 16 12" fill={color}><path d="M8 2.2c2.4 0 4.6.9 6.3 2.5l1.2-1.3A10.6 10.6 0 0 0 8 .4C5.2.4 2.5 1.5.5 3.4l1.2 1.3A8.9 8.9 0 0 1 8 2.2Zm0 3.6c1.4 0 2.7.5 3.7 1.4l1.2-1.3A7.2 7.2 0 0 0 8 4c-1.8 0-3.6.7-4.9 1.9l1.2 1.3c1-.9 2.3-1.4 3.7-1.4Zm0 3.5c-.6 0-1.2.2-1.6.6L8 11.6l1.6-1.7c-.4-.4-1-.6-1.6-.6Z" /></svg>
        {/* battery */}
        <svg width="27" height="13" viewBox="0 0 27 13"><rect x="0.5" y="0.5" width="23" height="12" rx="3.5" fill="none" stroke={color} strokeOpacity="0.4" /><rect x="2" y="2" width="17" height="9" rx="2" fill={color} /><path d="M25 4.5v4c.8-.3 1.4-1.1 1.4-2s-.6-1.7-1.4-2Z" fill={color} fillOpacity="0.4" /></svg>
      </span>
    </div>
  );
}

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [code, setCode] = useState("");
  const [wrong, setWrong] = useState(false);
  const [ready, setReady] = useState(false); // true once the keypad is interactive (after hydration)
  useEffect(() => setReady(true), []);

  const press = useCallback((d: string) => {
    setWrong(false);
    setCode((c) => (c.length >= 4 ? d : c + d)); // after a wrong code, the next key starts a new try
  }, []);
  const del = useCallback(() => setCode((c) => c.slice(0, -1)), []);

  useEffect(() => {
    if (code.length < 4) return;
    if (code === PASSCODE) {
      const t = setTimeout(onUnlock, 150);
      return () => clearTimeout(t);
    }
    setWrong(true);
    const t = setTimeout(() => setCode(""), 450);
    return () => clearTimeout(t);
  }, [code, onUnlock]);

  // Typing on the computer keyboard also works.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") del();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press, del]);

  return (
    <div className="ios-lock" data-testid="lock-screen" data-ready={ready ? "true" : undefined}>
      <StatusBar dark />
      <div className="ios-lock-body">
        <svg width="18" height="24" viewBox="0 0 18 24" fill="#fff" aria-hidden="true"><path d="M9 1.5a5.5 5.5 0 0 0-5.5 5.5v3H3a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-.5V7A5.5 5.5 0 0 0 9 1.5Zm-3.5 5.5a3.5 3.5 0 1 1 7 0v3h-7V7Z" /></svg>
        <h2 className="ios-lock-title">{wrong ? "Wrong Passcode" : "Enter Passcode"}</h2>
        <div className={`ios-dots ${wrong ? "ios-shake" : ""}`} role="status" aria-label={`${code.length} of 4 digits entered`}>
          {[0, 1, 2, 3].map((i) => <span key={i} className={i < code.length ? "filled" : ""} />)}
        </div>
        <div className="ios-keypad">
          {KEYS.map((k) => (
            <button key={k.d} type="button" aria-label={k.d} className="ios-key" onClick={() => press(k.d)}>
              <span className="ios-key-digit">{k.d}</span>
              <span className="ios-key-letters">{k.l || " "}</span>
            </button>
          ))}
          <span className="ios-key-text" aria-hidden="true">Emergency</span>
          <button type="button" aria-label="0" className="ios-key" onClick={() => press("0")}>
            <span className="ios-key-digit">0</span>
          </button>
          <button type="button" className="ios-key-text ios-key-delete" onClick={del} disabled={code.length === 0} aria-label="Delete">
            {code.length ? "Delete" : "Cancel"}
          </button>
        </div>
      </div>
      <div className="ios-home-indicator light" />
    </div>
  );
}

function MessagesView({ sender, texts }: { sender: string; texts: Text[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastRef = useRef<HTMLLIElement>(null);
  // Open on the newest message, showing its start (like tapping a new text).
  useEffect(() => {
    const box = scrollRef.current;
    const last = lastRef.current;
    if (box && last) box.scrollTop += last.getBoundingClientRect().top - box.getBoundingClientRect().top - 4;
  }, []);
  const initials = "WC";

  return (
    <div className="ios-messages" data-testid="messages-view">
      <div className="ios-msg-header">
        <StatusBar dark={false} />
        <div className="ios-msg-contact">
          <span className="ios-back" aria-hidden="true">
            <svg width="12" height="20" viewBox="0 0 12 20"><path d="M10 2 2 10l8 8" fill="none" stroke="#007aff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <div className="ios-avatar" aria-hidden="true">{initials}</div>
          <div className="ios-contact-name">{sender} <span aria-hidden="true">›</span></div>
        </div>
      </div>
      <div ref={scrollRef} className="ios-msg-scroll" tabIndex={0} aria-label={`Conversation with ${sender}`}>
        {texts.length === 0 ? (
          <p className="ios-msg-note">No text messages yet.</p>
        ) : (
          <>
            <p className="ios-msg-note small">Text Message · SMS</p>
            <ul className="ios-thread">
              {texts.map((t, i) => (
                <li key={t.id} ref={i === texts.length - 1 ? lastRef : undefined} data-testid="text-message">
                  <p className="ios-time">{t.time}</p>
                  <span data-testid="text-sender" className="sr-only">{sender}</span>
                  <div
                    className="ios-bubble email-body"
                    dangerouslySetInnerHTML={{ __html: t.html.replace(/class="email-button"/g, 'class="ios-link-strong"') }}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <div className="ios-compose" aria-hidden="true">
        <span className="ios-plus">+</span>
        <span className="ios-input">Text Message · SMS</span>
      </div>
      <div className="ios-home-indicator" />
    </div>
  );
}

export function PhoneMessages({ initiallyUnlocked, sender, texts }: { initiallyUnlocked: boolean; sender: string; texts: Text[] }) {
  const [unlocked, setUnlocked] = useState(initiallyUnlocked);

  const unlock = useCallback(() => {
    // Session cookie: going back to this page from a link keeps the phone unlocked.
    document.cookie = `${PHONE_UNLOCK_COOKIE}=1; path=/; samesite=lax`;
    setUnlocked(true);
  }, []);
  const lock = () => {
    document.cookie = `${PHONE_UNLOCK_COOKIE}=; path=/; max-age=0`;
    setUnlocked(false);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="iphone">
        <button type="button" className="iphone-btn side" onClick={lock} aria-label="Lock phone" title="Lock phone" />
        <span className="iphone-btn action" aria-hidden="true" />
        <span className="iphone-btn vol-up" aria-hidden="true" />
        <span className="iphone-btn vol-down" aria-hidden="true" />
        <div className="iphone-screen">
          <div className="iphone-island" aria-hidden="true" />
          {unlocked ? <MessagesView sender={sender} texts={texts} /> : <LockScreen onUnlock={unlock} />}
        </div>
      </div>
      <p className="text-center text-sm text-gray-600">
        {unlocked ? "Scroll inside the phone to read. Press the side button to lock it again." : <>Demo passcode: <strong>0000</strong> (tap the keys or type it)</>}
      </p>
    </div>
  );
}
