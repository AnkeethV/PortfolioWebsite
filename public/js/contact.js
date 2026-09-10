/**
   Contact Form Controller
   Client validation, honeypot handling, AJAX submission, inline alerts
   ========================================================================== */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  const nameInput = document.getElementById('contact-name');
  const emailInput = document.getElementById('contact-email');
  const messageInput = document.getElementById('contact-message');
  const submitBtn = document.getElementById('contact-submit-btn');
  const statusAlert = document.getElementById('form-status-message');

  const nameError = document.getElementById('name-error');
  const emailError = document.getElementById('email-error');
  const messageError = document.getElementById('message-error');

  function clearErrors() {
    [nameError, emailError, messageError].forEach(el => {
      if (el) el.textContent = '';
    });
    [nameInput, emailInput, messageInput].forEach(el => {
      if (el) el.classList.remove('error');
    });
  }

  // Clear errors when typing
  [nameInput, emailInput, messageInput].forEach(input => {
    if (input) {
      input.addEventListener('input', () => {
        input.classList.remove('error');
        const errSpan = form.querySelector(`#${input.id.replace('contact-', '')}-error`);
        if (errSpan) errSpan.textContent = '';
      });
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const message = messageInput.value.trim();
    const gotcha = form.querySelector('input[name="_gotcha"]')?.value || '';

    let hasError = false;

    if (!name || name.length < 2) {
      nameInput.classList.add('error');
      if (nameError) nameError.textContent = 'Please enter your name (at least 2 characters).';
      hasError = true;
    }

    if (!email || !EMAIL_REGEX.test(email)) {
      emailInput.classList.add('error');
      if (emailError) emailError.textContent = 'Please enter a valid email address.';
      hasError = true;
    }

    if (!message || message.length < 5) {
      messageInput.classList.add('error');
      if (messageError) messageError.textContent = 'Please enter a message (at least 5 characters).';
      hasError = true;
    }

    if (hasError) return;

    // Loading state
    submitBtn.disabled = true;
    const originalBtnHtml = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span>Sending Message...</span>';
    if (statusAlert) {
      statusAlert.style.display = 'none';
      statusAlert.className = 'form-status-alert';
    }

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          message,
          _gotcha: gotcha
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        form.reset();
        if (statusAlert) {
          statusAlert.className = 'form-status-alert success';
          statusAlert.textContent = data.message || 'Thank you! Your message has been sent successfully.';
          statusAlert.style.display = 'block';
        }
      } else {
        throw new Error(data.error || 'Failed to deliver message.');
      }
    } catch (err) {
      if (statusAlert) {
        statusAlert.className = 'form-status-alert error';
        statusAlert.textContent = err.message || 'An error occurred. Please try again or email Ankeeth directly.';
        statusAlert.style.display = 'block';
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnHtml;
    }
  });
}

export default initContactForm;
