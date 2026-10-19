/* =========================================================
   SERVICE WORKER — Шпион: Ложная Локация
   Офлайн-кэширование статических ресурсов
   ========================================================= */

"use strict";

/* Версия кэша. При изменении содержимого файлов увеличивайте номер,
   чтобы старый кэш автоматически очистился при обновлении. */
const CACHE_NAME = "party-games-v9";

/* Файлы, которые сохраняем для офлайн-работы */
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./pool.js",
  "./airhockey.js",
  "./manifest.json"
];

/* ===== УСТАНОВКА: кладём все файлы в кэш ===== */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

/* ===== АКТИВАЦИЯ: удаляем старые кэши ===== */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* ===== ЗАПРОСЫ: сначала кэш, затем сеть ===== */
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Обрабатываем только GET-запросы
  if (request.method !== "GET") return;

  // Только запросы своего источника (файлы приложения)
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Навигационные запросы (открытие страницы офлайн)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match("./index.html").then((cached) => cached || caches.match("./"))
      )
    );
    return;
  }

  // Остальные ресурсы: cache-first с обновлением из сети
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          // Кэшируем успешные ответы
          if (response && response.status === 200 && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});