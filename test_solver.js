const cubeSolver = require('cube-solver');

// Solved state string
const solvedState = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

// Scrambled state string (R rotation)
// U -> U (mostly), R -> R (rotated), F -> U (partially)... this is hard to construct manually.
// Let's just try the solved state. It should return empty string or error.
try {
    console.log("Testing Solved State:");
    const result = cubeSolver.solve(solvedState);
    console.log("Result:", result);
} catch (e) {
    console.log("Error with State String:", e.message);
}

// Try a rotation string
try {
    console.log("Testing Rotation String 'x':");
    const result = cubeSolver.solve('x');
    console.log("Result:", result);
} catch (e) {
    console.log("Error with Rotation String:", e.message);
}

// Try a middle layer move representation
try {
    console.log("Testing Middle Layer 'L\\' R x\\'':");
    const result = cubeSolver.solve("L' R x'");
    console.log("Result:", result);
} catch (e) {
    console.log("Error with Middle Layer:", e.message);
}
