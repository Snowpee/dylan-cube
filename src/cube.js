import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export class Cube {
    constructor(scene) {
        this.scene = scene;
        this.cubies = [];
        this.group = new THREE.Group();
        this.scene.add(this.group);
        this.moveHistory = [];

        this.init();
        // this.initAxes(); // Removed as per new design
        // this.initArrows(); // Removed as per new design
    }

    init() {
        // Create 27 cubies
        const blackMaterial = new THREE.MeshStandardMaterial({
            color: 0x111111,
            roughness: 0.6,
            metalness: 0.1
        });

        // Face Colors (Rotated 180 around X-axis: Yellow Top, Blue Front)
        const faceColors = {
            R: new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.2, metalness: 0.0 }), // Right (Red) - Unchanged
            L: new THREE.MeshStandardMaterial({ color: 0xff8800, roughness: 0.2, metalness: 0.0 }), // Left (Orange) - Unchanged
            U: new THREE.MeshStandardMaterial({ color: 0xffff00, roughness: 0.2, metalness: 0.0 }), // Top (Yellow) - Was White
            D: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.0 }), // Bottom (White) - Was Yellow
            F: new THREE.MeshStandardMaterial({ color: 0x0000ff, roughness: 0.2, metalness: 0.0 }), // Front (Blue) - Was Green
            B: new THREE.MeshStandardMaterial({ color: 0x00ff00, roughness: 0.2, metalness: 0.0 })  // Back (Green) - Was Blue
        };

        for (let x = -1; x <= 1; x++) {
            for (let y = -1; y <= 1; y++) {
                for (let z = -1; z <= 1; z++) {
                    // Use RoundedBoxGeometry for realism
                    // args: width, height, depth, segments, radius
                    const geometry = new RoundedBoxGeometry(0.95, 0.95, 0.95, 4, 0.05);

                    // Determine materials for each face
                    // Order: Right, Left, Top, Bottom, Front, Back
                    const materials = [];

                    // Right (x=1)
                    materials.push(x === 1 ? faceColors.R : blackMaterial);
                    // Left (x=-1)
                    materials.push(x === -1 ? faceColors.L : blackMaterial);
                    // Top (y=1)
                    materials.push(y === 1 ? faceColors.U : blackMaterial);
                    // Bottom (y=-1)
                    materials.push(y === -1 ? faceColors.D : blackMaterial);
                    // Front (z=1)
                    materials.push(z === 1 ? faceColors.F : blackMaterial);
                    // Back (z=-1)
                    materials.push(z === -1 ? faceColors.B : blackMaterial);

                    const mesh = new THREE.Mesh(geometry, materials);
                    mesh.position.set(x, y, z);

                    // Store logical position for solving/manipulation
                    mesh.userData = {
                        initialPosition: new THREE.Vector3(x, y, z),
                        currentPosition: new THREE.Vector3(x, y, z)
                    };

                    this.cubies.push(mesh);
                    this.group.add(mesh);
                }
            }
        }
    }

    // Helper to get cubies in a specific layer
    getLayer(axis, index) {
        return this.cubies.filter(cubie => {
            // Use a small epsilon for float comparison
            const worldPos = new THREE.Vector3();
            cubie.getWorldPosition(worldPos);
            return Math.abs(worldPos[axis] - index) < 0.1;
        });
    }

    clearHighlights() {
        // Remove any existing highlight lines
        if (this.highlightGroup) {
            this.group.remove(this.highlightGroup);
            this.highlightGroup = null;
        }
    }

    highlightEdges(cubies, color = 0x00ffff, dashed = false) {
        this.clearHighlights();
        this.highlightGroup = new THREE.Group();

        // Material for the glowing bars
        const material = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 2.0,
            roughness: 0.1,
            metalness: 0.8
        });

        const radius = 0.03; // Thickness of the bar

        cubies.forEach(cubie => {
            // Get local edges from BoxGeometry (0.95 size)
            // BoxGeometry vertices are at +/- width/2, height/2, depth/2
            const s = 0.95 / 2;
            const vertices = [
                new THREE.Vector3(-s, -s, -s), new THREE.Vector3(s, -s, -s),
                new THREE.Vector3(s, -s, -s), new THREE.Vector3(s, s, -s),
                new THREE.Vector3(s, s, -s), new THREE.Vector3(-s, s, -s),
                new THREE.Vector3(-s, s, -s), new THREE.Vector3(-s, -s, -s),

                new THREE.Vector3(-s, -s, s), new THREE.Vector3(s, -s, s),
                new THREE.Vector3(s, -s, s), new THREE.Vector3(s, s, s),
                new THREE.Vector3(s, s, s), new THREE.Vector3(-s, s, s),
                new THREE.Vector3(-s, s, s), new THREE.Vector3(-s, -s, s),

                new THREE.Vector3(-s, -s, -s), new THREE.Vector3(-s, -s, s),
                new THREE.Vector3(s, -s, -s), new THREE.Vector3(s, -s, s),
                new THREE.Vector3(s, s, -s), new THREE.Vector3(s, s, s),
                new THREE.Vector3(-s, s, -s), new THREE.Vector3(-s, s, s)
            ];

            // Pairs of vertices defining the 12 edges
            const edgePairs = [
                [0, 1], [1, 2], [2, 3], [3, 0], // Back face
                [4, 5], [5, 6], [6, 7], [7, 4], // Front face
                [0, 4], [1, 5], [2, 6], [3, 7]  // Connecting edges
            ];

            // Actually, the vertex list above is just points. Let's define edges manually based on box corners.
            // Corners:
            // 0: - - -
            // 1: + - -
            // 2: + + -
            // 3: - + -
            // 4: - - +
            // 5: + - +
            // 6: + + +
            // 7: - + +

            const corners = [
                new THREE.Vector3(-s, -s, -s), // 0
                new THREE.Vector3(s, -s, -s), // 1
                new THREE.Vector3(s, s, -s), // 2
                new THREE.Vector3(-s, s, -s), // 3
                new THREE.Vector3(-s, -s, s), // 4
                new THREE.Vector3(s, -s, s), // 5
                new THREE.Vector3(s, s, s), // 6
                new THREE.Vector3(-s, s, s)  // 7
            ];

            const edgesIndices = [
                [0, 1], [1, 2], [2, 3], [3, 0], // Back ring
                [4, 5], [5, 6], [6, 7], [7, 4], // Front ring
                [0, 4], [1, 5], [2, 6], [3, 7]  // Connecting struts
            ];

            edgesIndices.forEach(pair => {
                const start = corners[pair[0]];
                const end = corners[pair[1]];
                const length = start.distanceTo(end);

                if (dashed) {
                    // Create dashed effect with multiple small segments
                    const segments = 5;
                    const segLen = length / segments;
                    const gap = 0.3; // 30% gap
                    const actualLen = segLen * (1 - gap);

                    const dir = new THREE.Vector3().subVectors(end, start).normalize();

                    for (let i = 0; i < segments; i++) {
                        const segCenter = new THREE.Vector3().copy(start).addScaledVector(dir, segLen * (i + 0.5));

                        const geometry = new THREE.CylinderGeometry(radius, radius, actualLen, 8);
                        const mesh = new THREE.Mesh(geometry, material);

                        // Align cylinder to edge
                        // Cylinder default is Y axis.
                        const quaternion = new THREE.Quaternion();
                        quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
                        mesh.setRotationFromQuaternion(quaternion);

                        mesh.position.copy(segCenter);

                        // Apply cubie transform
                        mesh.position.applyQuaternion(cubie.quaternion);
                        mesh.position.add(cubie.position);

                        // Rotate mesh to match cubie rotation (accumulate)
                        // Wait, we set rotation from quaternion above. We need to apply cubie's rotation ON TOP.
                        // Easier: Create a container or apply rotation to the computed world vector?
                        // No, we are building in local space of cubie then transforming?
                        // Let's build in local space and add to a group that matches cubie transform?
                        // Or just compute world positions.
                    }
                } else {
                    // Solid bar
                    const geometry = new THREE.CylinderGeometry(radius, radius, length, 8);
                    const mesh = new THREE.Mesh(geometry, material);

                    const center = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
                    const dir = new THREE.Vector3().subVectors(end, start).normalize();

                    const quaternion = new THREE.Quaternion();
                    quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
                    mesh.setRotationFromQuaternion(quaternion);

                    mesh.position.copy(center);

                    // Transform to world space (match cubie)
                    mesh.position.applyQuaternion(cubie.quaternion);
                    mesh.position.add(cubie.position);

                    const worldQuat = cubie.quaternion.clone().multiply(quaternion);
                    mesh.quaternion.copy(worldQuat);

                    this.highlightGroup.add(mesh);
                }

                if (dashed) {
                    // Re-implement dashed loop correctly with world transforms
                    const segments = 5;
                    const segLen = length / segments;
                    const gap = 0.3;
                    const actualLen = segLen * (1 - gap);
                    const dir = new THREE.Vector3().subVectors(end, start).normalize();

                    for (let i = 0; i < segments; i++) {
                        const segCenter = new THREE.Vector3().copy(start).addScaledVector(dir, segLen * (i + 0.5));

                        const geometry = new THREE.CylinderGeometry(radius, radius, actualLen, 8);
                        const mesh = new THREE.Mesh(geometry, material);

                        const quaternion = new THREE.Quaternion();
                        quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

                        // Apply cubie transform to position
                        const worldPos = segCenter.clone().applyQuaternion(cubie.quaternion).add(cubie.position);
                        mesh.position.copy(worldPos);

                        // Apply cubie transform to rotation
                        const worldQuat = cubie.quaternion.clone().multiply(quaternion);
                        mesh.quaternion.copy(worldQuat);

                        this.highlightGroup.add(mesh);
                    }
                }
            });
        });

        this.group.add(this.highlightGroup);
    }

    async rotateLayer(axis, index, clockwise = true, duration = 300, recordHistory = true) {
        if (this.isRotating) return;
        this.isRotating = true;

        let angle = Math.PI / 2;
        if (clockwise) angle = -Math.PI / 2;

        // Record move
        if (recordHistory) {
            this.moveHistory.push({ axis, index, clockwise });
        }

        // Adjust for "inverse" faces/directions if needed. 
        // Standard: Right-hand rule around axis.
        // x+: y->z
        // y+: z->x
        // z+: x->y

        // For manual controls, we just stick to axis rotation.
        // But for standard cube notation, we need to match.
        // Let's keep it simple: rotateLayer rotates around the axis.
        // clockwise means negative angle (right hand rule thumb pointing to +axis)

        const layerCubies = this.getLayer(axis, index);
        const pivot = new THREE.Object3D();
        pivot.rotation.set(0, 0, 0);
        this.group.add(pivot);

        // Attach cubies to pivot
        layerCubies.forEach(cubie => {
            this.group.remove(cubie);
            pivot.add(cubie);
        });

        // Animate
        const startRotation = pivot.rotation[axis];
        const targetRotation = startRotation + angle;
        const startTime = Date.now();

        return new Promise(resolve => {
            const animate = () => {
                const now = Date.now();
                const progress = Math.min((now - startTime) / duration, 1);
                // Ease out cubic
                const ease = 1 - Math.pow(1 - progress, 3);

                pivot.rotation[axis] = startRotation + (targetRotation - startRotation) * ease;

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    // Finish
                    pivot.rotation[axis] = targetRotation;
                    pivot.updateMatrixWorld();

                    // Detach and reattach to group with new transforms
                    const cubies = [...pivot.children];
                    cubies.forEach(cubie => {
                        cubie.getWorldPosition(cubie.position);
                        cubie.getWorldQuaternion(cubie.quaternion);
                        cubie.getWorldScale(cubie.scale);

                        // Round positions to nearest integer to prevent drift
                        cubie.position.x = Math.round(cubie.position.x);
                        cubie.position.y = Math.round(cubie.position.y);
                        cubie.position.z = Math.round(cubie.position.z);

                        pivot.remove(cubie);
                        this.group.add(cubie);
                    });

                    this.group.remove(pivot);
                    this.isRotating = false;
                    resolve();
                }
            };
            animate();
        });
    }

    async rotateFace(face, clockwise = true, duration = 300, recordHistory = true) {
        let axis, index;
        let layerClockwise = clockwise;

        if (face === 'U') { axis = 'y'; index = 1; }
        if (face === 'D') {
            axis = 'y';
            index = -1;
            layerClockwise = !clockwise;
        }
        if (face === 'R') { axis = 'x'; index = 1; }
        if (face === 'L') {
            axis = 'x';
            index = -1;
            layerClockwise = !clockwise;
        }
        if (face === 'F') { axis = 'z'; index = 1; }
        if (face === 'B') {
            axis = 'z';
            index = -1;
            layerClockwise = !clockwise;
        }

        // Delegate to rotateLayer, passing recordHistory
        await this.rotateLayer(axis, index, layerClockwise, duration, recordHistory);
    }
    getCubeState() {
        // 1. Identify Centers and Map Colors
        // Centers are at positions where two coordinates are 0 and one is +/- 1.
        // We need to find which color is at which spatial position (U, D, L, R, F, B).

        const centers = [
            { name: 'U', pos: new THREE.Vector3(0, 1, 0), normal: new THREE.Vector3(0, 1, 0) },
            { name: 'D', pos: new THREE.Vector3(0, -1, 0), normal: new THREE.Vector3(0, -1, 0) },
            { name: 'R', pos: new THREE.Vector3(1, 0, 0), normal: new THREE.Vector3(1, 0, 0) },
            { name: 'L', pos: new THREE.Vector3(-1, 0, 0), normal: new THREE.Vector3(-1, 0, 0) },
            { name: 'F', pos: new THREE.Vector3(0, 0, 1), normal: new THREE.Vector3(0, 0, 1) },
            { name: 'B', pos: new THREE.Vector3(0, 0, -1), normal: new THREE.Vector3(0, 0, -1) }
        ];

        const colorMap = {}; // Hex -> FaceName (e.g., 'ff0000' -> 'R')

        centers.forEach(center => {
            const cubie = this.cubies.find(c => c.position.distanceTo(center.pos) < 0.1);
            if (cubie) {
                // Find the face pointing in the normal direction
                const normals = [
                    new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0),
                    new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0),
                    new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)
                ];

                for (let i = 0; i < 6; i++) {
                    const worldNormal = normals[i].clone().applyQuaternion(cubie.quaternion);
                    if (worldNormal.angleTo(center.normal) < 0.1) {
                        const colorHex = cubie.material[i].color.getHexString();
                        colorMap[colorHex] = center.name;
                        break;
                    }
                }
            }
        });

        // 2. Scan all faces using the dynamic color map
        const faces = [
            { name: 'U', axis: 'y', dir: 1 },
            { name: 'R', axis: 'x', dir: 1 },
            { name: 'F', axis: 'z', dir: 1 },
            { name: 'D', axis: 'y', dir: -1 },
            { name: 'L', axis: 'x', dir: -1 },
            { name: 'B', axis: 'z', dir: -1 }
        ];

        let state = '';

        faces.forEach(face => {
            for (let row = 0; row < 3; row++) {
                for (let col = 0; col < 3; col++) {
                    let searchPos = new THREE.Vector3();

                    // Define search position based on face and row/col
                    if (face.name === 'U') { searchPos.set(col - 1, 1, row - 1); }
                    if (face.name === 'R') { searchPos.set(1, 1 - row, 1 - col); } // z goes 1, 0, -1
                    if (face.name === 'F') { searchPos.set(col - 1, 1 - row, 1); }
                    if (face.name === 'D') { searchPos.set(col - 1, -1, 1 - row); } // z goes 1, 0, -1
                    if (face.name === 'L') { searchPos.set(-1, 1 - row, col - 1); } // z goes -1, 0, 1
                    if (face.name === 'B') { searchPos.set(1 - col, 1 - row, -1); } // x goes 1, 0, -1

                    // Find cubie at this position
                    const cubie = this.cubies.find(c => c.position.distanceTo(searchPos) < 0.1);

                    if (cubie) {
                        const normals = [
                            new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0),
                            new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0),
                            new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)
                        ];

                        let foundColor = null;

                        for (let i = 0; i < 6; i++) {
                            const worldNormal = normals[i].clone().applyQuaternion(cubie.quaternion);
                            let targetDir = new THREE.Vector3();
                            if (face.axis === 'x') targetDir.set(face.dir, 0, 0);
                            if (face.axis === 'y') targetDir.set(0, face.dir, 0);
                            if (face.axis === 'z') targetDir.set(0, 0, face.dir);

                            if (worldNormal.angleTo(targetDir) < 0.1) {
                                const colorHex = cubie.material[i].color.getHexString();
                                foundColor = colorMap[colorHex]; // Use dynamic map
                                break;
                            }
                        }
                        state += foundColor || '?';
                    } else {
                        state += '?';
                    }
                }
            }
        });
        return state;
    }
    async scramble() {
        const faces = ['U', 'D', 'L', 'R', 'F', 'B'];
        for (let i = 0; i < 20; i++) {
            const face = faces[Math.floor(Math.random() * faces.length)];
            const clockwise = Math.random() > 0.5;
            await this.rotateFace(face, clockwise, 100, true);
        }
    }
}
