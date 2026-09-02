const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// 1) 1024x1024 Icon matching exact geometry from user image
const iconSvg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Background Grid & Charcoal Tone matching user image -->
    <radialGradient id="bgGlow" cx="50%" cy="50%" r="75%">
      <stop offset="0%" stop-color="#141417" />
      <stop offset="60%" stop-color="#0c0d0f" />
      <stop offset="100%" stop-color="#070709" />
    </radialGradient>

    <!-- Subtle technical grid lines like in original photo -->
    <pattern id="gridPattern" width="160" height="160" patternUnits="userSpaceOnUse">
      <path d="M 160 0 L 0 0 0 160" fill="none" stroke="#23262d" stroke-width="1.2" stroke-opacity="0.35" />
      <path d="M 0 10 L 0 -10 M -10 0 L 10 0" stroke="#383d47" stroke-width="1.2" stroke-opacity="0.45" />
    </pattern>

    <!-- Realistic satin metallic silver/white lighting -->
    <linearGradient id="silverGrad" x1="15%" y1="85%" x2="85%" y2="15%">
      <stop offset="0%" stop-color="#9aa0a6" />
      <stop offset="25%" stop-color="#e8eaed" />
      <stop offset="45%" stop-color="#ffffff" />
      <stop offset="70%" stop-color="#bdc1c6" />
      <stop offset="90%" stop-color="#f1f3f4" />
      <stop offset="100%" stop-color="#80868b" />
    </linearGradient>

    <filter id="ribbonShadow" x="-20%" y="-20%" width="150%" height="150%">
      <feDropShadow dx="-6" dy="12" stdDeviation="12" flood-color="#000000" flood-opacity="0.9" />
    </filter>
  </defs>

  <rect width="1024" height="1024" fill="url(#bgGlow)" />
  <rect width="1024" height="1024" fill="url(#gridPattern)" />

  <g id="symbol">
    <!-- Back strand of the loop -->
    <path
      d="M 525 480 
         C 610 380, 715 260, 795 285 
         C 885 315, 875 425, 730 490 
         C 585 550, 480 500, 310 405 
         C 185 335, 155 490, 205 660 
         C 260 830, 435 835, 515 670 
         C 555 590, 540 520, 525 480 Z"
      fill="none"
      stroke="#6d737d"
      stroke-width="70"
      stroke-linecap="round"
      stroke-linejoin="round"
    />

    <!-- Main Satin Silver Body with exact curved curvature -->
    <path
      d="M 525 480 
         C 610 380, 715 260, 795 285 
         C 885 315, 875 425, 730 490 
         C 585 550, 480 500, 310 405 
         C 185 335, 155 490, 205 660 
         C 260 830, 435 835, 515 670 
         C 555 590, 540 520, 525 480 Z"
      fill="none"
      stroke="url(#silverGrad)"
      stroke-width="64"
      stroke-linecap="round"
      stroke-linejoin="round"
    />

    <!-- Front Overlapping Strand crossing over with shadow (creates the 3D twist) -->
    <path
      d="M 430 455
         C 540 515, 680 490, 765 440
         C 840 395, 845 320, 785 295
         C 725 270, 630 365, 525 480
         C 490 520, 490 600, 515 670"
      fill="none"
      stroke="url(#silverGrad)"
      stroke-width="64"
      stroke-linecap="round"
      filter="url(#ribbonShadow)"
    />

    <!-- Pure White Edge Rim Specular Highlight: Top Right Loop -->
    <path
      d="M 640 330 
         C 710 265, 790 280, 830 320 
         C 865 365, 845 420, 750 470"
      fill="none"
      stroke="#ffffff"
      stroke-width="10"
      stroke-linecap="round"
      stroke-opacity="0.9"
    />

    <!-- Pure White Edge Rim Specular Highlight: Bottom Left Loop -->
    <path
      d="M 180 440 
         C 150 540, 185 710, 260 770 
         C 340 830, 460 810, 515 680"
      fill="none"
      stroke="#ffffff"
      stroke-width="10"
      stroke-linecap="round"
      stroke-opacity="0.9"
    />
  </g>
