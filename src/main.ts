import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Player } from './player';
import { LevelMap } from './map';

export class GameEngine {
    public scene: THREE.Scene;
    public camera: THREE.PerspectiveCamera;
    public renderer: THREE.WebGLRenderer;
    public world: CANNON.World;
    public physicsBodies: { mesh: THREE.Mesh; body: CANNON.Body }[] = [];
    public lastTime: number = 0;

    public player: Player;
    public levelMap: LevelMap;

    private gameStartTime: number = 0;
    private gameWon: boolean = false;
    private timerElement: HTMLElement;
    private winScreenElement: HTMLElement;

    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(100, 100, 50);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        this.scene.add(dirLight);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 5, 10);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.body.appendChild(this.renderer.domElement);

        this.world = new CANNON.World({
            gravity: new CANNON.Vec3(0, -20, 0),
        });

        const defaultMaterial = new CANNON.Material("default");
        const defaultContactMaterial = new CANNON.ContactMaterial(
            defaultMaterial,
            defaultMaterial,
            { friction: 0.8, restitution: 0.0 }
        );
        this.world.addContactMaterial(defaultContactMaterial);

        window.addEventListener('resize', this.onWindowResize.bind(this), false);

        this.setupGround();

        this.levelMap = new LevelMap(this);
        this.player = new Player(this, 0, 2, 0);

        this.timerElement = document.getElementById('timer')!;
        this.winScreenElement = document.getElementById('win-screen')!;
        this.gameStartTime = performance.now();

        requestAnimationFrame(this.animate.bind(this));
    }

    private setupGround() {
        const groundShape = new CANNON.Box(new CANNON.Vec3(25, 1, 25));
        const groundBody = new CANNON.Body({ mass: 0 });
        groundBody.addShape(groundShape);
        groundBody.position.set(0, -1, 0);
        this.world.addBody(groundBody);

        const groundGeo = new THREE.BoxGeometry(50, 2, 50);
        const groundMat = new THREE.MeshStandardMaterial({ color: 0x44aa44 });
        const groundMesh = new THREE.Mesh(groundGeo, groundMat);
        groundMesh.receiveShadow = true;
        groundMesh.position.copy(groundBody.position as any);
        this.scene.add(groundMesh);
    }

    private onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    public addVoxel(width: number, height: number, depth: number, x: number, y: number, z: number, color: number, mass: number = 0) {
        const shape = new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2));
        const body = new CANNON.Body({ mass });
        body.addShape(shape);
        body.position.set(x, y, z);
        this.world.addBody(body);

        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshStandardMaterial({ color });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.position.set(x, y, z);
        this.scene.add(mesh);

        this.physicsBodies.push({ mesh, body });

        return { mesh, body };
    }

    public winGame() {
        if (!this.gameWon) {
            this.gameWon = true;
            const timeTaken = ((performance.now() - this.gameStartTime) / 1000).toFixed(2);
            this.winScreenElement.style.display = 'flex';
            this.winScreenElement.innerHTML = `<h1>Course Completed!</h1><p>Time: ${timeTaken} seconds</p><button onclick="location.reload()">Play Again</button>`;
        }
    }

    public animate(time: number) {
        requestAnimationFrame(this.animate.bind(this));

        const dt = (time - this.lastTime) / 1000;
        this.lastTime = time;

        if (dt > 0 && dt < 0.1) {
            this.world.step(1/60, dt, 3);
        }

        if (this.levelMap) {
            this.levelMap.update(time);
        }

        if (this.player && dt < 0.1) {
            this.player.update(dt, this.camera);
        }

        for (const { mesh, body } of this.physicsBodies) {
            if (body !== this.player?.body && body.type !== CANNON.Body.KINEMATIC) {
                mesh.position.copy(body.position as any);
                mesh.quaternion.copy(body.quaternion as any);
            } else if (body === this.player?.body) {
                mesh.position.copy(body.position as any);
            }
        }

        if (!this.gameWon) {
            const currentTime = ((performance.now() - this.gameStartTime) / 1000).toFixed(1);
            this.timerElement.innerText = `Time: ${currentTime}s`;
        }

        this.renderer.render(this.scene, this.camera);
    }
}

const style = document.createElement('style');
style.textContent = `
    body { margin: 0; overflow: hidden; font-family: sans-serif; }
    #ui { position: absolute; top: 10px; left: 10px; color: white; text-shadow: 1px 1px 2px black; font-size: 24px; pointer-events: none; z-index: 10; }
    #timer { position: absolute; top: 10px; right: 10px; color: white; text-shadow: 1px 1px 2px black; font-size: 24px; font-weight: bold; z-index: 10; }
    #win-screen { display: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); color: gold; flex-direction: column; justify-content: center; align-items: center; z-index: 20; font-family: sans-serif; }
    #win-screen h1 { font-size: 64px; margin: 0; text-shadow: 2px 2px 4px #000; }
    #win-screen p { font-size: 32px; color: white; }
    #win-screen button { margin-top: 20px; padding: 15px 30px; font-size: 24px; cursor: pointer; background: #44aa44; border: none; color: white; border-radius: 5px; }
    #win-screen button:hover { background: #55bb55; }
`;
document.head.appendChild(style);

const ui = document.createElement('div');
ui.id = 'ui';
ui.innerHTML = 'Use WASD to move, SPACE to jump.';
document.body.appendChild(ui);

const timer = document.createElement('div');
timer.id = 'timer';
timer.innerText = 'Time: 0.0s';
document.body.appendChild(timer);

const winScreen = document.createElement('div');
winScreen.id = 'win-screen';
document.body.appendChild(winScreen);

new GameEngine();
