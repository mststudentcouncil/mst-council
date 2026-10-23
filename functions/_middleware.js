// ไฟล์: functions/_middleware.js

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // ============================================================================
  // 1. อนุญาตให้โหลดหน้าหลัก (หน้าแรก) และไฟล์ที่เกี่ยวข้องได้โดยไม่ต้องล็อกอิน
  // ============================================================================
  const publicPaths = [
    "/", 
    "/index", 
    "/index.html", 
    "/logo.webp", 
    "/favicon.ico", 
    "/robots.txt",
    "/sitemap.xml",
    "/auth/ip",
    "/manifest.json",
    "/feedback.html",
    "/richmenuline.html",
    "/maintenance.html",
    "/404.html"
  ];
  
  // อนุญาตโฟลเดอร์ที่เก็บรูปภาพ สคริปต์ หรือ CSS ของหน้าเว็บหลัก (โฟลเดอร์ใน GitHub)
  const publicPrefixes = [
    "/member/",   // ปลดล็อกโฟลเดอร์ member ทั้งหมด (67, 68, 69)
    "/public/",
    "/assets/",   // (ถ้ามี) โฟลเดอร์เก็บไฟล์ css/js ของหน้าหลัก
    "/files/"    // (ถ้ามี) โฟลเดอร์เก็บรูปภาพอื่นๆ
  ];

  const isPublicPath = publicPaths.includes(url.pathname);
  const isPublicPrefix = publicPrefixes.some(prefix => url.pathname.startsWith(prefix));

  // หากเป็นหน้าหลัก หรือไฟล์ในโฟลเดอร์สาธารณะ ให้ปล่อยผ่านทันที
  if (isPublicPath || isPublicPrefix) {
    return next(); 
  }

  // ============================================================================
  // 2. ดึงค่าตั้งต้นจาก Cloudflare Variables and secrets
  // ============================================================================
  const rawSchoolIps = (env.SCHOOL_IPS || "").trim();
  const schoolIpList =
    !rawSchoolIps || rawSchoolIps.toUpperCase() === "NONE"
      ? []
      : rawSchoolIps.split(",").map((ip) => ip.trim()).filter(Boolean);

  const CONFIG = {
    SCHOOL_IPS: schoolIpList,
    ALLOWED_DOMAIN: (env.ALLOWED_DOMAIN || "mst.ac.th").trim().toLowerCase(),
    GOOGLE_CLIENT_ID: (env.GOOGLE_CLIENT_ID || "").trim(),
    GOOGLE_CLIENT_SECRET: (env.GOOGLE_CLIENT_SECRET || "").trim(),
    SESSION_SECRET: env.SESSION_SECRET || "mstsc-central-portal-secret-key-2026",
    SESSION_DURATION: 60 * 60 * 12, // อายุการเข้าสู่ระบบ 12 ชั่วโมง
  };

  const clientIP = request.headers.get("CF-Connecting-IP") || "ไม่ทราบหมายเลข IP";

  // ============================================================================
  // 3. หน้าสำหรับตรวจสอบเลข IP ปัจจุบัน (เข้าดูได้ที่ /auth/ip)
  // ============================================================================
  if (url.pathname === "/auth/ip") {
    return new Response(
      JSON.stringify(
        {
          ip: clientIP,
          is_school_wifi: checkIsSchoolWiFi(clientIP, CONFIG.SCHOOL_IPS),
          configured_school_ips: CONFIG.SCHOOL_IPS,
        },
        null,
        2
      ),
      {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }
    );
  }

  // ============================================================================
  // 4. ตรวจสอบว่าเป็น Wi-Fi โรงเรียนหรือไม่ (ถ้าใช่ ให้เข้าใช้งานทุกระบบได้ทันที)
  // ============================================================================
  const isSchoolWiFi = checkIsSchoolWiFi(clientIP, CONFIG.SCHOOL_IPS);

  if (isSchoolWiFi && !url.pathname.startsWith("/auth/")) {
    return next();
  }

  // ============================================================================
  // 5. จัดการเส้นทางยืนยันตัวตน (/auth/login, /auth/callback, /auth/logout)
  // ============================================================================
  const redirectUri = `${url.origin}/auth/callback`;

  // 5.1 เริ่มต้นล็อกอินผ่าน Google OAuth
  if (url.pathname === "/auth/login") {
    if (!CONFIG.GOOGLE_CLIENT_ID || !CONFIG.GOOGLE_CLIENT_SECRET) {
      return renderGatewayPage(
        clientIP,
        CONFIG.ALLOWED_DOMAIN,
        "/",
        "ระบบยังไม่ได้ตั้งค่า GOOGLE_CLIENT_ID หรือ GOOGLE_CLIENT_SECRET ใน Cloudflare"
      );
    }

    const returnTo = sanitizeReturnPath(url.searchParams.get("return_to") || "/");
    const state = crypto.randomUUID();

    const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    googleAuthUrl.searchParams.set("client_id", CONFIG.GOOGLE_CLIENT_ID);
    googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
    googleAuthUrl.searchParams.set("response_type", "code");
    googleAuthUrl.searchParams.set("scope", "openid email profile");
    googleAuthUrl.searchParams.set("hd", CONFIG.ALLOWED_DOMAIN);
    googleAuthUrl.searchParams.set("state", state);
    googleAuthUrl.searchParams.set("prompt", "select_account");

    const headers = new Headers();
    headers.set("Location", googleAuthUrl.toString());
    headers.append(
      "Set-Cookie",
      `mst_oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`
    );
    headers.append(
      "Set-Cookie",
      `mst_return_to=${encodeURIComponent(returnTo)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`
    );

    return new Response(null, { status: 302, headers });
  }

  // 5.2 ออกจากระบบเครือข่าย
  if (url.pathname === "/auth/logout") {
    return new Response(null, {
      status: 302,
      headers: {
        "Location": "/",
        "Set-Cookie": "mst_network_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0",
      },
    });
  }

  // 5.3 รับผลลัพธ์กลับมาจาก Google (Callback)
  if (url.pathname === "/auth/callback") {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    const cookies = parseCookies(request.headers.get("Cookie") || "");
    const returnTo = sanitizeReturnPath(
      cookies.mst_return_to ? decodeURIComponent(cookies.mst_return_to) : "/"
    );

    if (error) {
      return renderGatewayPage(
        clientIP,
        CONFIG.ALLOWED_DOMAIN,
        returnTo,
        "ยกเลิกการเข้าสู่ระบบ หรือบัญชีของคุณไม่ได้รับอนุญาตจากองค์กร"
      );
    }

    if (!code || !state || state !== cookies.mst_oauth_state) {
      return renderGatewayPage(
        clientIP,
        CONFIG.ALLOWED_DOMAIN,
        returnTo,
        "เซสชันการยืนยันตัวตนหมดอายุ กรุณากดยืนยันตัวตนใหม่อีกครั้ง"
      );
    }

    try {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: CONFIG.GOOGLE_CLIENT_ID,
          client_secret: CONFIG.GOOGLE_CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenRes.ok) {
        return renderGatewayPage(
          clientIP,
          CONFIG.ALLOWED_DOMAIN,
          returnTo,
          "ไม่สามารถตรวจสอบ Token กับระบบ Google ได้ กรุณาตรวจสอบ Redirect URI"
        );
      }

      const tokenData = await tokenRes.json();

      const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      if (!userRes.ok) {
        return renderGatewayPage(
          clientIP,
          CONFIG.ALLOWED_DOMAIN,
          returnTo,
          "ไม่สามารถดึงข้อมูลผู้ใช้งานจาก Google ได้"
        );
      }

      const user = await userRes.json();
      const email = (user.email || "").toLowerCase();

      if (!user.email_verified || !email.endsWith(`@${CONFIG.ALLOWED_DOMAIN}`)) {
        return renderGatewayPage(
          clientIP,
          CONFIG.ALLOWED_DOMAIN,
          returnTo,
          `ปฏิเสธการเข้าถึง: บัญชี ${email} ไม่ใช่อีเมลของโรงเรียน (@${CONFIG.ALLOWED_DOMAIN})`
        );
      }

      const exp = Math.floor(Date.now() / 1000) + CONFIG.SESSION_DURATION;
      const sessionToken = await createSignedToken(
        { email, name: user.name || "", exp },
        CONFIG.SESSION_SECRET
      );

      const headers = new Headers();
      headers.set("Location", returnTo);
      headers.append(
        "Set-Cookie",
        `mst_network_session=${sessionToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${CONFIG.SESSION_DURATION}`
      );
      headers.append(
        "Set-Cookie",
        "mst_oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"
      );
      headers.append(
        "Set-Cookie",
        "mst_return_to=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"
      );

      return new Response(null, { status: 302, headers });
    } catch (err) {
      return renderGatewayPage(
        clientIP,
        CONFIG.ALLOWED_DOMAIN,
        returnTo,
        "เกิดข้อผิดพลาดในการเชื่อมต่อระบบยืนยันตัวตน กรุณาลองใหม่อีกครั้ง"
      );
    }
  }

  // ============================================================================
  // 6. ตรวจสอบ Session Cookie สำหรับผู้ที่ยืนยันตัวตนจากนอกโรงเรียนแล้ว
  // ============================================================================
  const cookies = parseCookies(request.headers.get("Cookie") || "");
  if (cookies.mst_network_session) {
    const payload = await verifySignedToken(cookies.mst_network_session, CONFIG.SESSION_SECRET);
    if (payload && payload.email && payload.email.endsWith(`@${CONFIG.ALLOWED_DOMAIN}`)) {
      return next();
    }
  }

  // ============================================================================
  // 7. แสดงหน้าด่านตรวจสอบสิทธิ์กลาง
  // ============================================================================
  const requestedPath = `${url.pathname}${url.search}`;
  return renderGatewayPage(clientIP, CONFIG.ALLOWED_DOMAIN, requestedPath);
}

