import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GameEngine } from './main';

export class Player {
    public mesh: THREE.Mesh;
    public body: CANNON.Body;

    private engine: GameEngine;
    private speed: number = 15; // increased speed
    private jumpForce: number = 12; // increased jump force
    private canJump: boolean = false;
    private startPos = new CANNON.Vec3(0, 2, 0);
    public isDead: boolean = false;

    private keys = {
        w: false,
        a: false,
        s: false,
        d: false,
        space: false
    };

    constructor(engine: GameEngine, x: number, y: number, z: number) {
        this.engine = engine;
        this.startPos.set(x, y, z);

        const size = 1;
        const mass = 5;

        this.body = new CANNON.Body({
            mass: mass,
            position: this.startPos.clone(),
            shape: new CANNON.Box(new CANNON.Vec3(size/2, size/2, size/2)),
            fixedRotation: true
        });
        this.body.linearDamping = 0.9;
        this.engine.world.addBody(this.body);

        const geo = new THREE.BoxGeometry(size, size, size);
        const mat = new THREE.MeshStandardMaterial({ color: 0xff8800 });
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.castShadow = true;
        this.engine.scene.add(this.mesh);

        this.engine.physicsBodies.push({ mesh: this.mesh, body: this.body });

        this.setupInputs();
        this.setupCollision();
    }

    public respawn() {
        this.body.position.copy(this.startPos);
        this.body.velocity.set(0, 0, 0);
        this.isDead = false;
    }

    private setupInputs() {
        window.addEventListener('keydown', (e) => {
            if (this.isDead) return;
            switch(e.key.toLowerCase()) {
                case 'w': this.keys.w = true; break;
                case 'a': this.keys.a = true; break;
                case 's': this.keys.s = true; break;
                case 'd': this.keys.d = true; break;
                case ' ':
                    if (this.canJump) {
                        this.body.velocity.y = this.jumpForce;
                        this.canJump = false;
                    }
                    break;
            }
        });

        window.addEventListener('keyup', (e) => {
            switch(e.key.toLowerCase()) {
                case 'w': this.keys.w = false; break;
                case 'a': this.keys.a = false; break;
                case 's': this.keys.s = false; break;
                case 'd': this.keys.d = false; break;
            }
        });
    }

    private setupCollision() {
        this.engine.world.addEventListener('postStep', () => {
            const contactNormal = new CANNON.Vec3();
            let upAxis = new CANNON.Vec3(0, 1, 0);
            let grounded = false;

            for(let i=0; i<this.engine.world.contacts.length; i++){
                let contact = this.engine.world.contacts[i];
                if(contact.bi.id === this.body.id || contact.bj.id === this.body.id){
                    // Check if touching finish zone
                    const otherBody = contact.bi.id === this.body.id ? contact.bj : contact.bi;
                    if (this.engine.levelMap && this.engine.levelMap.finishZone && otherBody.id === this.engine.levelMap.finishZone.body.id) {
                        this.engine.winGame();
                        continue;
                    }

                    if(contact.bi.id === this.body.id){
                        contact.ni.negate(contactNormal);
                    }else{
                        contactNormal.copy(contact.ni);
                    }
                    if(contactNormal.dot(upAxis) > 0.5){
                        grounded = true;
                    }
                }
            }
            this.canJump = grounded;
        });
    }

    public update(_dt: number, camera: THREE.PerspectiveCamera) {
        if (this.isDead) return;

        // Death by falling
        if (this.body.position.y < -15) {
            this.isDead = true;
            setTimeout(() => this.respawn(), 1000);
        }

        const cameraDir = new THREE.Vector3();
        camera.getWorldDirection(cameraDir);
        cameraDir.y = 0;
        cameraDir.normalize();

        const cameraRight = new THREE.Vector3();
        cameraRight.crossVectors(cameraDir, new THREE.Vector3(0, 1, 0)).normalize();

        const moveDir = new THREE.Vector3(0, 0, 0);

        if (this.keys.w) moveDir.add(cameraDir);
        if (this.keys.s) moveDir.sub(cameraDir);
        if (this.keys.a) moveDir.sub(cameraRight);
        if (this.keys.d) moveDir.add(cameraRight);

        if (moveDir.length() > 0) {
            moveDir.normalize();
            this.body.applyForce(new CANNON.Vec3(moveDir.x * this.speed * 50, 0, moveDir.z * this.speed * 50), this.body.position);

            const targetRotation = Math.atan2(moveDir.x, moveDir.z);
            this.mesh.rotation.y = targetRotation;
        }

        // 3rd Person Camera Follow
        const cameraOffset = new THREE.Vector3(0, 5, 10);
        const playerPos = new THREE.Vector3(this.body.position.x, this.body.position.y, this.body.position.z);

        camera.position.lerp(playerPos.clone().add(cameraOffset), 0.1);
        camera.lookAt(playerPos);
    }
}
