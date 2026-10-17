/* MathMate — tiện ích dùng chung cho mọi trang */
(function () {
  // Toast thông báo
  var toastEl, toastTimer;
  window.toast = function (msg, type) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      toastEl.innerHTML = '<span class="dot"></span><span class="msg"></span>';
      document.body.appendChild(toastEl);
    }
    toastEl.className = 'toast' + (type ? ' ' + type : '');
    toastEl.querySelector('.msg').textContent = msg;
    requestAnimationFrame(function () { toastEl.classList.add('show'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 3200);
  };

  // Mọi phần tử có data-soon: bấm vào → báo "sắp ra mắt"
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-soon]');
    if (!el) return;
    e.preventDefault();
    var name = el.getAttribute('data-soon');
    toast((name ? '“' + name + '” ' : 'Tính năng này ') + 'sắp ra mắt. Bạn quay lại sau nhé!');
  });

  // Form chưa hoạt động (data-soon): chặn gửi đi
  document.addEventListener('submit', function (e) {
    var f = e.target.closest('[data-soon]');
    if (!f) return;
    e.preventDefault();
    toast('“' + f.getAttribute('data-soon') + '” sắp ra mắt. Bạn quay lại sau nhé!');
  });

  // Menu trên điện thoại
  var nav = document.querySelector('.nav');
  var toggle = document.querySelector('.nav-toggle');
  if (nav && toggle) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      var links = nav.querySelector('.nav-links');
      if (open && links) nav.style.setProperty('--links-h', links.offsetHeight + 'px');
    });
  }

  // Hiển thị công thức toán bằng KaTeX (nếu đã nạp)
  window.renderMath = function (root) {
    if (window.renderMathInElement) {
      renderMathInElement(root || document.body, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '\\(', right: '\\)', display: false }
        ],
        throwOnError: false
      });
    }
  };
  window.addEventListener('load', function () { window.renderMath(); });
})();
