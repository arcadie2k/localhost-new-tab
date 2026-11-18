import { $, icon, state, hideTip } from './core.js';

let onAction = null;

export function menuItem(action, iconName, label) {
  return `<button class="menu-item" role="menuitem" data-action="${action}">${icon(iconName)}<span>${label}</span></button>`;
}

export function openPopover(trigger, html, { id = '', kind = '', onAction: handler = null } = {}) {
  closeMenu(true);
  const menu = $('menu');
  menu.innerHTML = html;
  menu.dataset.id = id;
  menu.classList.remove('is-closing');
  menu.hidden = false;

  const r = trigger.getBoundingClientRect();
  const m = menu.getBoundingClientRect();
  const below = r.bottom + 6 + m.height < window.innerHeight;
  menu.style.top = `${below ? r.bottom + 6 : r.top - 6 - m.height}px`;
  menu.style.left = `${Math.min(window.innerWidth - m.width - 16, Math.max(16, r.right - m.width))}px`;
  menu.style.transformOrigin = below ? 'top right' : 'bottom right';

  onAction = handler;
  state.menuFor = id;
  state.menuKind = kind;
  state.menuTrigger = trigger;
  trigger.closest('.card')?.classList.add('is-menu-open');
  trigger.setAttribute('aria-expanded', 'true');
  menu.querySelector('.menu-item')?.focus({ preventScroll: true });
  hideTip();
}

export function closeMenu(immediate = false) {
  const menu = $('menu');
  if (menu.hidden) return;
  document.querySelectorAll('.card.is-menu-open').forEach((el) => el.classList.remove('is-menu-open'));
  document.querySelectorAll('[aria-expanded="true"]').forEach((el) => el.removeAttribute('aria-expanded'));
  state.menuFor = null;
  onAction = null;
  if (immediate || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    menu.hidden = true;
    return;
  }
  menu.classList.add('is-closing');
  const finish = () => {
    if (menu.classList.contains('is-closing')) menu.hidden = true;
  };
  menu.addEventListener('animationend', finish, { once: true });
  setTimeout(finish, 250);
}

$('menu').addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (el && onAction) onAction(el.dataset.action, el);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('menu').hidden) {
    e.stopImmediatePropagation();
    closeMenu();
    return;
  }
  if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !$('menu').hidden) {
    e.preventDefault();
    const items = [...$('menu').querySelectorAll('.menu-item')];
    const i = items.indexOf(document.activeElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
  }
});

window.addEventListener('resize', () => closeMenu(true));
window.addEventListener('scroll', () => closeMenu(true), { passive: true });
