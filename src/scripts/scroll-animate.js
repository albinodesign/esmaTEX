/**
 * Scroll-Reveal via IntersectionObserver (lokal, ohne Abhängigkeiten).
 * Elemente mit [data-animate] werden beim Hereinscrollen sichtbar (CSS-Fade-Up).
 * Optional: data-animate-delay="120" setzt eine Verzögerung in ms (Staggering).
 * Respektiert prefers-reduced-motion.
 */
const animatedElements = document.querySelectorAll('[data-animate]');

animatedElements.forEach((el) => {
  const delay = el.getAttribute('data-animate-delay');
  if (delay) {
    el.style.setProperty('--animate-delay', `${delay}ms`);
  }
});

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (prefersReducedMotion || !('IntersectionObserver' in window)) {
  animatedElements.forEach((el) => el.classList.add('is-visible'));
} else {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
  );

  animatedElements.forEach((el) => observer.observe(el));
}
