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
    if (window.MM) MM.track('soon_click', { feature: name || '' });
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

  // ══ Phiên đăng nhập (BẢN XEM TRƯỚC: lưu trên trình duyệt, chưa có máy chủ) ══
  var MM = window.MM = {
    getUser: function () { try { return JSON.parse(localStorage.getItem('mm_user')); } catch (e) { return null; } },
    setUser: function (u) { try { localStorage.setItem('mm_user', JSON.stringify(u)); } catch (e) {} },
    logout: function () { try { localStorage.removeItem('mm_user'); } catch (e) {} location.href = 'index.html'; },
    roleLabel: function (u) {
      if (!u) return '';
      if (u.role === 'teacher') return 'Giáo viên' + (u.approved ? '' : ' (chờ duyệt)');
      return 'Học sinh lớp ' + u.grade;
    },
    initials: function (name) {
      var p = String(name || '?').trim().split(/\s+/);
      return (p.length > 1 ? p[0][0] + p[p.length - 1][0] : p[0].slice(0, 2)).toUpperCase();
    },
    getResults: function () { try { return JSON.parse(localStorage.getItem('mm_results')) || {}; } catch (e) { return {}; } },
    // Mã ẩn danh của trình duyệt (không chứa tên hay email)
    sid: function () {
      try {
        var id = localStorage.getItem('mm_sid');
        if (!id) { id = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('mm_sid', id); }
        return id;
      } catch (e) { return ''; }
    },
    // Gửi một sự kiện thống kê về máy chủ
    track: function (type, data) {
      if (location.protocol === 'file:' || /\/admin(\.html)?$/.test(location.pathname)) return;
      var u = MM.getUser();
      var body = JSON.stringify({
        type: type, page: location.pathname, sid: MM.sid(),
        role: u ? u.role : 'guest', grade: u && u.grade ? String(u.grade) : '', data: data || {}
      });
      try {
        if (navigator.sendBeacon) navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }));
        else fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true });
      } catch (e) {}
    }
  };
  MM.track('page_view');

  // Hiện người dùng đang đăng nhập + menu tài khoản
  var user = MM.getUser(), cta = document.querySelector('.nav-cta');
  if (user && cta) {
    var home = user.role === 'teacher' ? 'Góc giáo viên' : 'Góc học tập';
    cta.innerHTML =
      '<div class="acc">' +
        '<button class="user-chip" type="button" id="acc-btn" aria-haspopup="menu" aria-expanded="false" aria-controls="acc-menu">' +
          '<span class="avatar' + (user.role === 'teacher' ? ' t' : '') + '">' + MM.initials(user.name) + '</span>' +
          '<span class="who"><b></b><small>' + MM.roleLabel(user) + '</small></span>' +
          '<svg class="caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>' +
        '</button>' +
        '<div class="acc-menu" id="acc-menu" role="menu" hidden>' +
          '<div class="acc-head"><span class="avatar' + (user.role === 'teacher' ? ' t' : '') + '">' + MM.initials(user.name) + '</span><div><b></b><small></small></div></div>' +
          '<a role="menuitem" href="tai-khoan.html#ho-so">Hồ sơ của tôi</a>' +
          '<a role="menuitem" href="tai-khoan.html#mat-khau">Đổi mật khẩu</a>' +
          '<a role="menuitem" href="tong-quan.html">' + home + '</a>' +
          '<button role="menuitem" type="button" data-soon="Cài đặt thông báo">Cài đặt thông báo</button>' +
          '<hr>' +
          '<button role="menuitem" type="button" class="danger" id="btn-logout">Đăng xuất</button>' +
        '</div>' +
      '</div>';
    cta.querySelector('.who b').textContent = user.name;
    cta.querySelector('.acc-head b').textContent = user.name;
    cta.querySelector('.acc-head small').textContent = user.email;
    document.getElementById('btn-logout').onclick = MM.logout;

    var accBtn = document.getElementById('acc-btn'), accMenu = document.getElementById('acc-menu');
    var setMenu = function (open) {
      accMenu.hidden = !open;
      accBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) accMenu.querySelector('[role="menuitem"]').focus();
    };
    accBtn.addEventListener('click', function (e) { e.stopPropagation(); setMenu(accMenu.hidden); });
    document.addEventListener('click', function (e) { if (!accMenu.hidden && !e.target.closest('.acc')) setMenu(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !accMenu.hidden) { setMenu(false); accBtn.focus(); } });
  }
  // Giáo viên: mục "Giáo viên" trên menu dẫn tới Góc giáo viên
  if (user && user.role === 'teacher') {
    var tBtn = document.querySelector('.nav-links [data-soon="Không gian giáo viên"]');
    if (tBtn) {
      var a = document.createElement('a'); a.href = 'tong-quan.html'; a.textContent = 'Góc giáo viên';
      tBtn.replaceWith(a);
      var g = document.querySelector('.nav-links a[href="tong-quan.html"]'); if (g && g !== a) g.remove();
    }
  }

  // Ghi công người tạo web, hiện ở cuối mọi trang
  var credit = document.createElement('p');
  credit.className = 'credit';
  credit.innerHTML = 'Thiết kế và phát triển bởi <b>NocNocTTHN</b>';
  var ftWrap = document.querySelector('.footer .wrap');
  if (ftWrap) {
    ftWrap.appendChild(credit);
  } else {
    var ft = document.createElement('footer');
    ft.className = 'footer footer-min';
    ft.innerHTML = '<div class="wrap"></div>';
    ft.firstChild.appendChild(credit);
    document.body.appendChild(ft);
  }

  // Trợ lý MathMate ở góc dưới bên phải, hiện trên mọi trang
  if (!document.querySelector('.ask') && !/\/admin(\.html)?$/.test(location.pathname)) {
    var ask = document.createElement('button');
    ask.className = 'ask';
    ask.type = 'button';
    ask.setAttribute('data-soon', 'Trợ lý MathMate');
    ask.setAttribute('aria-label', 'Mở trợ lý MathMate');
    ask.innerHTML = '<span class="ask-label">Khó cứ để MathMate lo</span><span class="ask-face"><img src="assets/img/mathmate-bot.svg" alt="" width="64" height="64"><i class="ask-dot"></i></span>';
    document.body.appendChild(ask);
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