</svg>
`;

const logoSvg = `
<svg width="1800" height="600" viewBox="0 0 1800 600" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="logoGrid" width="120" height="120" patternUnits="userSpaceOnUse">
      <path d="M 120 0 L 0 0 0 120" fill="none" stroke="#1d2026" stroke-width="1.2" stroke-opacity="0.4" />
      <path d="M 0 8 L 0 -8 M -8 0 L 8 0" stroke="#313640" stroke-width="1.2" stroke-opacity="0.5" />
    </pattern>

    <linearGradient id="lSilverGrad" x1="15%" y1="85%" x2="85%" y2="15%">
      <stop offset="0%" stop-color="#9aa0a6" />
      <stop offset="25%" stop-color="#e8eaed" />
      <stop offset="45%" stop-color="#ffffff" />
      <stop offset="70%" stop-color="#bdc1c6" />
      <stop offset="90%" stop-color="#f1f3f4" />
      <stop offset="100%" stop-color="#80868b" />
    </linearGradient>

    <filter id="lRibbonShadow" x="-20%" y="-20%" width="150%" height="150%">
      <feDropShadow dx="-4" dy="8" stdDeviation="8" flood-color="#000000" flood-opacity="0.9" />
    </filter>
  </defs>

  <!-- Background Base matching user design -->
  <rect width="1800" height="600" fill="#0a0b0d" />
  <rect width="1800" height="600" fill="url(#logoGrid)" />

  <!-- Left: The 3D Infinity Loop Symbol -->
  <g transform="translate(100, 30) scale(0.9)">
    <!-- Back strand -->
    <path
      d="M 330 270 
         C 385 205, 455 130, 510 145 
         C 570 165, 560 235, 465 280 
         C 370 320, 300 290, 190 225 
         C 105 175, 85 280, 120 395 
         C 155 510, 270 515, 325 405 
         C 350 350, 340 300, 330 270 Z"
      fill="none"
      stroke="#6d737d"
      stroke-width="48"
      stroke-linecap="round"
      stroke-linejoin="round"
    />

    <!-- Main Silver Band -->
    <path
      d="M 330 270 
         C 385 205, 455 130, 510 145 
         C 570 165, 560 235, 465 280 
         C 370 320, 300 290, 190 225 
         C 105 175, 85 280, 120 395 
         C 155 510, 270 515, 325 405 
         C 350 350, 340 300, 330 270 Z"
      fill="none"
      stroke="url(#lSilverGrad)"
      stroke-width="44"
      stroke-linecap="round"
      stroke-linejoin="round"
    />

    <!-- Front Overlapping Strand -->
    <path
      d="M 270 250
         C 345 290, 435 275, 490 245
         C 540 215, 545 165, 505 150
         C 465 135, 400 200, 330 270
         C 310 295, 310 350, 325 405"
      fill="none"
      stroke="url(#lSilverGrad)"
      stroke-width="44"
      stroke-linecap="round"
      filter="url(#lRibbonShadow)"
    />

    <!-- Specular Highlight Top Right -->
    <path
      d="M 410 175 C 455 135, 510 145, 535 170 C 555 200, 540 235, 480 268"
      fill="none"
      stroke="#ffffff"
      stroke-width="7"
      stroke-linecap="round"
      stroke-opacity="0.9"
    />

    <!-- Specular Highlight Bottom Left -->
    <path
      d="M 100 245 C 80 310, 105 425, 155 465 C 210 505, 290 495, 325 410"
      fill="none"
      stroke="#ffffff"
      stroke-width="7"
      stroke-linecap="round"
      stroke-opacity="0.9"
    />
  </g>

  <!-- Right: Exact Typography "A B H I A I" as seen in user's image -->
  <g transform="translate(680, 240)" fill="#FFFFFF">
    
    <!-- Letter 'A' (1) -->
    <g transform="translate(0, 0)">
      <path
        fill-rule="evenodd"
        d="M 0,35 C 0,14 16,0 36,0 L 70,0 C 90,0 106,14 106,35 L 106,105 C 106,113 100,118 92,118 C 84,118 78,113 78,105 L 78,74 L 28,74 L 28,105 C 28,113 22,118 14,118 C 6,118 0,113 0,105 Z M 28,48 L 78,48 L 78,35 C 78,28 74,24 68,24 L 38,24 C 32,24 28,28 28,35 Z"
      />
    </g>

    <!-- Letter 'B' -->
    <g transform="translate(195, 0)">
      <path
        fill-rule="evenodd"
        d="M 0,12 C 0,5 6,0 14,0 L 72,0 C 94,0 110,14 110,32 C 110,44 103,53 92,57 C 105,62 112,72 112,86 C 112,104 95,118 74,118 L 14,118 C 6,118 0,113 0,106 Z M 28,24 L 28,47 L 68,47 C 76,47 82,42 82,35 C 82,29 76,24 68,24 Z M 28,71 L 28,94 L 70,94 C 78,94 84,89 84,82 C 84,76 78,71 70,71 Z"
      />
    </g>

    <!-- Letter 'H' -->
    <g transform="translate(395, 0)">
      <path
        d="M 14,0 C 22,0 28,6 28,14 L 28,47 L 78,47 L 78,14 C 78,6 84,0 92,0 C 100,0 106,6 106,14 L 106,104 C 106,112 100,118 92,118 C 84,118 78,112 78,104 L 78,71 L 28,71 L 28,104 C 28,112 22,118 14,118 C 6,118 0,112 0,104 L 0,14 C 0,6 6,0 14,0 Z"
      />
    </g>

    <!-- Letter 'I' (1) -->
    <g transform="translate(595, 0)">
      <rect x="0" y="0" width="28" height="118" rx="14" />
    </g>

    <!-- Letter 'A' (2) -->
    <g transform="translate(710, 0)">
      <path
        fill-rule="evenodd"
        d="M 0,35 C 0,14 16,0 36,0 L 70,0 C 90,0 106,14 106,35 L 106,105 C 106,113 100,118 92,118 C 84,118 78,113 78,105 L 78,74 L 28,74 L 28,105 C 28,113 22,118 14,118 C 6,118 0,113 0,105 Z M 28,48 L 78,48 L 78,35 C 78,28 74,24 68,24 L 38,24 C 32,24 28,28 28,35 Z"
      />
    </g>

    <!-- Letter 'I' (2) -->
    <g transform="translate(905, 0)">
      <rect x="0" y="0" width="28" height="118" rx="14" />
    </g>
  </g>
</svg>
`;

async function main() {
  const outDir = path.join(process.cwd(), 'public', 'branding');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const iconPath = path.join(outDir, 'abhiai-icon.png');
  const logoPath = path.join(outDir, 'abhiai-logo.png');

  await sharp(Buffer.from(iconSvg))
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(iconPath);
  console.log('Regenerated icon at:', iconPath);

  await sharp(Buffer.from(logoSvg))
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(logoPath);
  console.log('Regenerated logo banner at:', logoPath);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
