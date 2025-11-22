import cubeSolver from 'cube-solver';

export class Solver {
    constructor() {
        // Initialize if needed
    }

    solve(stateString) {
        // stateString format: UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB
        // This is standard definition order: U, R, F, D, L, B
        return cubeSolver.solve(stateString);
    }

    reverse(moveHistory) {
        // Invert moves
        return moveHistory.map(move => {
            if (move.includes("'")) return move.replace("'", "");
            return move + "'";
        }).reverse();
    }
}
