(function () {
  document.documentElement.classList.remove("no-js");

  const body = document.body;
  const appUrl = body.dataset.appUrl || "../web/";
  document.querySelectorAll("[data-open-app]").forEach((link) => {
    link.setAttribute("href", appUrl);
  });

  const year = document.querySelector("[data-year]");
  if (year) {
    year.textContent = String(new Date().getFullYear());
  }

  const backTop = document.querySelector("[data-back-top]");
  if (backTop) {
    backTop.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  const navLinks = Array.from(document.querySelectorAll(".site-nav a"));
  const sections = navLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  const setActiveLink = (id) => {
    navLinks.forEach((link) => {
      link.classList.toggle("is-active", link.getAttribute("href") === `#${id}`);
    });
  };

  if ("IntersectionObserver" in window) {
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveLink(entry.target.id);
          }
        });
      },
      { rootMargin: "-35% 0px -50% 0px", threshold: 0.01 },
    );
    sections.forEach((section) => sectionObserver.observe(section));

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    document.querySelectorAll(".reveal").forEach((item) => {
      revealObserver.observe(item);
    });
  } else {
    document.querySelectorAll(".reveal").forEach((item) => {
      item.classList.add("is-visible");
    });
  }

  window.addEventListener(
    "scroll",
    () => {
      if (backTop) {
        backTop.classList.toggle("is-visible", window.scrollY > 480);
      }
    },
    { passive: true },
  );

  document.querySelectorAll(".faq-list details").forEach((details) => {
    details.addEventListener("toggle", () => {
      if (!details.open) return;
      document.querySelectorAll(".faq-list details").forEach((item) => {
        if (item !== details) {
          item.removeAttribute("open");
        }
      });
    });
  });
})();
