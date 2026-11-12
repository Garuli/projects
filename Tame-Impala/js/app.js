(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const el = (tag, attrs = {}, html = "") => {
    const e = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
    e.innerHTML = html;
    return e;
  };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const T = window.TI;
  const ytThumb = id => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  const ytSearch = q => `https://www.youtube.com/results?search_query=${encodeURIComponent("Tame Impala " + q)}`;

  /* ---------- shared header + footer ---------- */
  const pages = [["index.html", "Home"], ["music.html", "Music"], ["albums.html", "Albums"], ["live.html", "Live"],
    ["tours.html", "Tours"], ["films.html", "Films"], ["band.html", "Band"], ["shop.html", "Shop"]];
  const here = location.pathname.split("/").pop() || "index.html";
  $("#site-header").innerHTML = `
    <a class="skip" href="#main">Skip to content</a>
    <nav class="nav" aria-label="Main"><div class="wrap">
      <a class="logo" href="index.html">Tame Impala</a>
      <button class="burger" aria-expanded="false" aria-controls="menu">Menu</button>
      <ul id="menu">${pages.map(([h, n]) => `<li><a href="${h}"${h === here ? ' aria-current="page"' : ""}>${n}</a></li>`).join("")}</ul>
    </div></nav>`;
  const burger = $(".burger");
  burger.addEventListener("click", () => {
    const open = $("#menu").classList.toggle("open");
    burger.setAttribute("aria-expanded", open);
  });
  $("#site-footer").innerHTML = `<div class="wrap">
    <div>Official site: <a href="https://www.tameimpala.com" target="_blank" rel="noopener">tameimpala.com</a></div>
    <p class="fan">This is an unofficial fan project made for a web development class. Not affiliated with Tame Impala or its label.
    Album covers, music and videos belong to their owners and are shown or embedded for illustration; videos play from the official YouTube channels.</p>
  </div>`;

  /* cover images with a gradient fallback if the hotlink fails */
  const coverImg = a => `<img src="${a.cover}" alt="${esc(a.title)} album cover" loading="lazy" onerror="this.removeAttribute('src');this.alt=''">`;

  /* ---------- home ---------- */
  if ($("#home-albums")) {
    $("#home-albums").innerHTML = [...T.albums].reverse().map(a => `
      <article class="card album"><a href="albums.html#${a.id}">${coverImg(a)}
        <div class="pad"><h3>${esc(a.title)}</h3><p class="muted">${a.year} · ${a.tracks.length} tracks</p></div></a></article>`).join("");
    $("#home-next").innerHTML = T.tours.upcoming.slice(0, 3).map(t =>
      `<li><b>${esc(t.date)}</b> · ${esc(t.city)}, ${esc(t.venue)}</li>`).join("");
  }

  /* hero tilt (mouse + touch) */
  const tilt = $(".tilt");
  if (tilt && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const stage = tilt.parentElement;
    const move = e => {
      const p = e.touches ? e.touches[0] : e, r = stage.getBoundingClientRect();
      const x = (p.clientX - r.left) / r.width - .5, y = (p.clientY - r.top) / r.height - .5;
      tilt.style.transform = `rotateY(${x * 28}deg) rotateX(${-y * 28}deg)`;
      tilt.style.setProperty("--gx", (x + .5) * 100 + "%"); tilt.style.setProperty("--gy", (y + .5) * 100 + "%");
    };
    const reset = () => { tilt.style.transform = ""; };
    document.addEventListener("mousemove", move); stage.addEventListener("touchmove", move, { passive: true });
    stage.addEventListener("mouseleave", reset); stage.addEventListener("touchend", reset);
  }

  /* ---------- albums page ---------- */
  if ($("#albums")) {
    const byAlbum = {};
    T.songs.forEach((s, i) => { (byAlbum[s.album] = byAlbum[s.album] || {})[s.title] = i; });
    $("#albums").innerHTML = [...T.albums].reverse().map(a => `
      <article class="card album-full" id="${a.id}">
        ${coverImg(a)}
        <div><h2>${esc(a.title)} <span class="pill">${a.year}</span></h2>
          <p class="muted">Released ${esc(a.date)}</p><p style="margin-top:8px">${esc(a.blurb)}</p>
          <ol class="tracks">${a.tracks.map(t => {
            const idx = (byAlbum[a.title] || {})[t];
            return idx === undefined ? `<li>${esc(t)}</li>`
              : `<li class="has-video"><button data-song="${idx}" title="Play in the player">${esc(t)}</button></li>`;
          }).join("")}</ol>
          <p class="muted" style="margin-top:10px">Pink numbers play in the <a href="music.html">player</a>.</p>
        </div></article>`).join("");
    $("#albums").addEventListener("click", e => {
      const b = e.target.closest("[data-song]"); if (b) location.href = `music.html#${b.dataset.song}`;
    });
  }

  /* ---------- music player (YouTube IFrame API) ---------- */
  if ($("#yt")) {
    let player, cur = -1, timer, repeat = false, ready = false, wantPlay = false;
    const list = $("#list"), title = $("#now"), seek = $("#seek"), tcur = $("#tcur"), tdur = $("#tdur"), msg = $("#msg");
    const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
    list.innerHTML = T.songs.map((s, i) => `<li data-i="${i}"><button><span class="n">${i + 1}</span>
      <span class="t">${esc(s.title)}<small>${esc(s.album)} · ${esc(s.kind)}</small></span></button></li>`).join("");
    const mark = () => $$("li", list).forEach(li => li.classList.toggle("active", +li.dataset.i === cur));
    function load(i, play = true) {
      cur = (i + T.songs.length) % T.songs.length;
      const s = T.songs[cur];
      msg.classList.remove("show");
      title.textContent = `${s.title} · ${s.album}`;
      mark(); history.replaceState(null, "", "#" + cur);
      document.title = `${s.title} | Tame Impala fan site`;
      if (!ready) { wantPlay = play; return; }
      play ? player.loadVideoById(s.yt) : player.cueVideoById(s.yt);
    }
    window.onYouTubeIframeAPIReady = () => {
      player = new YT.Player("yt", {
        host: "https://www.youtube-nocookie.com",
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: () => { ready = true; const s = T.songs[cur]; wantPlay ? player.loadVideoById(s.yt) : player.cueVideoById(s.yt); },
          onStateChange: e => {
            $("#play").textContent = e.data === 1 ? "❚❚" : "▶";
            $("#play").setAttribute("aria-label", e.data === 1 ? "Pause" : "Play");
            if (e.data === 0) repeat ? player.playVideo() : load(cur + 1);
          },
          onError: () => {
            const s = T.songs[cur];
            msg.innerHTML = `<div><p><b>This video can't be played here.</b></p><p class="muted">The owner may have blocked embedding.</p>
              <p style="margin-top:12px" class="row"><a class="btn small" target="_blank" rel="noopener" href="${ytSearch(s.title)}">Find it on YouTube</a>
              <button class="btn ghost small" id="skip">Next song</button></p></div>`;
            msg.classList.add("show"); $("#skip").onclick = () => load(cur + 1);
          }
        }
      });
      timer = setInterval(() => {
        if (!ready || !player.getDuration) return;
        const d = player.getDuration() || 0, c = player.getCurrentTime() || 0;
        if (d && document.activeElement !== seek) { seek.value = (c / d) * 1000; }
        tcur.textContent = fmt(c); tdur.textContent = fmt(d);
      }, 500);
    };
    const s = document.createElement("script"); s.src = "https://www.youtube.com/iframe_api"; document.head.appendChild(s);
    list.addEventListener("click", e => { const li = e.target.closest("li"); if (li) load(+li.dataset.i); });
    $("#play").onclick = () => {
      if (!ready) return;
      if (cur < 0) return load(0);
      player.getPlayerState() === 1 ? player.pauseVideo() : player.playVideo();
    };
    $("#prev").onclick = () => load(cur - 1);
    $("#next").onclick = () => load(cur + 1);
    $("#repeat").onclick = e => { repeat = !repeat; e.currentTarget.setAttribute("aria-pressed", repeat); };
    seek.addEventListener("input", () => { if (ready) player.seekTo((seek.value / 1000) * player.getDuration(), true); });
    const start = parseInt(location.hash.slice(1), 10);
    load(Number.isInteger(start) && T.songs[start] ? start : 0, false);
  }

  /* ---------- lazy video grids (live + films) ---------- */
  function lazyVideos(target, items, sub) {
    target.innerHTML = items.map((v, i) => `
      <article class="card vcard">
        <div class="video" data-yt="${v.yt}"><img src="${ytThumb(v.yt)}" alt="" loading="lazy">
          <button aria-label="Play ${esc(v.title)}"><span class="play">▶</span></button></div>
        <div class="pad"><h3>${esc(v.title)}${v.length ? `<span class="len">${v.length}</span>` : ""}</h3>
          <p class="muted">${esc(sub(v))}</p></div></article>`).join("");
    target.addEventListener("click", e => {
      const box = e.target.closest(".video"); if (!box) return;
      box.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${box.dataset.yt}?autoplay=1&rel=0" title="YouTube video player"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    });
  }
  if ($("#live")) lazyVideos($("#live"), T.live, v => `${v.where}. ${v.note}`);
  if ($("#films")) lazyVideos($("#films"), T.films, v => v.blurb);

  /* ---------- tours ---------- */
  if ($("#upcoming")) {
    $("#upcoming").innerHTML = T.tours.upcoming.map(t => `<tr><td><b>${esc(t.date)}</b></td><td>${esc(t.city)}</td>
      <td>${esc(t.venue)}</td><td><span class="pill">${esc(t.extra)}</span></td></tr>`).join("");
    $("#past").innerHTML = T.tours.past.map(t => `<article class="card"><div class="pad">
      <span class="pill">${esc(t.year)}</span><h3 style="margin-top:8px">${esc(t.name)}</h3><p class="muted" style="margin-top:6px">${esc(t.text)}</p></div></article>`).join("");
    const first = new Date("2027-05-28T19:00:00+01:00");
    const tick = () => {
      const d = first - Date.now();
      $("#countdown").textContent = d > 0
        ? `${Math.floor(d / 864e5)} days until Manchester (28 May 2027)` : "The 2027 run has started!";
    };
    tick(); setInterval(tick, 60000);
  }
  if ($("#timeline")) $("#timeline").innerHTML = T.timeline.map(([y, t]) => `<li><b>${y}</b><div>${esc(t)}</div></li>`).join("");

  /* ---------- band ---------- */
  if ($("#band")) {
    const g = ["#9b5de5,#5e72e4", "#ff6b6b,#f3a683", "#5e72e4,#2bb3a3", "#f3a683,#9b5de5", "#2bb3a3,#5e72e4", "#ff6b6b,#9b5de5"];
    $("#band").innerHTML = T.band.map((m, i) => `<article class="card member">
      <div class="ph" style="background:linear-gradient(135deg,${g[i % g.length]})" aria-hidden="true">${m.name.split(" ").map(w => w[0]).join("")}</div>
      <div class="pad"><h3>${esc(m.name)}</h3><p class="muted">${esc(m.role)}</p><p style="margin-top:6px">${esc(m.text)}</p></div></article>`).join("");
  }

  /* ---------- demo shop ---------- */
  if ($("#shop")) {
    let cart = {};
    try { cart = JSON.parse(localStorage.getItem("ti-cart") || "{}"); } catch (e) {}
    const save = () => { try { localStorage.setItem("ti-cart", JSON.stringify(cart)); } catch (e) {} };
    $("#shop").innerHTML = T.shop.map(p => `<article class="card item"><div class="swatch" style="background:${p.color}" aria-hidden="true">🛍</div>
      <div class="pad"><h3>${esc(p.name)}</h3><p class="muted">$${p.price}</p>
      <button class="btn small" style="margin-top:10px" data-add="${p.id}">Add to cart</button></div></article>`).join("");
    const render = () => {
      const ids = Object.keys(cart).filter(id => T.shop.find(p => p.id === id));
      const count = ids.reduce((n, id) => n + cart[id], 0);
      const total = ids.reduce((n, id) => n + cart[id] * T.shop.find(p => p.id === id).price, 0);
      $("#cart-count").textContent = count;
      $("#cart-items").innerHTML = ids.length ? ids.map(id => {
        const p = T.shop.find(x => x.id === id);
        return `<li><span>${cart[id]} × ${esc(p.name)}</span><span>$${cart[id] * p.price} <button data-del="${id}" aria-label="Remove ${esc(p.name)}">✕</button></span></li>`;
      }).join("") : "<li>Your cart is empty.</li>";
      $("#cart-total").textContent = `$${total}`;
    };
    document.addEventListener("click", e => {
      const a = e.target.closest("[data-add]"), d = e.target.closest("[data-del]");
      if (a) { cart[a.dataset.add] = (cart[a.dataset.add] || 0) + 1; save(); render(); }
      if (d) { delete cart[d.dataset.del]; save(); render(); }
    });
    $("#cart-btn").onclick = () => { const o = $("#cart-panel").classList.toggle("open"); $("#cart-btn").setAttribute("aria-expanded", o); };
    $("#checkout").onclick = () => { cart = {}; save(); render(); $("#cart-note").textContent = "This is a demo shop, so nothing was bought. Thanks for testing it!"; };
    render();
  }
})();
