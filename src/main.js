import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Cube } from './cube.js';
import { Solver } from './solver.js';

// Scene Setup
const scene = new THREE.Scene();

// Create a radial gradient background texture
const canvas = document.createElement('canvas');
canvas.width = 512;
canvas.height = 512;
const context = canvas.getContext('2d');
const gradient = context.createRadialGradient(256, 256, 0, 256, 256, 512);
gradient.addColorStop(0, '#333333');
gradient.addColorStop(1, '#111111');
context.fillStyle = gradient;
context.fillRect(0, 0, 512, 512);
const backgroundTexture = new THREE.CanvasTexture(canvas);
scene.background = backgroundTexture;

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(5, 5, 7);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; // Better color handling
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('canvas-container').appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Lights
const ambientLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6); // Sky/Ground color
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(5, 10, 7);
scene.add(directionalLight);

const backLight = new THREE.DirectionalLight(0xffffff, 0.5);
backLight.position.set(-5, -5, -7);
scene.add(backLight);

// Cube & Solver
const cube = new Cube(scene);
const solver = new Solver();

// UI Elements
const statusDiv = document.getElementById('status');
const axisSelect = document.getElementById('manual-axis');
const layerSelect = document.getElementById('manual-layer');

// Selection State
let selectionState = {
    step: 0, // 0: Idle, 1: First Face Selected
    startFace: null // { cubie, normal, point }
};

// Raycasting
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener('pointerdown', (event) => {
    // Calculate mouse position
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    // Check for cubie intersections
    const intersects = raycaster.intersectObjects(cube.cubies);
    if (intersects.length > 0) {
        const intersect = intersects[0];
        const cubie = intersect.object;
        const point = intersect.point;
        const normal = intersect.face.normal.clone().applyQuaternion(cubie.quaternion).round(); // World normal

        if (selectionState.step === 0) {
            // Step 1: Select First Face
            selectionState.step = 1;
            selectionState.startFace = { cubie, normal, point };

            // Highlight clicked cubie (Cyan, dashed)
            cube.highlightEdges([cubie], 0x00ffff, true);

        } else if (selectionState.step === 1) {
            // Step 2: Select Second Face
            const start = selectionState.startFace;

            // Determine Layer
            let axis = null;
            let index = null;

            // Case 1: Same Cubie, Different Face
            if (cubie === start.cubie) {
                // If same face, cancel
                if (normal.equals(start.normal)) {
                    selectionState.step = 0;
                    cube.clearHighlights();
                    return;
                }

                // Axis is the cross product of the two normals
                const cross = new THREE.Vector3().crossVectors(start.normal, normal);
                if (Math.abs(cross.x) > 0.9) axis = 'x';
                else if (Math.abs(cross.y) > 0.9) axis = 'y';
                else if (Math.abs(cross.z) > 0.9) axis = 'z';

                if (axis) {
                    index = Math.round(cubie.position[axis]);
                }
            }
            // Case 2: Different Cubie
            else {
                // Check if they are neighbors
                const dist = cubie.position.distanceTo(start.cubie.position);
                if (dist < 1.1) { // Adjacent
                    const dir = new THREE.Vector3().subVectors(cubie.position, start.cubie.position).normalize().round();

                    const cross = new THREE.Vector3().crossVectors(start.normal, dir);
                    if (Math.abs(cross.x) > 0.9) axis = 'x';
                    else if (Math.abs(cross.y) > 0.9) axis = 'y';
                    else if (Math.abs(cross.z) > 0.9) axis = 'z';

                    if (axis) {
                        index = Math.round(start.cubie.position[axis]);
                    }
                }
            }

            if (axis) {
                // Valid Layer Selected
                selectionState.step = 0;

                // Update UI
                axisSelect.value = axis;
                layerSelect.value = index.toString();

                // Highlight Layer (Solid Gold)
                const layerCubies = cube.getLayer(axis, index);
                cube.highlightEdges(layerCubies, 0xffd700, false);
            } else {
                // Invalid selection, reset
                selectionState.step = 0;
                cube.clearHighlights();
            }
        }
    } else {
        // Clicked background -> Reset
        selectionState.step = 0;
        cube.clearHighlights();
    }
});

// Manual Controls
function updateHighlight() {
    const axis = axisSelect.value;
    const index = parseInt(layerSelect.value);
    const layerCubies = cube.getLayer(axis, index);
    cube.highlightEdges(layerCubies, 0xffd700, false); // Gold
}

