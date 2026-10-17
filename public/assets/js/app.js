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
    getResults: function () { try { return JSON.parse(localStorage.getItem('mm_results')) || {}; } catch (e) { return {}; } }
  };

  // Hiện người dùng đang đăng nhập trên thanh điều hướng
  var user = MM.getUser(), cta = document.querySelector('.nav-cta');
  if (user && cta) {
    cta.innerHTML =
      '<div class="user-chip" title="' + user.email + '">' +
        '<span class="avatar' + (user.role === 'teacher' ? ' t' : '') + '">' + MM.initials(user.name) + '</span>' +
        '<span class="who"><b></b><small>' + MM.roleLabel(user) + '</small></span>' +
      '</div>' +
      '<button class="btn btn-ghost btn-sm" type="button" id="btn-logout">Đăng xuất</button>';
    cta.querySelector('.who b').textContent = user.name;
    document.getElementById('btn-logout').onclick = MM.logout;
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
