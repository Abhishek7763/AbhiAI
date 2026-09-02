const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const iconSvg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Background Gradient -->
    <radialGradient id="bgGrad" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#12141a" />
      <stop offset="45%" stop-color="#0c0d12" />
      <stop offset="100%" stop-color="#07080a" />
    </radialGradient>

    <!-- Ambient Core Glow -->
    <radialGradient id="iconGlow" cx="45%" cy="48%" r="42%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.14" />
      <stop offset="40%" stop-color="#94a3b8" stop-opacity="0.05" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0" />
    </radialGradient>

    <!-- Technical Grid Pattern with Plus intersections -->
    <pattern id="grid" width="128" height="128" patternUnits="userSpaceOnUse">
      <path d="M 128 0 L 0 0 0 128" fill="none" stroke="#222736" stroke-width="1.2" stroke-opacity="0.6" />
      <!-- Subtle intersection crosshairs -->
      <path d="M 0 10 L 0 -10 M -10 0 L 10 0" stroke="#333c52" stroke-width="1.5" stroke-opacity="0.8" />
    </pattern>

    <!-- 3D Ribbon Main Satin Chrome Gradient -->
    <linearGradient id="ribbonMain" x1="150" y1="850" x2="850" y2="150" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#CBD5E1" />
      <stop offset="14%" stop-color="#FFFFFF" />
      <stop offset="32%" stop-color="#94A3B8" />
      <stop offset="52%" stop-color="#E2E8F0" />
      <stop offset="70%" stop-color="#64748B" />
      <stop offset="86%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#E2E8F0" />
    </linearGradient>

    <!-- Front Strand Gradient -->
    <linearGradient id="ribbonFront" x1="380" y1="260" x2="720" y2="660" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="25%" stop-color="#F8FAFC" />
      <stop offset="55%" stop-color="#CBD5E1" />
      <stop offset="80%" stop-color="#94A3B8" />
      <stop offset="100%" stop-color="#475569" />
    </linearGradient>

    <!-- Underside Ambient Shadow Gradient -->
    <linearGradient id="ribbonUnder" x1="680" y1="300" x2="300" y2="720" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#334155" />
      <stop offset="35%" stop-color="#64748B" />
      <stop offset="65%" stop-color="#CBD5E1" />
      <stop offset="85%" stop-color="#475569" />
      <stop offset="100%" stop-color="#1E293B" />
    </linearGradient>

    <!-- Realistic 3D Cast Shadow -->
    <filter id="crossoverShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="-8" dy="16" stdDeviation="15" flood-color="#04060a" flood-opacity="0.85" />
    </filter>
  </defs>

  <!-- Background Base -->
  <rect width="1024" height="1024" fill="url(#bgGrad)" />
  <rect width="1024" height="1024" fill="url(#grid)" />
  <circle cx="512" cy="512" r="420" fill="url(#iconGlow)" />

  <!-- 3D Infinity Loop Geometry (Scale factor 5.12 from 200 unit base) -->
  <g id="infinity-loop">
    <!-- Under Strand -->
    <path
      d="M 501 481
         C 573 389, 686 266, 788 296
         C 890 327, 921 450, 829 563
         C 737 675, 604 778, 501 614
         C 409 471, 296 419, 215 460
         C 122 512, 112 645, 204 737
         C 296 829, 440 819, 522 665
         C 542 624, 532 573, 501 481 Z"
      fill="none"
      stroke="url(#ribbonUnder)"
      stroke-width="96"
      stroke-linecap="round"
      stroke-linejoin="round"
    />

    <!-- Main Volumetric Ribbon Body -->
    <path
      d="M 501 481
         C 573 389, 686 266, 788 296
         C 890 327, 921 450, 829 563
         C 737 675, 604 778, 501 614
         C 409 471, 296 419, 215 460
         C 122 512, 112 645, 204 737
         C 296 829, 440 819, 522 665
         C 542 624, 532 573, 501 481 Z"
      fill="none"
      stroke="url(#ribbonMain)"
      stroke-width="92"
      stroke-linecap="round"
      stroke-linejoin="round"
    />

    <!-- Overlapping Front Crossover Strand -->
    <path
      d="M 419 368
         C 491 419, 604 450, 696 399
         C 788 348, 829 296, 768 296
         C 675 276, 573 378, 501 471
         C 471 522, 460 583, 481 645"
      fill="none"
      stroke="url(#ribbonFront)"
      stroke-width="92"
      stroke-linecap="round"
      filter="url(#crossoverShadow)"
    />

    <!-- Specular Crest Highlight: Top Right -->
    <path
      d="M 634 327
         C 727 276, 829 296, 850 389
         C 860 460, 798 563, 727 634"
      fill="none"
      stroke="#FFFFFF"
      stroke-width="16"
      stroke-linecap="round"
      stroke-opacity="0.92"
    />

    <!-- Specular Crest Highlight: Bottom Left -->
    <path
      d="M 194 491
         C 143 542, 133 645, 215 727
         C 286 798, 409 788, 481 665"
      fill="none"
      stroke="#FFFFFF"
      stroke-width="16"
      stroke-linecap="round"
      stroke-opacity="0.92"
    />

    <!-- Central Crossing Glimmer -->
    <path
      d="M 481 440 C 501 481, 532 522, 563 563"
      fill="none"
      stroke="#FFFFFF"
      stroke-width="12"
      stroke-linecap="round"
      stroke-opacity="0.95"
    />
  </g>
