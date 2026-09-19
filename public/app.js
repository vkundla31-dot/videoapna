
/* VIDEOAPNA SAFE 6-BUTTON NAVIGATION */
window.addEventListener("DOMContentLoaded", function () {

  const nav = document.querySelector(".bottom-nav");
  if (!nav) return;

  const uploadModal = document.getElementById("uploadModal");

  function closeUpload() {
    if (!uploadModal) return;

    uploadModal.classList.add("hidden");
    uploadModal.style.display = "none";
  }

  function openUpload() {
    if (!uploadModal) return;

    uploadModal.classList.remove("hidden");
    uploadModal.style.display = "";
  }

  /* Upload modal शुरू में हमेशा बंद */
  closeUpload();

  /* Upload में Back button */
  if (uploadModal && !document.getElementById("videoApnaUploadBack")) {

    const back = document.createElement("button");

    back.id = "videoApnaUploadBack";
    back.type = "button";
    back.textContent = "← वापस";

    back.style.display = "block";
    back.style.margin = "0 0 12px 0";
    back.style.padding = "10px 16px";
    back.style.border = "0";
    back.style.borderRadius = "10px";
    back.style.background = "#222";
    back.style.color = "#fff";
    back.style.fontSize = "16px";

    back.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      closeUpload();
    });

    const firstChild = uploadModal.firstElementChild;

    if (firstChild) {
      firstChild.insertBefore(back, firstChild.firstChild);
    } else {
      uploadModal.appendChild(back);
    }
  }

  /*
    Capture phase:
    पुराने bottom-nav click handlers तक event पहुँचने से पहले
    हम सही button पहचानेंगे।
  */
  nav.addEventListener("click", function (event) {

    const btn = event.target.closest(".bottom-item");

    if (!btn || !nav.contains(btn)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const buttons = nav.querySelectorAll(".bottom-item");

    buttons.forEach(function (b) {
      b.classList.remove("active");
    });

    btn.classList.add("active");

    const homeBtn = nav.querySelector(".bottom-item:nth-child(1)");
    const trendingBtn = document.getElementById("bottomTrending");
    const shortsBtn = document.getElementById("bottomShorts");
    const uploadBtn = document.getElementById("bottomUpload");
    const likedBtn = document.getElementById("bottomLiked");
    const profileBtn = document.getElementById("bottomProfile");

    /* HOME */
    if (btn === homeBtn) {

      closeUpload();

      document.body.classList.remove("shorts-mode");

      const shortsFeed = document.getElementById("shortsFeed");
      if (shortsFeed) shortsFeed.remove();

      if (typeof shortsOpen !== "undefined") {
        shortsOpen = false;
      }

      const videoList = document.getElementById("videoList");
      const hero = document.querySelector(".hero");
      const title = document.querySelector(".section-title");

      if (videoList) {
        videoList.classList.remove("hidden");
        videoList.style.display = "";
      }

      if (hero) hero.style.display = "";

      if (title) {
        title.style.display = "";
        title.textContent = "वीडियो देखें";
      }

      window.scrollTo(0, 0);
      return;
    }

    /* TRENDING */
    if (btn === trendingBtn) {

      closeUpload();

      if (typeof window.openTrending === "function") {
        window.openTrending();
      }

      return;
    }

    /* SHORTS */
    if (btn === shortsBtn) {

      closeUpload();

      /*
       * एक ही Shorts loading को allow करें।
       * Duplicate click/listener से start=0 loop रोकें।
       */
      if (window.__videoApnaShortsOpening) {
        console.log("⛔ VIDEOAPNA SHORTS duplicate open blocked");
        return;
      }

      window.__videoApnaShortsOpening = true;

      /* Home की Long Video screen छिपाएँ */
      const videoList = document.getElementById("videoList");
      const hero = document.querySelector(".hero");
      const title = document.querySelector(".section-title");

      if (videoList) {
        videoList.classList.add("hidden");
        videoList.style.display = "none";
      }

      if (hero) {
        hero.style.display = "none";
      }

      if (title) {
        title.style.display = "none";
      }

      /* Shorts mode तुरंत ON */
      document.body.classList.add("shorts-mode");

      /* Shorts feed पहले से नहीं है तो बनाएँ */
      if (typeof window.videoApnaLoadShorts === "function") {
        Promise.resolve(window.videoApnaLoadShorts())
          .finally(function () {
            window.__videoApnaShortsOpening = false;
          });
      } else {
        window.__videoApnaShortsOpening = false;
      }

      return;
    }

    /* UPLOAD */
    if (btn === uploadBtn) {

      openUpload();
      return;
    }

    /* LIKED */
    if (btn === likedBtn) {

      closeUpload();

      if (typeof likedBtn.click === "function" &&
          likedBtn !== btn) {
        likedBtn.click();
      }

      return;
    }

    /* PROFILE */
    if (btn === profileBtn) {

      closeUpload();

      if (typeof window.openProfile === "function") {
        window.openProfile();
      }

      return;
    }

  }, true);

});



/* =========================================
   VIDEOAPNA PEERTUBE HOME
========================================= */


/* =========================================
   VIDEOAPNA PROFILE OPEN — SAFE
========================================= */

window.openProfile = async function () {
  const profile = document.getElementById("profileSection");
  const liked = document.getElementById("liked");
  const videoList = document.getElementById("videoList");
  const hero = document.querySelector(".hero");
  const title = document.querySelector(".section-title");

  if (!profile) {
    console.error("PROFILE: profileSection नहीं मिला");
    return;
  }

  if (videoList) {
    videoList.classList.add("hidden");
    videoList.style.display = "none";
  }

  if (liked) {
    liked.classList.add("hidden");
    liked.style.display = "none";
  }

  if (hero) {
    hero.style.display = "none";
  }

  if (title) {
    title.style.display = "none";
  }

  profile.classList.remove("hidden");
  profile.style.display = "block";
  profile.style.visibility = "visible";
  profile.style.opacity = "1";

  window.scrollTo(0, 0);

  const list = document.getElementById("myVideoList");
  const empty = document.getElementById("myVideoEmpty");
  const count = document.getElementById("profileVideoCount");
  const views = document.getElementById("profileViews");
  const likes = document.getElementById("profileLikes");

  if (!list) {
    console.error("PROFILE: myVideoList नहीं मिला");
    return;
  }

  try {
    const response = await fetch(
      "/api/videos?userId=" +
      "my-account"
    );

    if (!response.ok) {
      throw new Error("Profile videos API failed");
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("Invalid profile video data");
    }

    list.innerHTML = "";

    let totalViews = 0;
    let totalLikes = 0;

    data.forEach(function (video) {
      totalViews += Number(video.viewCount || 0);
      totalLikes += Number(video.likes || 0);

      const card = document.createElement("article");
      card.className = "video-card";

      card.innerHTML = `
        <div class="thumbnail">
          <video
            src="${video.url || ""}"
            muted
            playsinline
            preload="metadata">
          </video>
          <button class="play-btn" type="button">▶</button>
        </div>

        <div class="video-info">
          <div class="video-title">
            ${video.title || "बिना नाम का वीडियो"}
          </div>

          <div class="video-meta">
            ${Number(video.viewCount || 0)} views
            • ${Number(video.likes || 0)} ❤️
            • ${video.category || "मनोरंजन"}
          </div>

          <button
            type="button"
            class="profile-delete-btn">
            🗑️ वीडियो Delete करें
          </button>
        </div>
      `;

      const deleteBtn =
        card.querySelector(".profile-delete-btn");

      if (deleteBtn) {
        deleteBtn.addEventListener(
          "click",
          async function (event) {
            event.preventDefault();
            event.stopPropagation();

            const ok = confirm(
              "क्या आप यह वीडियो Delete करना चाहते हैं?\n\n" +
              (video.title || "यह वीडियो")
            );

            if (!ok) return;

            try {
              deleteBtn.disabled = true;
              deleteBtn.textContent = "⏳ Delete हो रहा है...";

              const response = await fetch(
                "/api/videos/" + video.id,
                {
                  method: "DELETE",
                  headers: {
                    "Content-Type": "application/json"
                  },
                  body: JSON.stringify({
                    /* userId अब session से server पर तय होगा */
                  })
                }
              );

              const result =
                await response.json();

              if (
                !response.ok ||
                !result.success
              ) {
                throw new Error(
                  result.message ||
                  "Delete failed"
                );
              }

              card.remove();

              if (count) {
                count.textContent =
                  Math.max(
                    0,
                    Number(count.textContent || 0) - 1
                  );
              }

              alert("🗑️ वीडियो Delete हो गया!");

              console.log(
                "✅ PROFILE VIDEO DELETED:",
                video.id
              );

            } catch (error) {
              console.error(
                "PROFILE DELETE ERROR:",
                error
              );

              deleteBtn.disabled = false;
              deleteBtn.textContent =
                "🗑️ वीडियो Delete करें";

              alert(
                "वीडियो Delete नहीं हो पाया।"
              );
            }
          }
        );
      }

      card.addEventListener("click", function () {
        if (typeof openWatchingPage === "function") {
          openWatchingPage(video);
        }
      });

      list.appendChild(card);
    });

    if (count) {
      count.textContent = data.length;
    }

    if (views) {
      views.textContent = totalViews;
    }

    if (likes) {
      likes.textContent = totalLikes;
    }

    if (!data.length) {
      if (empty) {
        empty.classList.remove("hidden");
        empty.textContent =
          "अभी कोई वीडियो upload नहीं किया है।";
      }
    } else {
      if (empty) {
        empty.classList.add("hidden");
      }
    }

    console.log(
      "✅ PROFILE OPEN:",
      data.length,
      "अपने videos मिले"
    );

  } catch (error) {
    console.error("PROFILE LOAD ERROR:", error);

    if (empty) {
      empty.classList.remove("hidden");
      empty.textContent =
        "प्रोफाइल वीडियो लोड नहीं हो पाए।";
    }
  }
};

const videos = [];

const list = document.getElementById("videoList");
const searchInput = document.getElementById("searchInput");
const resultCount = document.getElementById("resultCount");
const noResults = document.getElementById("noResults");
const categoryButtons = document.querySelectorAll(".category");

let selectedCategory = "सभी";
let peerTubeVideos = [];
let odyseeVideos = [];
let currentLongHomeVideos = [];
let peerTubeSearchTimer = null;
let peerTubeRequestId = 0;

/* =========================================
   VIDEOAPNA ANONYMOUS RECOMMENDATION USER
========================================= */

function getVideoApnaUserId() {

  const KEY =
    "videoapna_recommendation_user_id";

  try {

    let userId =
      localStorage.getItem(KEY);

    if (!userId) {

      userId =
        "va-" +
        Date.now().toString(36) +
        "-" +
        Math.random()
          .toString(36)
          .slice(2, 12);

      localStorage.setItem(
        KEY,
        userId
      );

    }

    return userId;

  } catch (error) {

    console.error(
      "VIDEOAPNA USER ID ERROR:",
      error
    );

    return "va-temporary-" +
      Math.random()
        .toString(36)
        .slice(2);
  }
}

const VIDEOAPNA_USER_ID =
  getVideoApnaUserId();

console.log(
  "VIDEOAPNA recommendation user:",
  VIDEOAPNA_USER_ID
);


function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatViews(value) {
  const n = Number(value || 0);

  if (!n) return "0 views";
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M views";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K views";

  return n + " views";
}

function normalizePeerTubeVideo(video) {
  return {
    id: "pt-" + String(video.id || video.uuid || Math.random()),
    peerTubeId: video.id,
    uuid: video.uuid || "",
    title: video.title || "PeerTube Video",
    description: video.description || "",
    channel:
      video.channelTitle ||
      video.channel ||
      "PeerTube",
    thumbnail:
      video.thumbnail ||
      "https://dummyimage.com/640x360/111/fff.png&text=VideoApna",
    url: video.videoUrl || "",
    embedUrl: video.embedUrl || "",
    views: formatViews(video.views || video.viewCount || 0),
    viewCount: Number(video.views || video.viewCount || 0),
    likes: Number(video.likes || 0),
    category: video.category || "मनोरंजन",
    language: video.language || "",
    duration: Number(video.duration || 0),
    aspectRatio: video.aspectRatio || null,
    publishedAt: video.publishedAt || "",
    sourceHost: video.sourceHost || "",
    source: "peertube"
  };
}

let peerTubeHomeStart = 0;
let peerTubeHomeLoading = false;
let peerTubeHomeFinished = false;
let peerTubeHomeQuery = "videos";

let odyseeHomeStart = 0;
let odyseeHomeLoading = false;
let odyseeHomeFinished = false;
let odyseeHomeQuery = "hindi bhajan";

function getVideoApnaPublicVideos(query = "") {
  const text = String(query || "").trim().toLowerCase();

  return videos
    .filter(video => {
      const visibility =
        String(video.visibility || "public").toLowerCase();

      return visibility !== "private";
    })
    .filter(video => {
      if (!text || text === "videos" || text === "सभी") {
        return true;
      }

      const haystack = [
        video.title,
        video.description,
        video.channel,
        video.category,
        video.language,
        video.fileName
      ]
        .map(value => String(value || "").toLowerCase())
        .join(" ");

      return haystack.includes(text);
    })
    .map(normalizeVideoApnaVideo);
}

let longOwnVideos = [];
let longOwnIndex = 0;
let longBatchSize = 50;

async function loadPeerTubeHome(query = "videos", append = false) {
  if (peerTubeHomeLoading) return;

  const BATCH_SIZE = 50;

  if (!append) {
    peerTubeHomeStart = 0;
    peerTubeHomeFinished = false;
    peerTubeHomeQuery = query;

    peerTubeVideos = [];

    odyseeHomeStart = 0;
    odyseeHomeFinished = false;
    odyseeHomeQuery = "hindi bhajan";
    odyseeVideos = [];

    longOwnVideos = getVideoApnaPublicVideos(query);
    longOwnIndex = 0;
    longBatchSize = BATCH_SIZE;
  }

  peerTubeHomeLoading = true;

  const requestId = ++peerTubeRequestId;

  try {
    resultCount.textContent = append
      ? "⏳ अगले 50 वीडियो लोड हो रहे हैं..."
      : "⏳ पहले 50 वीडियो लोड हो रहे हैं...";

    noResults.classList.add("hidden");

    /*
     * ==========================================================
     * VIDEOAPNA LONG — UNIFIED 50 BATCH
     * ==========================================================
     *
     * हर request में अधिकतम 50 नए videos जोड़ेंगे।
     *
     * Order:
     * 1. अपने VideoApna videos
     * 2. Odysee Long (>90 sec)
     * 3. PeerTube Long (>90 sec)
     *
     * 50 कोई maximum नहीं है।
     * 50 के बाद अगला 50, फिर अगला 50...
     */

    const batchStartCount = [
      ...longOwnVideos.slice(longOwnIndex),
      ...odyseeVideos,
      ...peerTubeVideos
    ].length;

    let addedThisBatch = 0;

    /*
     * ==========================================================
     * 1. VIDEOAPNA OWN VIDEOS
     * ==========================================================
     *
     * अपने videos की duration पर कोई सीमा नहीं।
     * VCDN/native/local playable VideoApna videos allowed.
     */

    while (
      longOwnIndex < longOwnVideos.length &&
      addedThisBatch < BATCH_SIZE
    ) {
      const video = longOwnVideos[longOwnIndex++];
      const key = String(
        video.id ||
        video.vcdnVideoId ||
        video.url ||
        video.title ||
        ""
      );

      const exists = [...odyseeVideos, ...peerTubeVideos].some(
        item =>
          String(
            item.id ||
            item.vcdnVideoId ||
            item.url ||
            item.title ||
            ""
          ) === key
      );

      if (!exists) {
        peerTubeVideos.push({
          ...video,
          source: "videoapna"
        });

        addedThisBatch++;
      }
    }

    /*
     * अगर अपने videos से 50 पूरे हो गये,
     * तो इस request में external source की जरूरत नहीं।
     */

    /*
     * ==========================================================
     * 2. ODYSEE LONG
     * ==========================================================
     *
     * केवल >90 seconds.
     * Odysee pages में Shorts भी आते हैं, इसलिए खाली Long मिलने पर
     * अगला page लगातार माँगा जाएगा।
     */

    const queryText = String(query || "").trim();
    const explicitEnglish =
      /\benglish\b/i.test(queryText) ||
      /अंग्रेजी|इंग्लिश/.test(queryText);

    const isHomeFeed =
      queryText.toLowerCase() === "videos";

    const hindiIntent = !explicitEnglish;

    const odyseeQuery = isHomeFeed
      ? "hindi bhajan"
      : queryText;

    while (
      addedThisBatch < BATCH_SIZE &&
      hindiIntent &&
      !odyseeHomeFinished
    ) {
      const apiPath =
        "/api/odysee-search?q=" +
        encodeURIComponent(odyseeQuery) +
        "&start=" +
        odyseeHomeStart;

      const response = await fetch(apiPath);
      const data = await response.json();

      if (requestId !== peerTubeRequestId) return;

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Odysee search failed"
        );
      }

      const incoming =
        Array.isArray(data.videos)
          ? data.videos
          : [];

      /*
       * सचमुच खाली response = Odysee खत्म।
       */
      if (!incoming.length) {
        odyseeHomeFinished = true;
        break;
      }

      const normalized = incoming
        .map(video => ({
          ...video,
          source: "odysee",
          id:
            video.id ||
            ("odysee-" +
              String(
                video.odyseeId ||
                video.claim_id ||
                Math.random()
              ))
        }))
        .filter(video => {
          const duration =
            Number(video.duration || 0);

          return (
            !!video.embedUrl &&
            duration > 90
          );
        });

      const existingIds = new Set(
        [
          ...odyseeVideos,
          ...peerTubeVideos
        ].map(video =>
          String(
            video.odyseeId ||
            video.id ||
            video.embedUrl ||
            video.url ||
            ""
          )
        )
      );

      for (const video of normalized) {
        if (addedThisBatch >= BATCH_SIZE) break;

        const key = String(
          video.odyseeId ||
          video.id ||
          video.embedUrl ||
          video.url ||
          ""
        );

        if (!existingIds.has(key)) {
          existingIds.add(key);
          odyseeVideos.push(video);
          addedThisBatch++;
        }
      }

      /*
       * अगला Odysee page.
       * Incoming page size के हिसाब से आगे बढ़ेंगे।
       */
      odyseeHomeStart += Math.max(
        incoming.length,
        20
      );

      /*
       * अगर page में केवल Shorts थे तो loop अगला page लेगा।
       */
    }

    /*
     * ==========================================================
     * 3. PEERTUBE LONG
     * ==========================================================
     *
     * केवल >90 seconds.
     */

    while (
      addedThisBatch < BATCH_SIZE &&
      !hindiIntent &&
      !peerTubeHomeFinished
    ) {
      const apiPath =
        "/api/peertube-search?q=" +
        encodeURIComponent(queryText) +
        "&start=" +
        peerTubeHomeStart;

      const response = await fetch(apiPath);
      const data = await response.json();

      if (requestId !== peerTubeRequestId) return;

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "PeerTube search failed"
        );
      }

      const incoming =
        Array.isArray(data.videos)
          ? data.videos
          : [];

      if (!incoming.length) {
        peerTubeHomeFinished = true;
        break;
      }

      const normalized = incoming
        .map(video =>
          normalizePeerTubeVideo(video)
        )
        .filter(video => {
          const duration =
            Number(video.duration || 0);

          return (
            duration > 90 &&
            !!video.url
          );
        });

      const existingIds = new Set(
        [
          ...peerTubeVideos,
          ...odyseeVideos
        ].map(video =>
          String(
            video.uuid ||
            video.id ||
            video.url ||
            ""
          )
        )
      );

      for (const video of normalized) {
        if (addedThisBatch >= BATCH_SIZE) break;

        const key = String(
          video.uuid ||
          video.id ||
          video.url ||
          ""
        );

        if (!existingIds.has(key)) {
          existingIds.add(key);
          peerTubeVideos.push(video);
          addedThisBatch++;
        }
      }

      peerTubeHomeStart += Math.max(
        incoming.length,
        20
      );

      const total =
        Number(data.total || 0);

      if (
        total > 0 &&
        peerTubeHomeStart >= total
      ) {
        peerTubeHomeFinished = true;
      }
    }

    /*
     * ==========================================================
     * FINAL MERGE
     * ==========================================================
     *
     * VideoApna हमेशा सबसे पहले।
     * उसके बाद Odysee।
     * फिर PeerTube।
     */

    const combined = [
      ...peerTubeVideos.filter(
        video =>
          String(video.source || "").toLowerCase() ===
          "videoapna"
      ),
      ...odyseeVideos,
      ...peerTubeVideos.filter(
        video =>
          String(video.source || "").toLowerCase() !==
          "videoapna"
      )
    ];

    /*
     * Duplicate protection.
     */
    const uniqueMap = new Map();

    for (const video of combined) {
      const key = String(
        (video.source || "video") +
        ":" +
        (
          video.vcdnVideoId ||
          video.uuid ||
          video.odyseeId ||
          video.id ||
          video.url ||
          video.title ||
          ""
        )
      );

      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, video);
      }
    }

    let normalized =
      Array.from(uniqueMap.values());

    /*
     * Recommendation केवल existing videos का order बदल सकती है।
     * कोई video remove नहीं होगा।
     */
    if (
      normalized.length > 0 &&
      typeof VIDEOAPNA_USER_ID === "string" &&
      VIDEOAPNA_USER_ID
    ) {
      try {
        const recommendationResponse =
          await fetch(
            "/api/recommendation/feed",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json"
              },
              body: JSON.stringify({
                userId:
                  VIDEOAPNA_USER_ID,
                videos:
                  normalized.map(video => ({
                    id: video.id,
                    uuid:
                      video.uuid || "",
                    title:
                      video.title,
                    language:
                      video.language,
                    category:
                      video.category,
                    createdAt:
                      video.createdAt || "",
                    publishedAt:
                      video.publishedAt || ""
                  }))
              })
            }
          );

        const recommendationData =
          await recommendationResponse.json();

        if (
          recommendationResponse.ok &&
          recommendationData.success &&
          Array.isArray(
            recommendationData.videos
          )
        ) {
          const order =
            recommendationData.videos
              .map(video =>
                String(
                  video.uuid ||
                  video.id ||
                  ""
                )
              )
              .filter(Boolean);

          const videoMap =
            new Map(
              normalized.map(video => [
                String(
                  video.uuid ||
                  video.id ||
                  ""
                ),
                video
              ])
            );

          const rankedVideos = [];

          for (const key of order) {
            const video =
              videoMap.get(key);

            if (video) {
              rankedVideos.push(video);
              videoMap.delete(key);
            }
          }

          for (const video of videoMap.values()) {
            rankedVideos.push(video);
          }

          if (
            rankedVideos.length ===
            normalized.length
          ) {
            normalized =
              rankedVideos;
          }
        }
      } catch (recommendationError) {
        console.warn(
          "⚠️ Recommendation connection failed; original order kept:",
          recommendationError.message
        );
      }
    }

    /*
     * ==========================================================
     * RESULT
     * ==========================================================
     */

    if (!normalized.length) {
      list.innerHTML = "";
      resultCount.textContent =
        "कोई Long वीडियो नहीं मिला";
      noResults.classList.remove("hidden");
      return;
    }

    showPeerTubeVideos(normalized);

    resultCount.textContent =
      "Long वीडियो: " +
      normalized.length;

    console.log(
      "✅ VIDEOAPNA LONG BATCH:",
      addedThisBatch,
      "| Total:",
      normalized.length,
      "| Own:",
      longOwnIndex,
      "/",
      longOwnVideos.length,
      "| Odysee:",
      odyseeVideos.length,
      "| PeerTube:",
      peerTubeVideos.filter(
        video =>
          String(video.source || "").toLowerCase() ===
          "peertube"
      ).length
    );

  } catch (error) {
    console.error(
      "VIDEOAPNA HOME ERROR:",
      error
    );

    if (
      requestId !== peerTubeRequestId
    ) {
      return;
    }

    const ownVideos =
      getVideoApnaPublicVideos(query);

    if (ownVideos.length > 0) {
      showPeerTubeVideos(
        ownVideos
      );

      resultCount.textContent =
        "VideoApna वीडियो: " +
        ownVideos.length;
    } else {
      list.innerHTML = "";
      resultCount.textContent =
        "वीडियो लोड नहीं हो पाए";
      noResults.classList.remove(
        "hidden"
      );
    }

  } finally {
    peerTubeHomeLoading = false;
  }
}

