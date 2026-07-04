"use client";
import { useState } from "react";
import { usePhoneInput } from "react-international-phone";

/* Swiggy-style phone field: floating label + static +91 prefix + divider.
   Headless logic from react-international-phone, styled with our own CSS. */
export default function PhoneInput({ name = "phone", label = "Phone" }: { name?: string; label?: string }) {
  const [focused, setFocused] = useState(false);
  const { inputValue, phone, handlePhoneValueChange, inputRef } = usePhoneInput({
    defaultCountry: "in",
    disableDialCodeAndPrefix: true,
    disableCountryGuess: true,
  });
  const active = focused || inputValue.trim().length > 0;
  return (
    <div className={"swphone" + (focused ? " focus" : "") + (active ? " active" : "")}>
      <label className="swphone-label">{label}</label>
      <span className="swphone-cc" aria-hidden>+91<i className="swphone-div" /></span>
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
        aria-label={label}
      />
      <input type="hidden" name={name} value={phone || (inputValue ? `+91 ${inputValue}` : "")} />
    </div>
  );
}
