// v2
import React, { useState, useEffect, useRef } from "react";

const SUPA_URL = "https://fnwkcycybmnoemofxyxr.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZud2tjeWN5Ym1ub2Vtb2Z4eXhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NTg1MzQsImV4cCI6MjA5MzMzNDUzNH0.lghWYDNXr1_hukyU5sToJXBOm2BPVZqPfDslZ4jgsTA";

const supa = {
  h(token) {
    return {
      "Content-Type": "application/json",
      "apikey": SUPA_KEY,
      "Authorization": `Bearer ${token}`,
    };
  },
  async signUp(email, password, name) {
    const r = await fetch(`${SUPA_URL}/auth/v1/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPA_KEY },
      body: JSON.stringify({ email, password, data: { name } }),
    });
    return r.json();
  },
  async signIn(email, password) {
    const r = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPA_KEY },
      body: JSON.stringify({ email, password }),
    });
    return r.json();
  },
  async signOut(token) {
    await fetch(`${SUPA_URL}/auth/v1/logout`, { method: "POST", headers: this.h(token) });
  },
  async getUser(token) {
    const r = await fetch(`${SUPA_URL}/auth/v1/user`, { headers: this.h(token) });
    return r.json();
  },
  async query(table, token, params = "") {
    const r = await fetch(`${SUPA_URL}/rest/v1/${table}?${params}`, {
      headers: { ...this.h(token), "Prefer": "return=representation" },
    });
    return r.json();
  },
  async insert(table, token, body) {
    const r = await fetch(`${SUPA_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: { ...this.h(token), "Prefer": "return=representation" },
      body: JSON.stringify(body),
    });
    return r.json();
  },
  async update(table, token, id, body) {
    const r = await fetch(`${SUPA_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: "PATCH",
      headers: { ...this.h(token), "Prefer": "return=representation" },
      body: JSON.stringify(body),
    });
    return r.json();
  },
  googleOAuthUrl() {
    return `${SUPA_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(window.location.origin)}`;
  },
};

const ONBOARDING_KEY = "vinculos_onboarded";
const TOKEN_KEY = "vinculos_token";
const USER_KEY = "vinculos_user";
function getToken() { return localStorage.getItem(TOKEN_KEY); }
function setToken(t) { if (t) localStorage.setItem(TOKEN_KEY, t); }
function clearToken() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); }
function getCachedUser() { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; } }
function setCachedUser(u) { localStorage.setItem(USER_KEY, JSON.stringify(u)); }

const RELATION_TYPES = [
  { id: "parceiro", label: "Parceiro(a)", emoji: "💞" },
  { id: "amigo", label: "Amigo(a)", emoji: "🤝" },
  { id: "familiar", label: "Familiar", emoji: "🏠" },
  { id: "colega", label: "Colega", emoji: "💼" },
  { id: "outro", label: "Outro", emoji: "🌱" },
];

const MOMENT_TYPES = [
  { id: "conflict", label: "Estou num conflito", desc: "Algo aconteceu e preciso de clareza antes de agir", emoji: "⚡" },
  { id: "anticipate", label: "Preciso ter uma conversa", desc: "Quero me preparar para uma conversa difícil", emoji: "🧭" },
  { id: "process", label: "Estou processando", desc: "Algo aconteceu e quero entender melhor", emoji: "🌊" },
  { id: "reflect", label: "Quero refletir", desc: "Sem urgência, só quero pensar sobre essa relação", emoji: "🔍" },
];

const ONBOARDING_SLIDES = [
  { emoji: "🧭", title: "Antes de agir, pense.", body: "Quantas vezes você mandou uma mensagem no calor do momento e depois se arrependeu? O Vínculos é o espaço entre o que você sente e o que você faz." },
  { emoji: "💬", title: "Não é um chatbot. É um guia.", body: "Em vez de respostas prontas, o Vínculos faz as perguntas certas para você chegar às suas próprias conclusões." },
  { emoji: "🧠", title: "Ele lembra de tudo.", body: "Cada conversa fica registrada. Com o tempo, o guia conhece o histórico de cada relação." },
  { emoji: "📷", title: "Compartilhe a conversa.", body: "Cole o texto ou envie um print — o guia lê e usa o contexto real antes de falar qualquer coisa." },
];

async function callClaude(messages, systemPrompt, maxTokens = 1000) {
  const res = await fetch("/api/claude", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: maxTokens, system: systemPrompt, messages }),
  });
  const d = await res.json();
  return d.content?.[0]?.text || "";
}

async function extractTextFromImage(base64, mediaType) {
  const res = await fetch("/api/claude", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514", max_tokens: 2000,
      system: "Você extrai texto de prints de conversas. Retorne APENAS o texto no formato 'Nome: mensagem' por linha. Sem comentários.",
      messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: mediaType, data: base64 } }, { type: "text", text: "Extraia o texto desta conversa." }] }],
    }),
  });
  const d = await res.json();
  return d.content?.[0]?.text || "";
}

function fileToBase64(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(",")[1]); r.onerror = rej; r.readAsDataURL(file); });
}

function ParticleBackground() {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let W = canvas.width = window.innerWidth;
    let H = canvas.height = window.innerHeight;
    const COUNT = Math.min(55, Math.floor((W * H) / 22000));
    const pts = Array.from({ length: COUNT }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.28, vy: (Math.random() - 0.5) * 0.28,
      r: Math.random() * 1.6 + 0.3, opacity: Math.random() * 0.35 + 0.05,
      pulse: Math.random() * Math.PI * 2, pulseSpeed: 0.008 + Math.random() * 0.012,
    }));
    function draw() {
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 140) {
            ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y);
            ctx.strokeStyle = `rgba(201,169,110,${(1 - dist / 140) * 0.07})`; ctx.lineWidth = 0.5; ctx.stroke();
          }
        }
      }
      pts.forEach(p => {
        p.pulse += p.pulseSpeed;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(201,169,110,${Math.max(0, p.opacity + Math.sin(p.pulse) * 0.06)})`; ctx.fill();
        p.x += p.vx; p.y += p.vy;
        if (p.x < -10) p.x = W + 10; if (p.x > W + 10) p.x = -10;
        if (p.y < -10) p.y = H + 10; if (p.y > H + 10) p.y = -10;
      });
      animRef.current = requestAnimationFrame(draw);
    }
    draw();
    const onResize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; };
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(animRef.current); window.removeEventListener("resize", onResize); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", background: "radial-gradient(ellipse at 30% 20%,#1a1208 0%,#100e0b 40%,#0a0806 100%)" }} />;
}

