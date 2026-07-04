"use client";
import { useState } from "react";
import { usePhoneInput } from "react-international-phone";

/* Clean phone field: India flag + static +91 prefix + divider + numeric input.
   Headless logic from react-international-phone, styled with our own CSS. */
export default function PhoneInput({ name = "phone" }: { name?: string; label?: string }) {
  const [focused, setFocused] = useState(false);
  const { inputValue, phone, handlePhoneValueChange, inputRef } = usePhoneInput({
    defaultCountry: "in",
    disableDialCodeAndPrefix: true,
    disableCountryGuess: true,
  });
  return (
    <div className={"swphone" + (focused ? " focus" : "")}>
      <span className="swphone-cc" aria-hidden>
        <span className="swphone-flag">🇮🇳</span>
        <span className="swphone-code">+91</span>
        <i className="swphone-div" />
      </span>
      <input
        ref={inputRef}
        className="swphone-input"
        type="tel"
        inputMode="numeric"
        maxLength={12}
        value={inputValue}
        onChange={handlePhoneValueChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="98765 43210"
        aria-label="Phone number"
      />
      <input type="hidden" name={name} value={phone || (inputValue ? `+91 ${inputValue}` : "")} />
    </div>
  );
}
