// Spot illustrations (brand v0.4): market stall, inflation, ARIF-Net, and the coverage map.
// Decorative only; colours come from the `illustration.*` tokens.

export type IllustrationName = 'lapak' | 'inflasi' | 'arif-net' | 'peta';

export function Illustration({
  name,
  className,
}: {
  readonly name: IllustrationName;
  readonly className?: string;
}) {
  switch (name) {
    case 'lapak':
      return (
        <svg viewBox="0 0 420 300" aria-hidden className={className}>
          <circle className="fill-illustration-mint" cx="210" cy="168" r="128" />
          <circle className="fill-illustration-kunyit" cx="352" cy="64" r="18" opacity="0.9" />
          <ellipse
            className="fill-illustration-ink"
            cx="210"
            cy="262"
            rx="160"
            ry="8"
            opacity="0.06"
          />
          <rect className="fill-illustration-brand" x="96" y="90" width="8" height="166" rx="3" />
          <rect className="fill-illustration-brand" x="316" y="90" width="8" height="166" rx="3" />
          <rect className="fill-illustration-brand" x="74" y="50" width="272" height="14" rx="7" />
          <g>
            <rect className="fill-illustration-brand" x="80" y="62" width="32.5" height="34" />
            <rect className="fill-illustration-cream" x="112.5" y="62" width="32.5" height="34" />
            <rect className="fill-illustration-brand" x="145" y="62" width="32.5" height="34" />
            <rect className="fill-illustration-cream" x="177.5" y="62" width="32.5" height="34" />
            <rect className="fill-illustration-brand" x="210" y="62" width="32.5" height="34" />
            <rect className="fill-illustration-cream" x="242.5" y="62" width="32.5" height="34" />
            <rect className="fill-illustration-brand" x="275" y="62" width="32.5" height="34" />
            <rect className="fill-illustration-cream" x="307.5" y="62" width="32.5" height="34" />
            <path className="fill-illustration-brand" d="M80 96 A16.25 16.25 0 0 0 112.5 96 Z" />
            <path className="fill-illustration-cream" d="M112.5 96 A16.25 16.25 0 0 0 145 96 Z" />
            <path className="fill-illustration-brand" d="M145 96 A16.25 16.25 0 0 0 177.5 96 Z" />
            <path className="fill-illustration-cream" d="M177.5 96 A16.25 16.25 0 0 0 210 96 Z" />
            <path className="fill-illustration-brand" d="M210 96 A16.25 16.25 0 0 0 242.5 96 Z" />
            <path className="fill-illustration-cream" d="M242.5 96 A16.25 16.25 0 0 0 275 96 Z" />
            <path className="fill-illustration-brand" d="M275 96 A16.25 16.25 0 0 0 307.5 96 Z" />
            <path className="fill-illustration-cream" d="M307.5 96 A16.25 16.25 0 0 0 340 96 Z" />
          </g>
          <rect
            className="fill-illustration-sand-light"
            x="84"
            y="196"
            width="252"
            height="62"
            rx="12"
          />
          <rect
            className="fill-illustration-sand-light"
            x="84"
            y="196"
            width="252"
            height="10"
            rx="5"
          />
          <path
            className="fill-illustration-sand"
            d="M104 196 C104 206 186 206 186 196 L180 184 H110 Z"
          />
          <g>
            <g transform="translate(112,180) rotate(-20)">
              <path
                className="fill-illustration-chili"
                d="M0 -12 C4 -8 5 0 3 8 C1 13 -2 14 -3 14 C-2 8 -3 0 -2 -6 Z"
              />
              <path
                className="stroke-illustration-leaf-dark"
                d="M0 -12 L1 -16"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </g>
            <g transform="translate(124,176) rotate(10)">
              <path
                className="fill-illustration-chili"
                d="M0 -12 C4 -8 5 0 3 8 C1 13 -2 14 -3 14 C-2 8 -3 0 -2 -6 Z"
              />
              <path
                className="stroke-illustration-leaf-dark"
                d="M0 -12 L1 -16"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </g>
            <g transform="translate(136,181) rotate(-35)">
              <path
                className="fill-illustration-chili"
                d="M0 -12 C4 -8 5 0 3 8 C1 13 -2 14 -3 14 C-2 8 -3 0 -2 -6 Z"
              />
              <path
                className="stroke-illustration-leaf-dark"
                d="M0 -12 L1 -16"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </g>
            <g transform="translate(148,175) rotate(20)">
              <path
                className="fill-illustration-chili"
                d="M0 -12 C4 -8 5 0 3 8 C1 13 -2 14 -3 14 C-2 8 -3 0 -2 -6 Z"
              />
              <path
                className="stroke-illustration-leaf-dark"
                d="M0 -12 L1 -16"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </g>
            <g transform="translate(160,180) rotate(-10)">
              <path
                className="fill-illustration-chili"
                d="M0 -12 C4 -8 5 0 3 8 C1 13 -2 14 -3 14 C-2 8 -3 0 -2 -6 Z"
              />
              <path
                className="stroke-illustration-leaf-dark"
                d="M0 -12 L1 -16"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </g>
            <g transform="translate(130,170) rotate(40)">
              <path
                className="fill-illustration-chili"
                d="M0 -12 C4 -8 5 0 3 8 C1 13 -2 14 -3 14 C-2 8 -3 0 -2 -6 Z"
              />
              <path
                className="stroke-illustration-leaf-dark"
                d="M0 -12 L1 -16"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </g>
            <g transform="translate(150,168) rotate(-25)">
              <path
                className="fill-illustration-chili"
                d="M0 -12 C4 -8 5 0 3 8 C1 13 -2 14 -3 14 C-2 8 -3 0 -2 -6 Z"
              />
              <path
                className="stroke-illustration-leaf-dark"
                d="M0 -12 L1 -16"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </g>
          </g>
          <path
            className="fill-illustration-sand"
            d="M186 196 C186 206 246 206 246 196 L240 186 H192 Z"
          />
          <g>
            <path
              className="fill-illustration-shallot"
              d="M196 170 C198 176 205 178 205 184 C205 189 201 192 196 192 C191 192 187 189 187 184 C187 178 194 176 196 170Z"
            />
            <path
              className="fill-illustration-shallot"
              d="M210 166 C212 172 219 174 219 180 C219 185 215 188 210 188 C205 188 201 185 201 180 C201 174 208 172 210 166Z"
            />
            <path
              className="fill-illustration-shallot"
              d="M224 171 C226 177 233 179 233 185 C233 190 229 193 224 193 C219 193 215 190 215 185 C215 179 222 177 224 171Z"
            />
            <path
              className="fill-illustration-shallot"
              d="M203 158 C205 164 212 166 212 172 C212 177 208 180 203 180 C198 180 194 177 194 172 C194 166 201 164 203 158Z"
            />
            <path
              className="fill-illustration-shallot"
              d="M218 156 C220 162 227 164 227 170 C227 175 223 178 218 178 C213 178 209 175 209 170 C209 164 216 162 218 156Z"
            />
            <path
              className="fill-illustration-shallot"
              d="M232 162 C234 168 241 170 241 176 C241 181 237 184 232 184 C227 184 223 181 223 176 C223 170 230 168 232 162Z"
            />
          </g>
          <g>
            <path
              className="fill-illustration-white stroke-illustration-line"
              d="M262 198 C258 176 262 152 270 140 H306 C314 152 318 176 314 198 Z"
              strokeWidth="2"
            />
            <rect className="fill-illustration-leaf-dark" x="264" y="166" width="48" height="12" />
          </g>
          <g>
            <rect
              className="fill-illustration-white stroke-illustration-line"
              x="118"
              y="120"
              width="44"
              height="26"
              rx="6"
              strokeWidth="1.5"
            />
            <path
              className="stroke-illustration-chili"
              d="M124 138 L132 132 L139 135 L150 126"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <path className="stroke-illustration-sand" d="M140 146 L140 176" strokeWidth="2" />
          </g>
          <g>
            <rect
              className="fill-illustration-white stroke-illustration-line"
              x="250"
              y="104"
              width="44"
              height="26"
              rx="6"
              strokeWidth="1.5"
            />
            <path
              className="stroke-illustration-leaf-dark"
              d="M256 118 L266 122 L274 116 L286 120"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </g>
        </svg>
      );
    case 'inflasi':
      return (
        <svg viewBox="0 0 280 180" aria-hidden className={className}>
          <rect className="fill-illustration-kunyit-light" width="280" height="180" rx="24" />
          <circle
            className="fill-illustration-kunyit-light"
            cx="220"
            cy="40"
            r="56"
            opacity="0.6"
          />
          <g>
            <ellipse className="fill-illustration-kunyit" cx="70" cy="140" rx="28" ry="9" />
            <ellipse className="fill-illustration-kunyit" cx="70" cy="136" rx="28" ry="9" />
            <ellipse className="fill-illustration-kunyit" cx="70" cy="128" rx="28" ry="9" />
            <ellipse className="fill-illustration-kunyit" cx="70" cy="124" rx="28" ry="9" />
            <ellipse className="fill-illustration-kunyit" cx="70" cy="116" rx="28" ry="9" />
            <ellipse className="fill-illustration-kunyit" cx="70" cy="112" rx="28" ry="9" />
            <ellipse className="fill-illustration-kunyit" cx="70" cy="104" rx="28" ry="9" />
            <ellipse className="fill-illustration-kunyit" cx="70" cy="100" rx="28" ry="9" />
          </g>
          <g>
            <ellipse className="fill-illustration-kunyit" cx="128" cy="140" rx="28" ry="9" />
            <ellipse className="fill-illustration-kunyit" cx="128" cy="136" rx="28" ry="9" />
            <ellipse className="fill-illustration-kunyit" cx="128" cy="128" rx="28" ry="9" />
            <ellipse className="fill-illustration-kunyit" cx="128" cy="124" rx="28" ry="9" />
            <ellipse className="fill-illustration-kunyit" cx="128" cy="116" rx="28" ry="9" />
            <ellipse className="fill-illustration-kunyit" cx="128" cy="112" rx="28" ry="9" />
            <ellipse className="fill-illustration-kunyit" cx="128" cy="104" rx="28" ry="9" />
            <ellipse className="fill-illustration-kunyit" cx="128" cy="100" rx="28" ry="9" />
            <ellipse className="fill-illustration-kunyit" cx="128" cy="92" rx="28" ry="9" />
            <ellipse className="fill-illustration-kunyit" cx="128" cy="88" rx="28" ry="9" />
            <ellipse className="fill-illustration-kunyit" cx="128" cy="80" rx="28" ry="9" />
            <ellipse className="fill-illustration-kunyit" cx="128" cy="76" rx="28" ry="9" />
          </g>
          <g>
            <path
              className="stroke-illustration-chili"
              d="M168 148 C176 122 190 104 214 92"
              strokeWidth="5"
              strokeLinecap="round"
              fill="none"
            />
            <path
              className="stroke-illustration-chili"
              d="M200 86 L216 90 L210 106"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </g>
          <g>
            <path className="fill-illustration-leaf-dark" d="M196 120 H246 L240 156 H202 Z" />
            <path
              className="stroke-illustration-brand"
              d="M208 120 C208 108 234 108 234 120"
              strokeWidth="4"
              fill="none"
            />
          </g>
        </svg>
      );
    case 'arif-net':
      return (
        <svg viewBox="0 0 280 180" aria-hidden className={className}>
          <rect className="fill-illustration-terong-light" width="280" height="180" rx="24" />
          <path
            className="stroke-illustration-leaf-dark"
            d="M40 160 C60 150 90 156 120 140 C150 124 170 128 200 110 C220 98 236 84 252 66"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
            opacity="0.35"
          />
          <g>
            <path
              className="stroke-illustration-terong"
              d="M60 120 L90 70"
              strokeOpacity="0.35"
              strokeWidth="2"
            />
            <path
              className="stroke-illustration-terong"
              d="M90 70 L130 50"
              strokeOpacity="0.35"
              strokeWidth="2"
            />
            <path
              className="stroke-illustration-terong"
              d="M130 50 L170 62"
              strokeOpacity="0.35"
              strokeWidth="2"
            />
            <path
              className="stroke-illustration-terong"
              d="M170 62 L204 96"
              strokeOpacity="0.35"
              strokeWidth="2"
            />
            <path
              className="stroke-illustration-terong"
              d="M90 70 L150 110"
              strokeOpacity="0.35"
              strokeWidth="2"
            />
            <path
              className="stroke-illustration-terong"
              d="M150 110 L170 62"
              strokeOpacity="0.35"
              strokeWidth="2"
            />
            <path
              className="stroke-illustration-terong"
              d="M60 120 L110 120"
              strokeOpacity="0.35"
              strokeWidth="2"
            />
            <path
              className="stroke-illustration-terong"
              d="M110 120 L150 110"
              strokeOpacity="0.35"
              strokeWidth="2"
            />
            <path
              className="stroke-illustration-terong"
              d="M150 110 L180 140"
              strokeOpacity="0.35"
              strokeWidth="2"
            />
            <path
              className="stroke-illustration-terong"
              d="M180 140 L204 96"
              strokeOpacity="0.35"
              strokeWidth="2"
            />
            <path
              className="stroke-illustration-terong"
              d="M180 140 L220 140"
              strokeOpacity="0.35"
              strokeWidth="2"
            />
            <path
              className="stroke-illustration-terong"
              d="M204 96 L220 140"
              strokeOpacity="0.35"
              strokeWidth="2"
            />
            <path
              className="stroke-illustration-terong"
              d="M110 120 L180 140"
              strokeOpacity="0.35"
              strokeWidth="2"
            />
            <circle
              className="fill-illustration-white stroke-illustration-terong"
              cx="60"
              cy="120"
              r="7"
              strokeWidth="2.5"
            />
            <circle
              className="fill-illustration-white stroke-illustration-terong"
              cx="90"
              cy="70"
              r="7"
              strokeWidth="2.5"
            />
            <circle
              className="fill-illustration-white stroke-illustration-terong"
              cx="130"
              cy="50"
              r="7"
              strokeWidth="2.5"
            />
            <circle
              className="fill-illustration-white stroke-illustration-terong"
              cx="170"
              cy="62"
              r="7"
              strokeWidth="2.5"
            />
            <circle
              className="fill-illustration-white stroke-illustration-terong"
              cx="204"
              cy="96"
              r="7"
              strokeWidth="2.5"
            />
            <circle
              className="fill-illustration-terong stroke-illustration-terong"
              cx="150"
              cy="110"
              r="11"
              strokeWidth="2.5"
            />
            <circle
              className="fill-illustration-white stroke-illustration-terong"
              cx="110"
              cy="120"
              r="7"
              strokeWidth="2.5"
            />
            <circle
              className="fill-illustration-white stroke-illustration-terong"
              cx="180"
              cy="140"
              r="7"
              strokeWidth="2.5"
            />
            <circle
              className="fill-illustration-white stroke-illustration-terong"
              cx="220"
              cy="140"
              r="7"
              strokeWidth="2.5"
            />
            <path
              className="stroke-illustration-white"
              d="M150 104 V116 M144 110 H156"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </g>
          <path
            className="fill-illustration-kunyit"
            d="M230 70 L234 80 L244 84 L234 88 L230 98 L226 88 L216 84 L226 80 Z"
          />
        </svg>
      );
    case 'peta':
      return (
        <svg viewBox="0 0 360 220" aria-hidden className={className}>
          <rect className="fill-illustration-mint" width="360" height="220" rx="24" />
          <path
            className="fill-illustration-mint stroke-illustration-mint"
            d="M30 120 C40 70 90 40 150 46 C200 50 230 30 280 44 C330 58 340 110 320 150 C300 190 240 196 180 188 C120 180 60 186 40 160 C32 150 28 136 30 120Z"
            strokeWidth="2"
          />
          <path
            className="stroke-illustration-white"
            d="M60 140 C110 120 160 130 210 100 C250 76 290 84 320 70"
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
          />
          <path
            className="stroke-illustration-white"
            d="M120 60 C130 100 150 140 140 190"
            strokeWidth="4"
            strokeLinecap="round"
            fill="none"
          />
          <path
            className="stroke-illustration-white"
            d="M230 40 C226 90 240 140 260 190"
            strokeWidth="4"
            strokeLinecap="round"
            fill="none"
          />
          <g>
            <path
              className="fill-illustration-white stroke-illustration-muted"
              d="M90 118 C90 118 80 108 80 100 A10 10 0 0 1 100 100 C100 108 90 118 90 118Z"
              strokeWidth="2"
              strokeDasharray="3 3"
            />
            <circle className="fill-illustration-muted" cx="90" cy="100" r="3" />
          </g>
          <g>
            <path
              className="fill-illustration-white stroke-illustration-muted"
              d="M270 122 C270 122 260 112 260 104 A10 10 0 0 1 280 104 C280 112 270 122 270 122Z"
              strokeWidth="2"
              strokeDasharray="3 3"
            />
            <circle className="fill-illustration-muted" cx="270" cy="104" r="3" />
          </g>
          <g>
            <path
              className="fill-illustration-white stroke-illustration-muted"
              d="M160 168 C160 168 150 158 150 150 A10 10 0 0 1 170 150 C170 158 160 168 160 168Z"
              strokeWidth="2"
              strokeDasharray="3 3"
            />
            <circle className="fill-illustration-muted" cx="160" cy="150" r="3" />
          </g>
          <g>
            <circle className="fill-illustration-chili" cx="212" cy="100" r="26" opacity="0.12" />
            <circle className="fill-illustration-chili" cx="212" cy="100" r="14" opacity="0.18" />
            <path
              className="fill-illustration-chili"
              d="M212 104 C212 104 200 92 200 82 A12 12 0 0 1 224 82 C224 92 212 104 212 104Z"
            />
            <circle className="fill-illustration-white" cx="212" cy="82" r="4.5" />
          </g>
        </svg>
      );
  }
}
