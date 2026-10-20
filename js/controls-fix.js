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
        event.stopImmediatePropagation();
        window.addOperation({});
      });
    }

    if (!operations.dataset.passDelegationBound) {
      operations.dataset.passDelegationBound = '1';
      operations.addEventListener('click', (event) => {
        const button = event.target.closest('.add-pass');
        if (!button) return;
        const operation = button.closest('.operation');
        if (!operation) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        window.addPass(operation, {});
      }, true);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindControls, { once: true });
  } else {
    bindControls();
  }
})();
