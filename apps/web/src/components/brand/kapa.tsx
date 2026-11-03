import { cn } from '@kawan-pasar/ui';

// Kapa, the Kawan Pasar mascot: a curly red chilli, the most volatile commodity we track. Seven
// poses match the context (greeting, pointing, forecast, learning, alert, happy, resting). Colours
// come from the `illustration.*` tokens; the bob and the blink only run under motion-safe.

export type KapaPose =
  'halo' | 'menunjuk' | 'prediksi' | 'belajar' | 'waspada' | 'senang' | 'istirahat';

export type KapaProps = {
  readonly pose?: KapaPose;
  /** Read by screen readers; leave it out when Kapa only decorates nearby text. */
  readonly title?: string;
  readonly isAnimated?: boolean;
  readonly className?: string;
};

function Pose({ pose }: { readonly pose: KapaPose }) {
  switch (pose) {
    case 'halo':
      return (
        <>
          <ellipse
            className="fill-illustration-ink"
            cx="90"
            cy="190"
            rx="44"
            ry="5"
            opacity="0.09"
          />
          <g transform="translate(10,6)">
            <g className="kapa-rig">
              <g>
                <ellipse className="fill-illustration-chili-dark" cx="64" cy="178" rx="13" ry="6" />
                <ellipse className="fill-illustration-chili-dark" cx="96" cy="178" rx="13" ry="6" />
              </g>
              <path
                className="stroke-illustration-chili-dark"
                d="M26 124 C18 132 16 142 20 150"
                strokeWidth="9"
                strokeLinecap="round"
                fill="none"
              />
              <g>
                <path
                  className="stroke-illustration-leaf-dark"
                  d="M80 38 L80 26"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                <path
                  className="fill-illustration-leaf"
                  d="M80 34 C70 14 54 8 46 13 C55 18 66 26 80 34Z"
                />
                <path
                  className="fill-illustration-leaf-dark"
                  d="M80 34 C86 10 103 3 112 8 C102 15 90 23 80 34Z"
                />
              </g>
              <g>
                <path
                  className="fill-illustration-chili"
                  d="M80 30 C93 52 140 72 140 120 C140 155 113 176 80 176 C47 176 20 155 20 120 C20 72 67 52 80 30Z"
                />
                <path
                  className="stroke-illustration-shallot"
                  d="M80 46 C70 74 68 140 74 172"
                  strokeOpacity="0.22"
                  strokeWidth="2.5"
                  fill="none"
                />
                <path
                  className="stroke-illustration-shallot"
                  d="M80 46 C92 74 94 140 88 172"
                  strokeOpacity="0.16"
                  strokeWidth="2.5"
                  fill="none"
                />
                <path
                  className="stroke-illustration-white"
                  d="M42 104 C44 88 52 76 62 69"
                  strokeOpacity="0.35"
                  strokeWidth="6"
                  strokeLinecap="round"
                  fill="none"
                />
              </g>
              <g>
                <g className="kapa-eyes">
                  <ellipse className="fill-illustration-ink" cx="64" cy="116" rx="6.5" ry="8.5" />
                  <ellipse className="fill-illustration-ink" cx="96" cy="116" rx="6.5" ry="8.5" />
                  <circle className="fill-illustration-white" cx="66.5" cy="112.5" r="2.4" />
                  <circle className="fill-illustration-white" cx="98.5" cy="112.5" r="2.4" />
                </g>
                <g>
                  <ellipse
                    className="fill-illustration-cheek"
                    cx="50"
                    cy="130"
                    rx="8"
                    ry="5"
                    opacity="0.85"
                  />
                  <ellipse
                    className="fill-illustration-cheek"
                    cx="110"
                    cy="130"
                    rx="8"
                    ry="5"
                    opacity="0.85"
                  />
                </g>
                <path
                  className="stroke-illustration-ink"
                  d="M70 134 Q80 143 90 134"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  fill="none"
                />
              </g>
              <path
                className="stroke-illustration-chili-dark"
                d="M134 120 C148 110 154 96 150 82"
                strokeWidth="9"
                strokeLinecap="round"
                fill="none"
              />
            </g>
          </g>
        </>
      );
    case 'menunjuk':
      return (
        <>
          <ellipse
            className="fill-illustration-ink"
            cx="90"
            cy="190"
            rx="44"
            ry="5"
            opacity="0.09"
          />
          <g transform="translate(10,6)">
            <g className="kapa-rig">
              <g>
                <ellipse className="fill-illustration-chili-dark" cx="64" cy="178" rx="13" ry="6" />
                <ellipse className="fill-illustration-chili-dark" cx="96" cy="178" rx="13" ry="6" />
              </g>
              <path
                className="stroke-illustration-chili-dark"
                d="M26 124 C18 132 16 142 20 150"
                strokeWidth="9"
                strokeLinecap="round"
                fill="none"
              />
              <g>
                <path
                  className="stroke-illustration-leaf-dark"
                  d="M80 38 L80 26"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                <path
                  className="fill-illustration-leaf"
                  d="M80 34 C70 14 54 8 46 13 C55 18 66 26 80 34Z"
                />
                <path
                  className="fill-illustration-leaf-dark"
                  d="M80 34 C86 10 103 3 112 8 C102 15 90 23 80 34Z"
                />
              </g>
              <g>
                <path
                  className="fill-illustration-chili"
                  d="M80 30 C93 52 140 72 140 120 C140 155 113 176 80 176 C47 176 20 155 20 120 C20 72 67 52 80 30Z"
                />
                <path
                  className="stroke-illustration-shallot"
                  d="M80 46 C70 74 68 140 74 172"
                  strokeOpacity="0.22"
                  strokeWidth="2.5"
                  fill="none"
                />
                <path
                  className="stroke-illustration-shallot"
                  d="M80 46 C92 74 94 140 88 172"
                  strokeOpacity="0.16"
                  strokeWidth="2.5"
                  fill="none"
                />
                <path
                  className="stroke-illustration-white"
                  d="M42 104 C44 88 52 76 62 69"
                  strokeOpacity="0.35"
                  strokeWidth="6"
                  strokeLinecap="round"
                  fill="none"
                />
              </g>
              <g>
                <g className="kapa-eyes">
                  <ellipse className="fill-illustration-ink" cx="67" cy="116" rx="6.5" ry="8.5" />
                  <ellipse className="fill-illustration-ink" cx="99" cy="116" rx="6.5" ry="8.5" />
                  <circle className="fill-illustration-white" cx="69.5" cy="112.5" r="2.4" />
                  <circle className="fill-illustration-white" cx="101.5" cy="112.5" r="2.4" />
                </g>
                <g>
                  <ellipse
                    className="fill-illustration-cheek"
                    cx="50"
                    cy="130"
                    rx="8"
                    ry="5"
                    opacity="0.85"
                  />
                  <ellipse
                    className="fill-illustration-cheek"
                    cx="110"
                    cy="130"
                    rx="8"
                    ry="5"
                    opacity="0.85"
                  />
                </g>
                <path
                  className="stroke-illustration-ink"
                  d="M70 134 Q80 143 90 134"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  fill="none"
                />
              </g>
              <path
                className="stroke-illustration-chili-dark"
                d="M134 122 C146 120 156 116 166 110"
                strokeWidth="9"
                strokeLinecap="round"
                fill="none"
              />
            </g>
          </g>
        </>
      );
    case 'prediksi':
      return (
        <>
          <ellipse
            className="fill-illustration-ink"
            cx="90"
            cy="190"
            rx="44"
            ry="5"
            opacity="0.09"
          />
          <g transform="translate(10,6)">
            <g className="kapa-rig">
              <g>
                <ellipse className="fill-illustration-chili-dark" cx="64" cy="178" rx="13" ry="6" />
                <ellipse className="fill-illustration-chili-dark" cx="96" cy="178" rx="13" ry="6" />
              </g>
              <path
                className="stroke-illustration-chili-dark"
                d="M28 126 C34 140 46 148 56 150"
                strokeWidth="9"
                strokeLinecap="round"
                fill="none"
              />
              <g>
                <path
                  className="stroke-illustration-leaf-dark"
                  d="M80 38 L80 26"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                <path
                  className="fill-illustration-leaf"
                  d="M80 34 C70 14 54 8 46 13 C55 18 66 26 80 34Z"
                />
                <path
                  className="fill-illustration-leaf-dark"
                  d="M80 34 C86 10 103 3 112 8 C102 15 90 23 80 34Z"
                />
              </g>
              <g>
                <path
                  className="fill-illustration-chili"
                  d="M80 30 C93 52 140 72 140 120 C140 155 113 176 80 176 C47 176 20 155 20 120 C20 72 67 52 80 30Z"
                />
                <path
                  className="stroke-illustration-shallot"
                  d="M80 46 C70 74 68 140 74 172"
                  strokeOpacity="0.22"
                  strokeWidth="2.5"
                  fill="none"
                />
                <path
                  className="stroke-illustration-shallot"
                  d="M80 46 C92 74 94 140 88 172"
                  strokeOpacity="0.16"
                  strokeWidth="2.5"
                  fill="none"
                />
                <path
                  className="stroke-illustration-white"
                  d="M42 104 C44 88 52 76 62 69"
                  strokeOpacity="0.35"
                  strokeWidth="6"
                  strokeLinecap="round"
                  fill="none"
                />
              </g>
              <g>
                <g className="kapa-eyes">
                  <ellipse className="fill-illustration-ink" cx="64" cy="116" rx="6.5" ry="8.5" />
                  <ellipse className="fill-illustration-ink" cx="96" cy="116" rx="6.5" ry="8.5" />
                  <circle className="fill-illustration-white" cx="66.5" cy="112.5" r="2.4" />
                  <circle className="fill-illustration-white" cx="98.5" cy="112.5" r="2.4" />
                </g>
                <g>
                  <ellipse
                    className="fill-illustration-cheek"
                    cx="50"
                    cy="130"
                    rx="8"
                    ry="5"
                    opacity="0.85"
                  />
                  <ellipse
                    className="fill-illustration-cheek"
                    cx="110"
                    cy="130"
                    rx="8"
                    ry="5"
                    opacity="0.85"
                  />
                </g>
                <path
                  className="stroke-illustration-ink"
                  d="M70 134 Q80 143 90 134"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  fill="none"
                />
              </g>
              <path
                className="stroke-illustration-chili-dark"
                d="M132 126 C126 140 114 148 104 150"
                strokeWidth="9"
                strokeLinecap="round"
                fill="none"
              />
              <g>
                <rect
                  className="fill-illustration-white stroke-illustration-line"
                  x="48"
                  y="132"
                  width="64"
                  height="44"
                  rx="9"
                  strokeWidth="2"
                />
                <path
                  className="stroke-illustration-leaf-dark"
                  d="M56 166 L67 158 L77 162 L91 148"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
                <path
                  className="stroke-illustration-terong"
                  d="M91 148 L103 141"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeDasharray="3 4"
                  fill="none"
                />
                <circle className="fill-illustration-terong" cx="104" cy="140.5" r="3.6" />
              </g>
            </g>
          </g>
        </>
      );
    case 'belajar':
      return (
        <>
          <ellipse
            className="fill-illustration-ink"
            cx="90"
            cy="190"
            rx="44"
            ry="5"
            opacity="0.09"
          />
          <g transform="translate(10,6)">
            <g className="kapa-rig">
              <g>
                <ellipse className="fill-illustration-chili-dark" cx="64" cy="178" rx="13" ry="6" />
                <ellipse className="fill-illustration-chili-dark" cx="96" cy="178" rx="13" ry="6" />
              </g>
              <path
                className="stroke-illustration-chili-dark"
                d="M26 124 C18 132 16 142 20 150"
                strokeWidth="9"
                strokeLinecap="round"
                fill="none"
              />
              <g>
                <path
                  className="stroke-illustration-leaf-dark"
                  d="M80 38 L80 26"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                <path
                  className="fill-illustration-leaf"
                  d="M80 34 C70 14 54 8 46 13 C55 18 66 26 80 34Z"
                />
                <path
                  className="fill-illustration-leaf-dark"
                  d="M80 34 C86 10 103 3 112 8 C102 15 90 23 80 34Z"
                />
              </g>
              <g>
                <path
                  className="fill-illustration-chili"
                  d="M80 30 C93 52 140 72 140 120 C140 155 113 176 80 176 C47 176 20 155 20 120 C20 72 67 52 80 30Z"
                />
                <path
                  className="stroke-illustration-shallot"
                  d="M80 46 C70 74 68 140 74 172"
                  strokeOpacity="0.22"
                  strokeWidth="2.5"
                  fill="none"
                />
                <path
                  className="stroke-illustration-shallot"
                  d="M80 46 C92 74 94 140 88 172"
                  strokeOpacity="0.16"
                  strokeWidth="2.5"
                  fill="none"
                />
                <path
                  className="stroke-illustration-white"
                  d="M42 104 C44 88 52 76 62 69"
                  strokeOpacity="0.35"
                  strokeWidth="6"
                  strokeLinecap="round"
                  fill="none"
                />
              </g>
              <g>
                <g className="kapa-eyes">
                  <ellipse className="fill-illustration-ink" cx="66" cy="116" rx="6.5" ry="8.5" />
                  <ellipse className="fill-illustration-ink" cx="98" cy="116" rx="6.5" ry="8.5" />
                  <circle className="fill-illustration-white" cx="68.5" cy="112.5" r="2.4" />
                  <circle className="fill-illustration-white" cx="100.5" cy="112.5" r="2.4" />
                </g>
                <g>
                  <ellipse
                    className="fill-illustration-cheek"
                    cx="50"
                    cy="130"
                    rx="8"
                    ry="5"
                    opacity="0.85"
                  />
                  <ellipse
                    className="fill-illustration-cheek"
                    cx="110"
                    cy="130"
                    rx="8"
                    ry="5"
                    opacity="0.85"
                  />
                </g>
                <path
                  className="stroke-illustration-ink"
                  d="M70 134 Q80 143 90 134"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  fill="none"
                />
              </g>
              <path
                className="stroke-illustration-chili-dark"
                d="M134 124 C142 122 146 118 150 112"
                strokeWidth="9"
                strokeLinecap="round"
                fill="none"
              />
              <g>
                <path
                  className="stroke-illustration-ink"
                  d="M150 112 L141 124"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
                <circle
                  className="fill-illustration-terong-light stroke-illustration-ink"
                  cx="158"
                  cy="100"
                  r="13"
                  strokeWidth="4"
                />
              </g>
            </g>
          </g>
        </>
      );
    case 'waspada':
      return (
        <>
          <ellipse
            className="fill-illustration-ink"
            cx="90"
            cy="190"
            rx="44"
            ry="5"
            opacity="0.09"
          />
          <g transform="translate(10,6)">
            <g className="kapa-rig">
              <g>
                <ellipse className="fill-illustration-chili-dark" cx="64" cy="178" rx="13" ry="6" />
                <ellipse className="fill-illustration-chili-dark" cx="96" cy="178" rx="13" ry="6" />
              </g>
              <path
                className="stroke-illustration-chili-dark"
                d="M26 124 C18 132 16 142 20 150"
                strokeWidth="9"
                strokeLinecap="round"
                fill="none"
              />
              <g>
                <path
                  className="stroke-illustration-leaf-dark"
                  d="M80 38 L80 26"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                <path
                  className="fill-illustration-leaf"
                  d="M80 34 C70 14 54 8 46 13 C55 18 66 26 80 34Z"
                />
                <path
                  className="fill-illustration-leaf-dark"
                  d="M80 34 C86 10 103 3 112 8 C102 15 90 23 80 34Z"
                />
              </g>
              <g>
                <path
                  className="fill-illustration-chili"
                  d="M80 30 C93 52 140 72 140 120 C140 155 113 176 80 176 C47 176 20 155 20 120 C20 72 67 52 80 30Z"
                />
                <path
                  className="stroke-illustration-shallot"
                  d="M80 46 C70 74 68 140 74 172"
                  strokeOpacity="0.22"
                  strokeWidth="2.5"
                  fill="none"
                />
                <path
                  className="stroke-illustration-shallot"
                  d="M80 46 C92 74 94 140 88 172"
                  strokeOpacity="0.16"
                  strokeWidth="2.5"
                  fill="none"
                />
                <path
                  className="stroke-illustration-white"
                  d="M42 104 C44 88 52 76 62 69"
                  strokeOpacity="0.35"
                  strokeWidth="6"
                  strokeLinecap="round"
                  fill="none"
                />
              </g>
              <g>
                <g className="kapa-eyes">
                  <ellipse className="fill-illustration-ink" cx="64" cy="116" rx="8" ry="9.5" />
                  <ellipse className="fill-illustration-ink" cx="96" cy="116" rx="8" ry="9.5" />
                  <circle className="fill-illustration-white" cx="66.5" cy="112.5" r="2.4" />
                  <circle className="fill-illustration-white" cx="98.5" cy="112.5" r="2.4" />
                </g>
                <g>
                  <ellipse
                    className="fill-illustration-cheek"
                    cx="50"
                    cy="130"
                    rx="8"
                    ry="5"
                    opacity="0.85"
                  />
                  <ellipse
                    className="fill-illustration-cheek"
                    cx="110"
                    cy="130"
                    rx="8"
                    ry="5"
                    opacity="0.85"
                  />
                </g>
                <ellipse className="fill-illustration-ink" cx="80" cy="138" rx="5" ry="6" />
              </g>
              <path
                className="stroke-illustration-chili-dark"
                d="M134 124 C142 132 144 142 140 150"
                strokeWidth="9"
                strokeLinecap="round"
                fill="none"
              />
              <g>
                <circle className="fill-illustration-kunyit" cx="144" cy="40" r="15" />
                <rect
                  className="fill-illustration-white"
                  x="141.5"
                  y="29"
                  width="5"
                  height="14"
                  rx="2.5"
                />
                <circle className="fill-illustration-white" cx="144" cy="49" r="2.8" />
              </g>
            </g>
          </g>
        </>
      );
    case 'senang':
      return (
        <>
          <ellipse
            className="fill-illustration-ink"
            cx="90"
            cy="190"
            rx="44"
            ry="5"
            opacity="0.09"
          />
          <g transform="translate(10,6)">
            <g className="kapa-rig">
              <g>
                <ellipse className="fill-illustration-chili-dark" cx="64" cy="178" rx="13" ry="6" />
                <ellipse className="fill-illustration-chili-dark" cx="96" cy="178" rx="13" ry="6" />
              </g>
              <path
                className="stroke-illustration-chili-dark"
                d="M26 120 C14 108 10 94 14 82"
                strokeWidth="9"
                strokeLinecap="round"
                fill="none"
              />
              <g>
                <path
                  className="stroke-illustration-leaf-dark"
                  d="M80 38 L80 26"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                <path
                  className="fill-illustration-leaf"
                  d="M80 34 C70 14 54 8 46 13 C55 18 66 26 80 34Z"
                />
                <path
                  className="fill-illustration-leaf-dark"
                  d="M80 34 C86 10 103 3 112 8 C102 15 90 23 80 34Z"
                />
              </g>
              <g>
                <path
                  className="fill-illustration-chili"
                  d="M80 30 C93 52 140 72 140 120 C140 155 113 176 80 176 C47 176 20 155 20 120 C20 72 67 52 80 30Z"
                />
                <path
                  className="stroke-illustration-shallot"
                  d="M80 46 C70 74 68 140 74 172"
                  strokeOpacity="0.22"
                  strokeWidth="2.5"
                  fill="none"
                />
                <path
                  className="stroke-illustration-shallot"
                  d="M80 46 C92 74 94 140 88 172"
                  strokeOpacity="0.16"
                  strokeWidth="2.5"
                  fill="none"
                />
                <path
                  className="stroke-illustration-white"
                  d="M42 104 C44 88 52 76 62 69"
                  strokeOpacity="0.35"
                  strokeWidth="6"
                  strokeLinecap="round"
                  fill="none"
                />
              </g>
              <g>
                <g className="kapa-eyes">
                  <path
                    className="stroke-illustration-ink"
                    d="M57 119 Q64 110 71 119"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <path
                    className="stroke-illustration-ink"
                    d="M89 119 Q96 110 103 119"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    fill="none"
                  />
                </g>
                <g>
                  <ellipse
                    className="fill-illustration-cheek"
                    cx="50"
                    cy="130"
                    rx="8"
                    ry="5"
                    opacity="0.85"
                  />
                  <ellipse
                    className="fill-illustration-cheek"
                    cx="110"
                    cy="130"
                    rx="8"
                    ry="5"
                    opacity="0.85"
                  />
                </g>
                <path className="fill-illustration-ink" d="M68 132 Q80 150 92 132 Z" />
              </g>
              <path
                className="stroke-illustration-chili-dark"
                d="M134 120 C146 108 150 94 146 82"
                strokeWidth="9"
                strokeLinecap="round"
                fill="none"
              />
              <g opacity="0.6">
                <path
                  className="fill-illustration-kunyit"
                  d="M150 50 L153 59 L162 62 L153 65 L150 74 L147 65 L138 62 L147 59 Z"
                />
                <path
                  className="fill-illustration-kunyit"
                  d="M14 52 L16 58 L22 60 L16 62 L14 68 L12 62 L6 60 L12 58 Z"
                />
                <circle className="fill-illustration-terong" cx="130" cy="30" r="3" />
                <circle className="fill-illustration-leaf" cx="30" cy="34" r="3" />
              </g>
            </g>
          </g>
        </>
      );
    case 'istirahat':
      return (
        <>
          <ellipse
            className="fill-illustration-ink"
            cx="90"
            cy="190"
            rx="44"
            ry="5"
            opacity="0.09"
          />
          <g transform="translate(10,6)">
            <g className="kapa-rig">
              <g>
                <ellipse className="fill-illustration-chili-dark" cx="64" cy="178" rx="13" ry="6" />
                <ellipse className="fill-illustration-chili-dark" cx="96" cy="178" rx="13" ry="6" />
              </g>
              <path
                className="stroke-illustration-chili-dark"
                d="M26 124 C18 132 16 142 20 150"
                strokeWidth="9"
                strokeLinecap="round"
                fill="none"
              />
              <g>
                <path
                  className="stroke-illustration-leaf-dark"
                  d="M80 38 L80 26"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                <path
                  className="fill-illustration-leaf"
                  d="M80 34 C70 14 54 8 46 13 C55 18 66 26 80 34Z"
                />
                <path
                  className="fill-illustration-leaf-dark"
                  d="M80 34 C86 10 103 3 112 8 C102 15 90 23 80 34Z"
                />
              </g>
              <g>
                <path
                  className="fill-illustration-chili"
                  d="M80 30 C93 52 140 72 140 120 C140 155 113 176 80 176 C47 176 20 155 20 120 C20 72 67 52 80 30Z"
                />
                <path
                  className="stroke-illustration-shallot"
                  d="M80 46 C70 74 68 140 74 172"
                  strokeOpacity="0.22"
                  strokeWidth="2.5"
                  fill="none"
                />
                <path
                  className="stroke-illustration-shallot"
                  d="M80 46 C92 74 94 140 88 172"
                  strokeOpacity="0.16"
                  strokeWidth="2.5"
                  fill="none"
                />
                <path
                  className="stroke-illustration-white"
                  d="M42 104 C44 88 52 76 62 69"
                  strokeOpacity="0.35"
                  strokeWidth="6"
                  strokeLinecap="round"
                  fill="none"
                />
              </g>
              <g>
                <g className="kapa-eyes">
                  <path
                    className="stroke-illustration-ink"
                    d="M57 117 Q64 121 71 117"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <path
                    className="stroke-illustration-ink"
                    d="M89 117 Q96 121 103 117"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    fill="none"
                  />
                </g>
                <g>
                  <ellipse
                    className="fill-illustration-cheek"
                    cx="50"
                    cy="130"
                    rx="8"
                    ry="5"
                    opacity="0.85"
                  />
                  <ellipse
                    className="fill-illustration-cheek"
                    cx="110"
                    cy="130"
                    rx="8"
                    ry="5"
                    opacity="0.85"
                  />
                </g>
                <path
                  className="stroke-illustration-ink"
                  d="M74 136 L86 136"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
              </g>
              <path
                className="stroke-illustration-chili-dark"
                d="M134 124 C142 132 144 142 140 150"
                strokeWidth="9"
                strokeLinecap="round"
                fill="none"
              />
              <g opacity="0.55">
                <path
                  className="stroke-illustration-terong"
                  d="M118 52 H130 L118 64 H130"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
                <path
                  className="stroke-illustration-terong"
                  d="M136 30 H144 L136 38 H144"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  opacity="0.6"
                />
              </g>
            </g>
          </g>
        </>
      );
  }
}

export function Kapa({ pose = 'halo', title, isAnimated = false, className }: KapaProps) {
  return (
    <svg
      viewBox="0 0 180 196"
      data-pose={pose}
      className={cn('h-auto shrink-0', isAnimated && 'kapa-animated', className)}
      {...(title === undefined ? { 'aria-hidden': true } : { role: 'img', 'aria-label': title })}
    >
      <Pose pose={pose} />
    </svg>
  );
}
