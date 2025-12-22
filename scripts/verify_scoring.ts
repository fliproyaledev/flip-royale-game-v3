
const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

function nerfFactor(dup: number) {
    if (dup <= 1) return 1;
    if (dup === 2) return 0.75;
    if (dup === 3) return 0.5;
    if (dup === 4) return 0.25;
    return 0;
}

function calcPoints(pct: number, dir: 'UP' | 'DOWN', dup: number) {
    const signed = dir === 'UP' ? pct : -pct;
    let pts = signed * 100;

    const nerf = nerfFactor(dup);
    const loss = 2 - nerf; // If negative, multiply by (2-nerf) = higher penalty often? 
    // Wait, original logic: 
    // const loss = 2 - nerf;
    // pts = pts >= 0 ? pts * nerf : pts * loss;

    if (pts >= 0) {
        pts = pts * nerf;
    } else {
        pts = pts * loss;
    }

    return Math.round(clamp(pts, -2500, 2500));
}

// Test Cases
const cases = [
    { pct: 5.0, dir: 'UP', dup: 1, expected: 500 },
    { pct: 5.0, dir: 'DOWN', dup: 1, expected: -500 }, // 100 * -5 * (2-1) = -500
    { pct: -10.0, dir: 'UP', dup: 1, expected: -1000 },
    { pct: 10.0, dir: 'UP', dup: 2, expected: 750 }, // 1000 * 0.75 = 750
    { pct: 10.0, dir: 'UP', dup: 3, expected: 500 }, // 1000 * 0.5 = 500
];

console.log("Running Verification for New Scoring Logic...");
cases.forEach((c, i) => {
    const res = calcPoints(c.pct, c.dir as any, c.dup);
    const pass = res === c.expected;
    console.log(`Test ${i + 1}: ${c.pct}% ${c.dir} (x${c.dup}) => Got ${res}, Expected ${c.expected} [${pass ? 'PASS' : 'FAIL'}]`);
});
