import React from "react";
export function ReceiptArt() {
  return (
    <svg viewBox="0 0 230 158" aria-hidden="true" className="receipt-art">
      <g stroke="#c8d5f6" strokeWidth="1" fill="none">
        <path
          d="M22 44V26h18m150 0h18v18M22 115v18h18m150 0h18v-18"
          strokeWidth="2"
        />
        <path d="M12 80h206" strokeDasharray="2 6" />
      </g>
      <g transform="rotate(11 126 80)">
        <rect
          x="75"
          y="22"
          width="94"
          height="120"
          rx="4"
          fill="#cedbfb"
          stroke="#9bb2ec"
        />
      </g>
      <g transform="rotate(-8 110 80)">
        <path
          d="M63 14h99v126l-6-3-6 3-6-3-6 3-6-3-6 3-6-3-6 3-6-3-6 3-6-3-6 3-6-3-6 3-4-2Z"
          fill="white"
          stroke="#9cb2e1"
        />
        <g fill="#234a99">
          <path d="m74 30 6-9 6 9-6 8Z" />
          <text
            x="90"
            y="32"
            fontFamily="monospace"
            fontWeight="bold"
            fontSize="8"
          >
            FIELDNOTE
          </text>
          <text x="90" y="40" fontFamily="monospace" fontSize="5">
            SUPPLY CO.
          </text>
        </g>
        <path d="M74 49h77m-77 42h77" stroke="#b3bfd7" strokeDasharray="2 2" />
        <path
          d="M74 60h35m29 0h13m-77 9h48m16 0h13m-77 9h28m36 0h13"
          stroke="#a7b4c9"
          strokeWidth="2"
        />
        <text x="74" y="105" fill="#40516f" fontFamily="monospace" fontSize="7">
          TOTAL
        </text>
        <text
          x="120"
          y="105"
          fontFamily="monospace"
          fontWeight="bold"
          fontSize="8"
          fill="#17243b"
        >
          $24.00
        </text>
        <path
          d="M76 118h71"
          stroke="#40516f"
          strokeWidth="8"
          strokeDasharray="1 2 3 1 2 2"
        />
      </g>
      <g transform="translate(150 99)">
        <circle cx="12" cy="12" r="13" fill="#fff" stroke="#cad7ef" />
        <path
          d="m6 12 4 4 8-9"
          fill="none"
          stroke="#2f66f6"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
