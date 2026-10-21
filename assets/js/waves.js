// Onde animate tra le sezioni. Ogni elemento ".wave" riceve un SVG con due strati
// (uno sfumato dietro, uno pieno davanti) il cui profilo cambia nel tempo.
//
// Per non appesantire il sito l'animazione:
//  - gira solo per le onde visibili sullo schermo,
//  - è limitata a circa 30 fotogrammi al secondo,
//  - si ferma mentre l'utente usa la sezione indicata in "pauseWhileHovering",
//  - resta ferma per chi ha chiesto di ridurre i movimenti nel sistema.

const SETTINGS = {
	viewBoxHeight: 130,
	cycles: 1.5,
	oscillationSpeed: 0.55,
	travelSpeed: 0.05,
	down: { center: 60, amplitude: 34 },
	up: { center: 70, amplitude: 34 },
	backLayer: { ampScale: 0.55, areaBoost: 14, phase: 2.1, speedScale: 0.6 },
};

const SVG_NS = "http://www.w3.org/2000/svg";
const POINTS_PER_PATH = 160;
const MIN_FRAME_INTERVAL_MS = 33;

// Larghezza di un "tassello" d'onda: molto più della viewport, così la forma
// non viene tagliata mentre oscilla. Il disegno ne contiene due affiancati.
const TILE_WIDTH = 2880;

function createWave(element) {
	const type = element.classList.contains("wave-up") ? "up" : "down";
	const fill = element.dataset.fill;
	const width = TILE_WIDTH * 2;
	const height = SETTINGS.viewBoxHeight;

	const svg = document.createElementNS(SVG_NS, "svg");
	svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
	svg.setAttribute("preserveAspectRatio", "none");

	const backPath = document.createElementNS(SVG_NS, "path");
	backPath.setAttribute("fill", fill);
	backPath.classList.add("wave-back-layer");

	const frontPath = document.createElementNS(SVG_NS, "path");
	frontPath.setAttribute("fill", fill);

	svg.append(backPath, frontPath);
	element.appendChild(svg);

	return { element, type, width, height, backPath, frontPath };
}

// Costruisce il profilo dell'onda come percorso SVG, per un dato istante.
function buildPath(wave, time, isBackLayer) {
	const shape = SETTINGS[wave.type];
	const layer = isBackLayer ? SETTINGS.backLayer : null;
	const areaSign = wave.type === "up" ? 1 : -1;

	const center = shape.center + (layer ? areaSign * layer.areaBoost : 0);
	const amplitude = shape.amplitude * (layer ? layer.ampScale : 1);
	const phase = layer ? layer.phase : 0;
	const speedScale = layer ? layer.speedScale : 1;

	const travel = time * SETTINGS.travelSpeed * speedScale;
	const speed = SETTINGS.oscillationSpeed * speedScale;

	let path = `M 0 ${center}`;

	for (let i = 1; i <= POINTS_PER_PATH; i++) {
		const x = (i / POINTS_PER_PATH) * wave.width;
		const t = (x % TILE_WIDTH) / TILE_WIDTH;
		const envelope = Math.sin(Math.PI * t);

		const main =
			Math.sin(t * Math.PI * SETTINGS.cycles * 2 - travel + phase) * Math.cos(time * speed * 0.5);
		const ripple =
			Math.sin(t * Math.PI * SETTINGS.cycles * 4 - travel * 1.4 + phase + 0.9) *
			Math.cos(time * speed * 0.7);

		const y = center + (main + ripple * 0.18) * amplitude * envelope;
		path += ` L ${x} ${y}`;
	}

	// Chiude la forma verso l'alto (onda "up") o verso il basso (onda "down").
	path +=
		wave.type === "up"
			? ` L ${wave.width} 0 L 0 0 Z`
			: ` L ${wave.width} ${wave.height} L 0 ${wave.height} Z`;
	return path;
}

function drawWave(wave, time) {
	wave.backPath.setAttribute("d", buildPath(wave, time, true));
	wave.frontPath.setAttribute("d", buildPath(wave, time, false));
}

export function startWaves({ pauseWhileHovering = null } = {}) {
	const waves = [...document.querySelectorAll(".wave")].map(createWave);

	// Forma iniziale, disegnata una volta sola.
	waves.forEach((wave) => drawWave(wave, 0));

	const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	if (prefersReducedMotion) return;

	// Teniamo traccia di quali onde sono visibili: le altre non si ridisegnano.
	const visibleWaves = new Set();
	const wavesByElement = new Map(waves.map((wave) => [wave.element, wave]));

	const visibilityObserver = new IntersectionObserver((entries) => {
		for (const entry of entries) {
			const wave = wavesByElement.get(entry.target);
			if (entry.isIntersecting) visibleWaves.add(wave);
			else visibleWaves.delete(wave);
		}
	});
	wavesByElement.forEach((wave, element) => visibilityObserver.observe(element));

	let paused = false;
	if (pauseWhileHovering) {
		pauseWhileHovering.addEventListener("pointerenter", () => (paused = true));
		pauseWhileHovering.addEventListener("pointerleave", () => (paused = false));
	}

	let lastFrame = 0;

	function animate(timestamp) {
		requestAnimationFrame(animate);

		if (paused || timestamp - lastFrame < MIN_FRAME_INTERVAL_MS) return;
		lastFrame = timestamp;

		const seconds = timestamp / 1000;
		visibleWaves.forEach((wave) => drawWave(wave, seconds));
	}

	requestAnimationFrame(animate);
}