function loadMorePeerTubeHome() {
  if (
    peerTubeHomeQuery === "videos" &&
    !peerTubeHomeLoading
  ) {
    const ownFinished =
      longOwnIndex >=
      longOwnVideos.length;

    const externalFinished =
      odyseeHomeFinished &&
      peerTubeHomeFinished;

    if (
      !ownFinished ||
      !externalFinished
    ) {
      console.log(
        "⏳ VIDEOAPNA LONG: अगला 50 batch लोड हो रहा है..."
      );

      loadPeerTubeHome(
        peerTubeHomeQuery,
        true
      );
    }
  }
}

// PEERTUBE HOME INFINITE SCROLL
let peerTubeScrollTimer = null;



window.addEventListener("scroll", () => {

  if (peerTubeScrollTimer) return;

  peerTubeScrollTimer = setTimeout(() => {

    peerTubeScrollTimer = null;

    const nearBottom =
      window.innerHeight +
      window.scrollY >=
      document.documentElement.scrollHeight - 3000;

    if (nearBottom) {
      loadMorePeerTubeHome();
    }

  }, 150);

}, { passive: true });


async function reportVideo(video) {
  if (!video) return;

  const reason = prompt(
    "🚩 इस वीडियो को Report करने का कारण लिखें:\n\n" +
    "• Copyright — मेरा वीडियो/कंटेंट है\n" +
    "• चोरी का वीडियो\n" +
    "• बिना अनुमति इस्तेमाल\n" +
    "• अन्य समस्या\n\n" +
    "अपना कारण लिखें:"
  );

  if (!reason || !reason.trim()) return;

  const details = prompt(
    "अतिरिक्त जानकारी लिखें (optional):"
  );

  try {
    const response = await fetch(
      "/api/video-reports",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          videoId: String(
            video.id ||
            video.uuid ||
            ""
          ),
          videoTitle: String(
            video.title ||
            ""
          ),
          source: String(
            video.source ||
            video.sourceHost ||
            "peertube"
          ),
          userId: String(
            VIDEOAPNA_USER_ID || ""
          ),
          reason: String(reason).trim(),
          details: details
            ? String(details).trim()
            : ""
        })
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Report failed"
      );
    }

    alert(
      "🚩 Report भेज दी गई है।\n\n" +
      "Owner इसकी समीक्षा करेगा।"
    );

    console.log(
      "✅ VIDEO REPORT SENT:",
      video.id
    );

  } catch (error) {
    console.error(
      "VIDEO REPORT ERROR:",
      error
    );

    alert(
      "❌ Report भेजी नहीं जा सकी।\n\n" +
      (error.message || "")
    );
  }
}

function normalizeVideoApnaVideo(video) {
  return {
    ...video,
    id: "va-" + String(video.id || ""),
    source: "videoapna",
    title: video.title || "VideoApna Video",
    description: video.description || "",
    channel: video.channel || "VideoApna",
    thumbnail:
      video.thumbnail ||
      "https://dummyimage.com/640x360/111/fff.png&text=VideoApna",
    url: video.url || "",
    embedUrl: "",
    views: video.views || "0 views",
    viewCount: Number(video.viewCount || 0),
    likes: Number(video.likes || 0),
    category: video.category || "मनोरंजन",
    language: video.language || "",
    duration: Number(video.duration || 0)
  };
}

function showPeerTubeVideos(items) {
  // Home में अभी जो exact Long list दिखाई जा रही है,
  // वही Watching Page के नीचे दिखाई जाएगी।
  currentLongHomeVideos = Array.isArray(items)
    ? items.slice()
    : [];

  list.innerHTML = "";

  resultCount.textContent =
    `${items.length} वीडियो`;

  if (!items.length) {
    noResults.classList.remove("hidden");
    return;
  }

  noResults.classList.add("hidden");

  items.forEach(video => {
    const card =
      document.createElement("article");

    const isPeerTube =
      String(video.source || "").toLowerCase() ===
        "peertube" ||
      !!video.peerTubeId ||
      !!video.uuid;

    card.className =
      "video-card " +
      (
        isPeerTube
          ? "peertube-result-card"
          : "videoapna-result-card"
      );

    card.innerHTML = `
      <div class="thumbnail">
        <img
          src="${escapeHtml(
            video.thumbnail ||
            "https://dummyimage.com/640x360/111/fff.png&text=VideoApna"
          )}"
          alt="${escapeHtml(video.title)}"
          loading="lazy">

        <button
          class="play-btn"
          aria-label="Play"
          type="button">
          ▶
        </button>
      </div>

      <div class="video-info">

        <div class="video-title">
          ${escapeHtml(video.title)}
        </div>

        <div class="video-meta">
          ${escapeHtml(
            video.channel || "VideoApna"
          )}
        </div>

        <div class="video-meta">
          ${escapeHtml(
            video.views || "0 views"
          )}
          •
          ${
            isPeerTube
              ? "PeerTube"
              : "VideoApna"
          }
        </div>

        <button
          class="card-like-btn"
          data-video-id="${escapeHtml(video.id)}"
          type="button">
          ❤️ ${video.likes || 0}
        </button>

        <button
          class="card-report-btn"
          type="button"
          aria-label="Report video">
          🚩 Report
        </button>

      </div>
    `;

    card.addEventListener(
      "click",
      event => {

        if (
          event.target.closest(
            ".card-like-btn"
          )
        ) {
          return;
        }

        const reportBtn =
          event.target.closest(
            ".card-report-btn"
          );

        if (reportBtn) {
          event.preventDefault();
          event.stopPropagation();

          reportVideo(video);
          return;
        }

        const source =
          String(
            video.source || ""
          ).toLowerCase();

        if (source === "videoapna") {
          openVideoApnaWatchingPage(
            video
          );
        } else if (source === "odysee") {
          openOdyseeWatchingPage(
            video
          );
        } else {
          openPeerTubeWatchingPage(
            video
          );
        }
      }
    );

    list.appendChild(card);
  });
}

function searchPeerTube(query) {
  const text =
    String(query || "").trim();

  clearTimeout(
    peerTubeSearchTimer
  );

  if (!text) {
    loadPeerTubeHome("videos");
    return;
  }

  peerTubeSearchTimer =
    setTimeout(() => {
      loadPeerTubeHome(text);
    }, 500);
}

function filterVideos() {
  const query =
    searchInput.value.trim();

  if (!query) {
    if (
      selectedCategory === "सभी"
    ) {
      loadPeerTubeHome("videos");
      return;
    }

    loadPeerTubeHome(
      selectedCategory
    );

    return;
  }

  searchPeerTube(query);
}

/* =========================================
   VIDEOAPNA PEERTUBE WATCH TRACKER
========================================= */

