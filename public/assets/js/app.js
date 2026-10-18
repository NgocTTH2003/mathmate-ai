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
    logout: function () {
      var done = function () { try { localStorage.removeItem('mm_user'); } catch (e) {} location.href = 'index.html'; };
      MM.api('/api/auth/logout', {}).then(done, done);
    },
    // Gọi API của máy chủ. Trả về { ok, status, data }
    api: function (path, body) {
      return fetch(path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: 'same-origin'
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, data: d }; });
      });
    },
    // Đối chiếu người dùng lưu tạm trên trình duyệt với máy chủ; lệch thì cập nhật và tải lại trang
    syncUser: function () {
      if (location.protocol === 'file:') return;
      MM.api('/api/auth/me').then(function (r) {
        if (!r.ok) return;
        var server = r.data.user || null, local = MM.getUser();
        if (JSON.stringify(server) === JSON.stringify(local)) return;
        try { server ? localStorage.setItem('mm_user', JSON.stringify(server)) : localStorage.removeItem('mm_user'); } catch (e) {}
        location.reload();
      });
    },
    roleLabel: function (u) {
      if (!u) return '';
      if (u.role === 'admin') return 'Quản trị viên';
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
          (user.role === 'admin' ? '<a role="menuitem" href="admin.html">Trang quản trị</a>' : '') +
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


  // ══ Khách chỉ xem được Trang chủ; trang khác phải đăng nhập ══
  var PUBLIC_PAGES = { '': 1, 'index': 1, 'dang-nhap': 1, 'admin': 1 };
  function pageKey(path) { return String(path || '').replace(/^.*\//, '').replace(/\.html$/, ''); }
  function needsLogin(path) { return !PUBLIC_PAGES[pageKey(path)]; }
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var authModal = null, authNext = 'tong-quan.html', authGate = false;

  function buildAuthModal() {
    var m = document.createElement('div');
    m.className = 'auth-modal';
    m.hidden = true;
    m.innerHTML =
      '<div class="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="am-title">' +
        '<button class="am-close" type="button" aria-label="Đóng">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>' +
        '<img class="am-bot" src="assets/img/mathmate-bot.svg" alt="" width="72" height="72">' +
        '<h2 id="am-title">Đăng nhập để học tiếp</h2>' +
        '<p class="am-sub">Tạo tài khoản để xem bài học, làm bài luyện tập và lưu tiến độ của bạn.</p>' +
        '<form class="am-form" novalidate autocomplete="on">' +
          '<div class="field"><label for="am-email">Email</label>' +
            '<input class="input" id="am-email" name="email" type="email" autocomplete="email" inputmode="email" placeholder="ban@gmail.com" required>' +
            '<span class="error-msg" id="am-email-err"></span></div>' +
          '<div class="field"><label for="am-pw">Mật khẩu</label>' +
            '<input class="input" id="am-pw" name="password" type="password" autocomplete="current-password" placeholder="Nhập mật khẩu" required>' +
            '<span class="error-msg" id="am-pw-err"></span></div>' +
          '<div class="am-row"><label class="check"><input type="checkbox" name="remember" checked> Ghi nhớ đăng nhập</label>' +
            '<button class="link" type="button" data-soon="Quên mật khẩu">Quên mật khẩu?</button></div>' +
          '<button class="btn btn-primary btn-block btn-lg" type="submit">Đăng nhập</button>' +
        '</form>' +
        '<div class="divider">hoặc</div>' +
        '<button class="btn btn-google btn-block" type="button" data-soon="Đăng nhập bằng Google">Tiếp tục với Google</button>' +
        '<p class="am-foot">Chưa có tài khoản? <a class="link" id="am-signup" href="dang-nhap.html#dang-ky">Tạo tài khoản</a></p>' +
      '</div>';
    document.body.appendChild(m);

    m.querySelector('.am-close').onclick = closeAuth;
    m.addEventListener('click', function (e) { if (e.target === m) closeAuth(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !m.hidden) closeAuth(); });
    m.querySelector('.am-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var em = m.querySelector('#am-email'), pw = m.querySelector('#am-pw');
      var okE = EMAIL_RE.test(em.value.trim()), okP = !!pw.value;
      m.querySelector('#am-email-err').textContent = okE ? '' : 'Nhập email đúng định dạng, ví dụ ban@gmail.com';
      m.querySelector('#am-pw-err').textContent = okP ? '' : 'Nhập mật khẩu';
      em.classList.toggle('invalid', !okE); pw.classList.toggle('invalid', !okP);
      if (!okE || !okP) return;
      var btn = m.querySelector('.am-form button[type="submit"]');
      btn.disabled = true; btn.textContent = 'Đang đăng nhập…';
      MM.api('/api/auth/login', { email: em.value, password: pw.value, remember: m.querySelector('.am-row input').checked })
        .then(function (r) {
          if (!r.ok) {
            m.querySelector('#am-pw-err').textContent = r.data.error || 'Đăng nhập không thành công';
            pw.classList.add('invalid');
            return;
          }
          MM.setUser(r.data.user); MM.track('login');
          toast('Đăng nhập thành công!', 'ok');
          setTimeout(function () { authGate ? location.reload() : (location.href = authNext); }, 500);
        }, function () { toast('Không kết nối được máy chủ, bạn thử lại nhé.', 'err'); })
        .then(function () { btn.disabled = false; btn.textContent = 'Đăng nhập'; });
    });
    return m;
  }

  function openAuth(next, gate) {
    if (!authModal) authModal = buildAuthModal();
    authNext = next || 'tong-quan.html';
    authGate = !!gate;
    authModal.querySelector('#am-signup').href = 'dang-nhap.html?next=' + encodeURIComponent(authNext) + '#dang-ky';
    authModal.querySelector('.am-close').setAttribute('aria-label', gate ? 'Về trang chủ' : 'Đóng');
    authModal.hidden = false;
    document.body.classList.add('modal-open');
    setTimeout(function () { authModal.querySelector('#am-email').focus(); }, 50);
  }
  function closeAuth() {
    if (authGate) { location.href = 'index.html'; return; }
    authModal.hidden = true;
    document.body.classList.remove('modal-open');
  }
  window.MM.openAuth = openAuth;

  if (!MM.getUser()) {
    // Bấm vào liên kết tới trang cần đăng nhập → hiện hộp đăng nhập
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href]');
      if (!a || a.target === '_blank' || e.ctrlKey || e.metaKey || e.shiftKey) return;
      var href = a.getAttribute('href');
      if (!href || href.charAt(0) === '#' || /^(https?:|mailto:|tel:)/i.test(href)) return;
      var path = href.split('#')[0].split('?')[0];
      if (!path || !needsLogin(path)) return;
      e.preventDefault();
      openAuth(href, false);
    }, true);
    // Vào thẳng một trang cần đăng nhập → làm mờ trang và hiện hộp đăng nhập
    if (needsLogin(location.pathname)) {
      document.body.classList.add('gated');
      openAuth(pageKey(location.pathname) + '.html' + location.hash, true);
    }
  }

  MM.syncUser();

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

    // Chữ chạy kiểu gõ phím: gõ ra, giữ 3 giây, xóa dần, rồi lặp lại
    var lbl = ask.querySelector('.ask-label'), full = lbl.textContent;
    if (lbl.offsetWidth) {
      lbl.style.minWidth = lbl.offsetWidth + 'px';   // giữ cố định độ rộng, khung không bị co giãn
      lbl.innerHTML = '<span class="ask-typed"></span><i class="ask-caret"></i>';
      var typed = lbl.firstChild, pos = 0, dir = 1;
      (function tick() {
        pos += dir;
        typed.textContent = full.slice(0, pos);
        if (dir > 0 && pos >= full.length) { dir = -1; return setTimeout(tick, 3000); }
        if (dir < 0 && pos <= 0) { dir = 1; return setTimeout(tick, 600); }
        setTimeout(tick, dir > 0 ? 75 : 35);
      })();
    }
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