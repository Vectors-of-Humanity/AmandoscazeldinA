import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GameEngine } from './main';

export class LevelMap {
    private engine: GameEngine;
    public finishZone!: { mesh: THREE.Mesh; body: CANNON.Body };
    public movingPlatforms: { mesh: THREE.Mesh; body: CANNON.Body; startPos: CANNON.Vec3; endPos: CANNON.Vec3; speed: number; timeOffset: number }[] = [];

    constructor(engine: GameEngine) {
        this.engine = engine;
        this.buildNatureCourse();
    }

    private buildNatureCourse() {
        const colors = {
            grass: 0x44aa44,
            dirt: 0x8B4513,
            stone: 0x888888,
            wood: 0x654321,
            finish: 0xFFD700 // Gold
        };

        // Course Layout
        // The start area is already built in main.ts (setupGround)

        // 1. Stepping stones (static)
        this.engine.addVoxel(4, 1, 4, 0, 0, -15, colors.stone);
        this.engine.addVoxel(3, 1, 3, 5, 1, -22, colors.stone);
        this.engine.addVoxel(2, 1, 2, 10, 2, -28, colors.stone);

        // 2. High Wall to jump around
        this.engine.addVoxel(10, 5, 2, 15, 2.5, -35, colors.dirt);
        this.engine.addVoxel(2, 1, 2, 10, 3, -37, colors.wood); // side step

        // 3. Moving Platforms Area
        // We'll update these in the main animation loop
        this.addMovingPlatform(4, 1, 4, 15, 3, -45, 25, 3, -45, 2, 0, colors.wood);
        this.addMovingPlatform(4, 1, 4, 28, 4, -50, 28, 4, -60, 3, 0, colors.wood);

        // 4. Narrow bridge
        this.engine.addVoxel(2, 1, 15, 28, 4, -70, colors.stone);

        // 5. Final jumps
        this.engine.addVoxel(2, 1, 2, 28, 5, -80, colors.dirt);
        this.engine.addVoxel(2, 1, 2, 28, 6, -85, colors.dirt);
        this.engine.addVoxel(2, 1, 2, 28, 7, -90, colors.dirt);

        // 6. Finish Zone
        this.finishZone = this.engine.addVoxel(10, 1, 10, 28, 7, -100, colors.finish);

        // Make finish zone a trigger (ghost object)
        this.finishZone.body.collisionResponse = false;
    }

    private addMovingPlatform(w: number, h: number, d: number, sx: number, sy: number, sz: number, ex: number, ey: number, ez: number, speed: number, offset: number, color: number) {
        // We set mass to 0 so it's a static/kinematic body
        const platform = this.engine.addVoxel(w, h, d, sx, sy, sz, color, 0);

        // Make it kinematic so we can move it and it pushes the player
        platform.body.type = CANNON.Body.KINEMATIC;

        this.movingPlatforms.push({
            mesh: platform.mesh,
            body: platform.body,
            startPos: new CANNON.Vec3(sx, sy, sz),
            endPos: new CANNON.Vec3(ex, ey, ez),
            speed: speed,
            timeOffset: offset
        });
    }

    public update(time: number) {
        // Animate moving platforms
        const t = time / 1000;
        for (const plat of this.movingPlatforms) {
            // Simple ping-pong movement using Sine wave
            const factor = (Math.sin(t * plat.speed + plat.timeOffset) + 1) / 2; // 0 to 1

            plat.body.position.x = plat.startPos.x + (plat.endPos.x - plat.startPos.x) * factor;
            plat.body.position.y = plat.startPos.y + (plat.endPos.y - plat.startPos.y) * factor;
            plat.body.position.z = plat.startPos.z + (plat.endPos.z - plat.startPos.z) * factor;

            // Sync mesh manually because static/kinematic bodies might be skipped in main loop if we optimized them out
            plat.mesh.position.copy(plat.body.position as any);
        }
    }
}
