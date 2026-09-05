"use strict";
(function () {
  // Бургер
  var burger = document.querySelector(".burger");
  var header = document.querySelector(".site-header");
  if (burger) burger.addEventListener("click", function () {
    var open = header.classList.toggle("is-open");
    burger.setAttribute("aria-expanded", String(open));
  });

  // Попап «Куда обратиться»: перехватывает все ссылки на help.html#contacts,
  // чтобы контакты открывались без ухода со страницы. Сам раздел #contacts
  // на странице «Помощь» остаётся; при отключённом JS ссылки работают как раньше.
  var PHONE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6.8 4.5h3l1.5 4-2 1.5a12 12 0 0 0 4.7 4.7l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.8 6.7a2 2 0 0 1 2-2.2z"/></svg>';
  var HEADSET_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16.5v-5a8 8 0 0 1 16 0v5"/><rect x="3" y="14" width="4.5" height="6.5" rx="2"/><rect x="16.5" y="14" width="4.5" height="6.5" rx="2"/></svg>';
  var ALERT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4l8.5 14.5H3.5z"/><path d="M12 10v4M12 16.8v.2"/></svg>';
  var CONTACTS_MODAL_HTML =
    '<div class="modal" id="contacts-modal" hidden role="dialog" aria-modal="true" aria-labelledby="cm-h">' +
      '<div class="modal__card modal__card--wide">' +
        '<button class="modal__close" id="cm-close" type="button" aria-label="Закрыть">&times;</button>' +
        '<h3 id="cm-h">Куда обратиться за помощью</h3>' +
        '<p class="muted" style="font-size:15px">Проверенные бесплатные контакты. Позвонить — это уже шаг заботы о себе.</p>' +
        '<div class="modal__contacts">' +
          '<div class="contact-card"><span class="icon-chip icon-chip--round" aria-hidden="true">' + PHONE_ICON + '</span>' +
            '<div><b>Детский телефон доверия</b><a class="tel" href="tel:88002000122">8-800-2000-122</a>' +
            '<span>Бесплатно и анонимно, для детей, подростков и их родителей</span></div></div>' +
          '<div class="contact-card"><span class="icon-chip icon-chip--round icon-chip--sky" aria-hidden="true">' + HEADSET_ICON + '</span>' +
            '<div><b>Психологическая помощь МЧС России</b><a class="tel" href="tel:+74959895050">+7 (495) 989-50-50</a>' +
            '<span>Круглосуточно · онлайн: psi.mchs.gov.ru</span></div></div>' +
          '<div class="contact-card"><span class="icon-chip icon-chip--round icon-chip--sand" aria-hidden="true">' + ALERT_ICON + '</span>' +
            '<div><b>Экстренные службы</b><a class="tel" href="tel:112">112</a>' +
            '<span>Если есть опасность для жизни — звони сразу</span></div></div>' +
        '</div>' +
        '<p class="muted" style="font-size:14.5px; margin-bottom:14px">Также можно поговорить со школьным психологом или взрослым, которому ты доверяешь.</p>' +
        '<a class="btn btn--secondary" href="help.html">Техники самопомощи и вся страница «Помощь» <span class="arr">→</span></a>' +
      '</div>' +
    '</div>';

  var contactLinks = document.querySelectorAll('a[href$="help.html#contacts"]');
  if (contactLinks.length) {
    document.body.insertAdjacentHTML("beforeend", CONTACTS_MODAL_HTML);
    var cModal = document.getElementById("contacts-modal");
    var cClose = document.getElementById("cm-close");
    var cOpener = null;
    var openContacts = function (e) {
      e.preventDefault();
      cOpener = e.currentTarget;
      cModal.hidden = false;
      cClose.focus();
    };
    var closeContacts = function () {
      cModal.hidden = true;
      if (cOpener) cOpener.focus();
    };
    contactLinks.forEach(function (a) { a.addEventListener("click", openContacts); });
    cClose.addEventListener("click", closeContacts);
    cModal.addEventListener("click", function (e) { if (e.target === cModal) closeContacts(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !cModal.hidden) closeContacts();
    });
  }

  // Появление при скролле (уважает prefers-reduced-motion)
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var items = document.querySelectorAll(".reveal");
  if (reduce || !("IntersectionObserver" in window)) {
    items.forEach(function (el) { el.classList.add("in-view"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in-view"); io.unobserve(e.target); }
      });
    }, { threshold: 0.15 });
    items.forEach(function (el) { io.observe(el); });
  }
})();