</svg>
`;

const logoSvg = `
<svg width="1800" height="600" viewBox="0 0 1800 600" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Background Gradient -->
    <radialGradient id="logoBgGrad" cx="30%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#12141a" />
      <stop offset="50%" stop-color="#0c0d12" />
      <stop offset="100%" stop-color="#07080a" />
    </radialGradient>

    <!-- Ambient Core Glow -->
    <radialGradient id="logoIconGlow" cx="20%" cy="50%" r="35%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.15" />
      <stop offset="50%" stop-color="#94a3b8" stop-opacity="0.04" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0" />
    </radialGradient>

    <!-- Technical Grid Pattern with Plus intersections -->
    <pattern id="logoGrid" width="100" height="100" patternUnits="userSpaceOnUse">
      <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#222736" stroke-width="1.2" stroke-opacity="0.6" />
      <!-- Subtle intersection crosshairs -->
      <path d="M 0 8 L 0 -8 M -8 0 L 8 0" stroke="#333c52" stroke-width="1.5" stroke-opacity="0.8" />
    </pattern>

    <!-- 3D Ribbon Main Satin Chrome Gradient -->
    <linearGradient id="lRibbonMain" x1="100" y1="500" x2="500" y2="100" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#CBD5E1" />
      <stop offset="14%" stop-color="#FFFFFF" />
      <stop offset="32%" stop-color="#94A3B8" />
      <stop offset="52%" stop-color="#E2E8F0" />
      <stop offset="70%" stop-color="#64748B" />
      <stop offset="86%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#E2E8F0" />
    </linearGradient>

    <!-- Front Strand Gradient -->
    <linearGradient id="lRibbonFront" x1="220" y1="160" x2="420" y2="400" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="25%" stop-color="#F8FAFC" />
      <stop offset="55%" stop-color="#CBD5E1" />
      <stop offset="80%" stop-color="#94A3B8" />
      <stop offset="100%" stop-color="#475569" />
    </linearGradient>

    <!-- Underside Ambient Shadow Gradient -->
    <linearGradient id="lRibbonUnder" x1="400" y1="180" x2="180" y2="420" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#334155" />
      <stop offset="35%" stop-color="#64748B" />
      <stop offset="65%" stop-color="#CBD5E1" />
      <stop offset="85%" stop-color="#475569" />
      <stop offset="100%" stop-color="#1E293B" />
    </linearGradient>

    <!-- Realistic 3D Cast Shadow -->
    <filter id="lCrossoverShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="-5" dy="10" stdDeviation="9" flood-color="#04060a" flood-opacity="0.85" />
    </filter>
  </defs>

  <!-- Background Base -->
  <rect width="1800" height="600" fill="url(#logoBgGrad)" />
  <rect width="1800" height="600" fill="url(#logoGrid)" />
  <circle cx="310" cy="300" r="280" fill="url(#logoIconGlow)" />

  <!-- Left: 3D Infinity Loop Symbol (Scale 3.1x, Position X: 60, Y: 10) -->
  <g transform="translate(60, 20) scale(2.8)">
    <!-- Under Strand -->
    <path
      d="M 98 94
         C 112 76, 134 52, 154 58
         C 174 64, 180 88, 162 110
         C 144 132, 118 152, 98 120
         C 80 92, 58 82, 42 90
         C 24 100, 22 126, 40 144
         C 58 162, 86 160, 102 130
         C 106 122, 104 112, 98 94 Z"
      fill="none"
      stroke="url(#lRibbonUnder)"
      stroke-width="19"
      stroke-linecap="round"
      stroke-linejoin="round"
    />

    <!-- Main Volumetric Ribbon Body -->
    <path
      d="M 98 94
         C 112 76, 134 52, 154 58
         C 174 64, 180 88, 162 110
         C 144 132, 118 152, 98 120
         C 80 92, 58 82, 42 90
         C 24 100, 22 126, 40 144
         C 58 162, 86 160, 102 130
         C 106 122, 104 112, 98 94 Z"
      fill="none"
      stroke="url(#lRibbonMain)"
      stroke-width="18"
      stroke-linecap="round"
      stroke-linejoin="round"
    />

    <!-- Overlapping Front Crossover Strand -->
    <path
      d="M 82 72
         C 96 82, 118 88, 136 78
         C 154 68, 162 58, 150 58
         C 132 54, 112 74, 98 92
         C 92 102, 90 114, 94 126"
      fill="none"
      stroke="url(#lRibbonFront)"
      stroke-width="18"
      stroke-linecap="round"
      filter="url(#lCrossoverShadow)"
    />

    <!-- Specular Crest Highlights -->
    <path
      d="M 124 64
         C 142 54, 162 58, 166 76
         C 168 90, 156 110, 142 124"
      fill="none"
      stroke="#FFFFFF"
      stroke-width="3.2"
      stroke-linecap="round"
      stroke-opacity="0.9"
    />

    <path
      d="M 38 96
         C 28 106, 26 126, 42 142
         C 56 156, 80 154, 94 130"
      fill="none"
      stroke="#FFFFFF"
      stroke-width="3.2"
      stroke-linecap="round"
      stroke-opacity="0.9"
    />

    <path
      d="M 94 86 C 98 94, 104 102, 110 110"
      fill="none"
      stroke="#FFFFFF"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-opacity="0.95"
    />
  </g>

  <!-- Right: Pure White Bold Geometric Capsule Typography "A  B  H  I  A  I" -->
  <!-- Transformed to match exact optical baseline and tracking -->
  <g transform="translate(680, 230) scale(3.5)" fill="#FFFFFF">
    <!-- Letter 'A' (1) -->
    <g transform="translate(0, 0)">
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M 5 34 C 2.238 34 0 31.762 0 29 V 14 C 0 6.268 6.268 0 14 0 H 22 C 29.732 0 36 6.268 36 14 V 29 C 36 31.762 33.762 34 31 34 C 28.238 34 26 31.762 26 29 V 24 H 10 V 29 C 10 31.762 7.762 34 5 34 Z M 10 16 H 26 V 14 C 26 9.582 22.418 6 18 6 C 13.582 6 10 9.582 10 14 V 16 Z"
      />
    </g>

    <!-- Letter 'B' -->
    <g transform="translate(56, 0)">
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M 0 5 C 0 2.238 2.238 0 5 0 H 22 C 28.627 0 34 5.373 34 12 C 34 15.2 32.7 18.1 30.5 20.2 C 33.2 22.4 35 25.7 35 29.5 C 35 36.403 29.403 42 22.5 42 H 5 C 2.238 42 0 39.762 0 37 V 5 Z M 9 8 V 16 H 21 C 23.209 16 25 14.209 25 12 C 25 9.791 23.209 8 21 8 H 9 Z M 9 24 V 34 H 22 C 24.761 34 27 31.761 27 29 C 27 26.239 24.761 24 22 24 H 9 Z"
        transform="scale(0.81)"
      />
    </g>

    <!-- Letter 'H' -->
    <g transform="translate(112, 0)">
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M 5 0 C 7.762 0 10 2.238 10 5 V 13 H 26 V 5 C 26 2.238 28.238 0 31 0 C 33.762 0 36 2.238 36 5 V 29 C 36 31.762 33.762 34 31 34 C 28.238 34 26 31.762 26 29 V 21 H 10 V 29 C 10 31.762 7.762 34 5 34 C 2.238 34 0 31.762 0 29 V 5 C 0 2.238 2.238 0 5 0 Z"
      />
    </g>

    <!-- Letter 'I' (1) -->
    <g transform="translate(168, 0)">
      <rect x="0" y="0" width="10" height="34" rx="5" />
    </g>

    <!-- Letter 'A' (2) -->
    <g transform="translate(204, 0)">
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M 5 34 C 2.238 34 0 31.762 0 29 V 14 C 0 6.268 6.268 0 14 0 H 22 C 29.732 0 36 6.268 36 14 V 29 C 36 31.762 33.762 34 31 34 C 28.238 34 26 31.762 26 29 V 24 H 10 V 29 C 10 31.762 7.762 34 5 34 Z M 10 16 H 26 V 14 C 26 9.582 22.418 6 18 6 C 13.582 6 10 9.582 10 14 V 16 Z"
      />
    </g>

    <!-- Letter 'I' (2) -->
    <g transform="translate(260, 0)">
      <rect x="0" y="0" width="10" height="34" rx="5" />
    </g>
  </g>
</svg>
`;

async function generateAssets() {
  const brandingDir = path.join(__dirname, 'public', 'branding');
  if (!fs.existsSync(brandingDir)) {
    fs.mkdirSync(brandingDir, { recursive: true });
  }

  const iconPath = path.join(brandingDir, 'abhiai-icon.png');
  const logoPath = path.join(brandingDir, 'abhiai-logo.png');

  console.log('Rendering abhiai-icon.png...');
  await sharp(Buffer.from(iconSvg))
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(iconPath);
  console.log('Successfully written:', iconPath);

  console.log('Rendering abhiai-logo.png...');
  await sharp(Buffer.from(logoSvg))
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(logoPath);
  console.log('Successfully written:', logoPath);
}

generateAssets().catch(err => {
  console.error('Error generating assets:', err);
  process.exit(1);
});
