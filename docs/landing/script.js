/**
 * Script de la Landing Page de Lumihilo
 * Funcionalidad front-end pura: modal de privacidad, navegación móvil,
 * copia de correo al portapapeles y animaciones de demostración visual.
 * 
 * NOTA DE SEGURIDAD: No contiene ni interactúa con la lógica interna del videojuego.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Elementos del DOM
  const currentYearSpan = document.getElementById('currentYear');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const navLinks = document.getElementById('navLinks');
  
  // Modal de Política de Privacidad
  const privacyModal = document.getElementById('privacyModal');
  const openPrivacyNav = document.getElementById('openPrivacyNav');
  const openPrivacyFooter = document.getElementById('openPrivacyFooter');
  const closePrivacyBtn = document.getElementById('closePrivacyBtn');
  const closePrivacyFooterBtn = document.getElementById('closePrivacyFooterBtn');
  
  // Botón Copiar Correo de Soporte
  const copyEmailBtn = document.getElementById('copyEmailBtn');
  const supportEmailLink = document.getElementById('supportEmailLink');

  // Botón Trailer Demo
  const playTrailerBtn = document.getElementById('playTrailerBtn');

  // 2. Actualizar año en footer automáticamente
  if (currentYearSpan) {
    currentYearSpan.textContent = new Date().getFullYear();
  }

  // 3. Menú móvil interactivo
  if (mobileMenuBtn && navLinks) {
    mobileMenuBtn.addEventListener('click', () => {
      navLinks.classList.toggle('is-active');
      const isExpanded = navLinks.classList.contains('is-active');
      mobileMenuBtn.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
    });

    // Cerrar menú al hacer clic en cualquier enlace
    navLinks.querySelectorAll('a, button').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('is-active');
        mobileMenuBtn.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // 4. Control del Modal de Política de Privacidad
  const openModal = () => {
    if (!privacyModal) return;
    privacyModal.classList.add('is-open');
    privacyModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden'; // Evitar scroll de fondo
  };

  const closeModal = () => {
    if (!privacyModal) return;
    privacyModal.classList.remove('is-open');
    privacyModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  };

  if (openPrivacyNav) openPrivacyNav.addEventListener('click', (e) => { e.preventDefault(); openModal(); });
  if (openPrivacyFooter) openPrivacyFooter.addEventListener('click', (e) => { e.preventDefault(); openModal(); });
  if (closePrivacyBtn) closePrivacyBtn.addEventListener('click', closeModal);
  if (closePrivacyFooterBtn) closePrivacyFooterBtn.addEventListener('click', closeModal);

  // Cerrar al hacer clic en el fondo oscuro
  if (privacyModal) {
    privacyModal.addEventListener('click', (e) => {
      if (e.target === privacyModal) {
        closeModal();
      }
    });
  }

  // Cerrar con tecla Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && privacyModal && privacyModal.classList.contains('is-open')) {
      closeModal();
    }
  });

  // Abrir modal automáticamente si la URL contiene #privacy o #politica
  if (window.location.hash === '#privacy' || window.location.hash === '#politica') {
    openModal();
  }

  // 5. Copiar correo al portapapeles con retroalimentación visual
  if (copyEmailBtn && supportEmailLink) {
    copyEmailBtn.addEventListener('click', async () => {
      const email = supportEmailLink.textContent.trim();
      const originalText = copyEmailBtn.querySelector('.copy-text')?.textContent || (document.documentElement.lang === 'en' ? 'Copy' : 'Copiar');

      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(email);
        } else {
          // Fallback clásico para navegadores antiguos
          const textArea = document.createElement('textarea');
          textArea.value = email;
          textArea.style.position = 'fixed';
          textArea.style.left = '-999999px';
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          document.execCommand('copy');
          textArea.remove();
        }

        // Feedback visual
        copyEmailBtn.style.background = '#38f9d7';
        copyEmailBtn.style.color = '#0a0e17';
        copyEmailBtn.querySelector('.copy-text').textContent = document.documentElement.lang === 'en' ? 'Copied!' : '¡Copiado!';

        setTimeout(() => {
          copyEmailBtn.style.background = '';
          copyEmailBtn.style.color = '';
          copyEmailBtn.querySelector('.copy-text').textContent = originalText;
        }, 2200);
      } catch (err) {
        console.warn('Error al copiar correo:', err);
      }
    });
  }

  // 6. Animación estética de interacción en la vista previa del trailer
  if (playTrailerBtn) {
    playTrailerBtn.addEventListener('click', () => {
      const overlay = playTrailerBtn.closest('.media-placeholder-overlay');
      if (overlay) {
        const caption = overlay.querySelector('.placeholder-caption');
        if (caption) {
          caption.textContent = 'Tráiler oficial en producción para la Google Play Store';
          caption.style.color = '#00f0ff';
        }
      }
    });
  }

  // 7. Micro-animación visual en las celdas decorativas del Hero
  const demoCells = document.querySelectorAll('.demo-cell:not(.core-source)');
  demoCells.forEach((cell, idx) => {
    cell.addEventListener('click', () => {
      const currentRotation = cell.dataset.rotation ? parseInt(cell.dataset.rotation, 10) : 0;
      const nextRotation = currentRotation + 90;
      cell.dataset.rotation = nextRotation.toString();
      cell.style.transform = `rotate(${nextRotation}deg)`;
    });
  });
});
