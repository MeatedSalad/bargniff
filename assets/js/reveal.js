// Fa comparire con una dissolvenza gli elementi ".reveal" quando entrano nello schermo.

export function setupScrollReveal() {
	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				entry.target.classList.add("in");
				observer.unobserve(entry.target);
			}
		},
		{ threshold: 0.15 },
	);

	document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));
}