function startPeerTubeWatchTracking(video, page, iframe) {

  console.log(
    "🎬 VIDEOAPNA TRACKER START:",
    video.title
  );

  let watchedSeconds = 0;
  let lastTick = Date.now();
  let isPlaying = false;
  let ended = false;
  let sent = false;
  let liked = false;
  let saved = false;

  let duration =
    Number(video.duration || 0);

  function addWatchedTime() {

    const now = Date.now();

    const delta =
      (now - lastTick) / 1000;

    lastTick = now;

    if (
      document.hidden ||
      !document.body.contains(page)
    ) {
      return;
    }

    if (
      delta > 0 &&
      delta <= 5
    ) {
      watchedSeconds += delta;
    }
  }

  function getCompletion() {

    if (duration > 0) {
      return Math.min(
        1,
        Math.max(
          0,
          watchedSeconds / duration
        )
      );
    }

    return 0;
  }

  async function sendWatchEvent(reason) {

    if (sent) return;

    addWatchedTime();

    const completion =
      getCompletion();

    const completed =
      ended ||
      (
        duration > 0 &&
        completion >= 0.90
      );

    const skipped =
      watchedSeconds < 10 &&
      !completed;

    if (
      watchedSeconds < 2 &&
      !completed
    ) {
      console.log(
        "ℹ️ VIDEOAPNA WATCH TOO SHORT:",
        Math.round(watchedSeconds),
        "sec"
      );
      return;
    }

    sent = true;

    try {

      const response =
        await fetch(
          "/api/recommendation/watch",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({

                userId:
                  VIDEOAPNA_USER_ID,

                videoId:
                  String(
                    video.uuid ||
                    video.id ||
                    ""
                  ),

                uuid:
                  String(
                    video.uuid || ""
                  ),

                title:
                  String(
                    video.title || ""
                  ),

                language:
                  String(
                    video.language || ""
                  ),

                category:
                  String(
                    video.category || ""
                  ),

                duration,

                watchSeconds:
                  Math.round(
                    watchedSeconds
                  ),

                completion,

                completed,

                skipped,

                liked,

                saved,

                source:
                  "peertube",

                reason

              })
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {

        console.warn(
          "❌ VIDEOAPNA WATCH SAVE FAILED:",
          data
        );

        sent = false;

      } else {

        console.log(
          "✅ VIDEOAPNA WATCH SAVED:",
          Math.round(
            watchedSeconds
          ),
          "sec |",
          reason
        );

      }

    } catch (error) {

      sent = false;

      console.error(
        "❌ VIDEOAPNA WATCH SAVE ERROR:",
        error
      );

    }
  }

  /*
   * PeerTube Embed API messages
   */
  function handleMessage(event) {

    const data =
      event.data;

    if (!data) return;

    let message = data;

    if (
      typeof data === "string"
    ) {

      try {
        message =
          JSON.parse(data);
      } catch {
        return;
      }
    }

    if (
      !message ||
      typeof message !== "object"
    ) {
      return;
    }

    const eventName =
      String(
        message.event ||
        message.type ||
        message.name ||
        ""
      ).toLowerCase();

    console.log(
      "📩 VIDEOAPNA PLAYER EVENT:",
      eventName
    );

    if (
      eventName === "play" ||
      eventName === "playing" ||
      eventName.includes("play")
    ) {

      isPlaying = true;
      lastTick = Date.now();

      console.log(
        "▶️ VIDEOAPNA PLAY:",
        video.title
      );

      return;
    }

    if (
      eventName === "pause" ||
      eventName.includes("pause")
    ) {

      if (isPlaying) {
        addWatchedTime();
      }

      isPlaying = false;
      lastTick = Date.now();

      return;
    }

    if (
      eventName.includes("timeupdate") ||
      eventName.includes("progress")
    ) {

      const current =
        Number(
          message.currentTime ??
          message.data?.currentTime ??
          message.position ??
          0
        );

      if (
        Number.isFinite(current) &&
        current >= 0
      ) {
        duration =
          Number(
            message.duration ??
            message.data?.duration ??
            duration
          ) || duration;
      }

      return;
    }

    if (
      eventName.includes("ended") ||
      eventName === "end"
    ) {

      if (isPlaying) {
        addWatchedTime();
      }

      isPlaying = false;
      ended = true;

      const messageDuration =
        Number(
          message.duration ??
          message.data?.duration ??
          0
        );

      if (
        messageDuration > 0
      ) {
        duration =
          messageDuration;
      }

      sendWatchEvent("ended");
    }
  }

  window.addEventListener(
    "message",
    handleMessage
  );

  /*
   * Fallback timer:
   * अगर PeerTube play event न भी भेजे,
   * तो player page मौजूद रहने पर समय track होगा।
   */
  let fallbackStarted = false;

  const fallbackTimer =
    setInterval(
      () => {

        if (
          document.hidden ||
          !document.body.contains(page)
        ) {
          lastTick = Date.now();
          return;
        }

        if (!fallbackStarted) {
          fallbackStarted = true;
          isPlaying = true;

          console.log(
            "▶️ VIDEOAPNA FALLBACK PLAY:",
            video.title
          );
        }

        addWatchedTime();

      },
      2000
    );

  function cleanup() {

    console.log(
      "🧹 VIDEOAPNA TRACKER CLEANUP:",
      video.title,
      "| watched:",
      Math.round(
        watchedSeconds
      ),
      "sec"
    );

    clearInterval(
      fallbackTimer
    );

    window.removeEventListener(
      "message",
      handleMessage
    );

    if (isPlaying) {
      addWatchedTime();
    }

    sendWatchEvent(
      "page-exit"
    );
  }

  const observer =
    new MutationObserver(
      () => {

        if (
          !document.body.contains(page)
        ) {

          observer.disconnect();

          cleanup();
        }
      }
    );

  observer.observe(
    document.body,
    {
      childList: true,
      subtree: true
    }
  );

  return {

    setLiked(value) {
      liked = Boolean(value);
    },

    setSaved(value) {
      saved = Boolean(value);
    },

    cleanup

  };
}



function startVideoApnaWatchTracking(video, page, player) {

  console.log(
    "🎬 VIDEOAPNA NATIVE TRACKER START:",
    video.title
  );

  let watchedSeconds = 0;
  let lastTime = 0;
  let isPlaying = false;
  let ended = false;
  let sent = false;
  let liked = false;
  let saved = false;
  let lastSend = 0;

  function updateWatchTime() {
    if (!player || !isPlaying) return;

    const current = Number(player.currentTime || 0);

    if (
      Number.isFinite(current) &&
      current >= lastTime
    ) {
      const delta = current - lastTime;

      if (delta >= 0 && delta <= 5) {
        watchedSeconds += delta;
      }
    }

    lastTime = current;
  }

  function getDuration() {
    const d = Number(player.duration || 0);

    if (Number.isFinite(d) && d > 0) {
      return d;
    }

    return Number(video.duration || 0);
  }

  async function sendWatchEvent(reason) {

    if (sent) return;

    updateWatchTime();

    const duration = getDuration();

    const completion =
      duration > 0
        ? Math.min(
            1,
            Math.max(
              0,
              watchedSeconds / duration
            )
          )
        : 0;

    const completed =
      ended ||
      (
        duration > 0 &&
        completion >= 0.90
      );

    const skipped =
      watchedSeconds < 10 &&
      !completed;

    if (
      watchedSeconds < 2 &&
      !completed
    ) {
      console.log(
        "ℹ️ VIDEOAPNA NATIVE WATCH TOO SHORT:",
        Math.round(watchedSeconds),
        "sec"
      );
      return;
    }

    sent = true;
    lastSend = Date.now();

    try {

      const response =
        await fetch(
          "/api/recommendation/watch",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({

              userId:
                VIDEOAPNA_USER_ID,

              videoId:
                String(
                  video.id ||
                  video.uuid ||
                  ""
                ),

              uuid:
                String(
                  video.uuid || ""
                ),

              title:
                String(
                  video.title || ""
                ),

              language:
                String(
                  video.language || ""
                ),

              category:
                String(
                  video.category || ""
                ),

              duration,

              watchSeconds:
                Math.round(
                  watchedSeconds
                ),

              completion,
              completed,
              skipped,
              liked,
              saved,

              source:
                "videoapna",

              reason
            })
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {

        console.warn(
          "❌ VIDEOAPNA NATIVE WATCH SAVE FAILED:",
          data
        );

        sent = false;

      } else {

        console.log(
          "✅ VIDEOAPNA NATIVE WATCH SAVED:",
          Math.round(watchedSeconds),
          "sec |",
          reason
        );

      }

    } catch (error) {

      sent = false;

      console.error(
        "❌ VIDEOAPNA NATIVE WATCH SAVE ERROR:",
        error
      );
    }
  }

  function handlePlay() {

    isPlaying = true;

    lastTime =
      Number(
        player.currentTime || 0
      );

    console.log(
      "▶️ VIDEOAPNA NATIVE PLAY:",
      video.title
    );
  }

  function handlePause() {

    updateWatchTime();

    isPlaying = false;

    console.log(
      "⏸️ VIDEOAPNA NATIVE PAUSE:",
      Math.round(watchedSeconds),
      "sec"
    );
  }

  function handleTimeUpdate() {

    if (!isPlaying) return;

    updateWatchTime();
  }

  function handleEnded() {

    updateWatchTime();

    isPlaying = false;
    ended = true;

    sendWatchEvent(
      "ended"
    );
  }

  function handleVisibility() {

    if (document.hidden) {

      updateWatchTime();

      isPlaying = false;

      sendWatchEvent(
        "hidden"
      );

    } else {

      lastTime =
        Number(
          player.currentTime || 0
        );
    }
  }

  player.addEventListener(
    "play",
    handlePlay
  );

  player.addEventListener(
    "playing",
    handlePlay
  );

  player.addEventListener(
    "pause",
    handlePause
  );

  player.addEventListener(
    "timeupdate",
    handleTimeUpdate
  );

  player.addEventListener(
    "ended",
    handleEnded
  );

  document.addEventListener(
    "visibilitychange",
    handleVisibility
  );

  function cleanup() {

    if (!page || !document.body.contains(page)) {
      return;
    }

    updateWatchTime();

    player.removeEventListener(
      "play",
      handlePlay
    );

    player.removeEventListener(
      "playing",
      handlePlay
    );

    player.removeEventListener(
      "pause",
      handlePause
    );

    player.removeEventListener(
      "timeupdate",
      handleTimeUpdate
    );

    player.removeEventListener(
      "ended",
      handleEnded
    );

    document.removeEventListener(
      "visibilitychange",
      handleVisibility
    );

    isPlaying = false;

    sendWatchEvent(
      "page-exit"
    );
  }

  const observer =
    new MutationObserver(
      () => {

        if (
          !document.body.contains(page)
        ) {

          observer.disconnect();

          updateWatchTime();

          player.removeEventListener(
            "play",
            handlePlay
          );

          player.removeEventListener(
            "playing",
            handlePlay
          );

          player.removeEventListener(
            "pause",
            handlePause
          );

          player.removeEventListener(
            "timeupdate",
            handleTimeUpdate
          );

          player.removeEventListener(
            "ended",
            handleEnded
          );

          document.removeEventListener(
            "visibilitychange",
            handleVisibility
          );

          isPlaying = false;

          sendWatchEvent(
            "page-exit"
          );
        }
      }
    );

  observer.observe(
    document.body,
    {
      childList: true,
      subtree: true
    }
  );

  return {

    setLiked(value) {
      liked = Boolean(value);
    },

    setSaved(value) {
      saved = Boolean(value);
    },

    cleanup
  };
}

function openVideoApnaWatchingPage(video) {

  const oldPage =
    document.getElementById("watchingPage");

  if (oldPage) oldPage.remove();

  const page =
    document.createElement("div");

  page.id = "watchingPage";

  const videoUrl =
    String(video.url || "").trim();

  const embedUrl =
    String(video.embedUrl || "").trim();

  const isVcdnVideo =
    Boolean(
      embedUrl &&
      (
        video.vcdnVideoId ||
        String(video.vcdnStatus || "").toLowerCase() === "ready" ||
        embedUrl.includes("embed.vcdn.me")
      )
    );

  if (!videoUrl && !isVcdnVideo) {
    alert("इस VideoApna वीडियो का player उपलब्ध नहीं है।");
    return;
  }

  const playerHtml = isVcdnVideo
    ? `
        <iframe
          id="videoApnaVcdnPlayer"
          src="${escapeHtml(
            embedUrl +
            (embedUrl.includes("?") ? "&" : "?") +
            "api=1&autoplay=1&muted=0"
          )}"
          title="${escapeHtml(video.title || "VideoApna Video")}"
          style="
            width:100%;
            height:100%;
            border:0;
            display:block;
            background:#000;
          "
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowfullscreen>
        </iframe>
      `
    : `
        <video
          id="videoApnaNativePlayer"
          src="${escapeHtml(videoUrl)}"
          controls
          autoplay
          playsinline
          preload="metadata"
          style="
            width:100%;
            height:100%;
            display:block;
            background:#000;
          "
        ></video>
      `;

  page.innerHTML = `
    <div class="watch-header">

      <button id="videoApnaWatchBack">
        ←
      </button>

      <strong>VideoApna</strong>

    </div>

    <div class="watch-content">

      <div
        class="watch-player"
        style="
          width:100%;
          background:#000;
          aspect-ratio:16/9;
        "
      >

        ${playerHtml}

      </div>

      <div class="watch-info">

        <h2
          id="videoApnaTitleToggle"
          role="button"
          tabindex="0"
          style="
            cursor:pointer;
            margin-bottom:8px;
          "
          title="विवरण खोलने के लिए क्लिक करें"
        >
          ${escapeHtml(video.title)}
        </h2>

        <div class="watch-meta">
          ${escapeHtml(video.channel || "VideoApna")}
          •
          ${escapeHtml(video.views || "0 views")}
          • VideoApna
        </div>

        <div class="watch-actions">

          <button id="videoApnaLikeBtn">
            ❤️ Like
          </button>

          <button id="videoApnaShareBtn">
            ↗️ Share
          </button>

          <button id="videoApnaSaveBtn">
            🔖 Save
          </button>

          <button id="videoApnaReportBtn">
            🚩 Report
          </button>

        </div>

        <div
          id="videoApnaDescription"
          class="description"
          style="display:none;"
        >

          <h3>वीडियो के बारे में</h3>

          <p>
            ${escapeHtml(
              video.description ||
              "यह वीडियो VideoApna पर प्रकाशित है।"
            )}
          </p>

        </div>

        <div class="next-videos">

          <h3>🎬 अगला वीडियो</h3>

          <div id="videoApnaNextVideoList"></div>

        </div>

      </div>

    </div>
  `;

  document.body.appendChild(page);

  const backBtn =
    document.getElementById("videoApnaWatchBack");

  if (backBtn) {
    backBtn.addEventListener(
      "click",
      () => page.remove()
    );
  }

  const player =
    document.getElementById("videoApnaNativePlayer");

  let videoApnaTracker = null;

  if (
    player &&
    typeof startVideoApnaWatchTracking === "function"
  ) {
    videoApnaTracker =
      startVideoApnaWatchTracking(
        video,
        page,
        player
      );
  }

  /* =========================================
     VIDEOAPNA TITLE → DESCRIPTION TOGGLE
  ========================================= */

  const titleToggle =
    document.getElementById("videoApnaTitleToggle");

  const descriptionBox =
    document.getElementById("videoApnaDescription");

  if (titleToggle && descriptionBox) {

    const toggleDescription = () => {

      const isHidden =
        descriptionBox.style.display === "none";

      descriptionBox.style.display =
        isHidden ? "block" : "none";

      titleToggle.title =
        isHidden
          ? "विवरण बंद करने के लिए क्लिक करें"
          : "विवरण खोलने के लिए क्लिक करें";

    };

    titleToggle.addEventListener(
      "click",
      toggleDescription
    );

    titleToggle.addEventListener(
      "keydown",
      (event) => {

        if (
          event.key === "Enter" ||
          event.key === " "
        ) {

          event.preventDefault();
          toggleDescription();

        }

      }
    );

  }


  /* =========================================
     VIDEOAPNA HOME LONG VIDEOS
     Thumbnail/Video = Open Video
     Title = Description Toggle
  ========================================= */

  const nextList =
    document.getElementById("videoApnaNextVideoList");

  if (nextList) {
    /*
     * Home में जो exact combined Long list दिखाई गई थी,
     * वही यहाँ इस्तेमाल होगी।
     *
     * इसमें:
     * - VideoApna
     * - Odysee
     * - PeerTube
     * सभी शामिल हो सकते हैं।
     *
     * 6-video limit नहीं है।
     */
    const allHomeVideos =
      Array.isArray(currentLongHomeVideos)
        ? currentLongHomeVideos
        : [];

    const nextVideos = allHomeVideos.filter(videoItem => {
      if (!videoItem) return false;

      const currentId =
        String(
          video.id ||
          video.uuid ||
          video.vcdnVideoId ||
          ""
        );

      const itemId =
        String(
          videoItem.id ||
          videoItem.uuid ||
          videoItem.vcdnVideoId ||
          ""
        );

      return itemId !== currentId;
    });

    if (!nextVideos.length) {
      nextList.innerHTML =
        '<p style="opacity:.7;">अभी कोई और Home Long वीडियो उपलब्ध नहीं है।</p>';
    } else {
      nextList.innerHTML = nextVideos
        .map(nextVideo => {
          const thumb =
            String(
              nextVideo.thumbnail ||
              nextVideo.posterUrl ||
              nextVideo.thumbnailUrl ||
              ""
            ).trim();

          const description =
            String(
              nextVideo.description ||
              "इस वीडियो का विवरण उपलब्ध नहीं है।"
            );

          const source =
            String(
              nextVideo.source || "videoapna"
            ).toLowerCase();

          const sourceName =
            source === "odysee"
              ? "Odysee"
              : source === "peertube"
              ? "PeerTube"
              : "VideoApna";

          const itemId =
            String(
              nextVideo.id ||
              nextVideo.uuid ||
              nextVideo.vcdnVideoId ||
              ""
            );

          return `
            <div
              class="next-video-item"
              data-video-id="${escapeHtml(itemId)}"
              style="
                padding:12px 0;
                border-bottom:1px solid rgba(128,128,128,.20);
              "
            >

              <!-- VIDEO / THUMBNAIL -->
              <div
                class="next-video-play"
                data-video-id="${escapeHtml(itemId)}"
                style="
                  display:flex;
                  gap:12px;
                  cursor:pointer;
                  align-items:center;
                "
              >
                <div
                  class="next-video-thumb"
                  style="
                    width:140px;
                    min-width:140px;
                    height:80px;
                    overflow:hidden;
                    border-radius:8px;
                    background:#222;
                  "
                >
                  ${
                    thumb
                      ? `
                        <img
                          src="${escapeHtml(thumb)}"
                          alt="${escapeHtml(
                            nextVideo.title || "Video"
                          )}"
                          loading="lazy"
                          style="
                            width:100%;
                            height:100%;
                            object-fit:cover;
                          "
                        >
                      `
                      : `
                        <div
                          style="
                            width:100%;
                            height:100%;
                            display:flex;
                            align-items:center;
                            justify-content:center;
                            font-size:28px;
                            color:#fff;
                          "
                        >
                          ▶️
                        </div>
                      `
                  }
                </div>
              </div>

              <!-- TITLE -->
              <div
                class="next-video-title"
                role="button"
                tabindex="0"
                title="विवरण खोलने के लिए क्लिक करें"
                style="
                  margin-top:8px;
                  cursor:pointer;
                  font-weight:600;
                  line-height:1.4;
                "
              >
                ${escapeHtml(
                  nextVideo.title || "Untitled Video"
                )}
              </div>

              <!-- META -->
              <div
                class="next-video-meta"
                style="
                  margin-top:4px;
                  font-size:13px;
                  opacity:.7;
                "
              >
                ${escapeHtml(
                  nextVideo.channel ||
                  nextVideo.author ||
                  "VideoApna"
                )}
                •
                ${escapeHtml(
                  nextVideo.views || "0 views"
                )}
                •
                ${escapeHtml(sourceName)}
              </div>

              <!-- DESCRIPTION -->
              <div
                class="next-video-description"
                style="
                  display:none;
                  margin:10px 0 2px 0;
                  padding:10px;
                  border-radius:8px;
                  background:rgba(128,128,128,.10);
                  line-height:1.5;
                  opacity:.9;
                "
              >
                ${escapeHtml(description)}
              </div>

            </div>
          `;
        })
        .join("");

      /*
       * Thumbnail / video area पर click:
       * उसी source का सही Watching Page खुलेगा।
       */
      nextList
        .querySelectorAll(".next-video-play")
        .forEach(playArea => {
          playArea.addEventListener(
            "click",
            event => {
              event.preventDefault();
              event.stopPropagation();

              const id =
                playArea.getAttribute(
                  "data-video-id"
                );

              const selectedVideo =
                nextVideos.find(item => {
                  const itemId =
                    String(
                      item.id ||
                      item.uuid ||
                      item.vcdnVideoId ||
                      ""
                    );

                  return itemId === String(id || "");
                });

              if (!selectedVideo) return;

              const source =
                String(
                  selectedVideo.source || ""
                ).toLowerCase();

              if (source === "odysee") {
                openOdyseeWatchingPage(
                  selectedVideo
                );
              } else if (source === "peertube") {
                openPeerTubeWatchingPage(
                  selectedVideo
                );
              } else {
                openVideoApnaWatchingPage(
                  selectedVideo
                );
              }
            }
          );
        });

      /*
       * Title पर click:
       * केवल उसी video's Description open/close होगी।
       * Video नहीं बदलेगा।
       */
      nextList
        .querySelectorAll(".next-video-title")
        .forEach(titleElement => {

          const toggleDescription = () => {
            const item =
              titleElement.closest(
                ".next-video-item"
              );

            if (!item) return;

            const descriptionBox =
              item.querySelector(
                ".next-video-description"
              );

            if (!descriptionBox) return;

            const isHidden =
              descriptionBox.style.display ===
              "none";

            descriptionBox.style.display =
              isHidden
                ? "block"
                : "none";

            titleElement.title =
              isHidden
                ? "विवरण बंद करने के लिए क्लिक करें"
                : "विवरण खोलने के लिए क्लिक करें";
          };

          titleElement.addEventListener(
            "click",
            event => {
              event.preventDefault();
              event.stopPropagation();
              toggleDescription();
            }
          );

          titleElement.addEventListener(
            "keydown",
            event => {
              if (
                event.key === "Enter" ||
                event.key === " "
              ) {
                event.preventDefault();
                event.stopPropagation();
                toggleDescription();
              }
            }
          );
        });
    }
  }

  const shareBtn =
    document.getElementById("videoApnaShareBtn");

  if (shareBtn) {
    shareBtn.addEventListener(
      "click",
      async () => {

        const shareUrl =
          isVcdnVideo
            ? embedUrl
            : (
                window.location.origin +
                String(video.url || "")
              );

        try {

          if (navigator.share) {

            await navigator.share({
              title: video.title,
              text:
                "VideoApna पर यह वीडियो देखें: " +
                video.title,
              url: shareUrl
            });

          } else if (navigator.clipboard) {

            await navigator.clipboard.writeText(
              shareUrl
            );

            alert("🔗 वीडियो लिंक कॉपी हो गया।");

          }

        } catch (error) {

          if (error.name !== "AbortError") {
            console.error(
              "VideoApna share error:",
              error
            );
          }

        }
      }
    );
  }

  const likeBtn =
    document.getElementById("videoApnaLikeBtn");

  if (likeBtn) {

    likeBtn.addEventListener(
      "click",
      () => {

        video.likes =
          Number(video.likes || 0) + 1;

        likeBtn.textContent =
          "❤️ Liked " + video.likes;

      }
    );
  }

  const reportBtn =
    document.getElementById("videoApnaReportBtn");

  if (reportBtn) {

    reportBtn.addEventListener(
      "click",
      async () => {
        await reportVideo(video);
      }
    );
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function openPeerTubeWatchingPage(video) {

  const oldPage =
    document.getElementById("watchingPage");

  if (oldPage) oldPage.remove();

  const page =
    document.createElement("div");

  page.id = "watchingPage";

  const embedUrl =
    String(video.embedUrl || "").trim();

  if (!embedUrl) {
    alert("इस PeerTube वीडियो का player उपलब्ध नहीं है।");
    return;
  }

  const separator =
    embedUrl.includes("?") ? "&" : "?";

  const playerUrl =
    embedUrl +
    separator +
    "api=1&autoplay=1&muted=0";

  page.innerHTML = `
    <div class="watch-header">

      <button id="peerTubeWatchBack">
        ←
      </button>

      <strong>VideoApna</strong>

    </div>

    <div class="watch-content">

      <div
        class="watch-player"
        style="
          width:100%;
          background:#000;
          aspect-ratio:16/9;
        "
      >

        <iframe
          id="peerTubeEmbedPlayer"
          src="${escapeHtml(playerUrl)}"
          title="${escapeHtml(video.title)}"
          style="
            width:100%;
            height:100%;
            border:0;
            display:block;
          "
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowfullscreen>
        </iframe>

      </div>

      <div class="watch-info">

        <h2>
          ${escapeHtml(video.title)}
        </h2>

        <div class="watch-meta">
          ${escapeHtml(video.channel)}
          •
          ${escapeHtml(video.views)}
          • PeerTube
        </div>

        <div class="watch-actions">

          <button id="peerTubeLikeBtn">
            ❤️ Like
          </button>

          <button id="peerTubeShareBtn">
            ↗️ Share
          </button>

          <button id="peerTubeSaveBtn">
            🔖 Save
          </button>
                                     <button id="peerTubeReportBtn">
                   🚩 Report
                                     </button>

        </div>

        <div class="description">

          <h3>
            वीडियो के बारे में
          </h3>

          <p>
            ${escapeHtml(
              video.description ||
              "यह वीडियो PeerTube से VideoApna पर उपलब्ध है।"
            )}
          </p>

        </div>

        <div class="next-videos">

          <h3>
            🎬 अगला वीडियो
          </h3>

          <div id="peerTubeNextVideoList"></div>

        </div>

      </div>

    </div>
  `;

  document.body.appendChild(page);

  const peerTubeWatchIframe =
    document.getElementById(
      "peerTubeEmbedPlayer"
    );

  let peerTubeWatchTracker = null;

  if (
    peerTubeWatchIframe &&
    typeof startPeerTubeWatchTracking === "function"
  ) {

    peerTubeWatchTracker =
      startPeerTubeWatchTracking(
        video,
        page,
        peerTubeWatchIframe
      );

    console.log(
      "✅ VideoApna watch tracker connected:",
      video.title
    );

  }

  const backBtn =
    document.getElementById(
      "peerTubeWatchBack"
    );

  if (backBtn) {

    backBtn.addEventListener(
      "click",
      () => page.remove()
    );

  }

  const reportBtn =
    document.getElementById(
      "peerTubeReportBtn"
    );

  if (reportBtn) {
    reportBtn.addEventListener(
      "click",
      async () => {
        await reportVideo(video);
      }
    );
  }

  const shareBtn =
    document.getElementById(
      "peerTubeShareBtn"
    );

  if (shareBtn) {

    shareBtn.addEventListener(
      "click",
      async () => {

        const shareUrl =
          video.embedUrl ||
          window.location.href;

        try {

          if (navigator.share) {

            await navigator.share({
              title: video.title,
              text:
                "VideoApna पर यह वीडियो देखें: " +
                video.title,
              url: shareUrl
            });

          } else if (navigator.clipboard) {

            await navigator.clipboard.writeText(
              shareUrl
            );

            alert(
              "🔗 वीडियो लिंक कॉपी हो गया।"
            );

          }

        } catch (error) {

          if (
            error.name !==
            "AbortError"
          ) {

            console.error(
              "PeerTube share error:",
              error
            );

          }

        }

      }
    );

  }

  const saveBtn =
    document.getElementById(
      "peerTubeSaveBtn"
    );

  const SAVE_KEY =
    "videoapna_saved_peertube";

  function getSaved() {

    try {

      return JSON.parse(
        localStorage.getItem(
          SAVE_KEY
        ) || "[]"
      );

    } catch {

      return [];

    }

  }

  function updateSave() {

    const saved =
      getSaved();

    const isSaved =
      saved.includes(
        String(video.uuid || video.id)
      );

    saveBtn.textContent =
      isSaved
        ? "✅ Saved"
        : "🔖 Save";

  }

  if (saveBtn) {

    updateSave();

    saveBtn.addEventListener(
      "click",
      () => {

        const saved =
          getSaved();

        const id =
          String(
            video.uuid ||
            video.id
          );

        const index =
          saved.indexOf(id);

        if (index === -1) {

          saved.push(id);

          saveBtn.textContent =
            "✅ Saved";

        } else {

          saved.splice(
            index,
            1
          );

          saveBtn.textContent =
            "🔖 Save";

        }

        localStorage.setItem(
          SAVE_KEY,
          JSON.stringify(saved)
        );

      }
    );

  }

  const likeBtn =
    document.getElementById(
      "peerTubeLikeBtn"
    );

  if (likeBtn) {

    likeBtn.addEventListener(
      "click",
      () => {

        video.likes =
          Number(video.likes || 0) + 1;

        likeBtn.textContent =
          "❤️ Liked " +
          video.likes;

      }
    );

  }

  const nextList =
    document.getElementById(
      "peerTubeNextVideoList"
    );

  if (nextList) {

    /*
     * VideoApna + PeerTube दोनों sources
     * से Next Videos बनाए जाएँगे।
     */
    const ownVideos =
      typeof getVideoApnaPublicVideos ===
      "function"
        ? getVideoApnaPublicVideos("videos")
        : [];

    const allNextVideos = [
      ...ownVideos,
      ...peerTubeVideos
    ];

    const uniqueNextVideos = [];
    const nextKeys = new Set();

    for (const nextVideo of allNextVideos) {

      const key =
        String(
          nextVideo.source ||
          "video"
        ) +
        ":" +
        String(
          nextVideo.uuid ||
          nextVideo.id ||
          nextVideo.url ||
          ""
        );

      if (
        !nextKeys.has(key) &&
        String(nextVideo.id) !==
          String(video.id)
      ) {

        nextKeys.add(key);
        uniqueNextVideos.push(
          nextVideo
        );
      }

      if (
        uniqueNextVideos.length >= 6
      ) {
        break;
      }
    }

    uniqueNextVideos.forEach(
      nextVideo => {

        const item =
          document.createElement(
            "div"
          );

        item.className =
          "next-video-item";

        const isPeerTube =
          String(
            nextVideo.source || ""
          ).toLowerCase() ===
            "peertube" ||
          !!nextVideo.peerTubeId ||
          !!nextVideo.uuid;

        item.innerHTML = `
          <div class="next-video-thumb">

            <img
              src="${escapeHtml(
                nextVideo.thumbnail ||
                "https://dummyimage.com/640x360/111/fff.png&text=VideoApna"
              )}"
              alt="${escapeHtml(
                nextVideo.title
              )}">

            <span>▶</span>

          </div>

          <div class="next-video-info">

            <strong>
              ${escapeHtml(
                nextVideo.title
              )}
            </strong>

            <small>
              ${escapeHtml(
                nextVideo.channel ||
                "VideoApna"
              )}
            </small>

            <small>
              ${escapeHtml(
                nextVideo.views ||
                "0 views"
              )}
              •
              ${
                isPeerTube
                  ? "PeerTube"
                  : "VideoApna"
              }
            </small>

          </div>
        `;

        item.addEventListener(
          "click",
          () => {

            if (
              String(
                nextVideo.source || ""
              ).toLowerCase() ===
              "videoapna"
            ) {

              openVideoApnaWatchingPage(
                nextVideo
              );

            } else {

              openPeerTubeWatchingPage(
                nextVideo
              );

            }

          }
        );

        nextList.appendChild(item);

      }
    );

  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

}


function openOdyseeWatchingPage(video) {

  const oldPage =
    document.getElementById("watchingPage");

  if (oldPage) oldPage.remove();

  const page =
    document.createElement("div");

  page.id = "watchingPage";

  const embedUrl =
    String(video.embedUrl || "").trim();

  if (!embedUrl) {
    alert("इस Odysee वीडियो का player उपलब्ध नहीं है।");
    return;
  }

  page.innerHTML = `
    <div class="watch-header">

      <button id="odyseeWatchBack">
        ←
      </button>

      <strong>VideoApna</strong>

    </div>

    <div class="watch-content">

      <div
        class="watch-player"
        style="
          width:100%;
          background:#000;
          aspect-ratio:16/9;
        "
      >

        <iframe
          id="odyseeEmbedPlayer"
          src="${escapeHtml(embedUrl)}"
          title="${escapeHtml(video.title || "Odysee Video")}"
          style="
            width:100%;
            height:100%;
            border:0;
            display:block;
          "
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowfullscreen>
        </iframe>

      </div>

      <div class="watch-info">

        <h2
          id="odyseeTitleToggle"
          role="button"
          tabindex="0"
          style="
            cursor:pointer;
            margin-bottom:8px;
          "
          title="विवरण खोलने के लिए क्लिक करें"
        >
          ${escapeHtml(
            video.title || "Odysee Video"
          )}
        </h2>

        <div class="watch-meta">
          ${escapeHtml(
            video.channel || "Odysee"
          )}
          •
          ${escapeHtml(
            video.views || "0 views"
          )}
          • Odysee
        </div>

        <div class="watch-actions">

          <button id="odyseeShareBtn">
            ↗️ Share
          </button>

          <button id="odyseeSaveBtn">
            🔖 Save
          </button>

          <button id="odyseeReportBtn">
            🚩 Report
          </button>

        </div>

        <div
          id="odyseeDescription"
          class="description"
          style="display:none;"
        >

          <h3>वीडियो के बारे में</h3>

          <p>
            ${escapeHtml(
              video.description ||
              "यह वीडियो Odysee से VideoApna पर official embed के माध्यम से उपलब्ध है।"
            )}
          </p>

        </div>

        <div class="next-videos">

          <h3>🎬 अगला वीडियो</h3>

          <div id="odyseeNextVideoList"></div>

        </div>

      </div>

    </div>
  `;

  document.body.appendChild(page);

  /* =========================================
     ODYSEE TITLE → DESCRIPTION TOGGLE
  ========================================= */

  const titleToggle =
    document.getElementById(
      "odyseeTitleToggle"
    );

  const descriptionBox =
    document.getElementById(
      "odyseeDescription"
    );

  if (titleToggle && descriptionBox) {

    const toggleDescription = () => {

      const isHidden =
        descriptionBox.style.display === "none";

      descriptionBox.style.display =
        isHidden ? "block" : "none";

      titleToggle.title =
        isHidden
          ? "विवरण बंद करने के लिए क्लिक करें"
          : "विवरण खोलने के लिए क्लिक करें";
    };

    titleToggle.addEventListener(
      "click",
      toggleDescription
    );

    titleToggle.addEventListener(
      "keydown",
      (event) => {

        if (
          event.key === "Enter" ||
          event.key === " "
        ) {
          event.preventDefault();
          toggleDescription();
        }

      }
    );

  }

  const backBtn =
    document.getElementById(
      "odyseeWatchBack"
    );

  if (backBtn) {

    backBtn.addEventListener(
      "click",
      () => page.remove()
    );

  }

  const shareBtn =
    document.getElementById(
      "odyseeShareBtn"
    );

  if (shareBtn) {

    shareBtn.addEventListener(
      "click",
      async () => {

        const shareUrl =
          video.watchUrl ||
          video.embedUrl ||
          window.location.href;

        try {

          if (navigator.share) {

            await navigator.share({
              title:
                video.title || "Odysee Video",
              text:
                "VideoApna पर यह वीडियो देखें: " +
                (video.title || ""),
              url: shareUrl
            });

          } else if (navigator.clipboard) {

            await navigator.clipboard.writeText(
              shareUrl
            );

            alert(
              "🔗 वीडियो लिंक कॉपी हो गया।"
            );

          }

        } catch (error) {

          if (
            error.name !==
            "AbortError"
          ) {

            console.error(
              "Odysee share error:",
              error
            );

          }

        }

      }
    );

  }

  const saveBtn =
    document.getElementById(
      "odyseeSaveBtn"
    );

  const SAVE_KEY =
    "videoapna_saved_odysee";

  function getSaved() {

    try {

      return JSON.parse(
        localStorage.getItem(
          SAVE_KEY
        ) || "[]"
      );

    } catch {

      return [];

    }

  }

  function updateSave() {

    const saved =
      getSaved();

    const id =
      String(
        video.odyseeId ||
        video.id ||
        video.embedUrl
      );

    saveBtn.textContent =
      saved.includes(id)
        ? "✅ Saved"
        : "🔖 Save";

  }

  if (saveBtn) {

    updateSave();

    saveBtn.addEventListener(
      "click",
      () => {

        const saved =
          getSaved();

        const id =
          String(
            video.odyseeId ||
            video.id ||
            video.embedUrl
          );

        const index =
          saved.indexOf(id);

        if (index === -1) {

          saved.push(id);

          saveBtn.textContent =
            "✅ Saved";

        } else {

          saved.splice(
            index,
            1
          );

          saveBtn.textContent =
            "🔖 Save";

        }

        localStorage.setItem(
          SAVE_KEY,
          JSON.stringify(saved)
        );

      }
    );

  }

  /*
   * ================================
   * ODYSEE NEXT VIDEO FEED
   * ================================
   */

  const nextList =
    document.getElementById(
      "odyseeNextVideoList"
    );

  if (nextList) {

    /*
     * पहले Odysee search से videos लाने की कोशिश।
     * Search fail/empty होने पर Home के available
     * videos से fallback दिखाया जाएगा।
     */

    nextList.innerHTML = `
      <div style="
        padding:12px;
        text-align:center;
        color:#888;
      ">
        ⏳ अगला वीडियो लोड हो रहा है...
      </div>
    `;

    const currentId =
      String(
        video.odyseeId ||
        video.id ||
        video.embedUrl ||
        ""
      );

    const renderNextVideos = function (nextVideos) {

      if (!Array.isArray(nextVideos)) {
        nextVideos = [];
      }

      nextVideos =
        nextVideos
          .filter(function (item) {

            if (!item) return false;

            const id =
              String(
                item.odyseeId ||
                item.id ||
                item.uuid ||
                item.embedUrl ||
                item.url ||
                ""
              );

            return (
              id &&
              id !== currentId
            );

          })
          .slice(0, 6);

      if (!nextVideos.length) {

        nextList.innerHTML = `
          <div style="
            padding:15px;
            color:#888;
            text-align:center;
          ">
            अभी और वीडियो उपलब्ध नहीं हैं।
          </div>
        `;

        return;
      }

      nextList.innerHTML = "";

      nextVideos.forEach(function (nextVideo) {

        const item =
          document.createElement("div");

        item.style.cssText = `
          display:flex;
          gap:12px;
          padding:10px 0;
          border-bottom:1px solid rgba(128,128,128,.2);
          cursor:pointer;
        `;

        item.innerHTML = `
          <img
            src="${escapeHtml(
              nextVideo.thumbnail ||
              nextVideo.posterUrl ||
              "https://dummyimage.com/320x180/111/fff.png?text=VideoApna"
            )}"
            alt=""
            style="
              width:145px;
              height:82px;
              object-fit:cover;
              border-radius:8px;
              background:#111;
              flex-shrink:0;
            "
          >

          <div style="
            min-width:0;
            flex:1;
          ">

            <div style="
              font-weight:600;
              line-height:1.35;
              display:-webkit-box;
              -webkit-line-clamp:2;
              -webkit-box-orient:vertical;
              overflow:hidden;
            ">
              ${escapeHtml(
                nextVideo.title ||
                "VideoApna Video"
              )}
            </div>

            <div style="
              margin-top:7px;
              color:#888;
              font-size:13px;
            ">
              ${escapeHtml(
                nextVideo.channel ||
                "VideoApna"
              )}
              •
              ${escapeHtml(
                nextVideo.views ||
                "0 views"
              )}
            </div>

          </div>
        `;

        item.addEventListener(
          "click",
          function () {

            const source =
              String(
                nextVideo.source || ""
              ).toLowerCase();

            if (
              source === "odysee" ||
              nextVideo.odyseeId ||
              nextVideo.embedUrl
            ) {

              openOdyseeWatchingPage(
                nextVideo
              );

            } else if (
              source === "peertube" ||
              nextVideo.peerTubeId ||
              nextVideo.uuid
            ) {

              openPeerTubeWatchingPage(
                nextVideo
              );

            } else {

              openVideoApnaWatchingPage(
                nextVideo
              );

            }

          }
        );

        nextList.appendChild(item);

      });

    };

    const fallbackVideos = function () {

      const externalVideos =
        Array.isArray(odyseeVideos)
          ? odyseeVideos
          : [];

      renderNextVideos(
        externalVideos
      );

    };

    const nextQuery =
      String(
        video.title ||
        "hindi bhajan"
      ).trim();

    fetch(
      "/api/odysee-search?q=" +
      encodeURIComponent(nextQuery) +
      "&start=0"
    )
      .then(function (response) {

        if (!response.ok) {
          throw new Error(
            "Odysee search failed"
          );
        }

        return response.json();

      })
      .then(function (data) {

        if (
          data &&
          data.success &&
          Array.isArray(data.videos) &&
          data.videos.length
        ) {

          renderNextVideos(
            data.videos
          );

        } else {

          fallbackVideos();

        }

      })
      .catch(function (error) {

        console.error(
          "Odysee next video error:",
          error
        );

        fallbackVideos();

      });

  }

}


/* CATEGORY BUTTONS */

categoryButtons.forEach(button => {

  button.addEventListener(
    "click",
    () => {

      categoryButtons.forEach(
        btn =>
          btn.classList.remove(
            "active"
          )
      );

      button.classList.add(
        "active"
      );

      selectedCategory =
        button.dataset.category ||
        "सभी";

      const search =
        searchInput.value.trim();

      if (search) {

        searchPeerTube(search);

      } else if (
        selectedCategory === "सभी"
      ) {

        loadPeerTubeHome(
          "videos"
        );

      } else {

        loadPeerTubeHome(
          selectedCategory
        );

      }

    }
  );

});

if (searchInput) {

  searchInput.addEventListener(
    "input",
    filterVideos
  );

}


/* PEERTUBE HOME START */

document.addEventListener("DOMContentLoaded", function () {
  loadPeerTubeHome("videos");
});


/* VIDEOAPNA BOTTOM NAV - FINAL */
(function () {
  const nav = document.querySelector(".bottom-nav");
  const buttons = document.querySelectorAll(".bottom-nav .bottom-item");

  if (!nav || !buttons.length) return;

  buttons.forEach(function (button, index) {
    button.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopImmediatePropagation();

      buttons.forEach(function (b) {
        b.classList.remove("active");
      });

      button.classList.add("active");

      if (index === 0) {
        window.scrollTo(0, 0);
      }

      if (index === 1) {
        openTrending();
      }

      if (index === 3) {
        const modal = document.getElementById("uploadModal");
        if (modal) {
          modal.classList.remove("hidden");
          modal.style.display = "";
        }
      }

      if (index === 4) {
        const likedBtn = document.getElementById("bottomLiked");
        if (likedBtn) likedBtn.click();
      }

    });
  });
})();

/* VIDEOAPNA VIDEO PREVIEW */
(function () {

  const fileInput = document.getElementById("videoFile");
  const previewBox = document.getElementById("videoPreview");
  const player = document.getElementById("previewPlayer");

  if (!fileInput || !previewBox || !player) {
    console.log("Preview elements missing");
    return;
  }

  fileInput.addEventListener("change", function () {

    const file = this.files && this.files[0];

    if (!file) {
      previewBox.classList.add("hidden");
      player.removeAttribute("src");
      player.load();
      return;
    }

    console.log("Selected video:", file.name, file.type, file.size);

    if (!file.type.startsWith("video/")) {
      alert("कृपया वीडियो फ़ाइल चुनें।");
      this.value = "";
      previewBox.classList.add("hidden");
      return;
    }

    const url = URL.createObjectURL(file);

    player.src = url;
    previewBox.classList.remove("hidden");

    player.load();

  });

})();



/* ================================
   VIDEOAPNA PUBLISH - SERVER
================================ */

(function () {

  const publishBtn = document.getElementById("publishBtn");
  const videoFile = document.getElementById("videoFile");
  const titleInput = document.getElementById("uploadTitle");
  const descriptionInput = document.getElementById("uploadDescription");
  const categoryInput = document.getElementById("uploadCategory");
  const uploadMessage = document.getElementById("uploadMessage");
  const uploadModal = document.getElementById("uploadModal");

  // Selected Sound
  let uploadSelectedSound = null;

  const soundTitleEl =
    document.getElementById("selectedSoundTitle");

  if (!publishBtn) return;

  publishBtn.addEventListener("click", async function (event) {

    event.preventDefault();
    event.stopPropagation();

    const file = videoFile.files[0];
    const title = titleInput.value.trim();

    if (!file) {
      uploadMessage.textContent = "⚠️ पहले वीडियो चुनें।";
      return;
    }

    if (!title) {
      uploadMessage.textContent = "⚠️ वीडियो का Title लिखें।";
      titleInput.focus();
      return;
    }

    publishBtn.disabled = true;
    uploadMessage.textContent = "⏳ वीडियो server पर upload हो रहा है...";

    try {

      const formData = new FormData();

      formData.append("video", file);
      formData.append("title", title);
      formData.append(
        "description",
        descriptionInput.value.trim()
      );
      formData.append(
        "category",
        categoryInput.value
      );

      // जिस user ने video upload किया है
      formData.append(
        "userId",
        String(VIDEOAPNA_USER_ID || "")
      );

      // Selected Video Template
      const selectedTemplate =
        window.videoApnaSelectedTemplate || "normal";

      formData.append(
        "template",
        selectedTemplate
      );

      console.log(
        "UPLOAD TEMPLATE:",
        selectedTemplate
      );

      const selectedSound =
        window.videoApnaSelectedSound;

      if (selectedSound) {
        formData.append(
          "soundId",
          String(selectedSound.id || "")
        );

        formData.append(
          "soundTitle",
          String(selectedSound.title || "Original Sound")
        );

        formData.append(
          "soundUrl",
          String(selectedSound.url || "")
        );

        console.log(
          "UPLOAD SOUND:",
          selectedSound
        );
      } else {
        console.log("UPLOAD SOUND: NONE");
      }

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Upload failed"
        );
      }

      uploadMessage.textContent =
        "✅ वीडियो Publish हो गया!";

      /* नया video तुरंत list में दिखाएँ */
      if (result.video) {
        videos.unshift(result.video);
        filterVideos();
      }

      setTimeout(function () {

        if (uploadModal) {
          uploadModal.classList.add("hidden");
        }

        videoFile.value = "";
        titleInput.value = "";
        descriptionInput.value = "";
        categoryInput.selectedIndex = 0;

        uploadSelectedSound = null;
        window.videoApnaSelectedSound = null;

        const selectedBox =
          document.getElementById("selectedSound");

        if (selectedBox) {
          selectedBox.classList.add("hidden");
        }

        if (soundTitleEl) {
          soundTitleEl.textContent =
            "कोई Sound नहीं चुना";
        }

        const preview =
          document.getElementById("videoPreview");

        const player =
          document.getElementById("previewPlayer");

        if (preview) {
          preview.classList.add("hidden");
        }

        if (player) {
          player.pause();
          player.removeAttribute("src");
          player.load();
        }

        uploadMessage.textContent = "";

      }, 1200);

    } catch (error) {

      console.error("Publish error:", error);

      uploadMessage.textContent =
        "❌ Publish नहीं हुआ: " + error.message;

    } finally {
      publishBtn.disabled = false;
    }

  });

})();


