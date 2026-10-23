// ไฟล์: functions/_middleware.js

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // ============================================================================
  // 1. ตั้งค่าระบบ (แนะนำให้ตั้งใน Cloudflare Environment Variables หรือแก้ค่าสำรองตรงนี้)
  // ============================================================================
  const CONFIG = {
    // ใส่ Public IP ของ Wi-Fi โรงเรียน (คั่นด้วยลูกน้ำ , หากมีหลาย IP หรือใช้ * ต่อท้ายเพื่อระบุวงแลนได้)
    SCHOOL_IPS: (env.SCHOOL_IPS || "203.113.0.1, 110.164.0.1").split(",").map(ip => ip.trim()),
    
    // โดเมนอีเมล Google Workspace ของโรงเรียน (ไม่ต้องมี @)
    ALLOWED_DOMAIN: (env.ALLOWED_DOMAIN || "school.ac.th").trim().toLowerCase(),
    
    // ค่าจาก Google Cloud Console
    GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID || "ใส่_CLIENT_ID_ตรงนี้",
    GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET || "ใส่_CLIENT_SECRET_ตรงนี้",
    
    // รหัสลับสำหรับเข้ารหัส Cookie (ตั้งเป็นข้อความยาวๆ อะไรก็ได้)
    SESSION_SECRET: env.SESSION_SECRET || "change-this-to-a-very-long-random-secret-key-2026",
    
    // อายุการล็อกอิน (วินาที) ค่าเริ่มต้น: 12 ชั่วโมง
    SESSION_DURATION: 60 * 60 * 12,
  };

  const clientIP = request.headers.get("CF-Connecting-IP") || "";

  // ============================================================================
  // 2. เช็กว่าเชื่อมต่อจาก Wi-Fi โรงเรียนหรือไม่ (ถ้าใช่ ให้เข้าเว็บได้ทันทีไม่ต้องล็อกอิน)
  // ============================================================================
  const isSchoolWiFi = CONFIG.SCHOOL_IPS.some(allowedIp => {
    if (!allowedIp) return false;
    if (allowedIp.endsWith("*")) {
      return clientIP.startsWith(allowedIp.slice(0, -1));
    }
    return clientIP === allowedIp;
  });

  if (isSchoolWiFi && !url.pathname.startsWith("/auth/")) {
    return next();
  }

  // ============================================================================
  // 3. จัดการเส้นทางเข้าสู่ระบบ / ออกจากระบบ (/auth/*)
  // ============================================================================
  const redirectUri = `${url.origin}/auth/callback`;

  // 3.1 เมื่อกดปุ่มล็อกอิน -> ส่งไปหน้า Google Sign-In (บังคับเฉพาะโดเมนโรงเรียนด้วยพารามิเตอร์ hd)
  if (url.pathname === "/auth/login") {
    const state = crypto.randomUUID();
    const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    googleAuthUrl.searchParams.set("client_id", CONFIG.GOOGLE_CLIENT_ID);
    googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
    googleAuthUrl.searchParams.set("response_type", "code");
    googleAuthUrl.searchParams.set("scope", "openid email profile");
    googleAuthUrl.searchParams.set("hd", CONFIG.ALLOWED_DOMAIN); // ล็อกเฉพาะโดเมนโรงเรียน
    googleAuthUrl.searchParams.set("state", state);
    googleAuthUrl.searchParams.set("prompt", "select_account");

    return new Response(null, {
      status: 302,
      headers: {
        "Location": googleAuthUrl.toString(),
        "Set-Cookie": `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
      },
    });
  }

  // 3.2 เมื่อต้องการออกจากระบบ
  if (url.pathname === "/auth/logout") {
    return new Response(null, {
      status: 302,
      headers: {
        "Location": "/",
        "Set-Cookie": "school_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0",
      },
    });
  }

  // 3.3 รับค่ากลับมาจาก Google (Callback)
  if (url.pathname === "/auth/callback") {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const cookies = parseCookies(request.headers.get("Cookie") || "");

    if (!code || !state || state !== cookies.oauth_state) {
      return renderAccessDeniedPage(clientIP, CONFIG.ALLOWED_DOMAIN, "เซสชันหมดอายุหรือไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง");
    }

    // แลก Code เป็น Access Token จาก Google
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
      return renderAccessDeniedPage(clientIP, CONFIG.ALLOWED_DOMAIN, "ไม่สามารถยืนยันตัวตนกับ Google ได้");
    }

    const tokenData = await tokenRes.json();

    // ดึงข้อมูลอีเมลผู้ใช้จาก Google
    const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userRes.ok) {
      return renderAccessDeniedPage(clientIP, CONFIG.ALLOWED_DOMAIN, "ไม่สามารถดึงข้อมูลบัญชีผู้ใช้ได้");
    }

    const user = await userRes.json();
    const email = (user.email || "").toLowerCase();

    // ตรวจสอบว่าเป็นอีเมลของโรงเรียนจริงๆ เท่านั้น
    if (!user.email_verified || !email.endsWith(`@${CONFIG.ALLOWED_DOMAIN}`)) {
      return renderAccessDeniedPage(
        clientIP,
        CONFIG.ALLOWED_DOMAIN,
        `ปฏิเสธการเข้าถึง: บัญชี ${email} ไม่ใช่อีเมลของโรงเรียน (@${CONFIG.ALLOWED_DOMAIN})`
      );
    }

    // สร้าง Session Token ที่เข้ารหัสด้วย HMAC-SHA256
    const exp = Math.floor(Date.now() / 1000) + CONFIG.SESSION_DURATION;
    const sessionToken = await createSignedToken({ email, name: user.name, exp }, CONFIG.SESSION_SECRET);

    const headers = new Headers();
    headers.set("Location", "/");
    headers.append("Set-Cookie", `school_session=${sessionToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${CONFIG.SESSION_DURATION}`);
    headers.append("Set-Cookie", "oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");

    return new Response(null, { status: 302, headers });
  }

  // ============================================================================
  // 4. เช็ก Session Cookie สำหรับคนที่อยู่นอก Wi-Fi โรงเรียน
  // ============================================================================
  const cookies = parseCookies(request.headers.get("Cookie") || "");
  if (cookies.school_session) {
    const payload = await verifySignedToken(cookies.school_session, CONFIG.SESSION_SECRET);
    if (payload && payload.email && payload.email.endsWith(`@${CONFIG.ALLOWED_DOMAIN}`)) {
      return next(); // ล็อกอินผ่านแล้ว อนุญาตให้เข้าเว็บได้
    }
  }

  // ============================================================================
  // 5. หากไม่ได้ต่อ Wi-Fi โรงเรียน และยังไม่ได้ล็อกอิน -> แสดงหน้ากั้นการเข้าถึง
  // ============================================================================
  return renderAccessDeniedPage(clientIP, CONFIG.ALLOWED_DOMAIN);
}

// ==============================================================================
// ฟังก์ชันช่วยเหลือสำหรับเข้ารหัส Cookie และแสดงหน้าเว็บแจ้งเตือน
// ==============================================================================

function parseCookies(cookieHeader) {
  return Object.fromEntries(
    cookieHeader.split(";").map(c => {
      const [key, ...v] = c.trim().split("=");
      return [key, v.join("=")];
    }).filter(([k]) => k)
  );
}

async function getCryptoKey(secret) {
  const enc = new TextEncoder();
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
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
    const isValid = await crypto.subtle.verify("HMAC", key, fromBase64Url(sigBase64), enc.encode(payloadBase64));
    if (!isValid) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(payloadBase64)));
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function renderAccessDeniedPage(clientIP, allowedDomain, errorMessage = "") {
  const html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>จำกัดการเข้าถึงระบบสารสนเทศ</title>
  <style>
    * { box-sizing: border-box; font-family: 'Sarabun', -apple-system, BlinkMacSystemFont, sans-serif; }
    body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #f3e8ff 0%, #e0e7ff 100%); padding: 20px; color: #1f2937; }
    .card { background: #ffffff; max-width: 460px; width: 100%; border-radius: 20px; padding: 32px 28px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.08); text-align: center; }
    .badge { display: inline-block; background: #fef3c7; color: #b45309; font-weight: 700; font-size: 0.85rem; padding: 6px 14px; border-radius: 999px; margin-bottom: 12px; }
    h1 { font-size: 1.45rem; margin: 0 0 8px; color: #312e81; }
    p { font-size: 0.95rem; color: #4b5563; line-height: 1.6; margin: 0 0 20px; }
    .error { background: #fee2e2; color: #b91c1c; padding: 12px; border-radius: 10px; font-size: 0.9rem; margin-bottom: 20px; font-weight: 600; }
    .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin-bottom: 24px; text-align: left; font-size: 0.88rem; color: #334155; }
    .info-box div { margin-bottom: 6px; }
    .info-box div:last-child { margin-bottom: 0; }
    .btn { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; background: #4f46e5; color: #ffffff; text-decoration: none; font-weight: 600; padding: 14px 20px; border-radius: 12px; transition: background 0.2s; font-size: 1rem; }
    .btn:hover { background: #4338ca; }
    .ip-tag { margin-top: 20px; font-size: 0.78rem; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">มาตรการความปลอดภัยของระบบ</div>
    <h1>จำกัดการเข้าถึงระบบสารสนเทศ</h1>
    <p>ระบบอนุญาตให้เข้าใช้งานได้โดยตรงเฉพาะเมื่อเชื่อมต่อผ่าน <strong>Wi-Fi ของโรงเรียน</strong> เท่านั้น</p>
    ${errorMessage ? `<div class="error">${errorMessage}</div>` : ""}
    <div class="info-box">
      <div>📶 <strong>อยู่ในโรงเรียน:</strong> เชื่อมต่อ Wi-Fi โรงเรียนแล้วรีเฟรชหน้านี้</div>
      <div>🔐 <strong>อยู่นอกโรงเรียน:</strong> ยืนยันตัวตนด้วยอีเมล <strong>@${allowedDomain}</strong></div>
    </div>
    <a href="/auth/login" class="btn">
      <span>เข้าสู่ระบบด้วยอีเมลโรงเรียน (Google)</span>
    </a>
    <div class="ip-tag">หมายเลข IP ปัจจุบันของคุณ: ${clientIP}</div>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 401,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}