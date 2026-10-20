(() => {
  'use strict';

  function bindControls() {
    const operations = document.getElementById('operations');
    const addOperation = document.getElementById('addOperation');
    if (!operations || typeof window.addOperation !== 'function' || typeof window.addPass !== 'function') return;

    if (addOperation && !addOperation.dataset.controlsBound) {
      addOperation.dataset.controlsBound = '1';
      addOperation.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        window.addOperation({});
      });
    }

    if (!operations.dataset.passDelegationBound) {
      operations.dataset.passDelegationBound = '1';
      operations.addEventListener('click', (event) => {
        const button = event.target.closest('.add-pass');
        if (!button) return;
        event.preventDefault();
        event.stopPropagation();
        const operation = button.closest('.operation');
        if (operation) window.addPass(operation, {});
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindControls, { once: true });
  } else {
    bindControls();
  }
})();
