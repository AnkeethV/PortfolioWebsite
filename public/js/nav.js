/**
   Navigation Controller
   Handles mobile menu drawer, smooth anchor scrolling, and active link spy
   ========================================================================== */

export function initNav() {
  const menuBtn = document.getElementById('mobile-menu-btn');
  const navWrapper = document.querySelector('.nav-links-wrapper');
  const navLinks = document.querySelectorAll('.nav-link');

  if (menuBtn && navWrapper) {
    menuBtn.addEventListener('click', () => {
      const isOpen = navWrapper.classList.toggle('open');
      menuBtn.classList.toggle('open', isOpen);
      menuBtn.setAttribute('aria-expanded', String(isOpen));
    });

    // Close mobile drawer when a link is clicked
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        navWrapper.classList.remove('open');
        menuBtn.classList.remove('open');
        menuBtn.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Active section spy on scroll
  const sections = document.querySelectorAll('section[id]');

  function onScroll() {
    const scrollY = window.pageYOffset;

    sections.forEach(current => {
      const sectionHeight = current.offsetHeight;
      const sectionTop = current.offsetTop - 120;
      const sectionId = current.getAttribute('id');

      if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
        navLinks.forEach(link => {
          link.classList.remove('active');
          if (link.getAttribute('href') === `#${sectionId}`) {
            link.classList.add('active');
          }
        });
      }
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
}

export default initNav;