/* ================================
   LOAD SERVER VIDEOS
================================ */

async function loadServerVideos() {
  try {
    const response = await fetch("/api/videos");

    if (!response.ok) {
      throw new Error("Server videos load failed");
    }

    const serverVideos = await response.json();

    if (Array.isArray(serverVideos) && serverVideos.length) {

      const serverIds = new Set(
        serverVideos.map(v => v.id)
      );

      /* पुराने server videos को duplicate न करें */
      const localOnly = videos.filter(
        v => !serverIds.has(v.id)
      );

      videos.length = 0;

      serverVideos.forEach(v => videos.push(v));
      localOnly.forEach(v => videos.push(v));

      filterVideos();
    }

  } catch (error) {
    console.log("Server videos:", error.message);
  }
}

loadServerVideos();

/* ================================
   VIDEOAPNA TRENDING
================================ */

async function openTrending() {

  console.log("🔥 PEERTUBE TRENDING OPEN");

  const profile = document.getElementById("profileSection");
  const liked = document.getElementById("liked");
  const videoList = document.getElementById("videoList");
  const hero = document.querySelector(".hero");
  const sectionTitle = document.querySelector(".section-title");

  if (profile) {
    profile.classList.add("hidden");
    profile.style.cssText = "";
  }

  if (liked) {
    liked.classList.add("hidden");
    liked.style.display = "";
  }

  if (hero) {
    hero.style.display = "none";
  }

  if (sectionTitle) {
    sectionTitle.textContent = "🔥 ट्रेंडिंग वीडियो";
  }

  if (videoList) {
    videoList.classList.remove("hidden");
    videoList.style.display = "";
  }

  try {

    resultCount.textContent =
      "⏳ ट्रेंडिंग वीडियो लोड हो रहे हैं...";

    noResults.classList.add("hidden");

    /*
      PeerTube में अलग /api/trending पर निर्भर नहीं रहेंगे।
      कई trending-type queries चलाकर वीडियो लेंगे।
    */

    const queries = [
      "trending",
      "popular",
      "shorts",
      "music"
    ];

    const results = await Promise.all(
      queries.map(async function(query) {

        try {

          const response = await fetch(
            "/api/peertube-search?q=" +
            encodeURIComponent(query)
          );

          const data = await response.json();

          if (!response.ok || !data.success) {
            return [];
          }

          return Array.isArray(data.videos)
            ? data.videos
            : [];

        } catch (error) {

          console.log(
            "Trending query failed:",
            query,
            error.message
          );

          return [];
        }

      })
    );

    const merged = [];

    results.forEach(function(items) {

      items.forEach(function(video) {

        const key =
          video.uuid ||
          video.id ||
          video.videoUrl;

        if (!key) return;

        if (
          !merged.some(function(existing) {
            return (
              (existing.uuid || existing.id || existing.videoUrl) === key
            );
          })
        ) {
          merged.push(video);
        }

      });

    });

    const normalized = merged
      .map(normalizePeerTubeVideo)
      .filter(function(video) {
        return video.url;
      });

    /*
      ज्यादा वीडियो मिलने पर पहले वाले दिखाएँ।
    */
    peerTubeVideos = normalized.slice(0, 20);

    showPeerTubeVideos(peerTubeVideos);

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

    console.log(
      "🔥 PEERTUBE TRENDING LOADED:",
      peerTubeVideos.length
    );

  } catch (error) {

    console.error(
      "PEERTUBE TRENDING ERROR:",
      error
    );

    list.innerHTML = "";

    resultCount.textContent =
      "ट्रेंडिंग वीडियो लोड नहीं हो पाए";

    noResults.classList.remove("hidden");

  }
}

