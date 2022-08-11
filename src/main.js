import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.118/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.118/examples/jsm/controls/OrbitControls.js';

import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.118.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.jsdelivr.net/npm/three@0.118.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://cdn.jsdelivr.net/npm/three@0.118.0/examples/jsm/postprocessing/UnrealBloomPass.js';


const VS_1 = `
varying vec3 vNormal;
varying vec2 vUv;

void main() {
    vNormal = normal;
    vUv = uv;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FS_1 = `
varying vec3 vNormal;
varying vec2 vUv;

uniform vec3 lightDir;
uniform sampler2D tDiffuse;

void main() {
    vec3 light = normalize(lightDir);

    vec4 texture = texture2D(tDiffuse, vUv);

    float dProd = 0.8 * max(0.0, dot(vNormal, light));

    gl_FragColor = texture * dProd;
}
`;

const toggleAnimationButton = document.getElementById("toggle-animation");
const moonPhasesButton = document.getElementById("moon-phases");
const toggleOptionsButton = document.getElementById("toggle-options");

const moonPhasesList = document.getElementById("moon-phases-list");
const phaseSelected = document.getElementById("phase-selected");

const optionsList = document.getElementById("options-list");
const animationSpeedSlider = document.getElementById("animation-speed");
const speed = document.getElementById("speed");

const moonPhases = [
    { element: document.getElementById("new-moon"), value: 25.0 },
    { element: document.getElementById("waxing-crescent"), value: 31.0 },
    { element: document.getElementById("first-quarter"), value: 34.0 },
    { element: document.getElementById("waxing-gibbous"), value: 5.0 },
    { element: document.getElementById("full-moon"), value: 10.0 },
    { element: document.getElementById("waning-gibbous"), value: 15.0 },
    { element: document.getElementById("third-quarter"), value: 18.5 },
    { element: document.getElementById("waning-crescent"), value: 21.0 },
];

class Main {
    constructor() {
        this.InitializeScene();
        this.InitializeCamera();
        this.InitializeRenderer();
        this.PostFX();
        this.AddListeners();

        this.clock = new THREE.Clock();
        this.lastTime = 0.0;
        this.animationSpeed = animationSpeedSlider.value;

        this.isAnimationEnabled = true;
        this.isMoonPhasesEnabled = false;
        this.isOptionsEnabled = false;

        this.activeMoonPhase = null;
        this.lightPos = new THREE.Vector3(10, 0, 30);

        speed.innerText = `Animation Speed: ${animationSpeedSlider.value}`;

        // this.controls = new OrbitControls(this.camera, this.renderer.domElement);

        this.uniforms = {
            u_time: { value: 0.0 },
            lightDir: { value: new THREE.Vector3() },
            tDiffuse: { value: new THREE.TextureLoader().load("../resources/moon.jpg") },
        };

        this.moon = new THREE.Mesh(
            new THREE.SphereGeometry(10, 50, 50),
            new THREE.ShaderMaterial({
                vertexShader: VS_1,
                fragmentShader: FS_1,
                uniforms: this.uniforms
            })
        );

        this.scene.add(this.moon);

        const starGeometry = new THREE.BufferGeometry();
        const starMaterial = new THREE.PointsMaterial({color: 0xffffff});
        const starVertices = [];

        for (let i = 0; i < 100; i++) {
            const x = (Math.random() - 0.5) * 2000;
            const y = (Math.random() - 0.5) * 2000;
            const z = -Math.random() * 1000;

            starVertices.push(x, y, z);
        }

        starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starVertices, 3));

        const stars = new THREE.Points(starGeometry, starMaterial);
        this.scene.add(stars);

        window.requestAnimationFrame(() => this.Update());
    }

    InitializeScene() {
        this.scene = new THREE.Scene();
    }

    InitializeCamera() {
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(-25, 0, 0);
        this.camera.rotation.order = "YXZ";
        this.camera.position.z = 40;
    }

    InitializeRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.VSMShadowMap;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        document.querySelector(".rendering-canvas").appendChild(this.renderer.domElement);
    }

    PostFX() {
        const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.05, 0.1, 0.1)

        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        this.composer.addPass(bloomPass);
    }

    AddListeners() {
        window.addEventListener("resize", () => this.OnWindowResize(), false);

        toggleAnimationButton.addEventListener("click", () => this.ToggleAnimation());
        moonPhasesButton.addEventListener("click", () => this.ToggleMoonPhases());

        for (let i = 0; i < moonPhases.length; i++) {
            moonPhases[i].element.addEventListener("click", () => {
                this.SetLightPos(moonPhases[i].value);
                this.SelectElement(moonPhases[i].element, moonPhasesList.children);
                phaseSelected.innerText = moonPhases[i].element.alt;
                this.activeMoonPhase = moonPhases[i];
                this.isAnimationEnabled = false;
            });
        }

        toggleOptionsButton.addEventListener("click", () => {
            this.ToggleOptions();
        });

        animationSpeedSlider.addEventListener("input", () => {
            // this.animationSpeed = this.Lerp(this.animationSpeed, animationSpeedSlider.value, this.clock.getDelta());
            
            this.animationSpeed = animationSpeedSlider.value;
            speed.innerText = `Animation Speed: ${animationSpeedSlider.value}`;
        })
    }

    OnWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    ToggleAnimation() {
        this.isAnimationEnabled = !this.isAnimationEnabled;

        if (this.isAnimationEnabled) {
            this.ResumeClock();
        } else if (!this.isAnimationEnabled) {
            this.PauseClock();
        }
    }

    ToggleMoonPhases() {
        this.isMoonPhasesEnabled = !this.isMoonPhasesEnabled;

        if (this.isMoonPhasesEnabled) {
            toggleAnimationButton.style.display = "none";
            toggleOptionsButton.style.display = "none";
            moonPhasesList.style.display = "block";
            moonPhasesButton.innerText = "<< BACK";

            if (this.activeMoonPhase != null) {
                this.SetLightPos(this.activeMoonPhase.value);
            }

            this.ToggleAnimation();
        } 
        else if (!this.isMoonPhasesEnabled) {
            toggleAnimationButton.style.display = "flex";
            toggleOptionsButton.style.display = "flex";
            moonPhasesList.style.display = "none";
            moonPhasesButton.innerText = "PHASES";

            this.ToggleAnimation();
        }
    }

    ToggleOptions() {
        this.isOptionsEnabled = !this.isOptionsEnabled;

        if (this.isOptionsEnabled) {
            toggleAnimationButton.style.display = "none";
            moonPhasesButton.style.display = "none";
            optionsList.style.display = "block";
            toggleOptionsButton.innerText = "<< Back";
        }
        else if (!this.isOptionsEnabled) {
            toggleAnimationButton.style.display = "flex";
            moonPhasesButton.style.display = "flex";
            optionsList.style.display = "none";
            toggleOptionsButton.innerText = "OPTIONS";
        }
    }

    SetLightPos(value) {
        // this.lightPos.z = Math.sin(value * 0.2);
        // this.lightPos.x = Math.cos(value * 0.2);
        this.lightPos.z = Math.sin((value * 0.2) * this.animationSpeed * 0.05);
        this.lightPos.x = Math.cos((value * 0.2) * this.animationSpeed * 0.05);
        this.uniforms.lightDir.value.copy(this.lightPos.clone().sub(this.moon.position.clone())); 
    }

    SelectElement(targetElement, otherElements) {
        for (let i = 0; i < otherElements.length; i++) {
            otherElements[i].style.borderColor = "white";
        }

        targetElement.style.borderColor = "red";
    }

    Lerp(value1, value2, amount) {
        return (1 - amount) * value1 + amount * value2;
    }

    PauseClock() {
        this.lastTime = this.clock.getElapsedTime();
        this.clock.running = false;
    }

    ResumeClock() {
        this.clock.start();
        this.clock.elapsedTime = this.lastTime;
    }

    Update() {
        requestAnimationFrame(() => this.Update());

        const t = this.clock.getElapsedTime();

        this.composer.render();

        if (!this.isAnimationEnabled)
            return;

        this.SetLightPos(t);

        this.uniforms.u_time.value = t;
        this.uniforms.lightDir.value.copy(this.lightPos.clone().sub(this.moon.position.clone())); 
    }
}

window.addEventListener("DOMContentLoaded", () => {
    window.DEBUG = new Main();
})