// ==============================================================================
// ฟังก์ชันช่วยเหลือด้านความปลอดภัยและการเข้ารหัส
// ==============================================================================

function sanitizeReturnPath(path) {
  if (!path || typeof path !== "string") return "/";
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/auth/")) {
    return "/";
  }
  return path;
}

function checkIsSchoolWiFi(clientIP, allowedIps) {
  if (!clientIP || !allowedIps || allowedIps.length === 0) return false;
  return allowedIps.some((allowedIp) => {
    if (!allowedIp) return false;
    if (allowedIp.endsWith("*")) {
      return clientIP.startsWith(allowedIp.slice(0, -1));
    }
    return clientIP === allowedIp;
  });
}

function parseCookies(cookieHeader) {
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((c) => {
        const [key, ...v] = c.trim().split("=");
        return [key, v.join("=")];
      })
      .filter(([k]) => k)
  );
}

async function getCryptoKey(secret) {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function toBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(base64Url) {
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4 === 0 ? "" : "=".repeat(4 - (base64.length % 4));
  const binary = atob(base64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function createSignedToken(payloadObj, secret) {
  const enc = new TextEncoder();
  const payloadBase64 = toBase64Url(enc.encode(JSON.stringify(payloadObj)));
  const key = await getCryptoKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(payloadBase64));
  return `${payloadBase64}.${toBase64Url(signature)}`;
}

async function verifySignedToken(token, secret) {
  try {
    const [payloadBase64, sigBase64] = token.split(".");
    if (!payloadBase64 || !sigBase64) return null;
    const enc = new TextEncoder();
    const key = await getCryptoKey(secret);
    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      fromBase64Url(sigBase64),
      enc.encode(payloadBase64)
    );
    if (!isValid) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(payloadBase64)));
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ==============================================================================
// หน้าด่านตรวจสอบสิทธิ์ระบบสารสนเทศกลาง
// ==============================================================================

function renderGatewayPage(clientIP, allowedDomain, returnTo = "/", errorMessage = "") {
  const loginUrl = `/auth/login?return_to=${encodeURIComponent(sanitizeReturnPath(returnTo))}`;

  const html = `<!DOCTYPE html>
<html lang="th">
<head>
    <script>
        (function() {
            const stopStyle = [
                'color: #ff0000',
                'font-size: 60px',
                'font-weight: 900',
                'text-shadow: 2px 2px 0px #222, 4px 4px 0px #fff',
                'font-family: "Prompt", "Anuphan", sans-serif',
                'display: block',
                'margin-bottom: 10px'
            ].join(';');
            const warningStyle = [
                'color: #333333',
                'font-size: 16px',
                'font-weight: bold',
                'font-family: "Prompt", "Anuphan", sans-serif',
                'line-height: 1.6',
                'display: block'
            ].join(';');
            const warningText = "ข้อห้ามเกี่ยวกับการเข้าถึง API และระบบโดยตรง ผู้ใช้งานต้องใช้งานผ่านระบบและหน้าจอ (UI) ที่คณะกรรมการสภานักเรียนกำหนดเท่านั้น ห้ามเข้าถึง ดึงข้อมูล หรือใช้งาน API, API Key และ Token ของระบบโดยตรง นอกจากนี้ ห้ามทำวิศวกรรมย้อนกลับ (Reverse Engineer) ถอดรหัส ดักจับ เลียนแบบ หรือสร้างโปรแกรม/บอทใดๆ เพื่อเชื่อมต่อเข้ากับ API โดยไม่ได้รับอนุญาตเป็นลายลักษณ์อักษร หากพบการฝ่าฝืน คณะกรรมการสภานักเรียนขอสงวนสิทธิ์ในการระงับบัญชีผู้ใช้ทันที และจะดำเนินคดีทางกฎหมายตาม พ.ร.บ. ว่าด้วยการกระทำความผิดเกี่ยวกับคอมพิวเตอร์ อย่างถึงที่สุด";
            console.log('%cหยุด!', stopStyle);
            console.log('%c' + warningText, warningStyle);
        })();

        window.confirmContactSupport = function() {
            Swal.fire({
                title: 'พบปัญหาในการใช้งาน?',
                text: 'ระบบจะนำคุณไปยังแอปพลิเคชัน LINE เพื่อพูดคุยปัญหากับผู้ดูแลระบบ ต้องการดำเนินการต่อหรือไม่?',
                icon: 'info',
                showCancelButton: true,
                confirmButtonColor: '#7e22ce',
                cancelButtonColor: '#d1d5db',
                confirmButtonText: 'ใช่, ไปที่ LINE',
                cancelButtonText: 'ยกเลิก',
                customClass: { popup: 'rounded-[2rem]' }
            }).then((result) => {
                if (result.isConfirmed) {
                    window.open('https://lin.ee/Os28nIs', '_blank');
                }
            });
        };

        window.copyCurrentIp = function() {
            const ipText = "${clientIP}";
            navigator.clipboard.writeText(ipText).then(() => {
                const label = document.getElementById("copyIpLabel");
                if (label) {
                    const oldText = label.innerText;
                    label.innerText = "คัดลอกแล้ว";
                    setTimeout(() => { label.innerText = oldText; }, 2000);
                }
            });
        };
    </script>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>ตรวจสอบสิทธิ์การเข้าถึงระบบสารสนเทศ - MSTSC</title>
    <link rel="icon" type="image/webp" href="/logo.webp">
    <link href="https://fonts.googleapis.com/css2?family=Anuphan:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    <script>
        tailwind.config = { 
            theme: {
                extend: { 
                    fontFamily: { sans: ['Anuphan', 'sans-serif'] },
                    colors: { primary: '#581c87', secondary: '#7e22ce' }
                } 
            } 
        }
    </script>
    <style>
        body { background: radial-gradient(circle at top right, #f3e8ff, #ffffff); min-height: 100vh; }
        .glass-card { background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.4); }
        .animate-float { animation: float 6s ease-in-out infinite; }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        .fade-in { animation: fadeIn 0.4s ease-out forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
    </style>
</head>
<body class="text-gray-800 antialiased flex flex-col justify-between min-h-screen">
    <div class="max-w-4xl mx-auto px-4 pt-12 pb-12 flex flex-col items-center text-center w-full fade-in">
        
        <div class="animate-float mb-5">
            <img src="/logo.webp" alt="Logo" class="w-24 h-24 md:w-28 md:h-28 rounded-full shadow-2xl object-cover bg-white" onerror="this.style.display='none'">
        </div>

        <div class="inline-flex items-center gap-2 bg-purple-100/90 text-primary text-xs font-bold px-4 py-1.5 rounded-full mb-3 border border-purple-200 shadow-sm">
            <svg class="w-4 h-4 text-secondary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
            </svg>
            <span>มาตรการรักษาความปลอดภัยระบบสารสนเทศ</span>
        </div>

        <h1 class="text-3xl md:text-5xl font-black text-primary tracking-tight mb-2">
            MSTSC
        </h1>
        <p class="text-base md:text-lg text-gray-500 font-medium mb-8 max-w-lg">
            ระบบสารสนเทศคณะกรรมการสภานักเรียน<br>โรงเรียนเมืองสุราษฎร์ธานี
        </p>

        <div class="glass-card w-full max-w-md p-8 rounded-[2.5rem] shadow-2xl mb-12 relative text-center">
            <div class="w-14 h-14 bg-purple-100 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
                <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                </svg>
            </div>

            <h2 class="text-xl font-bold text-gray-800 mb-1.5">จำกัดการเข้าถึงระบบสารสนเทศ</h2>
            <p class="text-xs text-gray-500 font-medium mb-6 leading-relaxed">
                เพื่อลดความเสี่ยงจากการถูกโจมตีจากภายนอก ระบบอนุญาตให้เข้าถึงได้โดยตรงจากเครือข่ายภายในโรงเรียน หรือยืนยันตัวตนผ่านบัญชีโรงเรียนเท่านั้น
            </p>

            ${errorMessage ? `
            <div class="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-xs font-bold flex items-start gap-2.5 text-left shadow-sm">
                <svg class="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <span>${errorMessage}</span>
            </div>
            ` : ""}

            <a href="${loginUrl}" class="group w-full bg-purple-700 hover:bg-purple-800 text-white font-bold py-4 px-6 rounded-2xl flex items-center justify-center gap-4 transition-all duration-300 shadow-md hover:shadow-xl active:scale-95 z-10 relative border border-transparent">
                <div class="w-8 h-8 bg-white rounded-full flex items-center justify-center shrink-0 shadow-sm group-hover:scale-110 transition-transform">
                    <svg class="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                </div>
                <span class="text-md">ยืนยันตัวตนด้วย @${allowedDomain}</span>
            </a>

            <div class="mt-3 mb-6 flex items-center justify-center gap-1.5 text-[11px] text-purple-700 font-bold bg-purple-50 py-2 px-3 rounded-xl border border-purple-100 shadow-sm">
                <svg class="w-4 h-4 text-purple-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                </svg>
                <span>สำหรับนักเรียนและบุคลากรเมื่อเชื่อมต่อจากภายนอก</span>
            </div>

            <div class="text-left bg-gray-50/90 p-4 rounded-2xl border border-gray-200/80 space-y-3 shadow-sm">
                <div class="flex items-start gap-3">
                    <div class="w-8 h-8 rounded-xl bg-purple-100 text-primary flex items-center justify-center shrink-0 mt-0.5">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"></path>
                        </svg>
                    </div>
                    <div>
                        <p class="text-xs font-bold text-gray-800">เชื่อมต่อผ่านเครือข่ายภายในโรงเรียน (Wi-Fi)</p>
                        <p class="text-[11px] text-gray-500">เข้าใช้งานทุกระบบได้โดยอัตโนมัติเมื่ออยู่ในพื้นที่</p>
                    </div>
                </div>

                <div class="flex items-start gap-3 pt-2 border-t border-gray-200/60">
                    <div class="w-8 h-8 rounded-xl bg-purple-100 text-primary flex items-center justify-center shrink-0 mt-0.5">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                    </div>
                    <div>
                        <p class="text-xs font-bold text-gray-800">เชื่อมต่อจากเครือข่ายภายนอก</p>
                        <p class="text-[11px] text-gray-500">ต้องยืนยันสิทธิ์ด้วยบัญชี Google (@${allowedDomain}) ก่อนเข้าสู่ระบบสารสนเทศ</p>
                    </div>
                </div>
            </div>

            <div class="mt-5 pt-4 border-t border-gray-200/70 flex items-center justify-between text-[11px] text-gray-400">
                <div class="flex items-center gap-1.5">
                    <svg class="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path>
                    </svg>
                    <span>IP ของคุณ: <strong class="text-gray-600 font-mono">${clientIP}</strong></span>
                </div>
                <button type="button" onclick="copyCurrentIp()" class="inline-flex items-center gap-1 text-purple-600 hover:text-purple-800 font-bold bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-lg transition-colors">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                    </svg>
                    <span id="copyIpLabel">คัดลอก IP</span>
                </button>
            </div>
        </div>
    </div>

    <footer class="text-center pb-8 text-gray-400 text-xs">
        © 2026 MSTSC. All Rights Reserved.
    </footer>

    <div class="fixed bottom-6 right-6 z-[9999]">
        <button onclick="confirmContactSupport()" class="flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-gray-200 shadow-lg rounded-full p-3 text-gray-400 hover:text-purple-600 hover:border-purple-300 hover:shadow-xl transition-all duration-300 group outline-none active:scale-95">
            <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path>
            </svg>
            <span class="max-w-0 overflow-hidden group-hover:max-w-[200px] transition-all duration-500 ease-in-out whitespace-nowrap text-xs font-bold text-purple-600">
                แจ้งปัญหาการใช้งาน
            </span>
        </button>
    </div>
</body>
</html>`;

  return new Response(html, {
    status: 401,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}