/* ================================
   VIDEOAPNA SERVER LIKE
================================ */

document.addEventListener("click", async function (event) {

  const button = event.target.closest(".card-like-btn");

  if (!button) return;

  event.preventDefault();
  event.stopPropagation();

  const videoId = button.dataset.videoId;

  button.disabled = true;

  try {

    const response = await fetch(
      "/api/videos/" + videoId + "/like",
      {
        method: "POST"
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Like failed");
    }

    button.innerHTML = "❤️ " + Number(data.likes || 0);

    // इस device पर liked video की ID save करें
    try {
      const key = "videoapna_liked_ids";
      const ids = JSON.parse(localStorage.getItem(key) || "[]");
      const id = String(videoId);

      if (!ids.includes(id)) {
        ids.push(id);
        localStorage.setItem(key, JSON.stringify(ids));
      }

      console.log("CARD LIKED ID SAVED:", id);
    } catch (e) {
      console.error("CARD LIKED ID SAVE ERROR:", e);
    }

  } catch (error) {

    console.error("Like error:", error);
    alert("❤️ Like नहीं हो पाया।");

  } finally {

    button.disabled = false;

  }

});



/* ================================
/* VIDEOAPNA UPLOAD CLOSE FINAL FIX */
(function () {
  const closeBtn = document.getElementById("closeUpload");
  const uploadModal = document.getElementById("uploadModal");

  if (!closeBtn || !uploadModal) {
    console.log("UPLOAD CLOSE: ELEMENT NOT FOUND");
    return;
  }

  closeBtn.onclick = function (e) {
    e.preventDefault();
    e.stopPropagation();

    uploadModal.classList.add("hidden");
    uploadModal.style.display = "none";

    console.log("UPLOAD MODAL CLOSED");
  };

  uploadModal.addEventListener("click", function (e) {
    if (e.target === uploadModal) {
      uploadModal.classList.add("hidden");
      uploadModal.style.display = "none";
    }
  });

  console.log("UPLOAD CLOSE FIX READY");
})();

/* ================================
   VIDEOAPNA TRENDING BUTTON FINAL
================================ */

(function () {
  const trendingBtn = document.getElementById("bottomTrending");

  if (!trendingBtn) {
    console.log("TRENDING BUTTON NOT FOUND");
    return;
  }

  trendingBtn.addEventListener("click", async function (event) {
    event.preventDefault();
    event.stopPropagation();

    console.log("TRENDING BUTTON CLICKED");

    const profile = document.getElementById("profileSection");
    const liked = document.getElementById("liked");
    const videoList = document.getElementById("videoList");
    const hero = document.querySelector(".hero");
    const sectionTitle = document.querySelector(".section-title");

    if (profile) {
      profile.classList.add("hidden");
      profile.style.cssText = "";
    }

    if (liked) liked.classList.add("hidden");

    if (videoList) {
      videoList.classList.remove("hidden");
      videoList.style.display = "";
    }

    if (hero) hero.style.display = "";
    if (sectionTitle) sectionTitle.style.display = "";

    await openTrending();

    console.log("TRENDING OPENED");
  });

})();

/* ================================
   VIDEOAPNA HOME NAVIGATION FINAL
================================ */

(function () {

  const homeBtn = document.querySelector(".bottom-nav .bottom-item:first-child");

  if (!homeBtn) {
    console.log("HOME BUTTON NOT FOUND");
    return;
  }

  homeBtn.addEventListener("click", async function (event) {

    event.preventDefault();
    event.stopPropagation();

    console.log("HOME BUTTON CLICKED");

    const profile = document.getElementById("profileSection");
    const liked = document.getElementById("liked");
    const videoList = document.getElementById("videoList");
    const hero = document.querySelector(".hero");
    const sectionTitle = document.querySelector(".section-title");

    if (profile) {
      profile.classList.add("hidden");
      profile.style.cssText = "";
    }

    if (liked) {
      liked.classList.add("hidden");
      liked.style.display = "";
    }

    if (hero) {
      hero.style.display = "";
    }

    if (sectionTitle) {
      sectionTitle.style.display = "";
      sectionTitle.textContent = "🎬 नवीनतम वीडियो";
    }

    if (videoList) {
      videoList.classList.remove("hidden");
      videoList.style.display = "";
    }

    try {

      const response = await fetch("/api/videos");

      if (!response.ok) {
        throw new Error("Home videos load failed");
      }

      const homeVideos = await response.json();

      if (!Array.isArray(homeVideos)) {
        throw new Error("Invalid home video data");
      }

      videos.length = 0;

      homeVideos.forEach(function (video) {
        videos.push(video);
      });

      showVideos(videos);

      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });

      console.log("HOME SCREEN OPENED:", videos.length);

    } catch (error) {

      console.error("HOME NAVIGATION ERROR:", error);
      alert("🏠 Home वीडियो लोड नहीं हो पाए।");

    }

  }, true);

  console.log("HOME NAVIGATION FIX READY");

})();






/* VIDEOAPNA NAVIGATION CENTRAL FINAL */
window.addEventListener("load", function () {

  const nav = document.querySelector(".bottom-nav");

  if (!nav) {
    console.log("CENTRAL NAV: bottom nav missing");
    return;
  }

  nav.addEventListener("click", async function (event) {

    const btn = event.target.closest(".bottom-item");

    if (!btn) return;

    /* पुराने handlers को रोकें */
    event.preventDefault();
    event.stopImmediatePropagation();

    const buttons = nav.querySelectorAll(".bottom-item");
    buttons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const profile = document.getElementById("profileSection");
    const liked = document.getElementById("liked");
    const videoList = document.getElementById("videoList");
    const hero = document.querySelector(".hero");
    const title = document.querySelector(".section-title");
    const uploadModal = document.getElementById("uploadModal");

    const homeBtn = nav.querySelector(".bottom-item:nth-child(1)");
    const trendingBtn = document.getElementById("bottomTrending");
    const uploadBtn = nav.querySelector(".bottom-item:nth-child(3)");
    const likedBtn = document.getElementById("bottomLiked");
    const profileBtn = document.getElementById("bottomProfile");

    console.log("CENTRAL NAV CLICK");

    /* सभी screens reset */
    if (profile) {
      profile.classList.add("hidden");
      profile.style.display = "";
    }

    if (liked) {
      liked.classList.add("hidden");
      liked.style.display = "";
    }

    if (videoList) {
      videoList.classList.remove("hidden");
      videoList.style.display = "";
    }

    if (hero) hero.style.display = "";
    if (title) title.style.display = "";

    /* HOME */
    if (btn === homeBtn) {
      if (title) title.textContent = "🎬 नवीनतम वीडियो";
      window.scrollTo(0, 0);
      console.log("CENTRAL HOME OPEN");
      return;
    }

    /* TRENDING */
    if (btn === trendingBtn) {
      if (typeof openTrending === "function") {
        await openTrending();
      }
      window.scrollTo(0, 0);
      console.log("CENTRAL TRENDING OPEN");
      return;
    }

    /* UPLOAD */
    if (btn === uploadBtn) {
      if (uploadModal) {
        uploadModal.classList.remove("hidden");
        uploadModal.style.display = "";
      }
      console.log("CENTRAL UPLOAD OPEN");
      return;
    }

    /* LIKED */
    if (btn === likedBtn) {
      if (typeof openLikedVideos === "function") {
        await openLikedVideos();
      } else if (liked) {
        if (videoList) videoList.classList.add("hidden");
        if (hero) hero.style.display = "none";
        if (title) title.textContent = "❤️ पसंद किए गए वीडियो";
        liked.classList.remove("hidden");
      }
      window.scrollTo(0, 0);
      console.log("CENTRAL LIKED OPEN");
      return;
    }

    /* PROFILE */
    if (btn === profileBtn) {
      if (videoList) videoList.classList.add("hidden");
      if (liked) liked.classList.add("hidden");
      if (hero) hero.style.display = "none";
      if (title) title.style.display = "none";

      if (profile) {
        profile.classList.remove("hidden");
        profile.style.display = "block";
        profile.style.visibility = "visible";
        profile.style.opacity = "1";
      }

      window.scrollTo(0, 0);

      console.log("CENTRAL PROFILE OPEN");

      async function deleteVideoFromProfile(video, card) {

      try {
        const response = await fetch(
          "/api/videos/" + video.id,
          {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              /* userId अब session से server पर तय होगा */
            })
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Delete failed"
          );
        }

        if (card) {
          card.remove();
        }

        alert("🗑️ वीडियो Delete हो गया!");

        // Profile count/list refresh
        if (typeof loadVideos === "function") {
          await loadVideos();
        }

        return true;

      } catch (error) {
        console.error(
          "PROFILE DELETE ERROR:",
          error
        );

        alert(
          "वीडियो Delete नहीं हो पाया।"
        );

        return false;
      }
    }

    /* Profile statistics/videos */
      try {
        const response = await fetch(
        "/api/videos?userId=" +
        "my-account"
      );

        if (response.ok && profile) {
          const data = await response.json();

          if (Array.isArray(data)) {

            const count = document.getElementById("profileVideoCount");
            const views = document.getElementById("profileViews");
            const likes = document.getElementById("profileLikes");
            const list = document.getElementById("myVideoList");
            const empty = document.getElementById("myVideoEmpty");

            if (count) count.textContent = data.length;

            if (views) {
              views.textContent = data.reduce(
                (sum, v) => sum + Number(v.viewCount || 0), 0
              );
            }

            if (likes) {
              likes.textContent = data.reduce(
                (sum, v) => sum + Number(v.likes || 0), 0
              );
            }

            if (list) {
              list.innerHTML = "";

              if (!data.length) {
                if (empty) {
                  empty.classList.remove("hidden");
                  empty.textContent =
                    "अभी कोई वीडियो upload नहीं किया है।";
                }
              } else {
                if (empty) empty.classList.add("hidden");

                data.forEach(video => {

                  const card = document.createElement("article");
                  card.className = "video-card";

                  card.innerHTML = `
                    <div class="thumbnail">
                      <video
                        src="${video.url || ""}"
                        muted
                        playsinline
                        preload="metadata">
                      </video>
                      <button class="play-btn" type="button">▶</button>
                    </div>

                    <div class="video-info">
                      <div class="video-title">
                        ${video.title || ""}
                      </div>

                      <div class="video-meta">
                        ${video.channel || "VideoApna"}
                      </div>

                      <div class="video-meta">
                        ${Number(video.viewCount || 0)} views •
                        ${Number(video.likes || 0)} ❤️ •
                        ${video.category || "मनोरंजन"}
                      </div>

                      <button
                        type="button"
                        class="profile-delete-btn"
                        data-video-id="${video.id}">
                        🗑️ वीडियो Delete करें
                      </button>
                    </div>
                  `;

                  card.addEventListener("click", function (event) {

                    const deleteBtn =
                      event.target.closest(".profile-delete-btn");

                    if (deleteBtn) {
                      event.preventDefault();
                      event.stopPropagation();

                      const ok = confirm(
                        "क्या आप यह वीडियो Delete करना चाहते हैं?\n\n" +
                        (video.title || "यह वीडियो")
                      );

                      if (!ok) return;

                      deleteVideoFromProfile(video, card);
                      return;
                    }

                    if (typeof openWatchingPage === "function") {
                      openWatchingPage(video);
                    }
                  });

                  list.appendChild(card);
                });
              }
            }
          }
        }
      } catch (error) {
        console.error("CENTRAL PROFILE API ERROR:", error);
      }

      return;
    }

  }, true);

  /* PROFILE BACK FINAL FIX */
const back = document.getElementById("profileBack");

if (back) {
  back.onclick = function (event) {
    event.preventDefault();
    event.stopImmediatePropagation();

    const profile = document.getElementById("profileSection");
    const liked = document.getElementById("liked");
    const videoList = document.getElementById("videoList");
    const hero = document.querySelector(".hero");
    const title = document.querySelector(".section-title");
    const nav = document.querySelector(".bottom-nav");

    /* Profile बंद */
    if (profile) {
      profile.classList.add("hidden");
      profile.style.display = "none";
    }

    /* Liked बंद */
    if (liked) {
      liked.classList.add("hidden");
      liked.style.display = "none";
    }

    /* Home दिखाएँ */
    if (hero) {
      hero.style.display = "";
    }

    if (title) {
      title.style.display = "";
      title.textContent = "🎬 नवीनतम वीडियो";
    }

    if (videoList) {
      videoList.classList.remove("hidden");
      videoList.style.display = "";
    }

    /* Home button active */
    if (nav) {
      nav.querySelectorAll(".bottom-item").forEach(function (b) {
        b.classList.remove("active");
      });

      const homeBtn = nav.querySelector(".bottom-item:first-child");

      if (homeBtn) {
        homeBtn.classList.add("active");
      }
    }

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

    console.log("PROFILE BACK FINAL -> HOME");
  };
}

console.log("CENTRAL NAVIGATION READY");

});



/* ==========================================
   VIDEOAPNA LIKED VIDEOS FINAL
   Device-based liked video IDs
========================================== */

window.addEventListener("load", function () {

  const nav = document.querySelector(".bottom-nav");
  const likedBtn = document.getElementById("bottomLiked");
  const likedSection = document.getElementById("liked");

  if (!nav || !likedBtn || !likedSection) {
    console.log("LIKED FINAL: ELEMENT MISSING");
    return;
  }

  const likedList =
    document.getElementById("likedVideoList");

  const likedEmpty =
    document.getElementById("likedEmpty");

  function getLikedIds() {
    try {
      const data =
        JSON.parse(
          localStorage.getItem("videoapna_liked_ids") || "[]"
        );

      return Array.isArray(data)
        ? data.map(String)
        : [];

    } catch (error) {
      console.error("GET LIKED IDS ERROR:", error);
      return [];
    }
  }

  function saveLikedId(id) {

    id = String(id);

    const ids = getLikedIds();

    if (!ids.includes(id)) {

      ids.push(id);

      localStorage.setItem(
        "videoapna_liked_ids",
        JSON.stringify(ids)
      );
    }

    console.log("LIKED VIDEO SAVED:", id);
  }

  /*
   * Card Like
   */
  document.addEventListener("click", function (event) {

    const button =
      event.target.closest(".card-like-btn");

    if (!button) return;

    const id = button.dataset.videoId;

    if (id) {
      saveLikedId(id);
    }

  }, true);


  /*
   * Watch page Like
   * यह extra safety है।
   */
  document.addEventListener("click", function (event) {

    const button =
      event.target.closest("#likeBtn");

    if (!button) return;

    /*
     * Watch page button में video ID नहीं है,
     * इसलिए openWatchingPage के बाद अलग save होता है।
     * यह handler केवल diagnostic है।
     */

    console.log("WATCH LIKE CLICK DETECTED");

  }, true);


  async function showLikedVideos() {

    console.log("OPENING LIKED VIDEOS");

    const ids = getLikedIds();

    console.log("CURRENT LIKED IDS:", ids);

    /*
     * बाकी sections hide
     */
    const videoList =
      document.getElementById("videoList");

    const profile =
      document.getElementById("profileSection");

    const hero =
      document.querySelector(".hero");

    const title =
      document.querySelector(".section-title");

    if (videoList) {
      videoList.classList.add("hidden");
    }

    if (profile) {
      profile.classList.add("hidden");
      profile.style.display = "";
    }

    if (hero) {
      hero.style.display = "none";
    }

    if (title) {
      title.style.display = "";
      title.textContent = "❤️ पसंद किए गए वीडियो";
    }

    likedSection.classList.remove("hidden");
    likedSection.style.display = "";

    try {

      const response =
        await fetch("/api/videos");

      if (!response.ok) {
        throw new Error("Videos API failed");
      }

      const allVideos =
        await response.json();

      /*
       * केवल इस device की liked IDs।
       *
       * likes count देखकर video को liked
       * नहीं मानना है।
       */
      const likedVideos =
        allVideos.filter(video =>
          ids.includes(String(video.id))
        );

      console.log(
        "LIKED VIDEOS FOUND:",
        likedVideos.length
      );

      /*
       * सही container साफ करें
       */
      if (likedList) {
        likedList.innerHTML = "";
      }

      /*
       * Empty message
       */
      if (likedEmpty) {
        likedEmpty.style.display =
          likedVideos.length
            ? "none"
            : "";
      }

      if (!likedVideos.length) {

        console.log(
          "NO LIKED VIDEOS FOR THIS DEVICE"
        );

        return;
      }

      likedVideos.forEach(video => {

        const card =
          document.createElement("article");

        card.className = "video-card";

        card.innerHTML = `
          <div class="thumbnail">

            <video
              src="${video.url || ""}"
              muted
              playsinline
              preload="metadata">
            </video>

            <button
              class="play-btn"
              type="button">
              ▶
            </button>

          </div>

          <div class="video-info">

            <div class="video-title">
              ${video.title || ""}
            </div>

            <div class="video-meta">
              ${video.channel || "VideoApna"}
            </div>

            <div class="video-meta">
              ${Number(video.viewCount || 0)}
              views •
              ${Number(video.likes || 0)}
              ❤️ •
              ${video.category || "मनोरंजन"}
            </div>

          </div>
        `;

        card.addEventListener(
          "click",
          function (event) {

            if (
              event.target.closest(".play-btn") ||
              event.target.closest(".thumbnail") ||
              event.target.closest(".video-info")
            ) {

              if (
                typeof openWatchingPage ===
                "function"
              ) {
                openWatchingPage(video);
              }
            }

          }
        );

        if (likedList) {
          likedList.appendChild(card);
        }
      });

    } catch (error) {

      console.error(
        "LIKED VIDEOS ERROR:",
        error
      );

      if (likedList) {
        likedList.innerHTML =
          "<p>पसंद किए गए वीडियो लोड नहीं हो पाए।</p>";
      }
    }
  }


  /*
   * ❤️ पसंद button
   */
  likedBtn.addEventListener(
    "click",
    function (event) {

      event.preventDefault();
      event.stopPropagation();

      showLikedVideos();

      nav.querySelectorAll(".bottom-item")
        .forEach(function (button) {
          button.classList.remove("active");
        });

      likedBtn.classList.add("active");

    }
  );


  /*
   * ← वापस
   */
  const likedBack =
    document.getElementById("likedBack");

  if (likedBack) {

    likedBack.addEventListener(
      "click",
      function (event) {

        event.preventDefault();
        event.stopPropagation();

        likedSection.classList.add("hidden");

        if (videoList) {
          videoList.classList.remove("hidden");
          videoList.style.display = "";
        }

        if (hero) {
          hero.style.display = "";
        }

        if (title) {
          title.style.display = "";
          title.textContent =
            "वीडियो देखें";
        }

        const homeBtn =
          nav.querySelector(
            ".bottom-item:nth-child(1)"
          );

        nav.querySelectorAll(".bottom-item")
          .forEach(function (button) {
            button.classList.remove("active");
          });

        if (homeBtn) {
          homeBtn.classList.add("active");
        }

        window.scrollTo(0, 0);

        console.log(
          "LIKED BACK TO HOME"
        );
      }
    );
  }


  console.log(
    "LIKED VIDEOS FINAL READY"
  );

});

/* ==========================================
   VIDEOAPNA SOUND PICKER
========================================== */

// Global selected sound — Upload और Sound Picker दोनों इसे इस्तेमाल करेंगे
window.videoApnaSelectedSound = null;

