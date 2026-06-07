const apiBaseUrl = require("./urlEndPoint");

let isRefreshing = false;
let refreshSubscribers = []; // Antrean untuk request yang menunggu

// Fungsi untuk memasukkan request ke antrean
const subscribeTokenRefresh = (cb) => {
  refreshSubscribers.push(cb);
};

// Fungsi untuk menjalankan semua request yang mengantri setelah refresh sukses
const onRefreshed = () => {
  refreshSubscribers.map((cb) => cb());
  refreshSubscribers = [];
};

const fetchWithAuth = async (url, option = {}) => {
  const defaultOptions = {
    ...option,
    headers: {
      "Content-Type": "application/json",
      ...option.headers,
    },
    credentials: "include",
  };

  try {
    let res = await fetch(url, defaultOptions);

    if (res.status === 401) {
      // Jika sedang ada proses refresh, bungkus fetch ini dalam Promise yang menunggu
      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribeTokenRefresh(() => {
            resolve(fetchWithAuth(url, option));
          });
        });
      }

      isRefreshing = true;

      try {
        const refreshRes = await fetch(`${apiBaseUrl}/auth/refresh_token`, {
          method: "POST",
          credentials: "include",
        });

        if (refreshRes.ok) {
          isRefreshing = false;
          onRefreshed(); // Jalankan semua yang mengantri
          return await fetchWithAuth(url, option); // Ulangi request saat ini
        } else {
          // Jika refresh token juga expired/gagal
          isRefreshing = false;
          // Cek jika kita di browser, baru redirect
          if (typeof window !== "undefined") {
            window.location.href = "/login";
          }
          return Promise.reject("Session Expired");
        }
      } catch (err) {
        isRefreshing = false;
        return Promise.reject(err);
      }
    }

    if (!res.ok) {
      const errorData = await res.json();
      return Promise.reject(errorData);
    }

    return await res.json();
  } catch (error) {
    throw error;
  }
};

module.exports = fetchWithAuth;
