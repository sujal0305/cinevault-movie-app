const API_KEY  = "64e3e9a215b5f0db54ef89828253e10d";   
const BASE_URL = "https://api.themoviedb.org/3";
const IMG_URL  = "https://image.tmdb.org/t/p";

// Genre map for filter categories
const GENRE_MAP = { action: 28, comedy: 35, horror: 27, romance: 10749 };

// State
let currentCat  = "popular";
let currentPage = 1;
let currentQuery= "";
let favorites   = JSON.parse(localStorage.getItem("cv_favorites") || "[]");
let heroMovieId = null;

// ── DOM Refs ─────────────────────────────────────────────
const movieGrid   = document.getElementById("movieGrid");
const sectionTitle= document.getElementById("sectionTitle");
const sectionCount= document.getElementById("sectionCount");
const loadMoreBtn = document.getElementById("loadMoreBtn");
const searchInput = document.getElementById("searchInput");
const searchBtn   = document.getElementById("searchBtn");
const modalOverlay= document.getElementById("modalOverlay");
const toast       = document.getElementById("toast");

// ── API Fetch ─────────────────────────────────────────────
async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function buildUrl(endpoint, params = {}) {
  const p = new URLSearchParams({ api_key: API_KEY, language: "en-US", ...params });
  return `${BASE_URL}${endpoint}?${p}`;
}

// ── Movies by category ────────────────────────────────────
async function loadMovies(cat, page = 1, append = false) {
  showSkeletons(append ? 0 : 12);
  let url;
  const catLabels = {
    popular: "🔥 Popular Movies", top_rated: "⭐ Top Rated Movies",
    upcoming: "🎞 Upcoming Movies", now_playing: "🎭 Now Playing",
    action: "💥 Action Movies", comedy: "😂 Comedy Movies",
    horror: "👻 Horror Movies", romance: "💕 Romance Movies"
  };
  sectionTitle.textContent = catLabels[cat] || "Movies";

  if (GENRE_MAP[cat]) {
    url = buildUrl("/discover/movie", { sort_by: "popularity.desc", with_genres: GENRE_MAP[cat], page });
  } else {
    url = buildUrl(`/movie/${cat}`, { page });
  }

  try {
    const data = await fetchJSON(url);
    renderMovies(data.results, append);
    sectionCount.textContent = `${data.total_results?.toLocaleString() || ""} movies`;
    loadMoreBtn.disabled = page >= data.total_pages;
    if (!append && data.results.length > 0) setHero(data.results[0]);
  } catch (e) {
    showToast("⚠ Could not load movies. Check your API key.");
    console.error(e);
  }
}

// ── Search ────────────────────────────────────────────────
async function searchMovies(query, page = 1, append = false) {
  if (!query.trim()) { resetToHome(); return; }
  showSkeletons(append ? 0 : 12);
  currentQuery = query;
  sectionTitle.textContent = `🔍 Results for "${query}"`;
  try {
    const data = await fetchJSON(buildUrl("/search/movie", { query, page }));
    renderMovies(data.results, append);
    sectionCount.textContent = `${data.total_results} results`;
    loadMoreBtn.disabled = page >= data.total_pages;
  } catch (e) { showToast("⚠ Search failed."); }
}