(function () {

  const chooseBtn = document.getElementById("chooseSoundBtn");
  const panel = document.getElementById("soundPanel");
  const closeBtn = document.getElementById("closeSoundBtn");
  const soundList = document.getElementById("soundList");
  const selectedBox = document.getElementById("selectedSound");
  const selectedTitle = document.getElementById("selectedSoundTitle");
  const removeBtn = document.getElementById("removeSoundBtn");

  if (!chooseBtn || !panel || !soundList) {
    console.log("SOUND PICKER: ELEMENT MISSING");
    return;
  }

  let selectedSound = null;

  chooseBtn.addEventListener("click", async function () {

    panel.classList.remove("hidden");
    soundList.innerHTML = "<p>🎵 Sounds load हो रहे हैं...</p>";

    try {

      const response = await fetch("/api/sounds");

      if (!response.ok) {
        throw new Error("Sounds API failed");
      }

      const sounds = await response.json();

      if (!Array.isArray(sounds) || sounds.length === 0) {
        soundList.innerHTML = `
          <div class="sound-empty">
            <div>🎵</div>
            <strong>अभी कोई Sound उपलब्ध नहीं है</strong>
            <p>जल्द ही Sounds यहाँ दिखाई देंगे।</p>
          </div>
        `;
        return;
      }

      soundList.innerHTML = "";

      sounds.forEach(function (sound) {

        const item = document.createElement("div");
        item.className = "sound-item";

        item.innerHTML = `
          <div class="sound-item-info">
            <strong>${sound.title || "Original Sound"}</strong>
            <small>${sound.channel || "VideoApna"}</small>
          </div>

          <div class="sound-item-actions">

            <button
              type="button"
              class="sound-preview-btn">
              ▶
            </button>

            <button
              type="button"
              class="use-sound-btn">
              Use Sound
            </button>

          </div>
        `;

        const previewBtn =
          item.querySelector(".sound-preview-btn");

        const useBtn =
          item.querySelector(".use-sound-btn");

        let audio = null;

        previewBtn.addEventListener("click", function (event) {

          event.preventDefault();
          event.stopPropagation();

          if (audio) {
            audio.pause();
            audio.currentTime = 0;
            audio = null;
            previewBtn.textContent = "▶";
            return;
          }

          audio = new Audio(sound.url);

          audio.play()
            .then(function () {
              previewBtn.textContent = "⏸";
            })
            .catch(function (error) {
              console.error("Sound preview error:", error);
              alert("Sound चल नहीं पाया।");
              audio = null;
            });

          audio.addEventListener("ended", function () {
            previewBtn.textContent = "▶";
            audio = null;
          });

        });

        useBtn.addEventListener("click", function (event) {

          event.preventDefault();
          event.stopPropagation();

          selectedSound = sound;
          window.videoApnaSelectedSound = sound;

          selectedTitle.textContent =
            "🎵 " + (sound.title || "Original Sound");

          if (soundTitleEl) {
            soundTitleEl.textContent =
              "🎵 " + (sound.title || "Original Sound");
          }

          selectedBox.classList.remove("hidden");
          panel.classList.add("hidden");

          console.log(
            "SOUND SELECTED:",
            selectedSound
          );

        });

        soundList.appendChild(item);

      });

    } catch (error) {

      console.error("SOUND PICKER ERROR:", error);

      soundList.innerHTML = `
        <div class="sound-empty">
          <div>⚠️</div>
          <strong>Sounds load नहीं हो पाए</strong>
        </div>
      `;

    }

  });

  if (closeBtn) {
    closeBtn.addEventListener("click", function () {
      panel.classList.add("hidden");
    });
  }

  if (removeBtn) {
    removeBtn.addEventListener("click", function () {

      selectedSound = null;

      selectedBox.classList.add("hidden");

      selectedTitle.textContent =
        "कोई Sound नहीं चुना";

      console.log("SOUND REMOVED");

    });
  }

})();

/* ==========================================
   VIDEOAPNA PHONE SOUND
   Local device audio picker + preview
========================================== */

(function () {

  const input = document.getElementById("phoneSoundInput");
  const selectedBox = document.getElementById("selectedSound");
  const selectedTitle = document.getElementById("selectedSoundTitle");

  if (!input) {
    console.log("PHONE SOUND: INPUT MISSING");
    return;
  }

  let phoneAudio = null;

  input.addEventListener("change", function () {

    const file = this.files && this.files[0];

    if (!file) return;

    if (!file.type.startsWith("audio/")) {
      alert("कृपया Audio file चुनें।");
      input.value = "";
      return;
    }

    if (phoneAudio) {
      phoneAudio.pause();
      phoneAudio = null;
    }

    const audioUrl = URL.createObjectURL(file);

    phoneAudio = new Audio(audioUrl);

    if (selectedBox) {
      selectedBox.classList.remove("hidden");
    }

    if (selectedTitle) {
      selectedTitle.textContent =
        "📱 " + file.name;
    }

    phoneAudio.addEventListener("ended", function () {
      console.log("PHONE SOUND PREVIEW ENDED");
    });

    phoneAudio.play()
      .then(function () {
        console.log(
          "PHONE SOUND PREVIEW PLAYING:",
          file.name
        );
      })
      .catch(function (error) {
        console.log(
          "PHONE SOUND PREVIEW READY:",
          error
        );
      });

    window.videoApnaPhoneSound = {
      file: file,
      url: audioUrl,
      audio: phoneAudio
    };

    console.log(
      "PHONE SOUND SELECTED:",
      file.name
    );

  });

})();


/* =========================================================
   VIDEOAPNA PROFILE PHOTO + SAVE FIX
   ========================================================= */
