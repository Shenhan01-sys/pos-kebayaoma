/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Dev via tunnel publik (cloudflared quick tunnel / LAN): izinkan origin non-localhost
  // supaya HMR & chunk /_next/* tidak diblokir (stuck loading 0% di device lain).
  allowedDevOrigins: ["links-landscape-troy-command.trycloudflare.com", "192.168.18.147"],
};

export default nextConfig;