axisSelect.addEventListener('change', updateHighlight);
layerSelect.addEventListener('change', updateHighlight);

document.getElementById('btn-rotate-cw').addEventListener('click', () => {
    const axis = axisSelect.value;
    const index = parseInt(layerSelect.value);
    cube.rotateLayer(axis, index, true);
});

document.getElementById('btn-rotate-ccw').addEventListener('click', () => {
    const axis = axisSelect.value;
    const index = parseInt(layerSelect.value);
    cube.rotateLayer(axis, index, false);
});

// Reset View
document.getElementById('btn-reset-view').addEventListener('click', () => {
    camera.position.set(5, 5, 7);
    camera.lookAt(0, 0, 0);
    controls.reset();
});

// Scramble
document.getElementById('btn-scramble').addEventListener('click', async () => {
    statusDiv.innerText = '打乱中...';
    await cube.scramble();
    statusDiv.innerText = '已打乱';
    cube.clearHighlights();
});

// Reverse Solve
document.getElementById('btn-solve-reverse').addEventListener('click', async () => {
    if (cube.moveHistory.length === 0) {
        statusDiv.innerText = '已经是初始状态';
        return;
    }
    statusDiv.innerText = '还原中...';
    while (cube.moveHistory.length > 0) {
        const move = cube.moveHistory.pop();
        await cube.rotateLayer(move.axis, move.index, !move.clockwise, 300, false);
    }
    statusDiv.innerText = '已还原 (反向)';
});

// Optimal Solve
document.getElementById('btn-solve-optimal').addEventListener('click', async () => {
    statusDiv.innerText = '计算解法中...';

    setTimeout(async () => {
        // Generate scramble string from history
        const getMoveNotation = (move) => {
            const { axis, index, clockwise } = move;

            // Outer Layers
            if (axis === 'y' && index === 1) return clockwise ? 'U' : "U'";
            if (axis === 'y' && index === -1) return clockwise ? "D'" : 'D'; // Inverted
            if (axis === 'x' && index === 1) return clockwise ? 'R' : "R'";
            if (axis === 'x' && index === -1) return clockwise ? "L'" : 'L'; // Inverted
            if (axis === 'z' && index === 1) return clockwise ? 'F' : "F'";
            if (axis === 'z' && index === -1) return clockwise ? "B'" : 'B'; // Inverted

            // Middle Layers (Decomposed into Rotation + Face Moves)
            if (index === 0) {
                if (axis === 'x') return clockwise ? "x R' L" : "x' R L'";
                if (axis === 'y') return clockwise ? "y U' D" : "y' U D'";
                if (axis === 'z') return clockwise ? "z F' B" : "z' F B'";
            }

            return null;
        };

        const scrambleString = cube.moveHistory
            .map(getMoveNotation)
            .filter(m => m)
            .join(' ');

        const debugDiv = document.getElementById('debug-log');
        if (debugDiv) debugDiv.innerHTML += `<div>Scramble: ${scrambleString}</div>`;
        console.log('Scramble:', scrambleString);

        if (!scrambleString) {
            statusDiv.innerText = '已经是初始状态 (或无法识别)';
            return;
        }

        try {
            const solution = solver.solve(scrambleString);
            if (debugDiv) debugDiv.innerHTML += `<div>Solution: ${solution}</div>`;
            console.log('Solution:', solution);

            if (!solution) {
                statusDiv.innerText = '已还原!';
                return;
            }

            const moves = solution.split(' ').filter(m => m);

            for (const moveStr of moves) {
                let face = moveStr[0];
                let clockwise = true;
                let count = 1;

                if (moveStr.includes("'")) {
                    clockwise = false;
                } else if (moveStr.includes("2")) {
                    count = 2;
                }

                for (let i = 0; i < count; i++) {
                    await cube.rotateFace(face, clockwise, 300, false);
                }
            }
            statusDiv.innerText = '已还原 (最优)';
            cube.moveHistory = []; // Reset history after solve
        } catch (e) {
            console.error(e);
            if (debugDiv) debugDiv.innerHTML += `<div>Error: ${e.message}</div>`;
            statusDiv.innerText = '求解错误';
        }
    }, 10);
});

// Reset
document.getElementById('btn-reset').addEventListener('click', () => {
    location.reload();
});

// Animation Loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();

// Resize Handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