(function () {
  function initVideoApnaProfile() {
    const photoInput = document.getElementById("profilePhotoInput");
    const photo = document.getElementById("profilePhoto");
    const avatarIcon = document.getElementById("profileAvatarIcon");
    const saveBtn = document.getElementById("saveProfileBtn");
    const nameInput = document.getElementById("profileNameInput");
    const addressInput = document.getElementById("profileAddressInput");
    const saveMessage = document.getElementById("profileSaveMessage");

    if (!photoInput || !photo || !saveBtn || !nameInput || !addressInput) {
      return;
    }

    // पहले से saved profile load करें
    try {
      const savedName = localStorage.getItem("videoapna_profile_name");
      const savedAddress = localStorage.getItem("videoapna_profile_address");
      const savedPhoto = localStorage.getItem("videoapna_profile_photo");

      if (savedName) nameInput.value = savedName;
      if (savedAddress) addressInput.value = savedAddress;

      if (savedPhoto) {
        photo.src = savedPhoto;
        photo.style.display = "block";
        if (avatarIcon) avatarIcon.style.display = "none";
      }
    } catch (e) {
      console.warn("Profile load error:", e);
    }

    // फोटो चुनने पर तुरंत स्क्रीन पर दिखाएँ
    if (!photoInput.dataset.profileBound) {
      photoInput.dataset.profileBound = "1";

      photoInput.addEventListener("change", function () {
        const file = this.files && this.files[0];

        if (!file) return;

        if (!file.type.startsWith("image/")) {
          alert("कृपया केवल फोटो चुनें।");
          this.value = "";
          return;
        }

        const reader = new FileReader();

        reader.onload = function (event) {
          const imageData = event.target.result;

          photo.src = imageData;
          photo.style.display = "block";

          if (avatarIcon) {
            avatarIcon.style.display = "none";
          }

          try {
            localStorage.setItem("videoapna_profile_photo", imageData);
          } catch (e) {
            console.warn("Photo save error:", e);
          }
        };

        reader.readAsDataURL(file);
      });
    }

    // Save button
    if (!saveBtn.dataset.profileBound) {
      saveBtn.dataset.profileBound = "1";

      saveBtn.addEventListener("click", function (event) {
        event.preventDefault();

        const name = (nameInput.value || "").trim();
        const address = (addressInput.value || "").trim();

        try {
          localStorage.setItem("videoapna_profile_name", name);
          localStorage.setItem("videoapna_profile_address", address);

          if (saveMessage) {
            saveMessage.textContent = "✅ Profile सफलतापूर्वक Save हो गई!";
            saveMessage.style.display = "block";
          }

          // Header/profile में जहाँ नाम दिख रहा हो वहाँ भी update करें
          document.querySelectorAll(
            ".profile-name, #profileDisplayName, #profileName"
          ).forEach(function (el) {
            el.textContent = name;
          });

          document.querySelectorAll(
            ".profile-address, #profileDisplayAddress, #profileAddress"
          ).forEach(function (el) {
            el.textContent = address;
          });

        } catch (e) {
          console.error("Profile save error:", e);

          if (saveMessage) {
            saveMessage.textContent = "❌ Profile Save नहीं हो पाई।";
          }
        }
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initVideoApnaProfile);
  } else {
    initVideoApnaProfile();
  }

  // SPA में Profile section दोबारा खुलने पर भी initialise करें
  window.initVideoApnaProfile = initVideoApnaProfile;
})();


/* ================================
   VIDEOAPNA TEMPLATE PICKER
================================ */

(function () {

  const picker = document.getElementById("templatePicker");
  const hiddenInput = document.getElementById("selectedTemplate");

  if (!picker || !hiddenInput) {
    console.log("TEMPLATE PICKER: ELEMENT MISSING");
    return;
  }

  const buttons =
    picker.querySelectorAll(".template-item");

  buttons.forEach(function (button) {

    button.addEventListener("click", function (event) {

      event.preventDefault();
      event.stopPropagation();

      buttons.forEach(function (item) {
        item.classList.remove("active");
      });

      button.classList.add("active");

      const template =
        button.dataset.template || "normal";

      hiddenInput.value = template;

      window.videoApnaSelectedTemplate = template;

      console.log(
        "VIDEO TEMPLATE SELECTED:",
        template
      );

    });

  });

  window.videoApnaSelectedTemplate = "normal";

  console.log("VIDEOAPNA TEMPLATE PICKER READY");

})();



/* =========================================================
   VIDEOAPNA PHOTO → AUTO VIDEO
   1-5 Photos | 10/15/20 sec | FFmpeg | No AI
========================================================= */
(function () {

  const input = document.getElementById("photoVideoInput");
  const countText = document.getElementById("photoCountText");
  const previewGrid = document.getElementById("photoPreviewGrid");
  const durationSelect = document.getElementById("photoVideoDuration");
  const generateBtn = document.getElementById("generatePhotoVideoBtn");
  const message = document.getElementById("photoVideoMessage");
  const resultBox = document.getElementById("photoVideoResult");
  const resultPlayer = document.getElementById("photoVideoResultPlayer");

  if (!input || !generateBtn) {
    console.log("PHOTO VIDEO: ELEMENT MISSING");
    return;
  }

  console.log("VIDEOAPNA PHOTO VIDEO READY");

  input.addEventListener("change", function () {

    const files = Array.from(input.files || []);

    previewGrid.innerHTML = "";

    if (!files.length) {
      countText.textContent = "कोई फोटो नहीं चुनी गई";
      return;
    }

    if (files.length > 5) {
      countText.textContent = "⚠️ अधिकतम 5 फोटो चुन सकते हैं।";
      input.value = "";
      return;
    }

    countText.textContent =
      "📷 " + files.length + " फोटो चुनी गई";

    files.forEach(function (file) {

      const url = URL.createObjectURL(file);

      const img = document.createElement("img");
      img.src = url;
      img.alt = file.name;

      previewGrid.appendChild(img);

    });

  });


  generateBtn.addEventListener("click", async function () {

    const files = Array.from(input.files || []);

    if (!files.length) {
      message.textContent = "⚠️ पहले 1 से 5 फोटो चुनें।";
      return;
    }

    if (files.length > 5) {
      message.textContent = "⚠️ अधिकतम 5 फोटो चुन सकते हैं।";
      return;
    }

    const duration =
      Number(durationSelect.value || 10);

    const template =
      window.videoApnaSelectedTemplate || "normal";

    generateBtn.disabled = true;

    message.textContent =
      "⏳ फोटो से वीडियो बनाया जा रहा है...";

    resultBox.classList.add("hidden");

    try {

      const formData = new FormData();

      files.forEach(function (file) {
        formData.append("photos", file);
      });

      formData.append(
        "duration",
        String(duration)
      );

      formData.append(
        "template",
        template
      );

      console.log("PHOTO VIDEO REQUEST:", {
        photos: files.length,
        duration: duration,
        template: template
      });

      const response = await fetch(
        "/api/photo-to-video",
        {
          method: "POST",
          body: formData
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ||
          "Photo से Video नहीं बन पाया।"
        );
      }

      console.log(
        "PHOTO VIDEO CREATED:",
        result.video
      );

      if (result.video && result.video.url) {

        resultPlayer.src =
          result.video.url +
          "?v=" +
          Date.now();

        resultPlayer.load();

        resultBox.classList.remove("hidden");

        message.textContent =
          "✅ आपका Video तैयार है!";

      } else {

        throw new Error(
          "Video तैयार हुआ लेकिन URL नहीं मिला।"
        );

      }

    } catch (error) {

      console.error(
        "PHOTO VIDEO ERROR:",
        error
      );

      message.textContent =
        "❌ " +
        (error.message ||
          "Photo से Video नहीं बन पाया।");

    } finally {

      generateBtn.disabled = false;

    }

  });

})();





/* =========================================
   VIDEOAPNA AUTO SHORTS FEED
========================================= */
(function () {

  let shortsVideos = [];
  let shortsIndex = 0;
  let shortsFeed = null;

  /* Shorts infinite loading */
  let shortsStart = 0;
  let shortsLoading = false;
  let shortsFinished = false;
  let shortsTotal = 0;

  /*
   * Shorts में अलग-अलग categories rotate होंगी।
   */
  const shortsQueries = [
    "indian comedy shorts",
    "indian funny shorts",
    "funny hindi shorts",
    "hindi comedy shorts",
    "hindi funny shorts",
    "desi comedy shorts",
    "indian comedy",
    "indian funny",
    "hindi comedy",
    "hindi funny",
    "comedy shorts",
    "funny shorts"
  ];

  let shortsQueryIndex = 0;
  let shortsCategoryStarts = {};
  let shortsCategoryFinished = {};

  /*
   * पहला Short muted रहेगा।
   * User एक बार Sound ON करेगा तो preference आगे रहेगी।
   */
  let shortsSoundEnabled = true;
  let shortsSoundUnlocked = true;

  /*
   * Shorts relevance score:
   * Hindi / Indian / Desi / Comedy content को ऊपर रखें।
   * Foreign-only results को नीचे करें।
   */
  function scoreShortVideo(video) {

    const text = [
      video && video.title,
      video && video.channelTitle,
      video && video.channelName,
      video && video.description
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    let score = 0;

    const positiveWords = [
      "india",
      "indian",
      "hindi",
      "desi",
      "bharat",
      "bharatiya",
      "comedy",
      "comedian",
      "funny",
      "fun",
      "joke",
      "jokes",
      "meme",
      "memes",
      "standup",
      "stand-up",
      "entertainment",
      "reels"
    ];

    const negativeWords = [
      "ecuador",
      "ecuadorian",
      "germany",
      "german",
      "deutsch",
      "poland",
      "polish",
      "russia",
      "russian",
      "ukraine",
      "ukrainian",
      "france",
      "french",
      "spain",
      "spanish",
      "italy",
      "italian",
      "portugal",
      "portuguese",
      "brazil",
      "brazilian",
      "mexico",
      "mexican",
      "turkey",
      "turkish",
      "holland",
      "netherlands"
    ];

    positiveWords.forEach(function (word) {
      if (text.includes(word)) {
        score += 5;
      }
    });

    negativeWords.forEach(function (word) {
      if (text.includes(word)) {
        score -= 20;
      }
    });

    if (
      video &&
      String(video.language || "").toLowerCase() === "hi"
    ) {
      score += 10;
    }

    return score;
  }

  function sortShortVideos(videos) {
    return videos
      .map(function (video, order) {
        return {
          video: video,
          score: scoreShortVideo(video),
          order: order
        };
      })
      .sort(function (a, b) {
        if (b.score !== a.score) {
          return b.score - a.score;
        }

        return a.order - b.order;
      })
      .map(function (item) {
        return item.video;
      });
  }

  async function loadShortsFeed(append = false) {

    console.log("🚀 VIDEOAPNA SHORTS LOAD START");

    if (shortsLoading) return;
    if (append && shortsFinished) return;

    const SHORTS_TARGET = 50;
    const batchStartCount = shortsVideos.length;
    const batchTarget = batchStartCount + SHORTS_TARGET;

    if (!append) {
      shortsStart = 0;
      shortsFinished = false;
      shortsTotal = 0;
      shortsVideos = [];
      shortsIndex = 0;

      shortsQueryIndex = 0;
      shortsCategoryStarts = {};
      shortsCategoryFinished = {};

      shortsSoundEnabled = true;
      shortsSoundUnlocked = true;

      // नया Shorts session शुरू होने पर Own VideoApna Shorts फिर से check करें।
      window.__videoApnaOwnShortsLoaded = false;
    }

    shortsLoading = true;

    try {

      /*
       * ----------------------------------------------------------
       * SOURCE 1: VIDEOAPNA OWN SHORTS
       * ----------------------------------------------------------
       *
       * केवल public और playable VideoApna videos।
       * अपने videos की duration पर कोई सीमा नहीं है।
       */
      if (!append || !window.__videoApnaOwnShortsLoaded) {

        const ownResponse = await fetch("/api/videos");
        const ownData = await ownResponse.json();

        if (ownResponse.ok && Array.isArray(ownData)) {

          const ownShorts = ownData.filter(function (video) {

            const visibility =
              String(video.visibility || "public").toLowerCase();

            const duration =
              Number(video.duration || 0);

            const playable =
              Boolean(
                video.embedUrl ||
                video.vcdnPlaybackUrl ||
                video.url ||
                video.localUrl
              );

            return (
              visibility !== "private" &&
              playable
            );
          });

          const existingOwnKeys = new Set(
            shortsVideos.map(function (video) {
              return String(
                video.id ||
                video.vcdnVideoId ||
                video.url ||
                video.embedUrl
              );
            })
          );

          const freshOwn = [];

          ownShorts.forEach(function (video) {

            const key = String(
              video.id ||
              video.vcdnVideoId ||
              video.url ||
              video.embedUrl
            );

            if (!existingOwnKeys.has(key)) {

              existingOwnKeys.add(key);

              freshOwn.push(
                Object.assign({}, video, {
                  source: "videoapna",
                  sourceName: "VideoApna",
                  channelTitle:
                    video.channel || "VideoApna"
                })
              );
            }
          });

          /*
           * अपने videos सबसे पहले।
           */
          shortsVideos.push(...freshOwn);

          window.__videoApnaOwnShortsLoaded = true;

          console.log(
            "🎬 VideoApna own Shorts:",
            freshOwn.length,
            "total:",
            shortsVideos.length
          );

          /*
           * पहला अपना Short मिलते ही screen पर दिखाएँ।
           * External sources बाद में fallback के रूप में आएँगे।
           */
          if (freshOwn.length && !shortsFeed) {
            createShortsFeed();
            renderShorts();
          } else if (freshOwn.length) {
            appendShortsItems(freshOwn);
          }
        }
      }

      /*
       * VideoApna के अपने सभी playable videos पहले रहेंगे।
       * अपने videos की duration पर कोई सीमा नहीं है।
       * इसके बाद Odysee और PeerTube fallback के रूप में आएँगे।
       */

      /*
       * ----------------------------------------------------------
       * SOURCE 2: ODYSEE
       * ----------------------------------------------------------
       */
      let odyseeAdded = 0;

      for (let i = 0; i < shortsQueries.length; i++) {

        const index =
          (shortsQueryIndex + i) %
          shortsQueries.length;

        const selectedQuery =
          shortsQueries[index];

        if (shortsCategoryFinished[selectedQuery]) {
          continue;
        }

        shortsQueryIndex =
          (index + 1) %
          shortsQueries.length;

        const categoryStart =
          Number(
            shortsCategoryStarts[selectedQuery] || 0
          );

        console.log(
          "🎬 Odysee Shorts:",
          selectedQuery,
          "start:",
          categoryStart
        );

        try {

          const response = await fetch(
            "/api/odysee-search?q=" +
            encodeURIComponent(selectedQuery) +
            "&start=" +
            categoryStart
          );

          const data = await response.json();

          if (!response.ok || !data.success) {
            continue;
          }

          const videos =
            Array.isArray(data.videos)
              ? data.videos
              : [];

          const incoming =
            videos.filter(function (video) {

              const duration =
                Number(video.duration || 0);

              return (
                video.embedUrl &&
                duration > 0 &&
                duration <= 90
              );
            });

          const existing = new Set(
            shortsVideos.map(function (video) {
              return String(
                video.uuid ||
                video.id ||
                video.embedUrl ||
                video.url
              );
            })
          );

          const fresh = [];

          incoming.forEach(function (video) {

            const key = String(
              video.uuid ||
              video.id ||
              video.embedUrl ||
              video.url
            );

            if (!existing.has(key)) {

              existing.add(key);

              fresh.push(
                Object.assign({}, video, {
                  source: "odysee",
                  sourceName: "Odysee",
                  channelTitle:
                    video.channelTitle ||
                    video.channelName ||
                    "Odysee"
                })
              );
            }
          });

          const sortedFresh =
            sortShortVideos(fresh);

          shortsVideos.push(...sortedFresh);

          odyseeAdded += sortedFresh.length;

          shortsCategoryStarts[selectedQuery] =
            categoryStart +
            Math.max(videos.length, 20);

          const total =
            Number(data.total || 0);

          if (
            !videos.length ||
            (
              total > 0 &&
              shortsCategoryStarts[selectedQuery] >= total
            )
          ) {
            shortsCategoryFinished[selectedQuery] = true;
          }

          console.log(
            "🔎 Odysee Shorts:",
            "results=",
            videos.length,
            "under90=",
            incoming.length,
            "fresh=",
            sortedFresh.length
          );

          if (sortedFresh.length) {

            if (!shortsFeed) {
              createShortsFeed();
              renderShorts();
            } else {
              appendShortsItems(sortedFresh);
            }
          }

          /*
           * कुल Shorts 50 हो जाने पर Odysee रोक दें।
           * इसमें पहले से मौजूद VideoApna videos भी शामिल हैं।
           */
          if (shortsVideos.length >= batchTarget) {
            break;
          }

        } catch (odyseeError) {

          console.error(
            "ODYSEE SHORTS ERROR:",
            odyseeError.message
          );
        }
      }

      /*
       * ----------------------------------------------------------
       * SOURCE 3: PEERTUBE
       * ----------------------------------------------------------
       *
       * केवल तब जब VideoApna + Odysee पर्याप्त नहीं।
       */
      if (shortsVideos.length < batchTarget) {

        let peerTubeAdded = 0;

        for (let i = 0; i < shortsQueries.length; i++) {

          const index =
            (shortsQueryIndex + i) %
            shortsQueries.length;

          const selectedQuery =
            shortsQueries[index];

          const categoryStart =
            Number(
              shortsCategoryStarts[
                "peertube:" + selectedQuery
              ] || 0
            );

          console.log(
            "🎬 PeerTube Shorts:",
            selectedQuery,
            "start:",
            categoryStart
          );

          try {

            const response = await fetch(
              "/api/peertube-search?q=" +
              encodeURIComponent(selectedQuery) +
              "&start=" +
              categoryStart
            );

            const data =
              await response.json();

            if (!response.ok || !data.success) {
              continue;
            }

            const videos =
              Array.isArray(data.videos)
                ? data.videos
                : [];

            const incoming =
              videos.filter(function (video) {

                const duration =
                  Number(video.duration || 0);

                /*
                 * PeerTube direct videoUrl होने पर भी
                 * playable माना जाएगा।
                 */
                return (
                  duration > 0 &&
                  duration <= 90 &&
                  (
                    video.videoUrl ||
                    video.embedUrl
                  )
                );
              });

            const existing = new Set(
              shortsVideos.map(function (video) {
                return String(
                  video.uuid ||
                  video.id ||
                  video.embedUrl ||
                  video.videoUrl ||
                  video.url
                );
              })
            );

            const fresh = [];

            incoming.forEach(function (video) {

              const key = String(
                video.uuid ||
                video.id ||
                video.embedUrl ||
                video.videoUrl ||
                video.url
              );

              if (!existing.has(key)) {

                existing.add(key);

                fresh.push(
                  Object.assign({}, video, {
                    source: "peertube",
                    sourceName: "PeerTube",
                    channelTitle:
                      video.channelTitle ||
                      video.channelName ||
                      "PeerTube"
                  })
                );
              }
            });

            const sortedFresh =
              sortShortVideos(fresh);

            shortsVideos.push(...sortedFresh);

            peerTubeAdded += sortedFresh.length;

            shortsCategoryStarts[
              "peertube:" + selectedQuery
            ] =
              categoryStart +
              Math.max(videos.length, 20);

            console.log(
              "🔎 PeerTube Shorts:",
              "results=",
              videos.length,
              "under90=",
              incoming.length,
              "fresh=",
              sortedFresh.length
            );

            if (sortedFresh.length) {

              if (!shortsFeed) {
                createShortsFeed();
                renderShorts();
              } else {
                appendShortsItems(sortedFresh);
              }
            }

            /*
             * कुल Shorts 50 हो जाने पर PeerTube भी रोक दें।
             */
            if (shortsVideos.length >= batchTarget) {
              break;
            }

          } catch (peerTubeError) {

            console.error(
              "PEERTUBE SHORTS ERROR:",
              peerTubeError.message
            );
          }
        }

        console.log(
          "📊 PeerTube added:",
          peerTubeAdded
        );
      }

      /*
       * अगर कोई source कुछ भी नहीं दे पाया तो feed को finished
       * mark करें, लेकिन existing Shorts को स्क्रीन पर रहने दें।
       */
      if (!shortsVideos.length) {

        shortsFinished = true;

        console.log(
          "⚠️ कोई playable Short नहीं मिला।"
        );

      } else {

        if (!shortsFeed) {
          createShortsFeed();
          renderShorts();
        }

        console.log(
          "✅ Shorts loaded:",
          shortsVideos.length,
          "VideoApna → Odysee → PeerTube"
        );
      }

    } catch (error) {

      console.error(
        "AUTO SHORTS ERROR:",
        error
      );

    } finally {

      shortsLoading = false;
    }
  }

  function createShortsFeed() {

    shortsFeed = document.getElementById("shortsFeed");

    if (shortsFeed) return;

    shortsFeed = document.createElement("div");

    shortsFeed.id = "shortsFeed";

    document.body.appendChild(shortsFeed);

    document.body.classList.add("shorts-mode");

    const backBtn = document.createElement("button");

    backBtn.type = "button";
    backBtn.textContent = "←";
    backBtn.title = "होम पर वापस जाएँ";

    backBtn.style.position = "fixed";
    backBtn.style.top =
      "calc(14px + env(safe-area-inset-top))";
    backBtn.style.left = "14px";
    backBtn.style.width = "48px";
    backBtn.style.height = "48px";
    backBtn.style.border = "0";
    backBtn.style.borderRadius = "50%";
    backBtn.style.background = "rgba(0,0,0,.60)";
    backBtn.style.color = "#fff";
    backBtn.style.fontSize = "28px";
    backBtn.style.lineHeight = "48px";
    backBtn.style.textAlign = "center";
    backBtn.style.zIndex = "10001";

    backBtn.addEventListener("click", function (event) {

      event.preventDefault();
      event.stopPropagation();

      /*
       * Shorts छोड़ते समय current Odysee iframe
       * पूरी तरह destroy करें।
       */
      destroyAllShortsPlayers();

      document.body.classList.remove("shorts-mode");

      if (shortsFeed) {
        shortsFeed.remove();
        shortsFeed = null;
      }

      shortsIndex = 0;

      window.scrollTo(0, 0);

    });

    document.body.appendChild(backBtn);

    shortsFeed.addEventListener(
      "scroll",
      handleShortsScroll,
      { passive: true }
    );

  }


  function renderShorts() {

    if (!shortsFeed) return;

    shortsFeed.innerHTML = "";

    appendShortsItems(shortsVideos);

    document.body.classList.add("shorts-mode");

    setTimeout(function () {
      playCurrentShort();
    }, 500);

  }


  /*
   * IMPORTANT:
   * सभी Shorts के iframe एक साथ नहीं बनाए जाएंगे।
   *
   * यहाँ सिर्फ खाली Short containers बनेंगे।
   * Current Short में ही iframe बनाया जाएगा।
   */
  function appendShortsItems(videosToAdd) {

    if (!shortsFeed) return;

    videosToAdd.forEach(function (video) {

      const index = shortsVideos.indexOf(video);

      if (index < 0) return;

      /*
       * Duplicate DOM item रोकें।
       */
      if (
        shortsFeed.querySelector(
          '.videoapna-short[data-index="' + index + '"]'
        )
      ) {
        return;
      }

      const item = document.createElement("section");

      item.className = "videoapna-short";

      item.dataset.index = index;

      /*
       * Player placeholder.
       * iframe बाद में playCurrentShort() बनाएगा।
       */
      const playerBox = document.createElement("div");

      playerBox.className =
        "videoapna-short-player";

      playerBox.style.width = "100%";
      playerBox.style.height = "100%";
      playerBox.style.position = "absolute";
      playerBox.style.inset = "0";
      playerBox.style.background = "#000";

      item.appendChild(playerBox);
      /*
       * Full-screen video/iframe Android touch को अपने अंदर ले लेता है।
       * इसलिए transparent layer vertical swipe handle करेगी।
       * Sound/action buttons इसके ऊपर रहेंगे।
       */
      const swipeLayer = document.createElement("div");
      swipeLayer.className = "videoapna-short-swipe-layer";
      swipeLayer.style.position = "absolute";
      swipeLayer.style.inset = "0";
      swipeLayer.style.zIndex = "50";
      swipeLayer.style.background = "transparent";
      swipeLayer.style.touchAction = "none";

      let swipeStartY = 0;
      let swipeStartX = 0;

      swipeLayer.addEventListener(
        "touchstart",
        function (event) {
          if (!event.touches || !event.touches.length) return;

          swipeStartY = event.touches[0].clientY;
          swipeStartX = event.touches[0].clientX;
        },
        { passive: true }
      );

      swipeLayer.addEventListener(
        "touchend",
        function (event) {
          if (!event.changedTouches || !event.changedTouches.length) {
            return;
          }

          const endY = event.changedTouches[0].clientY;
          const endX = event.changedTouches[0].clientX;

          const deltaY = endY - swipeStartY;
          const deltaX = endX - swipeStartX;

          if (
            Math.abs(deltaY) < 50 ||
            Math.abs(deltaY) < Math.abs(deltaX)
          ) {
            return;
          }

          const currentIndex = shortsVideos.indexOf(video);

          if (currentIndex < 0 || !shortsFeed) return;

          let nextIndex = currentIndex;

          if (deltaY < 0) {
            nextIndex = Math.min(
              currentIndex + 1,
              shortsVideos.length - 1
            );
          } else {
            nextIndex = Math.max(
              currentIndex - 1,
              0
            );
          }

          if (nextIndex === currentIndex) return;

          const height = shortsFeed.clientHeight;
          if (!height) return;

          shortsIndex = nextIndex;

          shortsFeed.scrollTo({
            top: nextIndex * height,
            behavior: "smooth"
          });
        },
        { passive: true }
      );

      item.appendChild(swipeLayer);

      const info = document.createElement("div");

      info.className =
        "videoapna-short-info";

      info.innerHTML = `
        <div class="videoapna-short-title">
          ${escapeShortText(
            video.title || "Short"
          )}
        </div>

        <div class="videoapna-short-channel">
          ${escapeShortText(
            video.channelTitle || "Odysee"
          )}
        </div>
      `;

      item.appendChild(info);

      /*
       * Sound button
       */
      const actions = document.createElement("div");

      actions.className =
        "videoapna-short-actions";

      const soundBtn = document.createElement("button");

      soundBtn.type = "button";

      soundBtn.className =
        "videoapna-short-sound";

      function updateSoundButton() {

        soundBtn.textContent =
          shortsSoundEnabled
            ? "🔊"
            : "🔇";

        soundBtn.title =
          shortsSoundEnabled
            ? "आवाज़ बंद करें"
            : "आवाज़ चालू करें";

      }

      updateSoundButton();

      soundBtn.addEventListener(
        "click",
        function (event) {

          event.preventDefault();
          event.stopPropagation();

          shortsIndex = index;

          shortsSoundEnabled =
            !shortsSoundEnabled;

          /*
           * User interaction के बाद Sound preference
           * permanently इस Shorts session के लिए unlock है।
           */
          /*
           * एक बार user ने Sound ON किया तो
           * आगे के Shorts के लिए audio unlock रहेगा।
           */
          if (shortsSoundEnabled) {
            shortsSoundUnlocked = true;
          }

          updateAllShortsSoundButtons();

          /*
           * Current iframe को हटाएँ ताकि नया iframe
           * नई muted setting के साथ बने।
           */
          const currentPlayerBox =
            item.querySelector(
              ".videoapna-short-player"
            );

          if (currentPlayerBox) {

            const currentPlayers =
              currentPlayerBox.querySelectorAll(
                "iframe, video"
              );

            currentPlayers.forEach(function (player) {

              try {

                if (player.tagName === "VIDEO") {
                  player.pause();
                  player.currentTime = 0;
                  player.removeAttribute("src");
                  player.load();
                } else {
                  player.src = "about:blank";
                }

              } catch (e) {}

              player.remove();

            });
          }

          playCurrentShort();

          console.log(
            shortsSoundEnabled
              ? "🔊 VIDEOAPNA SHORT SOUND ON:"
              : "🔇 VIDEOAPNA SHORT SOUND OFF:",
            index
          );

        }
      );

      actions.appendChild(soundBtn);

      item.appendChild(actions);

      shortsFeed.appendChild(item);

    });

  }


  function updateAllShortsSoundButtons() {

    if (!shortsFeed) return;

    const buttons =
      shortsFeed.querySelectorAll(
        ".videoapna-short-sound"
      );

    buttons.forEach(function (button) {

      button.textContent =
        shortsSoundEnabled
          ? "🔊"
          : "🔇";

      button.title =
        shortsSoundEnabled
          ? "आवाज़ बंद करें"
          : "आवाज़ चालू करें";

    });

  }


  /*
   * सभी Shorts players destroy करें।
   * iframe और HTML5 video दोनों को बंद करें।
   */
  function destroyAllShortsPlayers() {

    if (!shortsFeed) return;

    const players =
      shortsFeed.querySelectorAll(
        "iframe, video"
      );

    players.forEach(function (player) {

      try {

        if (player.tagName === "VIDEO") {
          player.pause();
          player.currentTime = 0;
          player.removeAttribute("src");
          player.load();
        } else {
          player.src = "about:blank";
        }

      } catch (e) {}

      player.remove();

    });

    const playerBoxes =
      shortsFeed.querySelectorAll(
        ".videoapna-short-player"
      );

    playerBoxes.forEach(function (box) {
      box.innerHTML = "";
    });

  }

  async function createShortIframe(video) {
    if (!video) {
      return null;
    }

    /*
     * VideoApna / VCDN Shorts:
     * VCDN का पुराना storage master.m3u8 URL सीधे usable नहीं है।
     * पहले player-config से temporary token वाला playbackUrl लें।
     */
    if (
      String(video.source || "").toLowerCase() === "videoapna" &&
      video.vcdnVideoId
    ) {
      try {
        const configUrl =
          "https://embed.vcdn.me/api/bff/player-config/" +
          encodeURIComponent(String(video.vcdnVideoId));

        const response = await fetch(configUrl, {
          method: "GET",
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error(
            "VCDN player-config HTTP " + response.status
          );
        }

        const config = await response.json();

        const playbackUrl =
          config.playbackUrl ||
          config.streamUrl ||
          (
            Array.isArray(config.playbackSources) &&
            config.playbackSources[0] &&
            config.playbackSources[0].streamUrl
          );

        if (!playbackUrl) {
          throw new Error("VCDN playbackUrl नहीं मिला।");
        }

        const player = document.createElement("video");

        player.src = String(playbackUrl);
        player.autoplay = true;
        player.loop = false;
        player.playsInline = true;
        player.controls = true;

        player.muted = !(
          shortsSoundEnabled &&
          shortsSoundUnlocked
        );

        player.style.width = "100%";
        player.style.height = "100%";
        player.style.objectFit = "contain";
        player.style.background = "#000";
        player.style.display = "block";

        player.setAttribute("playsinline", "");
        player.setAttribute("webkit-playsinline", "");

        player.addEventListener("error", function () {
          console.error(
            "❌ VideoApna VCDN playback error:",
            video.vcdnVideoId,
            player.error
          );
        });

        console.log(
          "✅ VideoApna VCDN token playback:",
          video.title || "",
          video.vcdnVideoId
        );

        return player;

      } catch (error) {
        console.error(
          "❌ VideoApna VCDN playback config failed:",
          error
        );

        /*
         * अगर token playback किसी कारण से fail हो,
         * तो पुराने VCDN embed को fallback रखें।
         */
      }
    }

    /*
     * PeerTube direct videoUrl उपलब्ध हो तो HTML5 video इस्तेमाल करें।
     */
    if (
      String(video.source || "").toLowerCase() === "peertube" &&
      video.videoUrl
    ) {
      const player = document.createElement("video");

      player.src = String(video.videoUrl);
      player.autoplay = true;
      player.loop = false;
      player.playsInline = true;
      player.controls = true;

      player.muted = !(
        shortsSoundEnabled &&
        shortsSoundUnlocked
      );

      player.style.width = "100%";
      player.style.height = "100%";
      player.style.objectFit = "contain";
      player.style.background = "#000";
      player.style.display = "block";

      player.setAttribute("playsinline", "");
      player.setAttribute("webkit-playsinline", "");

      return player;
    }

    /*
     * VideoApna VCDN token playback fail होने पर,
     * या Odysee के लिए iframe fallback।
     */
    if (!video.embedUrl) {
      return null;
    }

    const iframe = document.createElement("iframe");

    let src = String(video.embedUrl);

    const separator = src.includes("?")
      ? "&"
      : "?";

    src +=
      separator +
      "api=1" +
      "&autoplay=1" +
      "&muted=" +
      (
        shortsSoundEnabled &&
        shortsSoundUnlocked
          ? "0"
          : "1"
      ) +
      "&controls=1";

    iframe.src = src;

    iframe.title =
      video.title || "Short";

    iframe.allow =
      "autoplay; encrypted-media; picture-in-picture";

    iframe.allowFullscreen = true;

    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "0";
    iframe.style.display = "block";

    return iframe;
  }

  function handleShortsScroll() {

    if (!shortsFeed) return;

    const height =
      shortsFeed.clientHeight;

    if (!height) return;

    const newIndex =
      Math.round(
        shortsFeed.scrollTop / height
      );

    if (
      newIndex !== shortsIndex &&
      newIndex >= 0 &&
      newIndex < shortsVideos.length
    ) {

      shortsIndex = newIndex;

      /*
       * पुराने iframe को तुरंत हटाकर
       * नया current Short load करें।
       */
      playCurrentShort();

    }

    /*
     * आखिरी 10 Shorts के पास पहुँचते ही
     * अगला batch पहले से लोड करना शुरू करें।
     */
    if (
      newIndex >=
        shortsVideos.length - 10 &&
      !shortsLoading &&
      !shortsFinished
    ) {

      console.log(
        "⏳ VIDEOAPNA Shorts: अगला batch लोड हो रहा है..."
      );

      loadShortsFeed(true);

    }

  }


  async function playCurrentShort() {

    if (!shortsFeed) return;

    const items =
      Array.from(
        shortsFeed.querySelectorAll(
          ".videoapna-short"
        )
      );

    const currentItem =
      items[shortsIndex];

    if (!currentItem) return;

    /*
     * बहुत जरूरी:
     * Current Short बदलते ही बाकी सभी players
     * destroy करें।
     */
    items.forEach(function (item, index) {

      if (index === shortsIndex) return;

      const oldPlayers =
        item.querySelectorAll("iframe, video");

      oldPlayers.forEach(function (player) {

        try {

          if (player.tagName === "VIDEO") {
            player.pause();
            player.currentTime = 0;
            player.removeAttribute("src");
            player.load();
          } else {
            player.src = "about:blank";
          }

        } catch (e) {}

        player.remove();

      });

    });

    const playerBox =
      currentItem.querySelector(
        ".videoapna-short-player"
      );

    if (!playerBox) return;

    /*
     * अगर current player पहले से मौजूद है,
     * उसे दोबारा reload नहीं करें।
     */
    const existingPlayer =
      playerBox.querySelector("iframe, video");

    if (existingPlayer) {

      console.log(
        shortsSoundEnabled
          ? "▶️ Current Short already loaded:"
          : "🔇 Current Short already loaded:",
        shortsIndex
      );

      return;

    }

    const video =
      shortsVideos[shortsIndex];

    if (!video) return;

    /*
     * नया iframe सिर्फ current Short के लिए।
     */
    const iframe =
      await createShortIframe(video);

    if (!iframe) return;

    playerBox.innerHTML = "";

    playerBox.appendChild(iframe);

    console.log(
      shortsSoundEnabled
        ? "▶️ VIDEOAPNA SHORT PLAY:"
        : "🔇 VIDEOAPNA SHORT PLAY MUTED:",
      shortsIndex,
      video.title || ""
    );

  }


  function escapeShortText(value) {

    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  }


  window.videoApnaLoadShorts =
    loadShortsFeed;

  // Shorts अब Home खुलते ही अपने-आप नहीं चलेगा।
  // इसे सिर्फ Shorts खोलने पर videoApnaLoadShorts() से चलाया जाएगा.


  window.videoApnaLoadShorts = loadShortsFeed;

  // Shorts अब Home खुलते ही अपने-आप नहीं चलेगा।
  // इसे सिर्फ Shorts खोलने पर videoApnaLoadShorts() से चलाया जाएगा।

})();


/* =========================================
   VIDEOAPNA OWNER REPORT PANEL JS
========================================= */

let ownerReports = [];
let ownerReportsLoading = false;


/* Owner Panel खोलना */
window.openOwnerPanel = async function () {
  const section = document.getElementById("ownerPanelSection");

  if (!section) {
    console.error("Owner Panel section नहीं मिला।");
    return;
  }

  section.classList.remove("hidden");

  /* बाकी मुख्य sections छुपाएँ */
  document.querySelectorAll("main > section").forEach(el => {
    if (el.id !== "ownerPanelSection") {
      el.classList.add("hidden");
    }
  });

  await checkOwnerSession();
};


/* Owner session check */
async function checkOwnerSession() {
  const loginBox =
    document.getElementById("ownerLoginBox");

  const dashboardBox =
    document.getElementById("ownerDashboardBox");

  const message =
    document.getElementById("ownerLoginMessage");

  try {
    const response =
      await fetch("/api/owner/me", {
        credentials: "same-origin"
      });

    const data = await response.json();

    if (
      response.ok &&
      data.success &&
      data.authenticated
    ) {
      loginBox?.classList.add("hidden");
      dashboardBox?.classList.remove("hidden");

      const email =
        document.getElementById("ownerLoggedEmail");

      if (email) {
        email.textContent =
          data.owner?.email || "";
      }

      await loadOwnerReports();

    } else {
      loginBox?.classList.remove("hidden");
      dashboardBox?.classList.add("hidden");

      if (message) {
        message.textContent =
          "Owner Login करें।";
      }
    }

  } catch (error) {
    console.error(
      "OWNER SESSION CHECK ERROR:",
      error
    );

    if (message) {
      message.textContent =
        "Owner Session check नहीं हो पाया।";
    }
  }
}


/* Owner Login */
async function ownerLogin() {
  const emailInput =
    document.getElementById("ownerEmailInput");

  const passwordInput =
    document.getElementById("ownerPasswordInput");

  const message =
    document.getElementById("ownerLoginMessage");

  const email =
    String(emailInput?.value || "").trim();

  const password =
    String(passwordInput?.value || "");

  if (!email || !password) {
    if (message) {
      message.textContent =
        "Email और Password दोनों भरें।";
    }
    return;
  }

  const button =
    document.getElementById("ownerLoginBtn");

  if (button) {
    button.disabled = true;
    button.textContent = "⏳ Login हो रहा है...";
  }

  try {
    const response =
      await fetch("/api/owner/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "same-origin",
        body: JSON.stringify({
          email,
          password
        })
      });

    const data =
      await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message ||
        "Owner Login failed"
      );
    }

    if (message) {
      message.textContent =
        "✅ Owner Login सफल है।";
    }

    if (passwordInput) {
      passwordInput.value = "";
    }

    await checkOwnerSession();

  } catch (error) {
    console.error(
      "OWNER LOGIN ERROR:",
      error
    );

    if (message) {
      message.textContent =
        "❌ " + error.message;
    }

  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "🔐 Owner Login";
    }
  }
}


