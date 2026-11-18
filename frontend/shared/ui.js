(function(){
  function ensureToastRoot(){
    var root=document.getElementById('toast-container');
    if(!root){
      root=document.createElement('div');
      root.id='toast-container';
      document.body.appendChild(root);
    }
    return root;
  }
  function createToast(message,type,opts){
    var root=ensureToastRoot();
    var el=document.createElement('div');
    el.className='toast '+(type||'info');
    el.textContent=message;
    root.appendChild(el);
    var ttl=(opts&&opts.duration)||2500;
    setTimeout(function(){
      if(el&&el.parentNode){el.parentNode.removeChild(el)}
    },ttl);
  }
  window.Toast={
    info:function(m,o){createToast(m,'info',o)},
    success:function(m,o){createToast(m,'success',o)},
    error:function(m,o){createToast(m,'error',o)},
    warn:function(m,o){createToast(m,'warn',o)}
  };
  // Loader
  var overlay;
  function ensureOverlay(){
    if(!overlay){
      overlay=document.createElement('div');
      overlay.id='loader-overlay';
      overlay.innerHTML='<div class="loader" aria-label="Loading"></div>';
      document.body.appendChild(overlay);
    }
    return overlay;
  }
  window.Loader={
    show:function(){ensureOverlay().style.display='flex'},
    hide:function(){ensureOverlay().style.display='none'}
  };

  // Simple validators
  window.UIHelpers={
    isEmail:function(v){return /\S+@\S+\.\S+/.test(String(v||'').trim());},
    isPhone:function(v){return /^\d{10}$/.test(String(v||'').trim());},
    strength:function(p){
      var s=0; if(!p) return 0; if(p.length>=8) s++; if(/[A-Z]/.test(p)) s++; if(/[a-z]/.test(p)) s++; if(/\d/.test(p)) s++; if(/[^\w]/.test(p)) s++; return s;
    }
  };
})();