// ── Render grid ───────────────────────────────────────────
function renderMovies(movies, append = false) {
  if (!append) movieGrid.innerHTML = "";

  if (!movies.length) {
    movieGrid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--muted);padding:60px 0;">
      No movies found.</div>`;
    return;
  }

  movies.forEach((m, i) => {
    const card = createCard(m);
    card.style.animationDelay = `${(i % 12) * 0.04}s`;
    movieGrid.appendChild(card);
  });
}

function createCard(m) {
  const isFaved = favorites.some(f => f.id === m.id);
  const poster = m.poster_path
    ? `${IMG_URL}/w342${m.poster_path}`
    : "https://via.placeholder.com/342x513/111118/8a8a9a?text=No+Image";
  const year = m.release_date ? m.release_date.slice(0, 4) : "—";
  const rating = m.vote_average ? m.vote_average.toFixed(1) : "N/A";

  const card = document.createElement("div");
  card.className = "movie-card";
  card.innerHTML = `
    <div class="card-img-wrap">
      <img src="${poster}" alt="${m.title}" loading="lazy"/>
      <span class="card-rating">⭐ ${rating}</span>
      <button class="card-fav-btn ${isFaved ? "faved" : ""}" data-id="${m.id}" title="Favorite">
        ${isFaved ? "❤" : "♡"}
      </button>
      <div class="card-overlay">
        <button class="card-overlay-btn">▶ View Details</button>
      </div>
    </div>
    <div class="card-body">
      <div class="card-title">${m.title}</div>
      <div class="card-year">${year}</div>
    </div>
  `;

  card.querySelector(".card-overlay-btn").addEventListener("click", (e) => {
    e.stopPropagation(); openModal(m.id);
  });
  card.querySelector(".card-img-wrap img").addEventListener("click", () => openModal(m.id));
  card.querySelector(".card-body").addEventListener("click", () => openModal(m.id));

  const favBtn = card.querySelector(".card-fav-btn");
  favBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleFavorite(m, favBtn);
  });

  return card;
}

// ── Hero banner ───────────────────────────────────────────
function setHero(m) {
  heroMovieId = m.id;
  const hero = document.getElementById("hero");
  const bg = m.backdrop_path ? `${IMG_URL}/w1280${m.backdrop_path}` : "";
  if (bg) hero.style.backgroundImage = `url(${bg})`;

  document.getElementById("heroTitle").textContent = m.title;
  document.getElementById("heroDesc").textContent  = m.overview || "No description available.";
  document.getElementById("heroMeta").innerHTML = `
    <span class="rating">⭐ ${m.vote_average?.toFixed(1) || "N/A"}</span>
    <span>📅 ${m.release_date?.slice(0,4) || "—"}</span>
    <span>🗳 ${m.vote_count?.toLocaleString() || "0"} votes</span>
  `;
  document.getElementById("heroWatchBtn").onclick = () => openModal(m.id);
  document.getElementById("heroFavBtn").onclick = () => {
    const isFaved = favorites.some(f => f.id === m.id);
    if (isFaved) { favorites = favorites.filter(f => f.id !== m.id); showToast("Removed from favorites"); }
    else { favorites.push(m); showToast("❤ Added to favorites!"); }
    saveFavorites();
  };
}

// ── Modal ─────────────────────────────────────────────────
async function openModal(id) {
  modalOverlay.classList.add("open");
  document.body.style.overflow = "hidden";

  // Reset
  document.getElementById("modalTitle").textContent    = "Loading…";
  document.getElementById("modalOverview").textContent = "";
  document.getElementById("modalMeta").innerHTML       = "";
  document.getElementById("modalBadges").innerHTML     = "";
  document.getElementById("modalCast").innerHTML       = "";
  document.getElementById("modalPoster").src           = "";
  document.getElementById("modalBackdrop").style.backgroundImage = "";

  try {
    const [movie, credits, videos] = await Promise.all([
      fetchJSON(buildUrl(`/movie/${id}`)),
      fetchJSON(buildUrl(`/movie/${id}/credits`)),
      fetchJSON(buildUrl(`/movie/${id}/videos`)),
    ]);

    // Backdrop
    if (movie.backdrop_path) {
      document.getElementById("modalBackdrop").style.backgroundImage =
        `url(${IMG_URL}/w1280${movie.backdrop_path})`;
    }
    // Poster
    document.getElementById("modalPoster").src = movie.poster_path
      ? `${IMG_URL}/w342${movie.poster_path}`
      : "https://via.placeholder.com/342x513/111118/8a8a9a?text=No+Image";

    // Badges
    const genres = movie.genres?.slice(0, 3).map(g =>
      `<span class="badge">${g.name}</span>`).join("") || "";
    document.getElementById("modalBadges").innerHTML =
      `<span class="badge accent">${movie.status || "Released"}</span>${genres}`;

    // Title
    document.getElementById("modalTitle").textContent = movie.title;

    // Meta
    const runtime = movie.runtime ? `${Math.floor(movie.runtime/60)}h ${movie.runtime%60}m` : "—";
    document.getElementById("modalMeta").innerHTML = `
      <span class="gold">⭐ ${movie.vote_average?.toFixed(1) || "N/A"}</span>
      <span>📅 ${movie.release_date?.slice(0,4) || "—"}</span>
      <span>⏱ ${runtime}</span>
      <span>🗳 ${movie.vote_count?.toLocaleString() || "0"} votes</span>
      ${movie.budget > 0 ? `<span>💰 $${(movie.budget/1e6).toFixed(0)}M budget</span>` : ""}
    `;

    // Overview
    document.getElementById("modalOverview").textContent =
      movie.overview || "No overview available.";

    // Trailer
    const trailer = videos.results?.find(v => v.type === "Trailer" && v.site === "YouTube");
    document.getElementById("modalTrailerBtn").onclick = () => {
      if (trailer) window.open(`https://www.youtube.com/watch?v=${trailer.key}`, "_blank");
      else showToast("No trailer available");
    };

    // Fav button
    const isFaved = favorites.some(f => f.id === id);
    const modalFavBtn = document.getElementById("modalFavBtn");
    modalFavBtn.textContent = isFaved ? "❤ In Favorites" : "+ Add to Favorites";
    modalFavBtn.onclick = () => {
      const already = favorites.some(f => f.id === id);
      if (already) {
        favorites = favorites.filter(f => f.id !== id);
        modalFavBtn.textContent = "+ Add to Favorites";
        showToast("Removed from favorites");
      } else {
        favorites.push(movie);
        modalFavBtn.textContent = "❤ In Favorites";
        showToast("❤ Added to favorites!");
      }
      saveFavorites();
    };

    // Cast
    const cast = credits.cast?.slice(0, 10) || [];
    if (cast.length) {
      document.getElementById("modalCast").innerHTML = `
        <h4>Top Cast</h4>
        <div class="cast-list">
          ${cast.map(c => `
            <div class="cast-item">
              <img src="${c.profile_path ? IMG_URL+"/w92"+c.profile_path : "https://via.placeholder.com/56x56/1a1a26/8a8a9a?text=?"}"
                   alt="${c.name}" onerror="this.src='https://via.placeholder.com/56x56/1a1a26/8a8a9a?text=?'"/>
              <div class="cast-name">${c.name}</div>
              <div class="cast-char">${c.character?.split("/")[0] || ""}</div>
            </div>
          `).join("")}
        </div>
      `;
    }
  } catch(e) {
    document.getElementById("modalTitle").textContent = "Failed to load movie.";
    console.error(e);
  }
}