/* Owner Logout */
async function ownerLogout() {
  try {
    const response =
      await fetch("/api/owner/logout", {
        method: "POST",
        credentials: "same-origin"
      });

    const data =
      await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message ||
        "Logout failed"
      );
    }

    ownerReports = [];

    const list =
      document.getElementById("ownerReportsList");

    if (list) {
      list.innerHTML = "";
    }

    document
      .getElementById("ownerDashboardBox")
      ?.classList.add("hidden");

    document
      .getElementById("ownerLoginBox")
      ?.classList.remove("hidden");

    const message =
      document.getElementById("ownerLoginMessage");

    if (message) {
      message.textContent =
        "✅ Owner Logout हो गया।";
    }

  } catch (error) {
    console.error(
      "OWNER LOGOUT ERROR:",
      error
    );

    alert(
      "Logout में समस्या हुई: " +
      error.message
    );
  }
}


/* Reports load */
async function loadOwnerReports() {
  if (ownerReportsLoading) return;

  ownerReportsLoading = true;

  const message =
    document.getElementById("ownerReportsMessage");

  if (message) {
    message.textContent =
      "⏳ Reports लोड हो रही हैं...";
  }

  try {
    const response =
      await fetch("/api/owner/reports", {
        credentials: "same-origin"
      });

    const data =
      await response.json();

    if (response.status === 401) {
      await checkOwnerSession();
      return;
    }

    if (!response.ok || !data.success) {
      throw new Error(
        data.message ||
        "Reports load failed"
      );
    }

    ownerReports =
      Array.isArray(data.reports)
        ? data.reports
        : [];

    updateOwnerReportSummary();
    renderOwnerReports();

  } catch (error) {
    console.error(
      "OWNER REPORT LOAD ERROR:",
      error
    );

    if (message) {
      message.textContent =
        "❌ Reports load नहीं हो पाईं: " +
        error.message;
    }

  } finally {
    ownerReportsLoading = false;
  }
}


/* Summary */
function updateOwnerReportSummary() {
  const total =
    ownerReports.length;

  const pending =
    ownerReports.filter(
      r => String(r.status || "pending") === "pending"
    ).length;

  const resolved =
    ownerReports.filter(
      r => String(r.status || "") === "resolved"
    ).length;

  const rejected =
    ownerReports.filter(
      r => String(r.status || "") === "rejected"
    ).length;

  const totalEl =
    document.getElementById("ownerTotalReports");

  const pendingEl =
    document.getElementById("ownerPendingReports");

  const resolvedEl =
    document.getElementById("ownerResolvedReports");

  const rejectedEl =
    document.getElementById("ownerRejectedReports");

  if (totalEl) totalEl.textContent = total;
  if (pendingEl) pendingEl.textContent = pending;
  if (resolvedEl) resolvedEl.textContent = resolved;
  if (rejectedEl) rejectedEl.textContent = rejected;
}


/* HTML safe text */
function ownerEscapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


/* Reports render */
function renderOwnerReports() {
  const list =
    document.getElementById("ownerReportsList");

  const filter =
    document.getElementById("ownerReportFilter")
      ?.value || "all";

  const message =
    document.getElementById("ownerReportsMessage");

  if (!list) return;

  let reports =
    ownerReports.slice();

  if (filter !== "all") {
    reports =
      reports.filter(
        r =>
          String(r.status || "pending") === filter
      );
  }

  if (!reports.length) {
    list.innerHTML =
      '<div class="owner-no-reports">📭 इस filter में कोई Report नहीं है।</div>';

    if (message) {
      message.textContent =
        "Reports: 0";
    }

    return;
  }

  if (message) {
    message.textContent =
      "Reports: " + reports.length;
  }

  list.innerHTML =
    reports.map(report => {

      const status =
        String(report.status || "pending");

      const source =
        String(report.source || "videoapna");

      const created =
        report.createdAt
          ? new Date(report.createdAt)
              .toLocaleString("hi-IN")
          : "समय उपलब्ध नहीं";

      const reviewed =
        report.reviewedAt
          ? new Date(report.reviewedAt)
              .toLocaleString("hi-IN")
          : "";

      const statusLabel =
        status === "pending"
          ? "🟡 Pending"
          : status === "resolved"
          ? "🟢 Resolved"
          : status === "rejected"
          ? "🔴 Rejected"
          : status;

      const isPending =
        status === "pending";

      const actionButtons =
        isPending
          ? `
            <div class="owner-report-actions">

              <button
                type="button"
                class="owner-action-private"
                data-report-id="${ownerEscapeHtml(report.id)}"
              >
                🔒 Private
              </button>

              <button
                type="button"
                class="owner-action-delete"
                data-report-id="${ownerEscapeHtml(report.id)}"
              >
                🗑️ Delete
              </button>

              <button
                type="button"
                class="owner-action-resolve"
                data-report-id="${ownerEscapeHtml(report.id)}"
              >
                ✅ Resolve
              </button>

              <button
                type="button"
                class="owner-action-reject"
                data-report-id="${ownerEscapeHtml(report.id)}"
              >
                ❌ Reject
              </button>

            </div>
          `
          : `
            <div class="owner-report-actions">

              ${
                status === "resolved"
                  ? `
                    <button
                      type="button"
                      class="owner-action-restore"
                      data-report-id="${ownerEscapeHtml(report.id)}"
                    >
                      ♻️ Restore
                    </button>
                  `
                  : ""
              }

            </div>
          `;

      return `
        <article class="owner-report-card">

          <div class="owner-report-card-top">

            <strong>
              🚩 ${ownerEscapeHtml(
                report.videoTitle || "Unknown Video"
              )}
            </strong>

            <span class="owner-report-status">
              ${ownerEscapeHtml(statusLabel)}
            </span>

          </div>

          <div class="owner-report-info">

            <p>
              <strong>Video ID:</strong>
              ${ownerEscapeHtml(report.videoId)}
            </p>

            <p>
              <strong>Source:</strong>
              ${ownerEscapeHtml(source)}
            </p>

            <p>
              <strong>Reporter:</strong>
              ${ownerEscapeHtml(report.reporterUserId)}
            </p>

            <p>
              <strong>Reason:</strong>
              ${ownerEscapeHtml(report.reason)}
            </p>

            ${
              report.details
                ? `
                  <p>
                    <strong>Details:</strong>
                    ${ownerEscapeHtml(report.details)}
                  </p>
                `
                : ""
            }

            <p>
              <strong>Report Time:</strong>
              ${ownerEscapeHtml(created)}
            </p>

            ${
              report.action
                ? `
                  <p>
                    <strong>Action:</strong>
                    ${ownerEscapeHtml(report.action)}
                  </p>
                `
                : ""
            }

            ${
              report.moderatorNote
                ? `
                  <p>
                    <strong>Owner Note:</strong>
                    ${ownerEscapeHtml(report.moderatorNote)}
                  </p>
                `
                : ""
            }

            ${
              reviewed
                ? `
                  <p>
                    <strong>Reviewed:</strong>
                    ${ownerEscapeHtml(reviewed)}
                  </p>
                `
                : ""
            }

          </div>

          ${actionButtons}

        </article>
      `;
    }).join("");
}


/* Moderation action */
async function ownerReportAction(
  reportId,
  action
) {
  const report =
    ownerReports.find(
      r => String(r.id) === String(reportId)
    );

  if (!report) {
    alert("Report नहीं मिली।");
    return;
  }

  let note = "";

  if (
    action === "private" ||
    action === "delete" ||
    action === "reject"
  ) {
    note =
      window.prompt(
        "Owner Note लिखें:",
        ""
      );

    if (note === null) {
      return;
    }
  }

  if (action === "delete") {
    const ok =
      window.confirm(
        "क्या आप इस Video को सच में Delete करना चाहते हैं?"
      );

    if (!ok) return;
  }

  try {
    const response =
      await fetch(
        "/api/owner/reports/" +
        encodeURIComponent(reportId) +
        "/action",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          credentials: "same-origin",
          body: JSON.stringify({
            action,
            moderatorNote: note
          })
        }
      );

    const data =
      await response.json();

    if (response.status === 401) {
      alert("Owner Login जरूरी है।");
      await checkOwnerSession();
      return;
    }

    if (!response.ok || !data.success) {
      throw new Error(
        data.message ||
        "Moderation action failed"
      );
    }

    alert(
      "✅ " +
      (data.message || "Action सफल है।")
    );

    await loadOwnerReports();

  } catch (error) {
    console.error(
      "OWNER REPORT ACTION ERROR:",
      error
    );

    alert(
      "❌ Action नहीं हो पाया: " +
      error.message
    );
  }
}


/* Buttons */
document.addEventListener(
  "click",
  event => {

    const loginBtn =
      event.target.closest(
        "#ownerLoginBtn"
      );

    if (loginBtn) {
      ownerLogin();
      return;
    }

    const logoutBtn =
      event.target.closest(
        "#ownerLogoutBtn"
      );

    if (logoutBtn) {
      ownerLogout();
      return;
    }

    const refreshBtn =
      event.target.closest(
        "#ownerRefreshReportsBtn"
      );

    if (refreshBtn) {
      loadOwnerReports();
      return;
    }

    const privateBtn =
      event.target.closest(
        ".owner-action-private"
      );

    if (privateBtn) {
      ownerReportAction(
        privateBtn.dataset.reportId,
        "private"
      );
      return;
    }

    const deleteBtn =
      event.target.closest(
        ".owner-action-delete"
      );

    if (deleteBtn) {
      ownerReportAction(
        deleteBtn.dataset.reportId,
        "delete"
      );
      return;
    }

    const resolveBtn =
      event.target.closest(
        ".owner-action-resolve"
      );

    if (resolveBtn) {
      ownerReportAction(
        resolveBtn.dataset.reportId,
        "resolve"
      );
      return;
    }

    const rejectBtn =
      event.target.closest(
        ".owner-action-reject"
      );

    if (rejectBtn) {
      ownerReportAction(
        rejectBtn.dataset.reportId,
        "reject"
      );
      return;
    }

    const restoreBtn =
      event.target.closest(
        ".owner-action-restore"
      );

    if (restoreBtn) {
      ownerReportAction(
        restoreBtn.dataset.reportId,
        "restore"
      );
      return;
    }

  },
  true
);


/* Filter */
document.addEventListener(
  "change",
  event => {

    if (
      event.target &&
      event.target.id === "ownerReportFilter"
    ) {
      renderOwnerReports();
    }

  },
  true
);


/* Back button */
document.addEventListener(
  "click",
  event => {

    const backBtn =
      event.target.closest(
        "#ownerPanelBack"
      );

    if (!backBtn) return;

    document
      .getElementById("ownerPanelSection")
      ?.classList.add("hidden");

    /* Home वापस */
    if (typeof window.showHome === "function") {
      window.showHome();
    } else {
      document
        .querySelector("main > section")
        ?.classList.remove("hidden");
    }

  },
  true
);




  const openOwnerPanelBtn =
    document.getElementById("openOwnerPanelBtn");

  if (openOwnerPanelBtn) {
    openOwnerPanelBtn.addEventListener("click", () => {
      if (typeof window.openOwnerPanel === "function") {
        window.openOwnerPanel();
      } else {
        console.error("openOwnerPanel function नहीं मिला।");
      }
    });
  }



/* =========================================
   VIDEOAPNA PUBLIC ACCOUNT UI
========================================= */
(function initVideoApnaPublicAccount() {

  function showAccountMessage(message, success = false) {
    const el = document.getElementById("publicAccountMessage");
    if (!el) return;

    el.textContent = message;
    el.style.display = "block";
    el.style.color = success ? "#15803d" : "#b91c1c";
  }

  function setAccountUI(authenticated, user) {
    const loggedOut =
      document.getElementById("publicAccountLoggedOut");

    const loggedIn =
      document.getElementById("publicAccountLoggedIn");

    const status =
      document.getElementById("publicAccountStatus");

    const emailText =
      document.getElementById("publicAccountEmailText");

    if (!loggedOut || !loggedIn) return;

    if (authenticated && user) {
      loggedOut.classList.add("hidden");
      loggedIn.classList.remove("hidden");

      if (emailText) {
        emailText.textContent = user.email || "";
      }

      if (status) {
        status.textContent =
          "✅ आपका VideoApna Account Login है। अब आप अपना वीडियो Upload कर सकते हैं।";
      }
    } else {
      loggedOut.classList.remove("hidden");
      loggedIn.classList.add("hidden");

      if (status) {
        status.textContent =
          "वीडियो देखने के लिए Login जरूरी नहीं है। अपना वीडियो Upload करने के लिए Account बनाइए।";
      }
    }
  }

  async function checkPublicAccount() {
    try {
      const response = await fetch("/api/auth/me", {
        credentials: "include"
      });

      const data = await response.json();

      if (response.ok && data.success && data.authenticated) {
        setAccountUI(true, data.user);
      } else {
        setAccountUI(false, null);
      }

    } catch (error) {
      console.error("PUBLIC ACCOUNT ME ERROR:", error);
      setAccountUI(false, null);
    }
  }

  async function registerPublicAccount() {

    const name =
      (document.getElementById("publicAccountName")?.value || "").trim();

    const email =
      (document.getElementById("publicAccountEmail")?.value || "").trim();

    const password =
      document.getElementById("publicAccountPassword")?.value || "";

    if (!email) {
      showAccountMessage("❌ Email डालिए।");
      return;
    }

    if (password.length < 8) {
      showAccountMessage("❌ Password कम से कम 8 अक्षर का होना चाहिए।");
      return;
    }

    showAccountMessage("⏳ Account बनाया जा रहा है...", true);

    try {

      const response = await fetch("/api/auth/register", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email,
          password,
          displayName: name || "VideoApna User"
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        showAccountMessage(
          "❌ " + (data.message || "Account नहीं बन पाया।")
        );
        return;
      }

      showAccountMessage(
        "✅ Account सफलतापूर्वक बन गया।",
        true
      );

      setAccountUI(true, data.user);

      const passwordInput =
        document.getElementById("publicAccountPassword");

      if (passwordInput) {
        passwordInput.value = "";
      }

    } catch (error) {

      console.error("PUBLIC REGISTER ERROR:", error);

      showAccountMessage(
        "❌ Server से connection नहीं हो पाया।"
      );
    }
  }

  async function loginPublicAccount() {

    const email =
      (document.getElementById("publicAccountEmail")?.value || "").trim();

    const password =
      document.getElementById("publicAccountPassword")?.value || "";

    if (!email || !password) {
      showAccountMessage("❌ Email और Password दोनों डालिए।");
      return;
    }

    showAccountMessage("⏳ Login हो रहा है...", true);

    try {

      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email,
          password
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        showAccountMessage(
          "❌ " + (data.message || "Login नहीं हुआ।")
        );
        return;
      }

      showAccountMessage(
        "✅ Login सफल है।",
        true
      );

      setAccountUI(true, data.user);

      const passwordInput =
        document.getElementById("publicAccountPassword");

      if (passwordInput) {
        passwordInput.value = "";
      }

    } catch (error) {

      console.error("PUBLIC LOGIN ERROR:", error);

      showAccountMessage(
        "❌ Server से connection नहीं हो पाया।"
      );
    }
  }

  async function logoutPublicAccount() {

    try {

      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include"
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        showAccountMessage(
          "❌ Logout नहीं हो पाया।"
        );
        return;
      }

      setAccountUI(false, null);

      showAccountMessage(
        "✅ Logout सफल है।",
        true
      );

    } catch (error) {

      console.error("PUBLIC LOGOUT ERROR:", error);

      showAccountMessage(
        "❌ Server से connection नहीं हो पाया।"
      );
    }
  }

  function bindPublicAccountButtons() {

    const registerBtn =
      document.getElementById("publicAccountRegisterBtn");

    const loginBtn =
      document.getElementById("publicAccountLoginBtn");

    const logoutBtn =
      document.getElementById("publicAccountLogoutBtn");

    const forgotBtn =
      document.getElementById("publicAccountForgotBtn");

    if (registerBtn && !registerBtn.dataset.accountBound) {
      registerBtn.dataset.accountBound = "1";
      registerBtn.addEventListener(
        "click",
        registerPublicAccount
      );
    }

    if (loginBtn && !loginBtn.dataset.accountBound) {
      loginBtn.dataset.accountBound = "1";
      loginBtn.addEventListener(
        "click",
        loginPublicAccount
      );
    }

    if (logoutBtn && !logoutBtn.dataset.accountBound) {
      logoutBtn.dataset.accountBound = "1";
      logoutBtn.addEventListener(
        "click",
        logoutPublicAccount
      );
    }

    if (forgotBtn && !forgotBtn.dataset.accountBound) {
      forgotBtn.dataset.accountBound = "1";
      forgotBtn.addEventListener("click", function () {
        showAccountMessage(
          "ℹ️ Password Recovery जल्द जोड़ा जाएगा।"
        );
      });
    }
  }

  function initPublicAccount() {
    bindPublicAccountButtons();
    checkPublicAccount();
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initPublicAccount
    );
  } else {
    initPublicAccount();
  }

  window.initVideoApnaPublicAccount =
    initPublicAccount;

})();
