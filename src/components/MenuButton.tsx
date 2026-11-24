"use client";
export default function MenuButton() {
  return <button type="button" className="menu-btn" aria-label="תפריט" onClick={() => window.dispatchEvent(new Event("naychah:toggle-menu"))}>☰</button>;
}
