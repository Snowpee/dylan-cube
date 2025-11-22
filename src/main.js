import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Cube } from './cube.js';
import { Solver } from './solver.js';

console.log('SCRIPT LOADED v2');

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
// Controls Setup
controls.enabled = false; // Default to disabled, require Alt key
controls.enableDamping = true;

// Key Listeners for View Control
window.addEventListener('keydown', (event) => {
    if (event.key === 'Alt') {
        controls.enabled = true;
        document.body.style.cursor = 'grab';
    }
});

window.addEventListener('keyup', (event) => {
    if (event.key === 'Alt') {
        controls.enabled = false;
        document.body.style.cursor = 'default';
    }
});

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLightFront = new THREE.DirectionalLight(0xffffff, 0.5);
dirLightFront.position.set(0, 10, 10);
scene.add(dirLightFront);

const dirLightBack = new THREE.DirectionalLight(0xffffff, 0.5);
dirLightBack.position.set(0, 10, -10);
scene.add(dirLightBack);

const dirLightLeft = new THREE.DirectionalLight(0xffffff, 0.5);
dirLightLeft.position.set(-10, 10, 0);
scene.add(dirLightLeft);

const dirLightRight = new THREE.DirectionalLight(0xffffff, 0.5);
dirLightRight.position.set(10, 10, 0);
scene.add(dirLightRight);

// Cube & Solver
const cube = new Cube(scene);
const solver = new Solver();

// UI Elements
const statusDiv = document.getElementById('status');
const axisSelect = document.getElementById('manual-axis');
const layerSelect = document.getElementById('manual-layer');

// Gesture State
let isDragging = false;
let startPoint = new THREE.Vector2();
let startFace = null; // { cubie, normal }
const minDragDistance = 0.05; // NDC distance

// Raycasting
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

renderer.domElement.addEventListener('pointerdown', (event) => {
    // If controls are enabled (Alt pressed), let OrbitControls handle it
    if (controls.enabled) return;

    // Calculate mouse position
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    // Check for cubie intersections
    const intersects = raycaster.intersectObjects(cube.cubies);
    if (intersects.length > 0) {
        const intersect = intersects[0];
        const cubie = intersect.object;
        const normal = intersect.face.normal.clone().applyQuaternion(cubie.quaternion).round();

        isDragging = true;
        startPoint.set(mouse.x, mouse.y);
        startFace = { cubie, normal };
    }
}, { capture: true });

