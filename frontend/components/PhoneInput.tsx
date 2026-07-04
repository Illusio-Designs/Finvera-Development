"use client";
import { useState, useRef, useEffect } from "react";
import { usePhoneInput, defaultCountries, parseCountry } from "react-international-phone";

/* Emoji flag from an ISO-2 country code (regional-indicator symbols). */
const flagEmoji = (iso2: string) =>
  iso2.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));

/* Phone field: openable country selector (flag + dial code + search) + numeric input.
   Headless logic from react-international-phone, styled with our own CSS. */
export default function PhoneInput({ name = "phone" }: { name?: string; label?: string }) {
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  const { inputValue, phone, country, setCountry, handlePhoneValueChange, inputRef } = usePhoneInput({
    defaultCountry: "in",
    disableDialCodeAndPrefix: true,
    countries: defaultCountries,
  });

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const term = q.trim().toLowerCase();
  const list = defaultCountries.map(parseCountry).filter((c) =>
    !term || c.name.toLowerCase().includes(term) || c.dialCode.includes(term.replace(/\D/g, "")) || c.iso2.includes(term));

  return (
    <div className={"swphone" + (focused ? " focus" : "") + (open ? " open" : "")} ref={wrapRef}>
      <button type="button" className="swphone-cc" onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox" aria-expanded={open} aria-label={`Country: ${country.name} +${country.dialCode}`}>
        <span className="swphone-flag">{flagEmoji(country.iso2)}</span>
        <span className="swphone-code">+{country.dialCode}</span>
        <svg className="swphone-caret" viewBox="0 0 24 24" width="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
        <i className="swphone-div" />
      </button>
      <input
        ref={inputRef}
        className="swphone-input"
        type="tel"
        inputMode="numeric"
        value={inputValue}
        onChange={handlePhoneValueChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="98765 43210"
        aria-label="Phone number"
      />
      <input type="hidden" name={name} value={inputValue ? phone : ""} />

      {open && (
        <div className="swphone-drop" role="listbox">
          <div className="swphone-search">
            <svg viewBox="0 0 24 24" width="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search country" aria-label="Search country" />
          </div>
          <ul className="swphone-list">
            {list.length === 0 && <li className="swphone-empty">No match</li>}
            {list.map((c) => (
              <li key={c.iso2}>
                <button type="button" className={"swphone-opt" + (c.iso2 === country.iso2 ? " on" : "")}
                  onClick={() => { setCountry(c.iso2); setOpen(false); setQ(""); setTimeout(() => inputRef.current?.focus(), 0); }}>
                  <span className="swphone-flag">{flagEmoji(c.iso2)}</span>
                  <span className="nm">{c.name}</span>
                  <span className="dc">+{c.dialCode}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
