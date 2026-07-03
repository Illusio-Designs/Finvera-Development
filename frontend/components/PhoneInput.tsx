"use client";
import { useState } from "react";
import PhoneInputLib from "react-phone-number-input";
import "react-phone-number-input/style.css";

/* International phone input with country flags (react-phone-number-input).
   Keeps a hidden input so it works inside a plain <form> / FormData. */
export default function PhoneInput({ name = "phone", required = false }: { name?: string; required?: boolean }) {
  const [value, setValue] = useState<string | undefined>();
  return (
    <div className="phone-input">
      <PhoneInputLib
        international
        defaultCountry="IN"
        value={value}
        onChange={setValue}
        placeholder="98765 43210"
      />
      <input type="hidden" name={name} value={value || ""} required={required} />
    </div>
  );
}