function Spinner({ color = "#c9a96e" }) {
  return <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "10px 0" }}>{[0, 1, 2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: color, animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}</div>;
}

function Avatar({ name, size = 40 }) {
  const hue = name ? (name.charCodeAt(0) * 37) % 360 : 200;
  return <div style={{ width: size, height: size, borderRadius: "50%", background: `hsl(${hue},30%,22%)`, border: `1.5px solid hsl(${hue},40%,38%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.4, fontFamily: "'Cormorant Garamond',serif", color: `hsl(${hue},60%,72%)`, flexShrink: 0 }}>{name?.[0]?.toUpperCase() || "?"}</div>;
}

function Card({ children, style = {}, gold = false }) {
  return <div style={{ background: gold ? "rgba(201,169,110,0.06)" : "rgba(255,255,255,0.03)", border: `1px solid ${gold ? "rgba(201,169,110,0.2)" : "rgba(255,255,255,0.07)"}`, borderRadius: 14, backdropFilter: "blur(8px)", ...style }}>{children}</div>;
}

function GoldButton({ children, onClick, disabled, secondary, style = {} }) {
  return <button onClick={onClick} disabled={disabled} style={{ width: "100%", padding: "13px", borderRadius: 11, fontFamily: "'Cormorant Garamond',serif", fontSize: 16, letterSpacing: "0.05em", fontWeight: 600, cursor: disabled ? "default" : "pointer", border: secondary ? "1px solid rgba(255,255,255,0.12)" : "none", background: disabled ? "rgba(255,255,255,0.05)" : secondary ? "transparent" : "linear-gradient(135deg,#c9a96e,#9a7338)", color: disabled ? "#5a4e3e" : secondary ? "#7a6a55" : "#1a1208", transition: "all 0.2s", ...style }}>{children}</button>;
}

function InputField({ label, ...props }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <div style={{ fontFamily: "'Lora',serif", fontSize: 11, color: "#7a6a55", letterSpacing: "0.1em", marginBottom: 6, textTransform: "uppercase" }}>{label}</div>}
      <input {...props} style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 14px", color: "#e8dcc8", fontSize: 14, fontFamily: "'Lora',serif", outline: "none", boxSizing: "border-box", ...(props.style || {}) }}
        onFocus={e => e.target.style.borderColor = "rgba(201,169,110,0.5)"}
        onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
    </div>
  );
}

function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState("landing");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [name, setName] = useState("");
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("access_token")) {
      const params = new URLSearchParams(hash.replace("#", "?"));
      const token = params.get("access_token");
      if (token) {
        setToken(token);
        supa.getUser(token).then(u => {
          if (u.id) {
            const user = { id: u.id, name: u.user_metadata?.name || u.email?.split("@")[0], email: u.email };
            setCachedUser(user); onLogin(user, token);
            window.history.replaceState({}, "", window.location.pathname);
          }
        });
      }
    }
  }, []);

  async function handleEmailAuth() {
    setError("");
    if (!email.trim() || !password.trim()) return setError("Preencha todos os campos.");
    if (mode === "signup" && !name.trim()) return setError("Informe seu nome.");
    if (password.length < 6) return setError("Senha deve ter ao menos 6 caracteres.");
    setLoading(true);
    try {
      let res;
      if (mode === "signup") {
        res = await supa.signUp(email.trim(), password, name.trim());
        if (res.error) return setError(res.error.message || "Erro ao criar conta.");
        if (!res.access_token) return setError("Verifique seu e-mail para confirmar a conta.");
      } else {
        res = await supa.signIn(email.trim(), password);
        if (res.error) return setError("E-mail ou senha incorretos.");
      }
      const token = res.access_token;
      setToken(token);
      const u = res.user || res;
      const user = { id: u.id, name: u.user_metadata?.name || name || u.email?.split("@")[0], email: u.email };
      setCachedUser(user); onLogin(user, token);
    } catch { setError("Erro de conexão. Tente novamente."); }
    finally { setLoading(false); }
  }

  if (mode === "landing") return (
    <div style={{ position: "relative", zIndex: 1, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 28px", maxWidth: 420, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 56 }}>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 11, letterSpacing: "0.35em", color: "#5a4e3e", textTransform: "uppercase", marginBottom: 16 }}>Vínculos</div>
        <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 48, fontWeight: 600, color: "#e8dcc8", margin: 0, lineHeight: 1.1 }}>Pense antes<br />de agir.</h1>
        <p style={{ fontFamily: "'Lora',serif", fontSize: 15, color: "#7a6a55", marginTop: 18, lineHeight: 1.8, maxWidth: 300, margin: "18px auto 0" }}>Um guia para navegar suas relações com mais clareza e menos reatividade.</p>
      </div>
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
        <button onClick={() => window.location.href = supa.googleOAuthUrl()}
          style={{ width: "100%", padding: "13px 20px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 11, color: "#e8dcc8", fontSize: 14, fontFamily: "'Lora',serif", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Entrar com Google
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
          <span style={{ fontFamily: "'Lora',serif", fontSize: 12, color: "#3a3028" }}>ou</span>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
        </div>
        <GoldButton onClick={() => setMode("signin")}>Entrar com e-mail</GoldButton>
        <GoldButton secondary onClick={() => setMode("signup")}>Criar conta</GoldButton>
      </div>
    </div>
  );

  return (
    <div style={{ position: "relative", zIndex: 1, minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", padding: "40px 28px", maxWidth: 420, margin: "0 auto" }}>
      <button onClick={() => { setMode("landing"); setError(""); }} style={{ background: "none", border: "none", color: "#7a6a55", cursor: "pointer", fontSize: 14, fontFamily: "'Lora',serif", marginBottom: 32, padding: 0, textAlign: "left" }}>← Voltar</button>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 11, letterSpacing: "0.25em", color: "#5a4e3e", textTransform: "uppercase", marginBottom: 8 }}>Vínculos</div>
        <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 30, fontWeight: 600, color: "#e8dcc8", margin: 0 }}>{mode === "signup" ? "Criar conta" : "Bem-vindo de volta"}</h2>
      </div>
      <Card style={{ padding: 24 }}>
        {mode === "signup" && <InputField label="Nome" type="text" placeholder="Como você se chama?" value={name} onChange={e => setName(e.target.value)} />}
        <InputField label="E-mail" type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} />
        <InputField label="Senha" type="password" placeholder={mode === "signup" ? "Mínimo 6 caracteres" : "••••••••"} value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleEmailAuth()} />
        {error && <div style={{ fontFamily: "'Lora',serif", fontSize: 13, color: "#c97070", marginBottom: 14, padding: "8px 12px", background: "rgba(201,100,100,0.08)", borderRadius: 8 }}>{error}</div>}
        {loading ? <div style={{ display: "flex", justifyContent: "center" }}><Spinner /></div> : <GoldButton onClick={handleEmailAuth}>{mode === "signup" ? "Criar conta" : "Entrar"}</GoldButton>}
      </Card>
      <p style={{ textAlign: "center", fontFamily: "'Lora',serif", fontSize: 13, color: "#5a4e3e", marginTop: 20 }}>
        {mode === "signup" ? "Já tem conta? " : "Não tem conta? "}
        <button onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(""); }} style={{ background: "none", border: "none", color: "#c9a96e", cursor: "pointer", fontFamily: "'Lora',serif", fontSize: 13, padding: 0 }}>
          {mode === "signup" ? "Entrar" : "Criar agora"}
        </button>
      </p>
    </div>
  );
}

function Onboarding({ onDone }) {
  const [step, setStep] = useState(0);
  const slide = ONBOARDING_SLIDES[step];
  const isLast = step === ONBOARDING_SLIDES.length - 1;
  return (
    <div style={{ position: "relative", zIndex: 1, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 28px", maxWidth: 440, margin: "0 auto" }}>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 11, letterSpacing: "0.3em", color: "#5a4e3e", textTransform: "uppercase", marginBottom: 64 }}>Vínculos</div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", width: "100%" }}>
        <div key={step + "e"} style={{ fontSize: 56, marginBottom: 28 }}>{slide.emoji}</div>
        <h2 key={step + "t"} style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 32, fontWeight: 600, color: "#e8dcc8", marginBottom: 16, lineHeight: 1.2 }}>{slide.title}</h2>
        <p key={step + "b"} style={{ fontFamily: "'Lora',serif", fontSize: 15, color: "#7a6a55", lineHeight: 1.8, maxWidth: 320 }}>{slide.body}</p>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
        {ONBOARDING_SLIDES.map((_, i) => <div key={i} style={{ width: i === step ? 22 : 6, height: 6, borderRadius: 3, background: i === step ? "#c9a96e" : "rgba(255,255,255,0.1)", transition: "all 0.3s" }} />)}
      </div>
      <GoldButton onClick={() => isLast ? onDone() : setStep(s => s + 1)} secondary={!isLast}>{isLast ? "Começar" : "Continuar"}</GoldButton>
      {!isLast && <button onClick={onDone} style={{ background: "none", border: "none", color: "#3a3028", cursor: "pointer", fontSize: 13, fontFamily: "'Lora',serif", marginTop: 16, padding: 8 }}>Pular</button>}
    </div>
  );
}

function SessionClosing({ session, person, token, onBack, onDone, onSave }) {
  const [recap, setRecap] = useState(session.recap || null);
  const [loading, setLoading] = useState(!session.recap);
  useEffect(() => { if (!session.recap) generateRecap(); }, []);
  async function generateRecap() {
    setLoading(true);
    const userMsgs = (session.messages || []).filter(m => m.role === "user").map(m => m.content).join("\n\n");
    const assistantMsgs = (session.messages || []).filter(m => m.role === "assistant").map(m => m.content).join("\n\n");
    const result = await callClaude([{ role: "user", content: `Sessão sobre ${person.name}. Pessoa disse:\n${userMsgs}\n\nGuia respondeu:\n${assistantMsgs}\n\nGere JSON: {"clareza":"o que ficou claro","padrao":"padrão ou null","proximo":"ação concreta","palavra":"tom emocional em uma palavra"}` }],
      "Analise sessões relacionais e gere resumos. Responda APENAS com JSON válido.", 600);
    try {
      const parsed = JSON.parse(result.replace(/```json|```/g, "").trim());
      setRecap(parsed);
      await supa.update("sessions", token, session.id, { recap: parsed });
      onSave({ ...session, recap: parsed });
    } catch {
      const fb = { clareza: "Sessão concluída.", padrao: null, proximo: "Continue refletindo.", palavra: "Reflexão" };
      setRecap(fb); onSave({ ...session, recap: fb });
    }
    setLoading(false);
  }
  const momentInfo = MOMENT_TYPES.find(m => m.id === session.moment_type);
  return (
    <div style={{ position: "relative", zIndex: 1, minHeight: "100vh", padding: "32px 24px", maxWidth: 480, margin: "0 auto" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#7a6a55", cursor: "pointer", fontSize: 14, fontFamily: "'Lora',serif", marginBottom: 32, padding: 0 }}>← Voltar à sessão</button>
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 11, letterSpacing: "0.25em", color: "#5a4e3e", textTransform: "uppercase", marginBottom: 10 }}>Encerramento</div>
        <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 30, fontWeight: 600, color: "#e8dcc8", margin: 0 }}>Sessão com {person.name}</h2>
        <div style={{ fontSize: 13, color: "#5a4e3e", marginTop: 8, fontFamily: "'Lora',serif" }}>{momentInfo?.emoji} {momentInfo?.label}</div>
      </div>
      {loading ? <div style={{ textAlign: "center", padding: "48px 0" }}><Spinner /><p style={{ fontFamily: "'Lora',serif", fontSize: 14, color: "#5a4e3e", marginTop: 8 }}>Consolidando...</p></div>
      : recap && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {recap.palavra && <div style={{ textAlign: "center" }}><span style={{ display: "inline-block", padding: "6px 22px", background: "rgba(201,169,110,0.1)", border: "1px solid rgba(201,169,110,0.2)", borderRadius: 20, fontFamily: "'Cormorant Garamond',serif", fontSize: 16, color: "#c9a96e", fontStyle: "italic" }}>{recap.palavra}</span></div>}
          <Card style={{ padding: "20px 22px" }}>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 10, letterSpacing: "0.2em", color: "#7a6a55", textTransform: "uppercase", marginBottom: 10 }}>O que ficou claro</div>
            <p style={{ fontFamily: "'Lora',serif", fontSize: 15, color: "#e8dcc8", lineHeight: 1.7, margin: 0 }}>{recap.clareza}</p>
          </Card>
          {recap.padrao && <Card style={{ padding: "20px 22px" }}>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 10, letterSpacing: "0.2em", color: "#7a6a55", textTransform: "uppercase", marginBottom: 10 }}>Padrão observado</div>
            <p style={{ fontFamily: "'Lora',serif", fontSize: 15, color: "#b8a888", lineHeight: 1.7, margin: 0 }}>{recap.padrao}</p>
          </Card>}
          <Card gold style={{ padding: "20px 22px" }}>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 10, letterSpacing: "0.2em", color: "#c9a96e", textTransform: "uppercase", marginBottom: 10 }}>Para levar daqui</div>
            <p style={{ fontFamily: "'Lora',serif", fontSize: 15, color: "#e8dcc8", lineHeight: 1.7, margin: 0 }}>{recap.proximo}</p>
          </Card>
          <GoldButton onClick={onDone}>Fechar sessão</GoldButton>
        </div>
      )}
    </div>
  );
}

function ImportModal({ onClose, onImport }) {
  const [mode, setMode] = useState(null);
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [extractedText, setExtractedText] = useState("");
  const fileRef = useRef(null);
  async function handleImageSelect(file) {
    if (!file) return;
    setImageFile(file); setImagePreview(URL.createObjectURL(file)); setExtracting(true);
    try { setExtractedText(await extractTextFromImage(await fileToBase64(file), file.type)); }
    catch { setExtractedText("Não foi possível extrair. Edite abaixo."); }
    setExtracting(false);
  }
  const confirm = () => { const t = mode === "text" ? text : extractedText; if (t.trim()) onImport(t.trim()); };
  const iStyle = { width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 14px", color: "#e8dcc8", fontSize: 13, fontFamily: "'Lora',serif", outline: "none", resize: "vertical", lineHeight: 1.6, boxSizing: "border-box", marginBottom: 14 };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(5,4,2,0.92)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#16120e", border: "1px solid rgba(201,169,110,0.2)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 460, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, color: "#e8dcc8", fontWeight: 600 }}>Importar conversa</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#5a4e3e", cursor: "pointer", fontSize: 20 }}>✕</button>
        </div>
        {!mode && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[{ id: "image", e: "📷", t: "Enviar print", d: "Screenshot — texto extraído automaticamente" }, { id: "text", e: "📋", t: "Colar texto", d: "Cole o texto copiado do chat" }].map(o => (
              <button key={o.id} onClick={() => setMode(o.id)} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 12, padding: "16px 18px", cursor: "pointer", textAlign: "left", width: "100%" }}>
                <div style={{ fontSize: 22, marginBottom: 5 }}>{o.e}</div>
                <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 17, color: "#e8dcc8", fontWeight: 600 }}>{o.t}</div>
                <div style={{ fontSize: 12, color: "#7a6a55", marginTop: 3, fontFamily: "'Lora',serif" }}>{o.d}</div>
              </button>
            ))}
          </div>
        )}
        {mode === "text" && <>
          <button onClick={() => setMode(null)} style={{ background: "none", border: "none", color: "#7a6a55", cursor: "pointer", fontSize: 13, fontFamily: "'Lora',serif", marginBottom: 12, padding: 0 }}>← Voltar</button>
          <textarea autoFocus value={text} onChange={e => setText(e.target.value)} rows={8} style={iStyle} placeholder="João: Oi&#10;Eu: Oi..." />
          <GoldButton onClick={confirm} disabled={!text.trim()}>Usar essa conversa</GoldButton>
        </>}
        {mode === "image" && <>
          <button onClick={() => { setMode(null); setImageFile(null); setImagePreview(null); setExtractedText(""); }} style={{ background: "none", border: "none", color: "#7a6a55", cursor: "pointer", fontSize: 13, fontFamily: "'Lora',serif", marginBottom: 12, padding: 0 }}>← Voltar</button>
          {!imageFile ? (
            <div onClick={() => fileRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); handleImageSelect(e.dataTransfer.files[0]); }}
              style={{ border: "2px dashed rgba(201,169,110,0.22)", borderRadius: 12, padding: "40px 20px", textAlign: "center", cursor: "pointer" }}>
              <div style={{ fontSize: 30, marginBottom: 10 }}>📷</div>
              <div style={{ fontFamily: "'Lora',serif", fontSize: 14, color: "#b8a888" }}>Clique ou arraste o print</div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleImageSelect(e.target.files[0])} />
            </div>
          ) : <>
            <img src={imagePreview} alt="" style={{ width: "100%", borderRadius: 10, maxHeight: 160, objectFit: "cover", marginBottom: 14 }} />
            {extracting ? <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#7a6a55", fontFamily: "'Lora',serif", fontSize: 13 }}><Spinner />Lendo...</div> : <>
              <div style={{ fontSize: 12, color: "#7a6a55", fontFamily: "'Lora',serif", marginBottom: 6 }}>Texto extraído — revise se necessário:</div>
              <textarea value={extractedText} onChange={e => setExtractedText(e.target.value)} rows={5} style={iStyle} />
              <GoldButton onClick={confirm} disabled={!extractedText.trim()}>Usar essa conversa</GoldButton>
            </>}
          </>}
        </>}
      </div>
    </div>
  );
}


function DeletePersonButton({ onDelete }) {
  const [confirming, setConfirming] = React.useState(false);
  if (!confirming) return (
    <button onClick={() => setConfirming(true)} style={{ background: "none", border: "none", color: "#5a3a3a", cursor: "pointer", fontSize: 12, fontFamily: "'Lora',serif" }}>Apagar relação</button>
  );
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <span style={{ fontSize: 12, color: "#7a6a55", fontFamily: "'Lora',serif" }}>Confirmar?</span>
      <button onClick={onDelete} style={{ background: "rgba(180,60,60,0.15)", border: "1px solid rgba(180,60,60,0.3)", borderRadius: 6, color: "#c07070", cursor: "pointer", fontSize: 12, fontFamily: "'Lora',serif", padding: "4px 10px" }}>Apagar</button>
      <button onClick={() => setConfirming(false)} style={{ background: "none", border: "none", color: "#5a4e3e", cursor: "pointer", fontSize: 12, fontFamily: "'Lora',serif" }}>Cancelar</button>
    </div>
  );
}

function PeopleView({ people, user, onSelect, onAdd, onLogout, onDeleteAccount }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState(""); const [relType, setRelType] = useState("amigo"); const [saving, setSaving] = useState(false);
  async function handleAdd() {
    if (!name.trim() || saving) return;
    setSaving(true);
    await onAdd({ name: name.trim(), type: relType });
    setName(""); setRelType("amigo"); setAdding(false); setSaving(false);
  }
  return (
    <div style={{ position: "relative", zIndex: 1, padding: "32px 24px", maxWidth: 480, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 40 }}>
        <div>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 11, letterSpacing: "0.25em", color: "#7a6a55", textTransform: "uppercase", marginBottom: 8 }}>Vínculos</div>
          <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 36, fontWeight: 600, color: "#e8dcc8", margin: 0 }}>Suas relações</h1>
          <p style={{ color: "#5a4e3e", fontSize: 13, marginTop: 8, fontFamily: "'Lora',serif" }}>Olá, {user?.name?.split(" ")[0]}.</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <button onClick={onLogout} style={{ background: "none", border: "none", color: "#3a3028", cursor: "pointer", fontSize: 12, fontFamily: "'Lora',serif" }}>Sair</button>
          <button onClick={onDeleteAccount} style={{ background: "none", border: "none", color: "#5a3a3a", cursor: "pointer", fontSize: 11, fontFamily: "'Lora',serif" }}>Apagar conta</button>
        </div>
      </div>
      {people.length === 0 && !adding && <div style={{ textAlign: "center", padding: "48px 0", color: "#5a4e3e" }}><div style={{ fontSize: 36, marginBottom: 12 }}>🌱</div><p style={{ fontFamily: "'Lora',serif", fontSize: 15, lineHeight: 1.7 }}>Nenhuma relação ainda.<br />Adicione alguém para começar.</p></div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
        {people.map(person => {
          const rel = RELATION_TYPES.find(r => r.id === person.type);
          return (
            <button key={person.id} onClick={() => onSelect(person)} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 13, padding: "15px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, textAlign: "left", width: "100%" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(201,169,110,0.07)"; e.currentTarget.style.borderColor = "rgba(201,169,110,0.2)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; }}>
              <Avatar name={person.name} size={44} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, color: "#e8dcc8", fontWeight: 600 }}>{person.name}</div>
                <div style={{ fontSize: 12, color: "#7a6a55", marginTop: 2 }}>{rel?.emoji} {rel?.label} · {person.session_count || 0} sessões</div>
              </div>
              <div style={{ color: "#3a3028", fontSize: 18 }}>›</div>
            </button>
          );
        })}
      </div>
      {adding ? (
        <Card gold style={{ padding: 20 }}>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 16, color: "#c9a96e", marginBottom: 16 }}>Nova relação</div>
          <InputField type="text" placeholder="Nome da pessoa" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAdd()} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {RELATION_TYPES.map(r => <button key={r.id} onClick={() => setRelType(r.id)} style={{ padding: "6px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer", border: "1px solid", fontFamily: "'Lora',serif", background: relType === r.id ? "rgba(201,169,110,0.2)" : "transparent", borderColor: relType === r.id ? "#c9a96e" : "rgba(255,255,255,0.1)", color: relType === r.id ? "#c9a96e" : "#7a6a55" }}>{r.emoji} {r.label}</button>)}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {saving ? <div style={{ flex: 1, display: "flex", justifyContent: "center" }}><Spinner /></div> : <GoldButton onClick={handleAdd} style={{ flex: 1 }}>Adicionar</GoldButton>}
            <GoldButton secondary onClick={() => setAdding(false)} style={{ flex: "0 0 auto", width: "auto", padding: "13px 18px" }}>Cancelar</GoldButton>
          </div>
        </Card>
      ) : (
        <button onClick={() => setAdding(true)} style={{ width: "100%", padding: "13px", background: "transparent", border: "1px dashed rgba(201,169,110,0.25)", borderRadius: 12, color: "#c9a96e", fontSize: 14, cursor: "pointer", fontFamily: "'Lora',serif" }}
          onMouseEnter={e => e.currentTarget.style.borderColor = "#c9a96e"}
          onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(201,169,110,0.25)"}>
          + Adicionar relação
        </button>
      )}
    </div>
  );
}

function PersonView({ person, sessions, onBack, onStartSession, onOpenSession, onDelete }) {
  const rel = RELATION_TYPES.find(r => r.id === person.type);
  const sorted = [...sessions].sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
  return (
    <div style={{ position: "relative", zIndex: 1, padding: "32px 24px", maxWidth: 480, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#7a6a55", cursor: "pointer", fontSize: 14, fontFamily: "'Lora',serif", padding: 0 }}>← Voltar</button>
        <DeletePersonButton onDelete={onDelete} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
        <Avatar name={person.name} size={54} />
        <div>
          <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 28, color: "#e8dcc8", margin: 0, fontWeight: 600 }}>{person.name}</h2>
          <div style={{ fontSize: 13, color: "#7a6a55", marginTop: 4 }}>{rel?.emoji} {rel?.label}</div>
        </div>
      </div>
      <p style={{ fontFamily: "'Lora',serif", fontSize: 13, color: "#5a4e3e", lineHeight: 1.7, marginBottom: 24 }}>Cada sessão registra um momento específico — um conflito, uma preparação, uma reflexão.</p>
      <GoldButton onClick={onStartSession} style={{ marginBottom: 32 }}>Nova sessão com {person.name}</GoldButton>
      {sorted.length > 0 && <>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 11, letterSpacing: "0.2em", color: "#7a6a55", textTransform: "uppercase", marginBottom: 12 }}>Histórico</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sorted.map((s, idx) => {
            const mt = MOMENT_TYPES.find(m => m.id === s.moment_type);
            return (
              <button key={s.id} onClick={() => onOpenSession(s)} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 11, padding: "14px 16px", cursor: "pointer", textAlign: "left", width: "100%" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(201,169,110,0.06)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div style={{ fontSize: 14, color: "#b8a888", fontFamily: "'Lora',serif", fontWeight: 600 }}>{mt?.emoji} {mt?.label}</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {s.recap && <div style={{ fontSize: 10, color: "#5a8a5e" }}>✓ encerrada</div>}
                    {idx === 0 && <div style={{ fontSize: 10, color: "#c9a96e" }}>RECENTE</div>}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "#5a4e3e", marginTop: 4 }}>{new Date(s.started_at).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}</div>
                {s.recap?.clareza && <div style={{ fontSize: 12, color: "#5a4e3e", marginTop: 6, fontStyle: "italic", fontFamily: "'Lora',serif" }}>"{s.recap.clareza}"</div>}
              </button>
            );
          })}
        </div>
      </>}
    </div>
  );
}

function MomentSelect({ person, onSelect, onBack }) {
  return (
    <div style={{ position: "relative", zIndex: 1, padding: "32px 24px", maxWidth: 480, margin: "0 auto" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#7a6a55", cursor: "pointer", fontSize: 14, fontFamily: "'Lora',serif", marginBottom: 24, padding: 0 }}>← Voltar</button>
      <div style={{ marginBottom: 30 }}>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 11, letterSpacing: "0.25em", color: "#7a6a55", textTransform: "uppercase", marginBottom: 8 }}>Sessão com {person.name}</div>
        <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 30, color: "#e8dcc8", margin: 0, fontWeight: 600 }}>O que está acontecendo?</h2>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {MOMENT_TYPES.map(m => (
          <button key={m.id} onClick={() => onSelect(m.id)} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 13, padding: "17px 18px", cursor: "pointer", textAlign: "left", width: "100%" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(201,169,110,0.07)"; e.currentTarget.style.borderColor = "rgba(201,169,110,0.25)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; }}>
            <div style={{ fontSize: 22, marginBottom: 5 }}>{m.emoji}</div>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18, color: "#e8dcc8", fontWeight: 600 }}>{m.label}</div>
            <div style={{ fontSize: 13, color: "#7a6a55", marginTop: 3, fontFamily: "'Lora',serif" }}>{m.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function SessionView({ session, person, allSessions, token, onBack, onSave, onClose }) {
  const [messages, setMessages] = useState(session.messages || []);
  const [input, setInput] = useState(""); const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState((session.messages || []).length > 0);
  const [showImport, setShowImport] = useState(false);
  const bottomRef = useRef(null); const inputRef = useRef(null);
  const userMsgCount = messages.filter(m => m.role === "user").length;
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);
  useEffect(() => { if (!started) startSession(); }, []);

  function buildPrompt() {
    const past = allSessions.filter(s => s.person_id === person.id && s.id !== session.id && (s.messages || []).length > 0).sort((a, b) => new Date(b.started_at) - new Date(a.started_at)).slice(0, 3);
    const history = past.length > 0 ? `\n\nHistórico com ${person.name}:\n` + past.map(s => `- ${new Date(s.started_at).toLocaleDateString("pt-BR")}: ${s.recap?.clareza || s.summary || "sessão anterior"}`).join("\n") : "";
    const ctx = { conflict: "Está num conflito, precisa de clareza antes de agir.", anticipate: "Quer se preparar para uma conversa difícil.", process: "Quer processar algo que aconteceu.", reflect: "Quer refletir sem urgência." }[session.moment_type];
    return `Você é um guia de inteligência relacional. Não terapeuta, não autoajuda.\n\nRelação: ${person.name} (${RELATION_TYPES.find(r => r.id === person.type)?.label})\nMomento: ${ctx}${history}\n\nFaça perguntas que abram perspectivas, distinga o que a pessoa quer FALAR do que quer ALCANÇAR, sem floreios. Responda sempre em português.`;
  }

  async function startSession() {
    setStarted(true); setLoading(true);
    const opening = await callClaude([{ role: "user", content: `Sessão sobre ${person.name}. Momento: ${MOMENT_TYPES.find(m => m.id === session.moment_type)?.label}` }], buildPrompt());
    const msgs = [{ role: "assistant", content: opening }];
    setMessages(msgs);
    await supa.update("sessions", token, session.id, { messages: msgs });
    onSave({ ...session, messages: msgs });
    setLoading(false);
  }

  async function sendMessage(override) {
    const text = override !== undefined ? override : input.trim();
    if (!text || loading) return;
    const newMsgs = [...messages, { role: "user", content: text }];
    setMessages(newMsgs);
    if (override === undefined) setInput("");
    setLoading(true);
    const reply = await callClaude(newMsgs.map(m => ({ role: m.role, content: m.content })), buildPrompt());
    const final = [...newMsgs, { role: "assistant", content: reply }];
    setMessages(final);
    let summary = session.summary;
    if (!summary && newMsgs.filter(m => m.role === "user").length === 1) summary = text.slice(0, 80) + (text.length > 80 ? "…" : "");
    await supa.update("sessions", token, session.id, { messages: final, summary });
    onSave({ ...session, messages: final, summary });
    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  const momentInfo = MOMENT_TYPES.find(m => m.id === session.moment_type);
  return (
    <>
      {showImport && <ImportModal onClose={() => setShowImport(false)} onImport={t => { setShowImport(false); sendMessage(`Vou compartilhar uma conversa que tive com ${person.name}:\n\n${t}`); }} />}
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", height: "100vh", maxWidth: 480, margin: "0 auto" }}>
        <div style={{ padding: "13px 18px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0, backdropFilter: "blur(12px)", background: "rgba(16,14,11,0.6)" }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: "#7a6a55", cursor: "pointer", fontSize: 18, padding: 0 }}>←</button>
          <Avatar name={person.name} size={30} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 15, color: "#e8dcc8", fontWeight: 600 }}>{person.name}</div>
            <div style={{ fontSize: 10, color: "#5a4e3e" }}>{momentInfo?.emoji} {momentInfo?.label}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setShowImport(true)} style={{ background: "rgba(201,169,110,0.08)", border: "1px solid rgba(201,169,110,0.18)", borderRadius: 7, padding: "5px 10px", cursor: "pointer", color: "#c9a96e", fontSize: 11, fontFamily: "'Lora',serif" }}>+ Conversa</button>
            {userMsgCount >= 2 && <button onClick={onClose} style={{ background: "rgba(90,138,94,0.1)", border: "1px solid rgba(90,138,94,0.22)", borderRadius: 7, padding: "5px 10px", cursor: "pointer", color: "#7aaa7e", fontSize: 11, fontFamily: "'Lora',serif" }}>Encerrar</button>}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "22px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
          {messages.map((msg, i) => {
            const isImport = msg.role === "user" && msg.content.startsWith("Vou compartilhar");
            return (
              <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{ maxWidth: "84%", padding: "11px 15px", borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: isImport ? "rgba(80,60,30,0.18)" : msg.role === "user" ? "rgba(201,169,110,0.13)" : "rgba(255,255,255,0.04)", border: `1px solid ${msg.role === "user" ? "rgba(201,169,110,0.22)" : "rgba(255,255,255,0.06)"}`, color: msg.role === "user" ? "#e8dcc8" : "#b8a888", fontSize: 14, lineHeight: 1.65, fontFamily: "'Lora',serif", whiteSpace: "pre-wrap" }}>
                  {isImport && <div style={{ fontSize: 10, color: "#7a6a55", marginBottom: 5 }}>📋 CONVERSA IMPORTADA</div>}
                  {msg.content}
                </div>
              </div>
            );
          })}
          {loading && <div style={{ display: "flex" }}><div style={{ padding: "8px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px 14px 14px 4px" }}><Spinner /></div></div>}
          {userMsgCount >= 2 && !loading && <div style={{ textAlign: "center" }}><button onClick={onClose} style={{ background: "none", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, color: "#5a4e3e", cursor: "pointer", fontSize: 11, fontFamily: "'Lora',serif", padding: "5px 14px" }}>Encerrar sessão e ver resumo →</button></div>}
          <div ref={bottomRef} />
        </div>
        <div style={{ padding: "12px 18px", borderTop: "1px solid rgba(255,255,255,0.05)", flexShrink: 0, backdropFilter: "blur(12px)", background: "rgba(16,14,11,0.6)" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Escreva aqui..." rows={1}
              style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 11, padding: "11px 13px", color: "#e8dcc8", fontSize: 14, fontFamily: "'Lora',serif", outline: "none", resize: "none", maxHeight: 110, overflowY: "auto", lineHeight: 1.5 }}
              onInput={e => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 110) + "px"; }}
              onFocus={e => e.target.style.borderColor = "rgba(201,169,110,0.35)"}
              onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.09)"} />
            <button onClick={() => sendMessage()} disabled={!input.trim() || loading} style={{ width: 40, height: 40, borderRadius: 10, background: input.trim() && !loading ? "#c9a96e" : "rgba(255,255,255,0.05)", border: "none", cursor: input.trim() && !loading ? "pointer" : "default", color: input.trim() && !loading ? "#1a1208" : "#5a4e3e", fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>↑</button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function App() {
  const [user, setUser] = useState(getCachedUser);
  const [token, setTokenState] = useState(getToken);
  const [onboarded, setOnboarded] = useState(() => !!localStorage.getItem(ONBOARDING_KEY));
  const [people, setPeople] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [view, setView] = useState("people");
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [activeSession, setActiveSession] = useState(null);

  useEffect(() => {
    if (!user || !token) return;
    setLoadingData(true);
    Promise.all([
      supa.query("people", token, `user_id=eq.${user.id}&order=created_at.asc`),
      supa.query("sessions", token, `user_id=eq.${user.id}&order=started_at.desc`),
    ]).then(([p, s]) => {
      const peopleList = Array.isArray(p) ? p : [];
      const sessionList = Array.isArray(s) ? s : [];
      const counts = {};
      sessionList.forEach(sess => { counts[sess.person_id] = (counts[sess.person_id] || 0) + 1; });
      setPeople(peopleList.map(person => ({ ...person, session_count: counts[person.id] || 0 })));
      setSessions(sessionList);
    }).finally(() => setLoadingData(false));
  }, [user, token]);

  function handleLogin(u, t) { setUser(u); setTokenState(t); }

  async function handleLogout() {
    if (token) await supa.signOut(token);
    clearToken(); setUser(null); setTokenState(null); setPeople([]); setSessions([]); setView("people");
  }

  function finishOnboarding() { localStorage.setItem(ONBOARDING_KEY, "1"); setOnboarded(true); }

  async function addPerson(data) {
    const res = await supa.insert("people", token, { ...data, user_id: user.id });
    const newPerson = Array.isArray(res) ? res[0] : res;
    if (newPerson?.id) setPeople(prev => [...prev, { ...newPerson, session_count: 0 }]);
  }

  async function startNewSession(momentType) {
    const res = await supa.insert("sessions", token, { user_id: user.id, person_id: selectedPerson.id, moment_type: momentType, messages: [], summary: null, recap: null });
    const newSession = Array.isArray(res) ? res[0] : res;
    if (newSession?.id) { setSessions(prev => [newSession, ...prev]); setActiveSession(newSession); setView("session"); }
  }

  function saveSessionLocal(updated) {
    setSessions(prev => prev.map(s => s.id === updated.id ? updated : s));
    setActiveSession(updated);
  }

  async function deletePerson(person) {
    await supa.delete("people", token, person.id);
    setPeople(prev => prev.filter(p => p.id !== person.id));
    setSessions(prev => prev.filter(s => s.person_id !== person.id));
    setView("people");
  }

  async function handleDeleteAccount() {
    if (!window.confirm("Apagar sua conta e todos os dados permanentemente?")) return;
    // Delete all user data then sign out
    const userPeople = people.map(p => p.id);
    for (const id of userPeople) await supa.delete("people", token, id);
    await supa.signOut(token);
    clearToken(); setUser(null); setTokenState(null); setPeople([]); setSessions([]); setView("people");
  }

  const STYLES = `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Lora:ital@0;1&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#100e0b;color:#e8dcc8;overflow-x:hidden}
    @keyframes pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}
    @keyframes riseIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
    ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(201,169,110,.18);border-radius:2px}
    input:-webkit-autofill{-webkit-box-shadow:0 0 0 100px #16120e inset;-webkit-text-fill-color:#e8dcc8}
  `;

  return (
    <>
      <style>{STYLES}</style>
      <div style={{ minHeight: "100vh", background: "#100e0b", position: "relative" }}>
        <ParticleBackground />
        {!user && <LoginScreen onLogin={handleLogin} />}
        {user && !onboarded && <Onboarding onDone={finishOnboarding} />}
        {user && onboarded && loadingData && <div style={{ position: "relative", zIndex: 1, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ textAlign: "center" }}><Spinner /><p style={{ fontFamily: "'Lora',serif", fontSize: 13, color: "#5a4e3e", marginTop: 8 }}>Carregando...</p></div></div>}
        {user && onboarded && !loadingData && (
          <>
            {view === "people" && <PeopleView people={people} user={user} onSelect={p => { setSelectedPerson(p); setView("person"); }} onAdd={addPerson} onLogout={handleLogout} onDeleteAccount={handleDeleteAccount} />}
            {view === "person" && selectedPerson && <PersonView person={selectedPerson} sessions={sessions.filter(s => s.person_id === selectedPerson.id)} onBack={() => setView("people")} onStartSession={() => setView("moment")} onOpenSession={s => { setActiveSession(s); setView("session"); }} onDelete={() => deletePerson(selectedPerson)} />}
            {view === "moment" && selectedPerson && <MomentSelect person={selectedPerson} onSelect={startNewSession} onBack={() => setView("person")} />}
            {view === "session" && activeSession && selectedPerson && <SessionView session={activeSession} person={selectedPerson} allSessions={sessions} token={token} onBack={() => setView("person")} onSave={saveSessionLocal} onClose={() => setView("closing")} />}
            {view === "closing" && activeSession && selectedPerson && <SessionClosing session={activeSession} person={selectedPerson} token={token} onBack={() => setView("session")} onDone={() => setView("person")} onSave={saveSessionLocal} />}
          </>
        )}
      </div>
    </>
  );
}