// Close modal
document.getElementById("modalClose").addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e) => { if (e.target === modalOverlay) closeModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

function closeModal() {
  modalOverlay.classList.remove("open");
  document.body.style.overflow = "";
}

// ── Favorites view ────────────────────────────────────────
function showFavorites() {
  sectionTitle.textContent = "❤ My Favorites";
  sectionCount.textContent = `${favorites.length} saved`;
  loadMoreBtn.style.display = "none";
  if (!favorites.length) {
    movieGrid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--muted);padding:60px 0;">
      No favorites yet. Click ♡ on any movie!</div>`;
    return;
  }
  renderMovies(favorites);
}

// ── Skeletons ─────────────────────────────────────────────
function showSkeletons(count) {
  if (!count) return;
  movieGrid.innerHTML = Array(count).fill("")
    .map(() => `<div class="skeleton skeleton-card"></div>`).join("");
}

// ── Toast ─────────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2500);
}

// ── Favorites persistence ─────────────────────────────────
function saveFavorites() { localStorage.setItem("cv_favorites", JSON.stringify(favorites)); }
function toggleFavorite(m, btn) {
  const idx = favorites.findIndex(f => f.id === m.id);
  if (idx > -1) { favorites.splice(idx, 1); btn.innerHTML = "♡"; btn.classList.remove("faved"); showToast("Removed from favorites"); }
  else { favorites.push(m); btn.innerHTML = "❤"; btn.classList.add("faved"); showToast("❤ Added!"); }
  saveFavorites();
}

// ── Event Listeners ───────────────────────────────────────
function resetToHome() {
  currentQuery = "";
  currentPage  = 1;
  loadMoreBtn.style.display = "";
  loadMovies(currentCat, 1);
}

document.querySelectorAll(".cat-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".cat-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentCat  = btn.dataset.cat;
    currentPage = 1;
    currentQuery= "";
    searchInput.value = "";
    loadMovies(currentCat, 1);
    loadMoreBtn.style.display = "";
  });
});

searchBtn.addEventListener("click", () => {
  currentPage = 1;
  searchMovies(searchInput.value.trim());
  loadMoreBtn.style.display = "";
});
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { currentPage = 1; searchMovies(searchInput.value.trim()); loadMoreBtn.style.display = ""; }
  if (!searchInput.value && e.key === "Backspace") resetToHome();
});

loadMoreBtn.addEventListener("click", () => {
  currentPage++;
  if (currentQuery) searchMovies(currentQuery, currentPage, true);
  else loadMovies(currentCat, currentPage, true);
});

document.querySelectorAll(".nav-link").forEach(link => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));
    link.classList.add("active");
    if (link.dataset.section === "favorites") showFavorites();
    else resetToHome();
  });
});

// ── Init ──────────────────────────────────────────────────
loadMovies("popular", 1);