window.addEventListener('pointermove', (event) => {
    if (!isDragging || !startFace) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    const currentPoint = new THREE.Vector2(mouse.x, mouse.y);
    const delta = new THREE.Vector2().subVectors(currentPoint, startPoint);

    // console.log('PointerMove: Delta', delta.length());

    if (delta.length() > minDragDistance) {
        // Determine drag direction
        const { cubie, normal } = startFace;

        // Potential movement axes (perpendicular to normal)
        const axes = [];
        if (Math.abs(normal.x) < 0.1) axes.push(new THREE.Vector3(1, 0, 0));
        if (Math.abs(normal.y) < 0.1) axes.push(new THREE.Vector3(0, 1, 0));
        if (Math.abs(normal.z) < 0.1) axes.push(new THREE.Vector3(0, 0, 1));

        // Project axes to screen space to find best match
        let bestAxis = null;
        let maxDot = -1;
        let direction = 0; // 1 or -1

        axes.forEach(axis => {
            const startPos = cubie.position.clone();
            const endPos = cubie.position.clone().add(axis);

            // Project to screen
            const p1 = startPos.project(camera);
            const p2 = endPos.project(camera);

            const screenDir = new THREE.Vector2(p2.x - p1.x, p2.y - p1.y).normalize();
            const dot = delta.clone().normalize().dot(screenDir);

            if (Math.abs(dot) > maxDot) {
                maxDot = Math.abs(dot);
                bestAxis = axis;
                direction = dot > 0 ? 1 : -1;
            }
        });

        console.log('Drag Analysis:', { maxDot, bestAxis, direction });

        if (bestAxis && maxDot > 0.5) { // Add threshold for dot product
            // Determine Rotation Axis and Layer
            // Rotation axis is the cross product of Normal and Movement Axis
            // But we need to be careful with coordinate systems.
            // Let's deduce:
            // If Normal is Y, and Move is X. Rotation Axis is Z.
            // Cross(Y, X) = -Z.

            const rotAxisVec = new THREE.Vector3().crossVectors(normal, bestAxis);
            let rotAxis = '';
            if (Math.abs(rotAxisVec.x) > 0.9) rotAxis = 'x';
            else if (Math.abs(rotAxisVec.y) > 0.9) rotAxis = 'y';
            else if (Math.abs(rotAxisVec.z) > 0.9) rotAxis = 'z';

            if (rotAxis) {
                const index = Math.round(cubie.position[rotAxis]);

                // Determine Clockwise/Counter-Clockwise
                // This is the tricky part.
                // We need to map the screen direction 'direction' back to 3D rotation direction.
                // A simple heuristic:
                // Calculate the screen vector for a POSITIVE rotation on this axis/layer.
                // Compare with user drag.

                // Let's try a standard cross product approach.
                // Drag Vector (in 3D approx) is bestAxis * direction.
                // Torque = Cross(Radius, Force). Radius is Normal (approx), Force is Drag.
                // Torque direction is the rotation axis.

                // Let's rely on the visual check or a robust math check.
                // Project (Normal + bestAxis * direction) -> Screen. Matches delta.

                // We know 'bestAxis' points in the direction of +1 on that axis.
                // If direction is 1, we moved towards +Axis.
                // If direction is -1, we moved towards -Axis.

                // Move Vector M = bestAxis * direction.
                // Rotation Axis R = rotAxisVec (which is Normal x bestAxis).
                // If we move along M, are we rotating around R in positive or negative direction?
                // R = N x A.
                // If we move along A, we are rotating around R.
                // Direction?
                // Right hand rule: Thumb along R. Fingers curl from N to A? No.
                // Fingers curl around R.
                // If we look down R, N rotates towards A?
                // Yes, N x A = R. So N is 90 deg "behind" A in rotation around R.
                // So moving N towards A corresponds to a rotation around R?
                // Actually, we are sliding the face.
                // If we slide Top (Y) to Right (X). We are rotating around Z.
                // The face moves +X.
                // A rotation around -Z (Clockwise looking from front?) moves Y towards X?
                // Rotation around Z: X->Y.
                // Rotation around -Z: Y->X.
                // So moving Y towards X is a -Z rotation.
                // Our R = Y x X = -Z.
                // So R points in -Z.
                // A positive rotation around R (which is -Z) would move...
                // Wait, let's simplify.

                // We have `rotAxis` (string) and `index`.
                // We need `clockwise` (bool).
                // Let's try to determine it based on the sign of the cross product projection?

                // Let's use the `direction` and the relationship between axes.
                // rotAxisVec is the vector form of the rotation axis.
                // If we rotate around rotAxisVec by +90deg, does the face move in `bestAxis` direction?
                // Vector N rotated by +90 around (N x A) = A.
                // Yes.
                // So a POSITIVE rotation around `rotAxisVec` moves the face in `bestAxis` direction.
                // We moved in `bestAxis * direction`.
                // So we want a rotation of `direction` around `rotAxisVec`.

                // `cube.rotateLayer(axis, index, clockwise)`
                // `clockwise` usually means negative angle around the axis (Right Hand Rule: Thumb=Axis, Fingers=CCW. Clockwise is opposite).
                // Wait, in 3D, "Clockwise" is relative to looking AT the axis from positive infinity?
                // Usually standard 3D rotation: Positive angle is CCW around the axis.
                // My `rotateLayer` implementation:
                // if (clockwise) angle = -Math.PI / 2;
                // So `clockwise=true` -> Negative Angle.

                // We determined we want rotation of `direction` (sign) around `rotAxisVec`.
                // `rotAxisVec` might be +Axis or -Axis.
                // Let's normalize `rotAxisVec` to get the sign of the axis.
                // e.g. if rotAxisVec is (0, 0, -1), it's -Z.
                // We want rotation `direction` around -Z.
                // This is equivalent to rotation `-direction` around +Z.

                // Let `axisSign` be the sign of the non-zero component of `rotAxisVec`.
                // We want rotation of `direction * axisSign` around +Axis.
                // Positive rotation (CCW) corresponds to `angle > 0`.
                // We want `angle` to have sign `direction * axisSign`.
                // `rotateLayer` takes `clockwise`.
                // `clockwise=true` -> `angle < 0`.
                // `clockwise=false` -> `angle > 0`.

                // So:
                // If `direction * axisSign > 0` (Positive Angle, CCW), we want `clockwise = false`.
                // If `direction * axisSign < 0` (Negative Angle, CW), we want `clockwise = true`.

                const axisSign = rotAxisVec.x + rotAxisVec.y + rotAxisVec.z; // Only one is non-zero
                const targetSign = direction * axisSign;
                const clockwise = targetSign < 0;

                console.log('Rotating:', { rotAxis, index, clockwise });
                cube.rotateLayer(rotAxis, index, clockwise);
            }
        }

        // Reset
        isDragging = false;
        startFace = null;
    }
});

window.addEventListener('pointerup', () => {
    isDragging = false;
    startFace = null;
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
