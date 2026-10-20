document.addEventListener('DOMContentLoaded',function(){
  document.querySelectorAll('nav button[data-v]').forEach(function(btn){
    btn.addEventListener('click',function(){
      var id=btn.getAttribute('data-v');
      document.querySelectorAll('nav button[data-v]').forEach(function(b){b.classList.toggle('active',b===btn)});
      document.querySelectorAll('.view').forEach(function(v){v.classList.toggle('active',v.id===id)});
      if(id==='setup' && typeof window.renderSetup==='function') window.renderSetup();
      if(id==='lib' && typeof window.renderLibrary==='function') window.renderLibrary();
      if(id==='hist' && typeof window.renderHistory==='function') window.renderHistory();
    });
  });
});